/**
 * UNDP Intervention Mapping stressor layer — clustered points by Type of Activity.
 */

import { loadPointLayer } from './vector_layers.js';

export const INTERVENTION_MAPPING_LAYER_ID = 'interventionMappingLayer';
export const INTERVENTION_ACTIVITY_FIELD = 'Type of Activity';
export const INTERVENTION_STATUS_FIELD = 'Project Status';
export const INTERVENTION_ONGOING_STATUS = 'Ongoing';
export const INTERVENTION_GEOJSON_URL = 'data/LB_Intervention_Mapping.geojson';

export const INTERVENTION_MAPPING_DESCRIPTION =
    'This layer maps ongoing UNDP activities across Lebanon by location and type of intervention. Projects are grouped into clusters based on geographic proximity, with each cluster showing the number and breakdown of nearby activities. Click a cluster and zoom in to explore individual project locations and details. This layer is considered a “Live Layer”, which will be updated as soon as UNDP Projects and Programmes provide updates on activities.';

export const INTERVENTION_MAPPING_DESCRIPTION_HTML = `
    <div class="layer-description-block">
        <p>${INTERVENTION_MAPPING_DESCRIPTION}</p>
    </div>
`;

/** Stable palette + short codes for map markers / legend. */
export const INTERVENTION_ACTIVITY_STYLES = [
    { match: 'Environmental works', label: 'Environmental works', color: '#2e7d32', code: 'EN' },
    { match: 'Peacebuilding & social cohesion', label: 'Peacebuilding & social cohesion', color: '#6a1b9a', code: 'PB' },
    { match: 'Renewable energy & energy efficiency', label: 'Renewable energy & energy efficiency', color: '#f9a825', code: 'RE' },
    { match: 'Municipal infrastructure', label: 'Municipal infrastructure', color: '#1565c0', code: 'MI' },
    { match: 'Nature reserves & biodiversity', label: 'Nature reserves & biodiversity', color: '#00897b', code: 'NR' },
    { match: 'Solid waste management', label: 'Solid waste management', color: '#5d4037', code: 'SW' },
    { match: 'Security infrastructure', label: 'Security infrastructure', color: '#c62828', code: 'SE' },
    { match: 'Livelihoods, agriculture & MSME support', label: 'Livelihoods, agriculture & MSME support', color: '#ef6c00', code: 'LV' },
    { match: 'Water & irrigation infrastructure', label: 'Water & irrigation infrastructure', color: '#0277bd', code: 'WA' },
    { match: 'Food security', label: 'Food security', color: '#ad1457', code: 'FS' },
    {
        match: 'Equipment and training for state institutions',
        label: 'Equipment and training for state institutions',
        color: '#4527a0',
        code: 'EQ'
    }
];

const UNSPECIFIED_STYLE = {
    match: '',
    label: 'Unspecified',
    color: '#90a4ae',
    code: '?'
};

const POPUP_SECTIONS = [
    {
        id: 'overview',
        title: 'Overview',
        fields: [
            'Full Activity Name',
            'Activity Description',
            'Programme',
            'Project ID (Quantum)',
            'Mother Project Name',
            'Mother Project?'
        ]
    },
    {
        id: 'location',
        title: 'Location',
        fields: [
            'Governorate',
            'District',
            'Cadaster',
            'Municipality Name',
            'Union of Municipalities (UoM)',
            'Geographic Level'
        ]
    },
    {
        id: 'timeline',
        title: 'Timeline & status',
        fields: ['Project Status', 'Start Date', 'End Date']
    },
    {
        id: 'partners',
        title: 'Partners & focal point',
        fields: [
            'Counterpart Type',
            'National Counterpart\n(Institutional Title)',
            'UNDP Focal Point',
            'Gender Marker'
        ]
    },
    {
        id: 'framework',
        title: 'Results framework',
        fields: [
            'CPD Output No.',
            'Output / Activity No.\n(per ProDoc results framework)',
            'Strategic Plan 2026-2029\nActivity / Output No.',
            'Remarks / Notes'
        ]
    }
];

const HEADER_SKIP_FIELDS = new Set([
    'Project Name',
    'Type of Activity',
    'REF',
    'Coordinates (Lat)',
    'Coordinates (Long)'
]);

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeActivityType(value) {
    const text = String(value ?? '').trim();
    return text || '';
}

export function getInterventionActivityStyle(activityType) {
    const normalized = normalizeActivityType(activityType);
    if (!normalized) return UNSPECIFIED_STYLE;
    const found = INTERVENTION_ACTIVITY_STYLES.find(
        entry => entry.match.toLowerCase() === normalized.toLowerCase()
    );
    if (found) return found;
    return {
        match: normalized,
        label: normalized,
        color: '#546e7a',
        code: normalized.slice(0, 2).toUpperCase() || '?'
    };
}

function isBlankValue(value) {
    if (value === null || value === undefined) return true;
    const text = String(value).trim();
    if (!text) return true;
    const lower = text.toLowerCase();
    return lower === 'null' || lower === 'nan' || lower === 'n/a' || lower === 'na';
}

function formatPopupLabel(key) {
    return String(key)
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function formatPopupValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
    }
    return String(value).trim();
}

function getProp(properties, key) {
    if (!Object.prototype.hasOwnProperty.call(properties, key)) return null;
    const value = properties[key];
    if (isBlankValue(value)) return null;
    return formatPopupValue(value);
}

function renderPopupFieldRows(properties, fieldKeys, usedKeys) {
    return fieldKeys
        .map(key => {
            const value = getProp(properties, key);
            if (value === null) return '';
            usedKeys.add(key);
            return `
                <div class="intervention-popup-field">
                    <div class="intervention-popup-field-label">${escapeHtml(formatPopupLabel(key))}</div>
                    <div class="intervention-popup-field-value">${escapeHtml(value)}</div>
                </div>
            `;
        })
        .filter(Boolean)
        .join('');
}

function renderPopupSection(title, bodyHtml) {
    if (!bodyHtml) return '';
    return `
        <section class="intervention-popup-section">
            <h5 class="intervention-popup-section-title">${escapeHtml(title)}</h5>
            <div class="intervention-popup-fields">${bodyHtml}</div>
        </section>
    `;
}

export function buildInterventionPopupContent(properties = {}) {
    const activityStyle = getInterventionActivityStyle(properties[INTERVENTION_ACTIVITY_FIELD]);
    const title =
        getProp(properties, 'Project Name') ||
        getProp(properties, 'Full Activity Name') ||
        activityStyle.label ||
        'Intervention project';
    const subtitle = getProp(properties, 'Full Activity Name');
    const showSubtitle = subtitle && subtitle !== title;

    const status = getProp(properties, 'Project Status');
    const programme = getProp(properties, 'Programme');
    const locationParts = ['Governorate', 'District', 'Cadaster', 'Municipality Name']
        .map(key => getProp(properties, key))
        .filter(Boolean);
    const location = locationParts.length ? [...new Set(locationParts)].join(' · ') : null;
    const dates = [getProp(properties, 'Start Date'), getProp(properties, 'End Date')]
        .filter(Boolean)
        .join(' → ');

    const usedKeys = new Set(HEADER_SKIP_FIELDS);
    if (showSubtitle) {
        usedKeys.add('Full Activity Name');
    }

    const sectionsHtml = POPUP_SECTIONS.map(section => {
        const body = renderPopupFieldRows(properties, section.fields, usedKeys);
        return renderPopupSection(section.title, body);
    }).join('');

    const remainingKeys = Object.keys(properties)
        .filter(key => !usedKeys.has(key) && !HEADER_SKIP_FIELDS.has(key))
        .sort((a, b) => a.localeCompare(b));
    const otherHtml = renderPopupFieldRows(properties, remainingKeys, usedKeys);
    const otherSection = renderPopupSection('Additional details', otherHtml);

    const chips = [
        status
            ? `<span class="intervention-popup-chip intervention-popup-chip-status">${escapeHtml(status)}</span>`
            : '',
        programme
            ? `<span class="intervention-popup-chip">${escapeHtml(programme)}</span>`
            : '',
        location
            ? `<span class="intervention-popup-chip">${escapeHtml(location)}</span>`
            : '',
        dates ? `<span class="intervention-popup-chip">${escapeHtml(dates)}</span>` : ''
    ]
        .filter(Boolean)
        .join('');

    return `
        <div class="intervention-popup-content">
            <header class="intervention-popup-header" style="--intervention-accent:${escapeHtml(activityStyle.color)}">
                <div class="intervention-popup-badge">
                    <span class="intervention-popup-badge-code">${escapeHtml(activityStyle.code)}</span>
                    <span class="intervention-popup-badge-label">${escapeHtml(activityStyle.label)}</span>
                </div>
                <h4 class="intervention-popup-title">${escapeHtml(title)}</h4>
                ${
                    showSubtitle
                        ? `<p class="intervention-popup-subtitle">${escapeHtml(subtitle)}</p>`
                        : ''
                }
                ${chips ? `<div class="intervention-popup-chips">${chips}</div>` : ''}
            </header>
            <div class="intervention-popup-body">
                ${sectionsHtml}
                ${otherSection}
            </div>
        </div>
    `;
}

export function createInterventionMarker(feature, latlng) {
    const style = getInterventionActivityStyle(feature?.properties?.[INTERVENTION_ACTIVITY_FIELD]);
    const icon = L.divIcon({
        className: 'intervention-marker-wrapper',
        html: `
            <div class="intervention-marker" style="background:${style.color};" title="${escapeHtml(style.label)}">
                <span>${escapeHtml(style.code)}</span>
            </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
    });
    return L.marker(latlng, { icon, keyboard: true });
}

export function createInterventionClusterIcon(cluster) {
    const count = cluster.getChildCount();
    const children = cluster.getAllChildMarkers() || [];
    const colorCounts = new Map();
    children.forEach(marker => {
        const style = getInterventionActivityStyle(
            marker?.feature?.properties?.[INTERVENTION_ACTIVITY_FIELD]
        );
        colorCounts.set(style.color, (colorCounts.get(style.color) || 0) + 1);
    });

    let dominantColor = '#455a64';
    let dominantCount = -1;
    colorCounts.forEach((value, color) => {
        if (value > dominantCount) {
            dominantCount = value;
            dominantColor = color;
        }
    });

    const size = count < 10 ? 36 : count < 50 ? 44 : 52;
    return L.divIcon({
        className: 'intervention-cluster-wrapper',
        html: `
            <div class="intervention-cluster-marker" style="width:${size}px;height:${size}px;background:${dominantColor};">
                <span class="intervention-cluster-count">${count}</span>
            </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });
}

function interventionTooltip(feature, layer) {
    const props = feature?.properties || {};
    const activity = normalizeActivityType(props[INTERVENTION_ACTIVITY_FIELD]) || 'Unspecified';
    const name = props['Project Name'] || props['Full Activity Name'] || activity;
    layer.bindTooltip(`${name}<br><em>${activity}</em>`, {
        permanent: false,
        direction: 'top',
        sticky: true,
        opacity: 0.95
    });
    layer.bindPopup(buildInterventionPopupContent(props), {
        maxWidth: 400,
        minWidth: 280,
        className: 'intervention-popup'
    });
}

export function buildInterventionClusterSummaryHtml(cluster) {
    const children = cluster.getAllChildMarkers?.() || [];
    const counts = new Map();
    children.forEach(marker => {
        const style = getInterventionActivityStyle(
            marker?.feature?.properties?.[INTERVENTION_ACTIVITY_FIELD]
        );
        const prev = counts.get(style.label) || { label: style.label, color: style.color, n: 0 };
        prev.n += 1;
        counts.set(style.label, prev);
    });

    const ranked = Array.from(counts.values()).sort((a, b) => b.n - a.n);
    const maxRows = 8;
    const shown = ranked.slice(0, maxRows);
    const extra = ranked.length - shown.length;
    const total = children.length;
    const maxCount = Math.max(1, ...shown.map(item => item.n));

    const rows = shown
        .map(item => {
            const width = Math.round((item.n / maxCount) * 100);
            const share = Math.round((item.n / total) * 100);
            return `
            <li>
                <span class="intervention-cluster-swatch" style="background:${escapeHtml(item.color)}"></span>
                <div class="intervention-cluster-cat-wrap">
                    <div class="intervention-cluster-cat">${escapeHtml(item.label)}</div>
                    <div class="intervention-cluster-bar-track">
                        <div class="intervention-cluster-bar-fill" style="width:${width}%;background:${escapeHtml(item.color)}"></div>
                    </div>
                </div>
                <div class="intervention-cluster-cat-count">
                    <strong>${item.n}</strong>
                    <span>${share}%</span>
                </div>
            </li>`;
        })
        .join('');

    return `
        <div class="intervention-cluster-popup">
            <header class="intervention-popup-header intervention-cluster-header">
                <div class="intervention-popup-badge intervention-popup-badge-neutral">
                    <span class="intervention-popup-badge-code">${total}</span>
                    <span class="intervention-popup-badge-label">projects nearby</span>
                </div>
                <h4 class="intervention-popup-title">Cluster summary</h4>
                <p class="intervention-popup-subtitle">Breakdown by Type of Activity</p>
            </header>
            <ul class="intervention-cluster-list">${rows}</ul>
            ${
                extra > 0
                    ? `<p class="intervention-cluster-hint">+${extra} more categor${extra === 1 ? 'y' : 'ies'}</p>`
                    : ''
            }
            <p class="intervention-cluster-hint">Zoom in to open individual project details.</p>
        </div>
    `;
}

export function getInterventionLegendConfig() {
    const hiddenLegendLabels = new Set(['tbd', 'unspecified']);
    return {
        layerName: 'UNDP Intervention Mapping',
        type: 'categorical',
        description: INTERVENTION_MAPPING_DESCRIPTION,
        items: INTERVENTION_ACTIVITY_STYLES
            .filter(entry => !hiddenLegendLabels.has(String(entry.label || '').trim().toLowerCase()))
            .map(entry => ({
                label: entry.label,
                color: entry.color
            }))
    };
}

function isOngoingProject(properties = {}) {
    const status = String(properties[INTERVENTION_STATUS_FIELD] ?? '').trim().toLowerCase();
    return status === INTERVENTION_ONGOING_STATUS.toLowerCase();
}

function filterPointFeatures(geojson) {
    const features = (geojson?.features || []).filter(feature => {
        if (!isOngoingProject(feature?.properties)) return false;
        const geom = feature?.geometry;
        if (!geom || geom.type !== 'Point') return false;
        const coords = geom.coordinates;
        return (
            Array.isArray(coords) &&
            coords.length >= 2 &&
            Number.isFinite(Number(coords[0])) &&
            Number.isFinite(Number(coords[1]))
        );
    });
    return {
        type: 'FeatureCollection',
        features
    };
}

export function getInterventionClusterOptions() {
    return {
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        zoomToBoundsOnClick: false,
        disableClusteringAtZoom: 14,
        maxClusterRadius: 55,
        iconCreateFunction: createInterventionClusterIcon
    };
}

/**
 * Load clustered intervention points onto the map.
 */
export async function loadInterventionMappingLayer(map, layers, addLegendEntry) {
    const response = await fetch(INTERVENTION_GEOJSON_URL);
    if (!response.ok) {
        throw new Error(`Failed to load intervention mapping (${response.status})`);
    }
    const raw = await response.json();
    const data = filterPointFeatures(raw);

    if (layers.point[INTERVENTION_MAPPING_LAYER_ID]) {
        map.removeLayer(layers.point[INTERVENTION_MAPPING_LAYER_ID]);
        delete layers.point[INTERVENTION_MAPPING_LAYER_ID];
    }

    const clusterLayer = await loadPointLayer(INTERVENTION_GEOJSON_URL, {
        data,
        pointToLayer: createInterventionMarker,
        tooltipFunction: interventionTooltip,
        clusterOptions: getInterventionClusterOptions()
    });

    clusterLayer.on('clusterclick', event => {
        // Keep the map from zooming into the cluster; only show the summary popup.
        if (event.originalEvent) {
            L.DomEvent.stop(event.originalEvent);
        }
        const cluster = event.layer;
        if (!cluster?.getAllChildMarkers) return;
        const html = buildInterventionClusterSummaryHtml(cluster);
        const popup = L.popup({
            maxWidth: 340,
            minWidth: 260,
            closeButton: true,
            className: 'intervention-popup intervention-cluster-summary-popup'
        })
            .setLatLng(event.latlng)
            .setContent(html);

        popup.openOn(map);
    });

    layers.point[INTERVENTION_MAPPING_LAYER_ID] = clusterLayer;
    clusterLayer.addTo(map);
    addLegendEntry?.(INTERVENTION_MAPPING_LAYER_ID, getInterventionLegendConfig());

    if (window.currentInfoPanel) {
        window.currentInfoPanel.updateLayer(INTERVENTION_MAPPING_LAYER_ID, {
            layer: clusterLayer,
            featureCount: data.features.length,
            selectedAttribute: INTERVENTION_ACTIVITY_FIELD
        });
    }

    return clusterLayer;
}
