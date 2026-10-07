/**
 * AOI Analysis-panel UI — render summary HTML and bind export / custom-index actions.
 */

import {
    buildAoiCsv,
    formatAoiNumber,
    formatAoiPercent
} from './aoi_summary.js';
import {
    buildAoiSummaries,
    buildGlobalThemeSpiderBundle,
    buildIndicatorSummaries,
    buildScopedLayerSummaries,
    getActiveResolutionFromProviders,
    getAoiProviders
} from './aoi_context.js';
import {
    clearAnalysisSelection,
    clearAnalysisSelectionHover,
    getActiveAdminResolutionLabel,
    getAnalysisSelectionCount,
    getAnalysisSelectionItems,
    highlightAnalysisSelectionItem,
    isAnalysisSelectionActive,
    setAnalysisSelectionActive
} from './analysis_selection.js';
import { forceAoiStyleRecovery } from './aoi_spotlight.js';
import {
    CUSTOM_OVERALL_BUILDER_ENABLED,
    openCustomOverallBuilderForAoi
} from './custom_overall_builder.js';
import {
    buildThemeSpiderModel,
    generateThemeSpiderHtml,
    paintThemeSpiderCharts
} from './theme_spider.js';
import { isDarkTheme } from './theme_mode.js';
import { CUSTOM_OVERALL_THEMES, themesForResolution } from './custom_overall_catalog.js';
import { legendMarkup, legendTitleFor } from './legend.js';

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function downloadTextFile(filename, text, mime = 'text/plain;charset=utf-8') {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

const PDF_EXPORT_WIDTH = 760;
const PDF_EXPORT_PAD = 16;
const MAP_EXPORT_MAX_HEIGHT = 560;
const THEME_EXPORT_LAYER_IDS = new Set([
    ...CUSTOM_OVERALL_THEMES.map(theme => theme.layerId),
    'svOverallTensionLayer',
    'svCustomOverallLayer'
]);
const ADMIN_LABEL_LEVELS = [
    { url: 'data/ADM1_POP.geojson', field: 'ADM1_NAME', size: 12, weight: '700' },
    { url: 'data/ADM2_POP.geojson', field: 'ADM2_NAME', size: 8, weight: '600' }
];
const adminLabelCache = new Map();

function waitForExportImages(root) {
    const images = [...root.querySelectorAll('img')];
    return Promise.all(
        images.map(
            img =>
                new Promise(resolve => {
                    if (img.complete && img.naturalWidth) {
                        resolve();
                        return;
                    }
                    img.addEventListener('load', () => resolve(), { once: true });
                    img.addEventListener('error', () => resolve(), { once: true });
                })
        )
    );
}

function exportThemeColors() {
    if (isDarkTheme()) {
        return { background: '#09111b', text: '#e8eef4' };
    }
    return { background: '#ffffff', text: '#212529' };
}

function hexToRgb(hex) {
    const value = String(hex || '').replace('#', '');
    return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16)
    };
}

/** Largest frame that keeps the source aspect ratio inside the max box. */
function fitFrame(srcWidth, srcHeight, maxWidth, maxHeight) {
    const aspect = srcWidth / srcHeight;
    let width = maxWidth;
    let height = width / aspect;
    if (height > maxHeight) {
        height = maxHeight;
        width = height * aspect;
    }
    return {
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height))
    };
}

/**
 * Pack blocks from the top of the page. A block that does not fit in the
 * space left on the page moves wholly to the next page. A block taller than
 * one page is scaled down so it still stays on a single page.
 * @param {HTMLElement[]} blocks
 * @param {string} filename
 */
async function savePdfBlocks(blocks, filename) {
    if (typeof html2canvas !== 'function') {
        throw new Error('html2canvas is not available.');
    }
    const jsPdfNamespace = window.jspdf;
    if (!jsPdfNamespace?.jsPDF) {
        throw new Error('jsPDF is not available.');
    }
    const pages = (blocks || []).filter(Boolean);
    if (!pages.length) {
        throw new Error('Nothing to export.');
    }

    const colors = exportThemeColors();
    const { jsPDF } = jsPdfNamespace;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const blockGap = 3;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;
    const rgb = hexToRgb(colors.background);
    const paintPage = () => {
        pdf.setFillColor(rgb.r, rgb.g, rgb.b);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    };
    let cursorY = margin;
    let pageStarted = false;
    const startPage = () => {
        if (pageStarted) pdf.addPage();
        paintPage();
        pageStarted = true;
        cursorY = margin;
    };

    for (let index = 0; index < pages.length; index += 1) {
        const block = pages[index];
        block.style.cssText = [
            'position: fixed',
            'left: -10000px',
            'top: 0',
            `width: ${PDF_EXPORT_WIDTH}px`,
            `background: ${colors.background}`,
            `color: ${colors.text}`,
            `padding: ${PDF_EXPORT_PAD}px`,
            'box-sizing: border-box',
            'z-index: -1'
        ].join(';');
        document.body.appendChild(block);
        try {
            paintThemeSpiderCharts(block);
            await waitForExportImages(block);
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const canvas = await html2canvas(block, {
                scale: 2,
                useCORS: true,
                allowTaint: false,
                backgroundColor: colors.background,
                width: block.scrollWidth,
                height: block.scrollHeight,
                onclone(doc) {
                    doc.documentElement.classList.toggle('theme-dark', isDarkTheme());
                }
            });
            let drawWidth = usableWidth;
            let drawHeight = (canvas.height * drawWidth) / canvas.width;
            if (drawHeight > usableHeight) {
                drawHeight = usableHeight;
                drawWidth = (canvas.width * drawHeight) / canvas.height;
            }
            const roomLeft = pageHeight - margin - cursorY;
            if (!pageStarted || (cursorY > margin + 0.5 && drawHeight > roomLeft)) {
                startPage();
            }
            const x = margin + (usableWidth - drawWidth) / 2;
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, cursorY, drawWidth, drawHeight);
            cursorY += drawHeight + blockGap;
        } finally {
            block.remove();
        }
    }

    pdf.save(filename);
}

function loadCorsImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('image'));
        image.src = src;
    });
}

function elementBox(el, origin) {
    const rect = el.getBoundingClientRect();
    return {
        x: rect.left - origin.left,
        y: rect.top - origin.top,
        w: rect.width,
        h: rect.height
    };
}

function paneZIndex(el) {
    const pane = el.closest?.('.leaflet-pane');
    const z = pane ? parseInt(window.getComputedStyle(pane).zIndex, 10) : 0;
    return Number.isFinite(z) ? z : 0;
}

async function rasterizeSvg(svg) {
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.removeAttribute('style');
    clone.removeAttribute('class');
    const width = svg.width?.baseVal?.value || svg.getBoundingClientRect().width;
    const height = svg.height?.baseVal?.value || svg.getBoundingClientRect().height;
    if (!width || !height) return null;
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    clone.setAttribute('preserveAspectRatio', 'xMinYMin meet');
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
        type: 'image/svg+xml;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    try {
        return await loadCorsImage(url);
    } finally {
        URL.revokeObjectURL(url);
    }
}

/**
 * Capture the current map view without stretching the choropleth.
 * Overlays are painted into their on-screen boxes so they stay aligned
 * with the basemap; the returned pixel size is the map's real aspect ratio.
 * @returns {Promise<{ dataUrl: string, width: number, height: number } | null>}
 */
async function captureLeafletMap() {
    const map = window.map;
    const container = map?.getContainer?.();
    if (!map || !container) return null;
    const mapRect = container.getBoundingClientRect();
    const width = mapRect.width;
    const height = mapRect.height;
    if (!width || !height) return null;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = isDarkTheme() ? '#09111b' : '#dbe3ea';
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();

    const tiles = container.querySelectorAll('.leaflet-tile-pane img');
    for (const tile of tiles) {
        const src = tile.currentSrc || tile.src;
        if (!src) continue;
        const box = elementBox(tile, mapRect);
        if (box.w < 1 || box.h < 1) continue;
        try {
            const image = await loadCorsImage(src);
            ctx.drawImage(image, box.x, box.y, box.w, box.h);
        } catch (error) {
            /* skip tiles that block cross-origin capture */
        }
    }

    const vectors = [...container.querySelectorAll('.leaflet-map-pane svg, .leaflet-map-pane canvas')]
        .filter(el => !el.closest('.leaflet-tile-pane'))
        .sort((a, b) => paneZIndex(a) - paneZIndex(b));

    for (const el of vectors) {
        const box = elementBox(el, mapRect);
        if (box.w < 1 || box.h < 1) continue;
        try {
            if (el.tagName.toLowerCase() === 'canvas') {
                if (!el.width || !el.height) continue;
                ctx.drawImage(el, box.x, box.y, box.w, box.h);
            } else {
                const image = await rasterizeSvg(el);
                if (!image) continue;
                ctx.drawImage(image, box.x, box.y, box.w, box.h);
            }
        } catch (error) {
            /* overlay is optional if this layer cannot be painted */
        }
    }

    await drawAdminNameLabels(ctx, map, width, height);
    ctx.restore();
    try {
        return {
            dataUrl: canvas.toDataURL('image/png'),
            width: canvas.width / dpr,
            height: canvas.height / dpr
        };
    } catch (error) {
        console.warn('Map capture was blocked by cross-origin imagery.', error);
        return null;
    }
}

const LEBANON_FALLBACK_BOUNDS = [[33.047, 35.094], [34.692, 36.625]];

function countryBounds(map) {
    const leaflet = window.L;
    if (!leaflet || !map) return null;
    let bounds = null;
    const extend = layer => {
        if (!layer || typeof layer.getBounds !== 'function') return;
        let next = null;
        try {
            next = layer.getBounds();
        } catch (error) {
            return;
        }
        if (!next || typeof next.isValid !== 'function' || !next.isValid()) return;
        bounds = bounds ? bounds.extend(next) : leaflet.latLngBounds(next.getSouthWest(), next.getNorthEast());
    };
    const vectors = window.mapLayers?.vector || {};
    Object.values(vectors).forEach(layer => {
        extend(layer);
        extend(layer?._svChoroplethFillLayer);
        extend(layer?._svVisualOutlineLayer);
        extend(layer?._svAdminOutlineLayer);
    });
    if (!bounds) bounds = leaflet.latLngBounds(LEBANON_FALLBACK_BOUNDS);
    return bounds;
}

function waitForMapTiles(container, timeout = 1400) {
    const start = Date.now();
    return new Promise(resolve => {
        const tick = () => {
            const tiles = [...container.querySelectorAll('.leaflet-tile-pane img')];
            const pending = tiles.some(img => img.src && !img.complete);
            if (!pending || Date.now() - start >= timeout) {
                resolve();
                return;
            }
            window.setTimeout(tick, 80);
        };
        tick();
    });
}

function featureLabelLatLng(geometry) {
    const polygons = geometry?.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry?.type === 'MultiPolygon'
            ? geometry.coordinates
            : [];
    let best = null;
    let bestArea = -1;
    polygons.forEach(poly => {
        const ring = poly?.[0];
        if (!ring?.length) return;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        ring.forEach(point => {
            const x = point?.[0];
            const y = point?.[1];
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        });
        if (!Number.isFinite(minX)) return;
        const area = (maxX - minX) * (maxY - minY);
        if (area > bestArea) {
            bestArea = area;
            best = [(minY + maxY) / 2, (minX + maxX) / 2];
        }
    });
    return best;
}

function loadAdminLabelData(url) {
    if (!adminLabelCache.has(url)) {
        adminLabelCache.set(
            url,
            fetch(url)
                .then(response => (response.ok ? response.json() : null))
                .catch(() => null)
        );
    }
    return adminLabelCache.get(url);
}

async function drawAdminNameLabels(ctx, map, width, height) {
    if (!map || typeof map.latLngToContainerPoint !== 'function') return;
    const dark = isDarkTheme();
    const collections = await Promise.all(ADMIN_LABEL_LEVELS.map(level => loadAdminLabelData(level.url)));
    collections.forEach((collection, index) => {
        const level = ADMIN_LABEL_LEVELS[index];
        const features = collection?.features;
        if (!features?.length) return;
        ctx.font = `${level.weight} ${level.size}px Calibri, "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = dark ? 'rgba(9, 17, 27, 0.88)' : 'rgba(255, 255, 255, 0.92)';
        ctx.fillStyle = dark ? '#f8fafc' : '#0f172a';
        features.forEach(feature => {
            const name = String(feature?.properties?.[level.field] || '').trim();
            const latLng = featureLabelLatLng(feature?.geometry);
            if (!name || !latLng) return;
            const point = map.latLngToContainerPoint(latLng);
            if (point.x < 6 || point.y < 6 || point.x > width - 6 || point.y > height - 6) return;
            ctx.strokeText(name, point.x, point.y);
            ctx.fillText(name, point.x, point.y);
        });
    });
}

const THEME_VISUAL_KEYS = [
    '_svChoroplethFillLayer',
    '_svAdminOutlineLayer',
    '_svCadastreOutlineLayer',
    '_svVisualOutlineLayer',
    '_svHitPolygonLayer',
    '_svDisplacementMarkerLayer',
    '_svServiceClusterLayer',
    '_svServiceMarkerLayer',
    '_svForestFireClusterLayer',
    '_svForestFireMarkerLayer',
    '_svForestFireGridLayer',
    '_svScoreLabelHost',
    '_svSectarianMarkerLayer',
    '_svSubindicatorOverlays',
    '_svDisplacementExtraGroups'
];

function pushThemeHost(candidate, map, out) {
    if (!candidate || out.includes(candidate)) return;
    if (Array.isArray(candidate)) {
        candidate.forEach(item => pushThemeHost(item, map, out));
        return;
    }
    if (typeof candidate.addTo === 'function' && map.hasLayer(candidate)) {
        out.push(candidate);
    }
    if (candidate._svVisualOutlineLayer) {
        pushThemeHost(candidate._svVisualOutlineLayer, map, out);
    }
}

function themeVisualHosts(root, map) {
    const hosts = [];
    if (!root || !map) return hosts;
    pushThemeHost(root, map, hosts);
    THEME_VISUAL_KEYS.forEach(key => pushThemeHost(root[key], map, hosts));
    return hosts;
}

/** Hide every other vector layer, then return a function that puts them back. */
function isolateVectorLayer(keepId) {
    const map = window.map;
    const vectors = window.mapLayers?.vector || {};
    const removed = [];
    if (!map) return () => {};
    Object.entries(vectors).forEach(([id, layer]) => {
        if (!layer || id === keepId) return;
        themeVisualHosts(layer, map).forEach(host => {
            map.removeLayer(host);
            removed.push(host);
        });
    });
    return () => {
        removed.forEach(host => {
            if (!map.hasLayer(host)) host.addTo(map);
        });
    };
}

function activeThemeExportLayers() {
    const infoLayers = Array.from(getAoiProviders()?.getActiveInfoLayers?.() || []);
    return infoLayers
        .filter(layer => layer?.id && THEME_EXPORT_LAYER_IDS.has(layer.id))
        .map(layer => ({
            id: layer.id,
            name: legendTitleFor(layer.id) || layer.name || layer.id
        }));
}

/**
 * Reframe the live map to the whole country, run captures, then restore the view.
 * @param {(map: object) => Promise<void>} capture
 */
async function withCountryFrame(capture) {
    const map = window.map;
    const container = map?.getContainer?.();
    if (!map || !container) {
        await capture(null);
        return;
    }
    const bounds = countryBounds(map);
    map.invalidateSize(false);
    const center = map.getCenter();
    const zoom = map.getZoom();
    try {
        await new Promise(resolve => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                map.off('moveend', finish);
                window.clearTimeout(hardStop);
                resolve();
            };
            const hardStop = window.setTimeout(finish, 900);
            map.once('moveend', finish);
            map.fitBounds(bounds, {
                animate: false,
                paddingTopLeft: [56, 64],
                paddingBottomRight: [56, 64]
            });
        });
        await waitForMapTiles(container);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await capture(map);
    } finally {
        map.setView(center, zoom, { animate: false });
    }
}

function htmlBlock(title, meta, content, { align } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'aoi-pdf-export-root aoi-pdf-block';
    wrap.setAttribute('aria-hidden', 'true');
    if (align) wrap.dataset.exportAlign = align;
    const masthead = document.createElement('div');
    masthead.className = 'aoi-pdf-masthead';
    masthead.innerHTML = `
        <h1 class="aoi-pdf-title">${escapeHtml(title)}</h1>
        ${meta ? `<p class="aoi-pdf-meta">${escapeHtml(meta)}</p>` : ''}
    `;
    wrap.appendChild(masthead);
    const panel = document.createElement('div');
    panel.className = 'aoi-panel';
    if (typeof content === 'string') panel.innerHTML = content;
    else if (content) panel.appendChild(content);
    wrap.appendChild(panel);
    return wrap;
}

function mapExportBlock({ capture, title, intro, meta, legendHtml }) {
    const figure = document.createElement('figure');
    figure.className = 'aoi-pdf-map';
    if (capture?.dataUrl && capture.width > 0 && capture.height > 0) {
        const frame = fitFrame(
            capture.width,
            capture.height,
            PDF_EXPORT_WIDTH - PDF_EXPORT_PAD * 2 - 2,
            MAP_EXPORT_MAX_HEIGHT
        );
        const image = document.createElement('img');
        image.src = capture.dataUrl;
        image.alt = title || 'Map of Lebanon';
        image.width = frame.width;
        image.height = frame.height;
        image.style.width = `${frame.width}px`;
        image.style.height = `${frame.height}px`;
        figure.appendChild(image);
    } else {
        const note = document.createElement('p');
        note.className = 'aoi-footnote';
        note.textContent = 'The map could not be captured.';
        figure.appendChild(note);
    }
    const body = document.createElement('div');
    if (intro) {
        const lead = document.createElement('p');
        lead.className = 'aoi-pdf-intro';
        lead.textContent = intro;
        body.appendChild(lead);
    }
    body.appendChild(figure);
    if (legendHtml) {
        const legendHost = document.createElement('div');
        legendHost.innerHTML = legendHtml;
        if (legendHost.firstElementChild) body.appendChild(legendHost.firstElementChild);
    }
    return htmlBlock(title || 'Map', meta, body);
}

async function buildMapExportBlocks(when, resolutionLabel) {
    const themes = activeThemeExportLayers();
    const names = themes.map(theme => theme.name);
    const meta = `${resolutionLabel} · Whole country · ${when}`;
    const blocks = [];
    const resolutionText = resolutionLabel.toLowerCase();
    await withCountryFrame(async () => {
        const stacked = await captureLeafletMap();
        const stackedTitle = themes.length > 1 ? 'Stacked map' : (names[0] || 'Current view');
        const stackedIntro = themes.length > 1
            ? `Themes turned on together: ${names.join(', ')}. This is the stacked map. Each theme follows on its own. District and governorate names are labeled.`
            : themes.length === 1
                ? `${names[0]} for the whole country at ${resolutionText} resolution. Stronger symbols and higher classes show greater intensity. District and governorate names are labeled.`
                : `The map as it is styled now, framed to the whole country. District and governorate names are labeled.`;
        blocks.push(mapExportBlock({
            capture: stacked,
            title: stackedTitle,
            intro: stackedIntro,
            meta,
            legendHtml: legendMarkup(themes.length ? themes.map(theme => theme.id) : null)
        }));
        if (themes.length < 2) return;
        for (const theme of themes) {
            const restore = isolateVectorLayer(theme.id);
            try {
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                const shot = await captureLeafletMap();
                blocks.push(mapExportBlock({
                    capture: shot,
                    title: theme.name,
                    intro: `${theme.name} on its own, for the whole country at ${resolutionText} resolution. District and governorate names are labeled.`,
                    meta,
                    legendHtml: legendMarkup([theme.id])
                }));
            } finally {
                restore();
            }
        }
    });
    return blocks;
}

function spiderExportBlock(title, meta, bundle, represented) {
    const holder = document.createElement('div');
    holder.innerHTML = renderAoiThemeSpider(bundle, { forExport: true });
    holder.querySelectorAll('.aoi-export-row, .analysis-rankings').forEach(el => el.remove());
    if (represented?.length) {
        const note = document.createElement('p');
        note.className = 'aoi-represented-names';
        note.textContent = represented.join(', ');
        holder.appendChild(note);
    }
    return htmlBlock(title, meta, holder);
}

function summaryExportBlocks(heading, meta, bundle, summaries, contributions, represented) {
    const blocks = [];
    if (bundle?.themeSums?.pillars?.length) {
        blocks.push(spiderExportBlock(heading, meta, bundle, represented));
        const scores = renderExportThemeScores(bundle);
        if (scores) blocks.push(htmlBlock(`${heading} · Theme scores`, meta, scores));
    }
    if (contributions?.pillars?.length) {
        const averages = renderThemeContributions(contributions);
        if (averages) blocks.push(htmlBlock(`${heading} · Theme averages`, meta, averages));
    }
    (summaries || []).forEach(summary => {
        blocks.push(htmlBlock(`${heading} · ${summary.layerName}`, meta, renderLayerSummary(summary)));
    });
    if (!blocks.length) {
        blocks.push(
            htmlBlock(
                heading,
                meta,
                '<p class="aoi-footnote">No scored theme is turned on for this set of units.</p>'
            )
        );
    }
    return blocks;
}

function coverageKey(summary) {
    return `${summary.layerId}::${summary.sourceField || summary.attributeLabel}`;
}

async function buildDataExportBlocks(choice) {
    const blocks = [];
    const when = new Date().toLocaleString();
    const resolutionLabel = getActiveAdminResolutionLabel();
    const covered = new Set();

    if (choice.view) {
        blocks.push(...await buildMapExportBlocks(when, resolutionLabel));
    }

    if (choice.everything) {
        const bundle = await buildGlobalThemeSpiderBundle();
        const summaries = await buildScopedLayerSummaries('all');
        blocks.push(
            ...summaryExportBlocks(
                'All units',
                `${resolutionLabel} · All units · ${when}`,
                bundle,
                summaries,
                null,
                null
            )
        );
        summaries.forEach(summary => covered.add(coverageKey(summary)));
    }

    if (choice.selection) {
        const bundle = await buildAoiSummaries();
        const summaries = bundle.summaries || [];
        blocks.push(
            ...summaryExportBlocks(
                'Current selection',
                `${resolutionLabel} · ${bundle.selectionCount || 0} selected · ${when}`,
                bundle,
                summaries,
                bundle.themeContributions,
                bundle.districtsInSelection
            )
        );
        summaries.forEach(summary => covered.add(coverageKey(summary)));
    }

    const extra = (choice.layers || []).filter(
        request => request?.layerId && request?.field && !covered.has(`${request.layerId}::${request.field}`)
    );
    if (extra.length) {
        const scopes = [];
        if (choice.everything || !choice.selection) scopes.push('all');
        if (choice.selection) scopes.push('selection');
        for (const scope of scopes) {
            const summaries = await buildIndicatorSummaries(extra, scope);
            const scopeLabel = scope === 'selection' ? 'Selection' : 'All units';
            if (!summaries.length) {
                blocks.push(
                    htmlBlock(
                        `${scopeLabel} · Additional layers`,
                        `${resolutionLabel} · ${when}`,
                        '<p class="aoi-footnote">No values were found for the added layers in this set of units.</p>'
                    )
                );
                continue;
            }
            summaries.forEach(summary => {
                blocks.push(
                    htmlBlock(
                        `${scopeLabel} · ${summary.layerName}`,
                        `${resolutionLabel} · ${summary.attributeLabel} · ${when}`,
                        renderLayerSummary(summary)
                    )
                );
            });
        }
    }

    if (!blocks.length) {
        throw new Error('Nothing to export. Choose a view, a set of units, or at least one layer.');
    }
    return blocks;
}

function activeExportLayerIds() {
    const layers = getAoiProviders()?.getActiveInfoLayers?.() || [];
    return new Set(Array.from(layers).map(layer => layer?.id).filter(Boolean));
}

function renderExportLayerPicker() {
    const resolution = getActiveResolutionFromProviders();
    const themes = themesForResolution(resolution);
    const activeIds = activeExportLayerIds();
    if (!themes.length) {
        return '<p class="data-export-note">No themes are available at this resolution.</p>';
    }
    return themes
        .map(theme => {
            const composite = theme.indicators.find(item => item.field === theme.scoreField);
            const compositeLabel = composite?.label || 'Theme score';
            const indicators = theme.indicators.filter(item => item.field !== theme.scoreField);
            const onMap = activeIds.has(theme.layerId);
            const indicatorRows = indicators
                .map(
                    item => `
                        <label class="data-export-indicator">
                            <input type="checkbox" data-export-field data-layer-id="${escapeHtml(theme.layerId)}" data-field="${escapeHtml(item.field)}" data-label="${escapeHtml(item.label)}" data-theme-title="${escapeHtml(theme.title)}">
                            <span>${escapeHtml(item.label)}</span>
                        </label>
                    `
                )
                .join('');
            return `
                <details class="data-export-theme" ${onMap ? 'open' : ''}>
                    <summary>
                        <span>${escapeHtml(theme.title)}</span>
                        ${onMap ? '<em class="data-export-badge">On map</em>' : ''}
                    </summary>
                    <label class="data-export-indicator">
                        <input type="checkbox" data-export-field data-layer-id="${escapeHtml(theme.layerId)}" data-field="${escapeHtml(theme.scoreField)}" data-label="${escapeHtml(compositeLabel)}" data-theme-title="${escapeHtml(theme.title)}">
                        <span>${escapeHtml(compositeLabel)}</span>
                    </label>
                    ${indicatorRows}
                </details>
            `;
        })
        .join('');
}

function readExportChoice(dialog) {
    const scopes = new Set(
        [...dialog.querySelectorAll('[data-export-scope]:checked')].map(input => input.value)
    );
    const layers = [...dialog.querySelectorAll('[data-export-field]:checked')].map(input => ({
        layerId: input.dataset.layerId,
        field: input.dataset.field,
        label: input.dataset.label,
        themeTitle: input.dataset.themeTitle
    }));
    return {
        view: scopes.has('view'),
        everything: scopes.has('everything'),
        selection: scopes.has('selection'),
        csv: Boolean(dialog.querySelector('[data-export-csv]')?.checked),
        layers
    };
}

async function exportSelectionCsv() {
    const bundle = await buildAoiSummaries();
    if (!Array.isArray(bundle.summaries) || !bundle.summaries.length) {
        throw new Error('CSV export needs a selection and an active scored layer.');
    }
    const csv = bundle.summaries.map(summary => buildAoiCsv(summary)).join('\n\n');
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`aoi-summary-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
}

function openDataExportDialog() {
    if (document.querySelector('.data-export-modal')) return;
    const selectionMode = isAnalysisSelectionActive();
    const selectionCount = getAnalysisSelectionCount();
    const showSelection = selectionMode || selectionCount > 0;
    const selectionReady = selectionCount > 0;
    const selectionChecked = selectionMode && selectionReady;
    const unitLabel = getActiveAdminResolutionLabel().toLowerCase();
    const selectionNote = selectionReady
        ? `${selectionCount} ${unitLabel}${selectionCount === 1 ? '' : 's'} selected`
        : 'Selection mode is on, but no units are selected yet';

    const dialog = document.createElement('div');
    dialog.className = 'data-export-modal';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'data-export-title');
    dialog.innerHTML = `
        <div class="data-export-backdrop" data-export-cancel></div>
        <div class="data-export-card">
            <header class="data-export-header">
                <div>
                    <h2 id="data-export-title">Export Analysis</h2>
                    <p>Choose what to include. Current view, all units, and the selection can be combined.</p>
                </div>
                <button type="button" class="data-export-close" data-export-cancel aria-label="Close">×</button>
            </header>
            <div class="data-export-body">
                <div class="data-export-choices">
                    <label class="data-export-choice">
                        <input type="checkbox" data-export-scope value="view" checked>
                        <span>
                            <strong>Current view</strong>
                            <small>Whole-country map. A stacked map stays stacked, and each theme on it is also exported on its own.</small>
                        </span>
                    </label>
                    <label class="data-export-choice">
                        <input type="checkbox" data-export-scope value="everything" ${selectionChecked ? '' : 'checked'}>
                        <span>
                            <strong>Everything</strong>
                            <small>Statistics for all units at this resolution</small>
                        </span>
                    </label>
                    ${
                        showSelection
                            ? `<label class="data-export-choice${selectionMode ? ' is-highlighted' : ''}">
                                <input type="checkbox" data-export-scope value="selection" ${selectionChecked ? 'checked' : ''} ${selectionReady ? '' : 'disabled'}>
                                <span>
                                    <strong>Current selection</strong>
                                    ${selectionMode ? '<em class="data-export-badge">Selection mode</em>' : ''}
                                    <small>${escapeHtml(selectionNote)}</small>
                                </span>
                            </label>`
                            : ''
                    }
                    <label class="data-export-choice">
                        <input type="checkbox" data-export-csv ${selectionReady ? '' : 'disabled'}>
                        <span>
                            <strong>Spreadsheet (CSV)</strong>
                            <small>${
                                selectionReady
                                    ? 'Unit scores and summary statistics for the current selection'
                                    : 'Select units first to export a spreadsheet'
                            }</small>
                        </span>
                    </label>
                </div>
                <h3 class="data-export-section-title">Additional layers</h3>
                <p class="data-export-note">Add other themes and sub-indicators to the output.</p>
                <div class="data-export-layers">${renderExportLayerPicker()}</div>
                <p class="data-export-error" data-export-error hidden></p>
            </div>
            <footer class="data-export-footer">
                <button type="button" class="data-export-secondary" data-export-cancel>Cancel</button>
                <button type="button" class="data-export-confirm" data-export-confirm>Export</button>
            </footer>
        </div>
    `;

    let busy = false;
    const close = () => {
        document.removeEventListener('keydown', onKey);
        dialog.remove();
    };
    const showError = message => {
        const error = dialog.querySelector('[data-export-error]');
        if (!error) return;
        error.hidden = !message;
        error.textContent = message || '';
    };
    const onKey = event => {
        if (event.key === 'Escape' && !busy) close();
    };

    dialog.addEventListener('click', async event => {
        const cancel = event.target.closest?.('[data-export-cancel]');
        if (cancel) {
            if (!busy) close();
            return;
        }
        const confirm = event.target.closest?.('[data-export-confirm]');
        if (!confirm || confirm.disabled) return;
        const choice = readExportChoice(dialog);
        const wantsPdf = choice.view || choice.everything || choice.selection || choice.layers.length;
        if (!wantsPdf && !choice.csv) {
            showError('Select the current view, everything, the selection, a spreadsheet, or at least one layer.');
            return;
        }
        showError('');
        busy = true;
        confirm.disabled = true;
        confirm.textContent = 'Exporting…';
        try {
            if (choice.csv) {
                await exportSelectionCsv();
            }
            if (wantsPdf) {
                const blocks = await buildDataExportBlocks(choice);
                const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
                await savePdfBlocks(blocks, `data-export-${stamp}.pdf`);
            }
            close();
        } catch (error) {
            console.error('Data export failed:', error);
            showError(error?.message || 'Could not export the data.');
            busy = false;
            confirm.disabled = false;
            confirm.textContent = 'Export';
        }
    });

    document.addEventListener('keydown', onKey);
    document.body.appendChild(dialog);
    dialog.querySelector('.data-export-close')?.focus();
}

function renderMetricCards(summary) {
    const weightedNote =
        summary.weighted.weightedCount > 0
            ? `${summary.weighted.weightedCount} units with pop`
            : 'pop unavailable';
    const high = summary.distribution?.highClass;
    return `
        <div class="aoi-metric-grid">
            <div class="aoi-metric-card">
                <div class="aoi-metric-label">Mean (unweighted)</div>
                <div class="aoi-metric-value">${escapeHtml(formatAoiNumber(summary.stats.mean))}</div>
            </div>
            <div class="aoi-metric-card">
                <div class="aoi-metric-label">Mean (pop-weighted)</div>
                <div class="aoi-metric-value">${escapeHtml(formatAoiNumber(summary.weighted.weightedMean))}</div>
                <div class="aoi-metric-note">${escapeHtml(weightedNote)}</div>
            </div>
            <div class="aoi-metric-card">
                <div class="aoi-metric-label">Range</div>
                <div class="aoi-metric-value">${escapeHtml(formatAoiNumber(summary.stats.min))} – ${escapeHtml(formatAoiNumber(summary.stats.max))}</div>
            </div>
            <div class="aoi-metric-card">
                <div class="aoi-metric-label">Share in ${escapeHtml(high?.label || 'High')}</div>
                <div class="aoi-metric-value">${escapeHtml(formatAoiPercent(high?.unitShare))}</div>
                <div class="aoi-metric-note">of units${
                    summary.distribution?.classifiedPopulation > 0
                        ? ` · ${escapeHtml(formatAoiPercent(high?.populationShare))} of pop`
                        : ''
                }</div>
            </div>
        </div>
    `;
}

function renderClassBars(summary) {
    const classes = summary.distribution?.classes || [];
    if (!classes.length || !summary.distribution.classifiedUnits) {
        return summary.distribution?.noDataUnits
            ? `<div class="aoi-section"><p class="aoi-footnote">Class breaks unavailable for this layer style, or no scored units in the AOI.</p></div>`
            : '';
    }
    const maxUnits = Math.max(1, ...classes.map(c => c.unitCount));
    const rows = classes
        .map(cls => {
            const width = Math.round((cls.unitCount / maxUnits) * 100);
            return `
                <div class="aoi-class-row">
                    <div class="aoi-class-label">${escapeHtml(cls.label)}</div>
                    <div class="aoi-class-bar-track">
                        <div class="aoi-class-bar-fill" style="width:${width}%"></div>
                    </div>
                    <div class="aoi-class-count">${cls.unitCount} · ${escapeHtml(formatAoiPercent(cls.unitShare))}</div>
                </div>
            `;
        })
        .join('');
    return `
        <div class="aoi-section">
            <div class="aoi-section-title">Class Distribution</div>
            ${rows}
            ${
                summary.distribution.noDataUnits
                    ? `<p class="aoi-footnote">${summary.distribution.noDataUnits} unit(s) with no data</p>`
                    : ''
            }
        </div>
    `;
}

function renderPillars(summary) {
    const pillars = [...(summary.pillars?.pillars || [])].sort(
        (a, b) => Number(b.value) - Number(a.value)
    );
    if (!pillars.length) return '';
    const max = Math.max(0.001, ...pillars.map(p => p.value));
    const rows = pillars
        .map(p => {
            const width = Math.round((Math.max(0, p.value) / max) * 100);
            const share = formatAoiPercent(p.proportion);
            return `
                <div class="aoi-class-row aoi-score-row">
                    <div class="aoi-class-label">${escapeHtml(p.label)}</div>
                    <div class="aoi-class-bar-track">
                        <div class="aoi-class-bar-fill aoi-pillar-fill" style="width:${width}%;background:${escapeHtml(p.color)}"></div>
                    </div>
                    <div class="aoi-class-count">${escapeHtml(formatAoiNumber(p.value))} · ${escapeHtml(share)}</div>
                </div>
            `;
        })
        .join('');
    const worst = summary.pillars.worst
        ? `<p class="aoi-footnote">Highest average theme score: <strong>${escapeHtml(summary.pillars.worst.label)}</strong></p>`
        : '';
    return `
        <div class="aoi-section">
            <div class="aoi-section-title">Theme contribution across AOI</div>
            <p class="aoi-footnote">Average theme scores for selected units. Share is each theme&rsquo;s relative contribution among the themes shown.</p>
            ${rows}
            ${worst}
        </div>
    `;
}

function renderThemeContributions(themeContributions) {
    if (!themeContributions?.pillars?.length) return '';
    return renderPillars({ pillars: themeContributions });
}

function renderExportThemeScores(bundle) {
    const pillars = [...(bundle?.themeSums?.pillars || [])].sort(
        (a, b) => Number(b.value) - Number(a.value)
    );
    if (!pillars.length) return '';
    const max = Math.max(0.001, ...pillars.map(p => Number(p.value) || 0));
    const global = Boolean(bundle.global);
    const rows = pillars
        .map(p => {
            const value = Number(p.value) || 0;
            const width = Math.round((Math.max(0, value) / max) * 100);
            return `
                <div class="aoi-class-row aoi-score-row">
                    <div class="aoi-class-label">${escapeHtml(p.label)}</div>
                    <div class="aoi-class-bar-track">
                        <div class="aoi-class-bar-fill aoi-pillar-fill" style="width:${width}%;background:${escapeHtml(p.color || '#64748b')}"></div>
                    </div>
                    <div class="aoi-class-count">${escapeHtml(formatAoiNumber(value))} · ${escapeHtml(formatAoiPercent(p.proportion))}</div>
                </div>
            `;
        })
        .join('');
    const worst = bundle.themeSums?.worst;
    return `
        <div class="aoi-section aoi-pdf-scores">
            <div class="aoi-section-title">${global ? 'Theme scores' : 'Theme scores in the selection'}</div>
            <p class="aoi-footnote">${
                global
                    ? 'Sum of each theme across all units at this resolution. The percentage is that theme’s share of the total.'
                    : 'Sum of each theme across the selected units. The percentage is that theme’s share of the total.'
            }</p>
            ${rows}
            ${
                worst
                    ? `<p class="aoi-footnote">Highest theme score: <strong>${escapeHtml(worst.label)}</strong></p>`
                    : ''
            }
        </div>
    `;
}

let themeScoresCollapsed = false;
let selectionUnitsCollapsed = false;

function outerRingAreaSqM(ring) {
    if (!ring || ring.length < 3) return 0;
    const radius = 6378137;
    let total = 0;
    for (let i = 0; i < ring.length; i += 1) {
        const start = ring[i];
        const end = ring[(i + 1) % ring.length];
        if (!start || !end || !Number.isFinite(start.lat) || !Number.isFinite(start.lng)) continue;
        const lat1 = (start.lat * Math.PI) / 180;
        const lat2 = (end.lat * Math.PI) / 180;
        const dLng = ((end.lng - start.lng) * Math.PI) / 180;
        total += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    return Math.abs((total * radius * radius) / 2);
}

function geometryAreaKm2(geometry) {
    const polygons = geometry?.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry?.type === 'MultiPolygon'
          ? geometry.coordinates
          : [];
    let squareMeters = 0;
    polygons.forEach(poly => {
        const outer = poly?.[0];
        if (!outer?.length) return;
        squareMeters += outerRingAreaSqM(outer.map(([lng, lat]) => ({ lat, lng })));
    });
    return squareMeters ? squareMeters / 1e6 : null;
}

function featureAreaKm2(featureLayer) {
    const fromGeometry = geometryAreaKm2(featureLayer?.feature?.geometry);
    if (Number.isFinite(fromGeometry)) return fromGeometry;
    const latlngs = featureLayer?.getLatLngs?.();
    if (!latlngs) return null;
    const outers = [];
    const walk = node => {
        if (!Array.isArray(node) || !node.length) return;
        if (node[0]?.lat != null) {
            outers.push(node);
            return;
        }
        if (node[0]?.[0]?.lat != null) {
            outers.push(node[0]);
            return;
        }
        node.forEach(walk);
    };
    walk(latlngs);
    if (!outers.length) return null;
    const squareMeters = outers.reduce((sum, ring) => sum + outerRingAreaSqM(ring), 0);
    if (!squareMeters) return null;
    return squareMeters / 1e6;
}

function formatAreaKm2(km2) {
    if (!Number.isFinite(km2)) return '—';
    if (km2 >= 100) return km2.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (km2 >= 10) return km2.toLocaleString(undefined, { maximumFractionDigits: 1 });
    return km2.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function renderSelectionUnits(bundle) {
    const items = getAnalysisSelectionItems();
    if (!items.length) return '';
    const unitLabel =
        bundle?.resolutionLabel === 'Governorate'
            ? 'Governorates'
            : bundle?.resolutionLabel === 'Cadastre'
              ? 'Cadastres'
              : 'Districts';
    const columns = (bundle?.summaries || [])
        .filter(summary => Array.isArray(summary.entries))
        .map(summary => ({
            id: summary.layerId,
            label: summary.layerName || summary.attributeLabel || 'Score',
            scores: new Map(summary.entries.map(entry => [entry.key, entry.score]))
        }));
    const rows = items
        .slice()
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
        .map(item => {
            const scores = columns
                .map(column => {
                    const score = column.scores.get(item.key);
                    return `<td class="num">${escapeHtml(formatAoiNumber(score))}</td>`;
                })
                .join('');
            return `
                <tr data-selection-key="${escapeHtml(item.key)}">
                    <td class="analysis-selection-name">${escapeHtml(item.name || 'Selected unit')}</td>
                    <td class="num">${escapeHtml(formatAreaKm2(featureAreaKm2(item.featureLayer)))}</td>
                    ${scores}
                </tr>
            `;
        })
        .join('');
    const scoreHeaders = columns
        .map(
            column =>
                `<th class="num" title="${escapeHtml(column.label)}">${escapeHtml(column.label)}</th>`
        )
        .join('');
    const collapsed = selectionUnitsCollapsed;
    return `
        <div class="analysis-rankings analysis-selection-units${collapsed ? ' is-collapsed' : ''}">
            <button type="button" class="analysis-rankings-toggle analysis-selection-toggle" aria-expanded="${collapsed ? 'false' : 'true'}">
                <span>${escapeHtml(unitLabel)} · ${items.length}</span>
                <span class="analysis-rankings-chevron" aria-hidden="true">${collapsed ? '▸' : '▾'}</span>
            </button>
            <div class="analysis-rankings-body">
                <table class="analysis-selection-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th class="num">Area (km²)</th>
                            ${scoreHeaders}
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
}

function renderAoiThemeSpider(bundle, { forExport = false } = {}) {
    const pillars = bundle?.themeSums?.pillars || [];
    if (!pillars.length) return '';
    const count = Number(bundle.selectionCount) || bundle.themeSums.unitCount || 0;
    const unitWord = count === 1 ? 'unit' : 'units';
    const global = Boolean(bundle.global);
    const scope = global ? `all ${count} ${unitWord}` : `the ${count} selected ${unitWord}`;
    const model = buildThemeSpiderModel({
        themes: pillars,
        activeLayerIds: bundle.activeLayerIds || []
    });
    const chart = generateThemeSpiderHtml(model, {
        showLegend: false,
        emphasizeSelected: true,
        omitTitle: !forExport,
        titleProfile: 'Theme scores',
        titleStacked: 'Theme scores',
        hintProfile:
            `Each corner is a theme. Distance from the centre is the total of that theme&rsquo;s scores across ${scope}.`,
        hintStacked:
            `Each coloured outline is one theme that is turned on. A larger outline means a higher total for that theme across ${scope}. The highest total reaches the outer ring. The colour key shows which outline is which theme.`
    });
    if (forExport) {
        return `<div class="aoi-theme-spider">${chart}</div>`;
    }
    const collapsed = themeScoresCollapsed;
    return `
        <div class="aoi-theme-spider is-collapsible${collapsed ? ' is-collapsed' : ''}">
            <button type="button" class="analysis-rankings-toggle analysis-theme-scores-toggle" aria-expanded="${collapsed ? 'false' : 'true'}">
                <span>Theme scores</span>
                <span class="analysis-rankings-chevron" aria-hidden="true">${collapsed ? '▸' : '▾'}</span>
            </button>
            <div class="analysis-theme-scores-body">${chart}</div>
        </div>
        ${analysisRankingsMountHtml()}
    `;
}

function analysisRankingsMountHtml() {
    return '<div class="analysis-rankings" id="active-layer-rankings"></div>';
}

function renderExtremes(summary) {
    const high = summary.extremes?.highest || [];
    const low = summary.extremes?.lowest || [];
    if (!high.length && !low.length) return '';
    const list = (items, title) => `
        <div class="aoi-extremes-col">
            <div class="aoi-section-title">${title}</div>
            <ul class="aoi-extremes-list">
                ${items
                    .map(
                        item =>
                            `<li><span>${escapeHtml(item.name)}</span><strong>${escapeHtml(formatAoiNumber(item.score))}</strong></li>`
                    )
                    .join('')}
            </ul>
        </div>
    `;
    return `
        <div class="aoi-section aoi-extremes">
            ${high.length ? list(high, 'Highest in AOI') : ''}
            ${low.length ? list(low, 'Lowest in AOI') : ''}
        </div>
    `;
}

function renderLayerSummary(summary) {
    return `
        <div class="aoi-layer-block" data-aoi-layer="${escapeHtml(summary.layerId)}">
            <h5 class="aoi-layer-title">${escapeHtml(summary.layerName)}</h5>
            <p class="aoi-layer-attribute">${escapeHtml(summary.attributeLabel)} · ${summary.scoredCount}/${summary.unitCount} scored</p>
            ${renderClassBars(summary)}
            ${renderExtremes(summary)}
            ${renderMetricCards(summary)}
            <p class="aoi-footnote">Means summarise unit scores at the current resolution; they are not a new composite index.</p>
        </div>
    `;
}

/**
 * Async HTML for the AOI charts region.
 */
export async function renderAoiPanelHtml() {
    const count = getAnalysisSelectionCount();

    if (!count) {
        const globalBundle = await buildGlobalThemeSpiderBundle();
        const spider = globalBundle ? renderAoiThemeSpider(globalBundle) : '';
        if (!spider) {
            return `
                <div class="aoi-empty">
                    <p class="no-results-message">Use Select Area of Interest on the map, then click units to build an AOI.</p>
                    ${analysisRankingsMountHtml()}
                    ${renderAoiSummaryDock()}
                </div>
            `;
        }
        return `
            <div class="aoi-panel">
                ${spider}
                ${renderAoiSummaryDock()}
            </div>
        `;
    }

    const bundle = await buildAoiSummaries();
    const representedNote = renderSelectionUnits(bundle);

    const summaryDock = renderAoiSummaryDock({
        selectionCount: bundle.selectionCount
    });

    if (!bundle.summaries.length) {
        return `
            <div class="aoi-panel">
                ${renderAoiThemeSpider(bundle) || analysisRankingsMountHtml()}
                ${representedNote}
                ${
                    bundle.themeSums?.pillars?.length
                        ? ''
                        : '<p class="no-results-message">Turn on a composite or theme layer with scores to compute AOI metrics.</p>'
                }
                ${summaryDock}
            </div>
        `;
    }

    return `
        <div class="aoi-panel">
            ${renderAoiThemeSpider(bundle) || analysisRankingsMountHtml()}
            ${representedNote}
            ${bundle.summaries.map(renderLayerSummary).join('')}
            ${summaryDock}
        </div>
    `;
}

function renderAoiSummaryDock({ selectionCount = 0 } = {}) {
    const count = Number(selectionCount) || 0;
    const hasSelection = count > 0;
    const aoiMode = isAnalysisSelectionActive() || hasSelection;
    const disabled = aoiMode ? '' : 'disabled';
    return `
        <div class="aoi-summary-dock">
            <div class="aoi-header">
                <h5 class="aoi-title">Custom Analysis and Saving</h5>
                ${
                    hasSelection
                        ? `<p class="aoi-layer-attribute">${count} unit${count === 1 ? '' : 's'} selected</p>`
                        : ''
                }
            </div>
            <div class="aoi-export-row">
                <button type="button" class="aoi-export-btn" data-aoi-action="export-situation">Export Analysis</button>
                ${
                    CUSTOM_OVERALL_BUILDER_ENABLED
                        ? `<button type="button" class="aoi-export-btn" data-aoi-action="design-custom-index" ${disabled}>Design Custom Index</button>`
                        : ''
                }
                <button type="button" class="aoi-export-btn" data-aoi-action="clear" ${disabled}>Clear AOI</button>
            </div>
        </div>
    `;
}

/**
 * Bind export and custom-index listeners.
 * Call after injecting HTML from renderAoiPanelHtml.
 */
export async function bindAoiPanelInteractions(root, { onChanged } = {}) {
    if (!root) return;
    paintThemeSpiderCharts(root);

    const notify = () => {
        if (typeof onChanged === 'function') onChanged();
    };

    clearAnalysisSelectionHover();

    root.querySelectorAll('.analysis-selection-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const card = button.closest('.analysis-selection-units');
            if (!card) return;
            selectionUnitsCollapsed = !card.classList.contains('is-collapsed');
            card.classList.toggle('is-collapsed', selectionUnitsCollapsed);
            button.setAttribute('aria-expanded', selectionUnitsCollapsed ? 'false' : 'true');
            const chevron = button.querySelector('.analysis-rankings-chevron');
            if (chevron) chevron.textContent = selectionUnitsCollapsed ? '▸' : '▾';
            if (selectionUnitsCollapsed) clearAnalysisSelectionHover();
        });
    });

    root.querySelectorAll('[data-selection-key]').forEach(row => {
        row.addEventListener('mouseenter', () => {
            row.classList.add('is-map-hover');
            highlightAnalysisSelectionItem(row.getAttribute('data-selection-key'));
        });
        row.addEventListener('mouseleave', () => {
            row.classList.remove('is-map-hover');
            clearAnalysisSelectionHover();
        });
    });

    root.querySelectorAll('.analysis-theme-scores-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const card = button.closest('.aoi-theme-spider');
            if (!card) return;
            themeScoresCollapsed = !card.classList.contains('is-collapsed');
            card.classList.toggle('is-collapsed', themeScoresCollapsed);
            button.setAttribute('aria-expanded', themeScoresCollapsed ? 'false' : 'true');
            const chevron = button.querySelector('.analysis-rankings-chevron');
            if (chevron) chevron.textContent = themeScoresCollapsed ? '▸' : '▾';
        });
    });

    root.querySelectorAll('[data-aoi-action]').forEach(button => {
        button.addEventListener('click', async () => {
            const action = button.getAttribute('data-aoi-action');
            if (action === 'clear') {
                clearAnalysisSelection();
                setAnalysisSelectionActive(false);
                void forceAoiStyleRecovery();
                notify();
                return;
            }
            if (action === 'design-custom-index') {
                void openCustomOverallBuilderForAoi();
                return;
            }
            if (action === 'export-situation') {
                openDataExportDialog();
            }
        });
    });
}
