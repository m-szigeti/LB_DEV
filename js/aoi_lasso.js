import {
    addAnalysisSelectionFeatures,
    isAnalysisSelectionActive,
    setAnalysisSelectionActive
} from './analysis_selection.js';
import { hideInfoPopup } from './info_popup.js';

let lassoActive = false;
let drawing = false;
let latlngs = [];
let rubber = null;
let onChanged = null;

function outerRings(geometry) {
    if (!geometry) return [];
    if (geometry.type === 'Polygon') {
        return geometry.coordinates?.[0] ? [geometry.coordinates[0]] : [];
    }
    if (geometry.type === 'MultiPolygon') {
        return (geometry.coordinates || []).map(polygon => polygon?.[0]).filter(ring => ring?.length);
    }
    return [];
}

function pointInRing(lat, lng, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0];
        const yi = ring[i][1];
        const xj = ring[j][0];
        const yj = ring[j][1];
        const intersects = (yi > lat) !== (yj > lat)
            && lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi;
        if (intersects) inside = !inside;
    }
    return inside;
}

function boundsOverlap(ring, lassoLngLat) {
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    ring.forEach(([lng, lat]) => {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
    });
    let lMinLng = Infinity;
    let lMaxLng = -Infinity;
    let lMinLat = Infinity;
    let lMaxLat = -Infinity;
    lassoLngLat.forEach(([lng, lat]) => {
        if (lng < lMinLng) lMinLng = lng;
        if (lng > lMaxLng) lMaxLng = lng;
        if (lat < lMinLat) lMinLat = lat;
        if (lat > lMaxLat) lMaxLat = lat;
    });
    return !(maxLng < lMinLng || minLng > lMaxLng || maxLat < lMinLat || minLat > lMaxLat);
}

function segmentsCross(a, b, c, d) {
    const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const d1 = cross(c, d, a);
    const d2 = cross(c, d, b);
    const d3 = cross(a, b, c);
    const d4 = cross(a, b, d);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function ringTouchesLasso(ring, lassoLngLat) {
    if (!boundsOverlap(ring, lassoLngLat)) return false;
    if (ring.some(([lng, lat]) => pointInRing(lat, lng, lassoLngLat))) return true;
    if (lassoLngLat.some(([lng, lat]) => pointInRing(lat, lng, ring))) return true;
    for (let i = 0; i < ring.length; i += 1) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        for (let j = 0; j < lassoLngLat.length; j += 1) {
            const c = lassoLngLat[j];
            const d = lassoLngLat[(j + 1) % lassoLngLat.length];
            if (segmentsCross(a, b, c, d)) return true;
        }
    }
    return false;
}

function geometryHitsLasso(geometry, lasso) {
    const rings = outerRings(geometry);
    const lassoLngLat = lasso.map(point => [point.lng, point.lat]);
    if (!rings.length || lassoLngLat.length < 3) return false;
    return rings.some(ring => ringTouchesLasso(ring, lassoLngLat));
}

function featureHitsLasso(featureLayer, lasso) {
    const geometry = featureLayer?.feature?.geometry;
    if (geometry && geometryHitsLasso(geometry, lasso)) return true;
    const latlng = typeof featureLayer.getLatLng === 'function' ? featureLayer.getLatLng() : null;
    if (!latlng) return false;
    return pointInRing(latlng.lat, latlng.lng, lasso.map(point => [point.lng, point.lat]));
}

function visitFeatureLayers(layer, visit) {
    if (!layer) return;
    if (layer.feature) visit(layer);
    if (typeof layer.eachLayer === 'function') {
        layer.eachLayer(child => visitFeatureLayers(child, visit));
    }
}

function collectLassoHits(lasso) {
    const map = window.map;
    const vector = window.mapLayers?.vector || {};
    const entries = [];
    Object.entries(vector).forEach(([layerId, entry]) => {
        const layer = entry?.leafletLayer || entry;
        if (!map || !layer || typeof map.hasLayer !== 'function' || !map.hasLayer(layer)) return;
        visitFeatureLayers(layer, featureLayer => {
            const properties = featureLayer?.feature?.properties;
            if (!properties || !featureHitsLasso(featureLayer, lasso)) return;
            entries.push({ featureLayer, properties, layerId });
        });
    });
    return entries;
}

function clearRubber() {
    const map = window.map;
    if (rubber && map) map.removeLayer(rubber);
    rubber = null;
    latlngs = [];
    drawing = false;
}

function syncLassoButton() {
    const button = document.getElementById('map-aoi-lasso-btn');
    if (!button) return;
    button.setAttribute('aria-pressed', lassoActive ? 'true' : 'false');
    button.classList.toggle('is-active', lassoActive);
    button.textContent = lassoActive ? 'Stop Lasso' : 'Lasso';
}

function setMapDrag(enabled) {
    const map = window.map;
    if (!map?.dragging) return;
    if (enabled) map.dragging.enable();
    else map.dragging.disable();
}

function onMouseMove(event) {
    if (!drawing || !event?.latlng) return;
    latlngs.push(event.latlng);
    if (latlngs.length >= 2) rubber?.setLatLngs(latlngs);
}

function onMouseUp() {
    const map = window.map;
    map?.off('mousemove', onMouseMove);
    map?.off('mouseup', onMouseUp);
    document.removeEventListener('mouseup', onMouseUp);
    if (!drawing) return;
    const path = latlngs.slice();
    clearRubber();
    if (path.length >= 3) {
        addAnalysisSelectionFeatures(collectLassoHits(path));
        window.currentInfoPanel?.updateAnalysisAreaSelection?.();
        if (typeof onChanged === 'function') onChanged();
    }
}

function onMouseDown(event) {
    const map = window.map;
    if (!lassoActive || !map || !event?.latlng) return;
    if (event.originalEvent) {
        event.originalEvent.preventDefault();
        event.originalEvent.stopPropagation();
    }
    clearRubber();
    drawing = true;
    latlngs = [event.latlng];
    rubber = L.polygon(latlngs, {
        color: '#2596be',
        weight: 2,
        fillColor: '#2596be',
        fillOpacity: 0.18,
        interactive: false,
        dashArray: '5 4'
    }).addTo(map);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);
    document.addEventListener('mouseup', onMouseUp);
}

export function stopAoiLasso() {
    const map = window.map;
    lassoActive = false;
    map?.off('mousedown', onMouseDown);
    map?.off('mousemove', onMouseMove);
    map?.off('mouseup', onMouseUp);
    document.removeEventListener('mouseup', onMouseUp);
    clearRubber();
    setMapDrag(true);
    document.body.classList.remove('aoi-lasso-mode');
    syncLassoButton();
}

export function startAoiLasso() {
    const map = window.map;
    if (!map) return;
    if (!isAnalysisSelectionActive()) {
        setAnalysisSelectionActive(true);
        hideInfoPopup();
        window.currentInfoPanel?.setActiveTab?.('analysis');
        window.currentInfoPanel?.updateAnalysisAreaSelection?.();
    }
    lassoActive = true;
    document.body.classList.add('aoi-lasso-mode');
    setMapDrag(false);
    map.on('mousedown', onMouseDown);
    syncLassoButton();
}

export function initAoiLasso({ onSelectionChanged } = {}) {
    onChanged = onSelectionChanged;
    const button = document.getElementById('map-aoi-lasso-btn');
    button?.addEventListener('click', () => {
        if (lassoActive) stopAoiLasso();
        else startAoiLasso();
    });
    document.addEventListener('analysis-selection-change', event => {
        if (!event.detail?.active && lassoActive) stopAoiLasso();
    });
    syncLassoButton();
}
