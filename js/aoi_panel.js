/**
 * AOI Analysis-panel UI — render summary HTML and bind export / district / custom-index actions.
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
    findFeaturesInDistrict,
    getActiveResolutionFromProviders,
    getAoiProviders,
    getPrimaryLeafletLayerForSelection,
    listDistrictsOnLayer
} from './aoi_context.js';
import {
    addAnalysisSelectionFeatures,
    clearAnalysisSelection,
    getActiveAdminResolutionLabel,
    getAnalysisSelectionCount,
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
import { themesForResolution } from './custom_overall_catalog.js';

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

/**
 * Build a print-ready clone of the visible AOI Analysis summary (no action controls).
 * @param {HTMLElement} root
 * @param {object} bundle
 */
function buildAoiBriefingPdfSource(root, bundle) {
    const sourcePanel = root.querySelector('.aoi-panel');
    const wrap = document.createElement('div');
    wrap.className = 'aoi-pdf-export-root';
    wrap.setAttribute('aria-hidden', 'true');

    const masthead = document.createElement('div');
    masthead.className = 'aoi-pdf-masthead';
    const generatedAt = new Date().toLocaleString();
    masthead.innerHTML = `
        <h1 class="aoi-pdf-title">AOI Analysis Briefing</h1>
        <p class="aoi-pdf-meta">
            ${escapeHtml(bundle.resolutionLabel || '—')} ·
            ${Number(bundle.selectionCount) || 0} unit${bundle.selectionCount === 1 ? '' : 's'} selected ·
            Generated ${escapeHtml(generatedAt)}
        </p>
    `;
    wrap.appendChild(masthead);

    if (sourcePanel) {
        const clone = sourcePanel.cloneNode(true);
        clone.querySelectorAll('.aoi-export-row, .aoi-district-tools').forEach(el => el.remove());
        wrap.appendChild(clone);
    } else {
        const empty = document.createElement('p');
        empty.className = 'no-results-message';
        empty.textContent = 'No AOI summary content available.';
        wrap.appendChild(empty);
    }

    return wrap;
}

const PDF_EXPORT_WIDTH = 760;
const PDF_EXPORT_PAD = 24;

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
 * Place one block on its own page, scaled down so it is never sliced onto the next page.
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
    const margin = 10;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;
    const rgb = hexToRgb(colors.background);
    const paintPage = () => {
        pdf.setFillColor(rgb.r, rgb.g, rgb.b);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
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
            if (index > 0) pdf.addPage();
            paintPage();
            let drawWidth = usableWidth;
            let drawHeight = (canvas.height * drawWidth) / canvas.width;
            if (drawHeight > usableHeight) {
                drawHeight = usableHeight;
                drawWidth = (canvas.width * drawHeight) / canvas.height;
            }
            const x = margin + (usableWidth - drawWidth) / 2;
            const y =
                block.dataset.exportAlign === 'center'
                    ? margin + (usableHeight - drawHeight) / 2
                    : margin;
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, drawWidth, drawHeight);
        } finally {
            block.remove();
        }
    }

    pdf.save(filename);
}

/**
 * Export the Analysis-tab AOI statistics as a multi-page PDF.
 * @param {HTMLElement} root
 * @param {object} bundle
 */
async function exportAoiBriefingPdf(root, bundle) {
    const blocks = briefingBlocks(root, bundle);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    await savePdfBlocks(blocks, `aoi-briefing-${stamp}.pdf`);
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

/**
 * Reframe the live map to the whole country, capture it, then restore the user's view.
 * Padding keeps the national outline inside the frame.
 */
async function captureCountryMap() {
    const map = window.map;
    const container = map?.getContainer?.();
    if (!map || !container) return captureLeafletMap();
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
                paddingTopLeft: [48, 48],
                paddingBottomRight: [48, 48]
            });
        });
        await waitForMapTiles(container);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return await captureLeafletMap();
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

function briefingBlocks(root, bundle) {
    const source = buildAoiBriefingPdfSource(root, bundle);
    const meta = source.querySelector('.aoi-pdf-meta')?.textContent?.trim() || '';
    const panel = source.querySelector('.aoi-panel');
    const pieces = panel
        ? [...panel.children].filter(el => !el.classList.contains('aoi-header'))
        : [];
    if (!pieces.length) return [source];
    return pieces.map((piece, index) => {
        const heading =
            piece.querySelector('h4, h5, .aoi-section-title, .aoi-represented-label')?.textContent?.trim() ||
            (index === 0 ? 'AOI Analysis Briefing' : 'AOI summary');
        return htmlBlock(heading, meta, piece);
    });
}

function mapExportBlock(capture, meta) {
    const figure = document.createElement('figure');
    figure.className = 'aoi-pdf-map';
    if (capture?.dataUrl && capture.width > 0 && capture.height > 0) {
        const frame = fitFrame(
            capture.width,
            capture.height,
            PDF_EXPORT_WIDTH - PDF_EXPORT_PAD * 2 - 2,
            2400
        );
        const image = document.createElement('img');
        image.src = capture.dataUrl;
        image.alt = 'Map of Lebanon';
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
    const block = htmlBlock('Current view', meta, figure, { align: 'center' });
    const caption = document.createElement('p');
    caption.className = 'aoi-footnote';
    caption.textContent = 'Whole country, with space inside the frame so the outline is not cut off.';
    block.querySelector('.aoi-panel')?.appendChild(caption);
    return block;
}

function spiderExportBlock(title, meta, bundle, represented) {
    const holder = document.createElement('div');
    holder.innerHTML = renderAoiThemeSpider(bundle);
    holder.querySelectorAll('.aoi-export-row').forEach(el => el.remove());
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
        const mapCapture = await captureCountryMap();
        blocks.push(mapExportBlock(mapCapture, `${resolutionLabel} · Whole country · ${when}`));
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
        layers
    };
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
                    <h2 id="data-export-title">Export data</h2>
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
                            <small>Map of the whole country, with the layers styled now</small>
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
                </div>
                <h3 class="data-export-section-title">Additional layers</h3>
                <p class="data-export-note">Add other themes and sub-indicators to the output.</p>
                <div class="data-export-layers">${renderExportLayerPicker()}</div>
                <p class="data-export-error" data-export-error hidden></p>
            </div>
            <footer class="data-export-footer">
                <button type="button" class="data-export-secondary" data-export-cancel>Cancel</button>
                <button type="button" class="data-export-confirm" data-export-confirm>Export PDF</button>
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
        if (!choice.view && !choice.everything && !choice.selection && !choice.layers.length) {
            showError('Select the current view, everything, the selection, or at least one layer.');
            return;
        }
        showError('');
        busy = true;
        confirm.disabled = true;
        confirm.textContent = 'Exporting PDF…';
        try {
            const blocks = await buildDataExportBlocks(choice);
            const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            await savePdfBlocks(blocks, `data-export-${stamp}.pdf`);
            close();
        } catch (error) {
            console.error('Situation PDF export failed:', error);
            showError(error?.message || 'Could not export the PDF.');
            busy = false;
            confirm.disabled = false;
            confirm.textContent = 'Export PDF';
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

function renderAoiThemeSpider(bundle) {
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
    return `
        <div class="aoi-theme-spider">
            ${generateThemeSpiderHtml(model, {
                showLegend: false,
                titleProfile: global ? 'Theme scores (all units)' : 'Theme scores (AOI sum)',
                titleStacked: global ? 'Selected themes (all units)' : 'Selected themes (AOI sum)',
                hintProfile:
                    `Each corner is a theme. Distance from the centre is the <strong>sum</strong> of that theme&rsquo;s scores across ${scope}. Higher = higher vulnerability. Scores do <strong>not</strong> add up to 1.`,
                hintStacked:
                    `Each coloured web is one selected theme. Larger web = the <strong>sum</strong> of that theme&rsquo;s scores across ${scope}. Scores are independent and do <strong>not</strong> add up to 1.`
            })}
        </div>
        <div class="aoi-export-row aoi-situation-export">
            <button type="button" class="aoi-export-btn" data-aoi-action="export-situation">Export data</button>
        </div>
    `;
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

function renderDistrictSelectControls(resolution) {
    if (resolution !== 'cadastre') return '';
    return `
        <div class="aoi-district-tools">
            <label class="aoi-district-label" for="aoi-district-select">Add whole district</label>
            <div class="aoi-district-row">
                <select id="aoi-district-select" class="aoi-district-select">
                    <option value="">Select district…</option>
                </select>
                <button type="button" id="aoi-district-add-btn" class="aoi-export-btn" disabled>Add</button>
            </div>
            <p class="aoi-footnote">Adds every cadastre in that district from the active map layer.</p>
        </div>
    `;
}

/**
 * Async HTML for the AOI charts region.
 */
export async function renderAoiPanelHtml() {
    const count = getAnalysisSelectionCount();
    const resolution = getActiveResolutionFromProviders();

    if (!count) {
        const globalBundle = await buildGlobalThemeSpiderBundle();
        const spider = globalBundle ? renderAoiThemeSpider(globalBundle) : '';
        if (!spider) {
            return `
                <div class="aoi-empty">
                    <p class="no-results-message">Use Select Area of Interest on the map, then click units to build an AOI.</p>
                </div>
            `;
        }
        return `
            <div class="aoi-panel">
                ${spider}
                ${isAnalysisSelectionActive() ? renderDistrictSelectControls(resolution) : ''}
            </div>
        `;
    }

    const bundle = await buildAoiSummaries();
    const representedLabel =
        bundle.resolutionLabel === 'Governorate'
            ? 'Governorates'
            : bundle.resolutionLabel === 'Cadastre'
              ? 'Cadastres'
              : 'Districts';
    const representedNote = bundle.districtsInSelection?.length
        ? `<div class="aoi-represented">
                <div class="aoi-represented-label">${representedLabel} represented</div>
                <div class="aoi-represented-names">${bundle.districtsInSelection.map(escapeHtml).join(', ')}</div>
           </div>`
        : '';

    const summaryHeader = `
        <div class="aoi-header">
            <h5 class="aoi-title">AOI summary (${escapeHtml(bundle.resolutionLabel)})</h5>
            <p class="aoi-layer-attribute">${bundle.selectionCount} unit${bundle.selectionCount === 1 ? '' : 's'} selected</p>
        </div>
    `;

    if (!bundle.summaries.length) {
        return `
            <div class="aoi-panel">
                ${renderAoiThemeSpider(bundle)}
                ${representedNote}
                ${
                    bundle.themeSums?.pillars?.length
                        ? ''
                        : '<p class="no-results-message">Turn on a composite or theme layer with scores to compute AOI metrics.</p>'
                }
                ${renderDistrictSelectControls(resolution)}
                ${summaryHeader}
                <div class="aoi-export-row">
                    ${
                        CUSTOM_OVERALL_BUILDER_ENABLED
                            ? '<button type="button" class="aoi-export-btn aoi-custom-index-btn" data-aoi-action="design-custom-index">Design Custom Index</button>'
                            : ''
                    }
                    <button type="button" class="aoi-export-btn" data-aoi-action="clear">Clear AOI</button>
                </div>
            </div>
        `;
    }

    return `
        <div class="aoi-panel">
            ${renderAoiThemeSpider(bundle)}
            ${representedNote}
            ${bundle.summaries.map(renderLayerSummary).join('')}
            ${renderDistrictSelectControls(resolution)}
            ${summaryHeader}
            <div class="aoi-export-row">
                ${
                    CUSTOM_OVERALL_BUILDER_ENABLED
                        ? '<button type="button" class="aoi-export-btn aoi-custom-index-btn" data-aoi-action="design-custom-index">Design Custom Index</button>'
                        : ''
                }
                <button type="button" class="aoi-export-btn" data-aoi-action="export-csv">Export CSV</button>
                <button type="button" class="aoi-export-btn" data-aoi-action="export-briefing">Export briefing (PDF)</button>
                <button type="button" class="aoi-export-btn aoi-export-btn-muted" data-aoi-action="clear">Clear AOI</button>
            </div>
        </div>
    `;
}

/**
 * Populate district dropdown + bind export / add-district listeners.
 * Call after injecting HTML from renderAoiPanelHtml.
 */
export async function bindAoiPanelInteractions(root, { onChanged } = {}) {
    if (!root) return;
    paintThemeSpiderCharts(root);

    const notify = () => {
        if (typeof onChanged === 'function') onChanged();
    };

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
                return;
            }
            const bundle = await buildAoiSummaries();
            const hasTheme =
                (Array.isArray(bundle.themeSums?.pillars) && bundle.themeSums.pillars.length > 0) ||
                (Array.isArray(bundle.themeContributions?.pillars) &&
                    bundle.themeContributions.pillars.length > 0);
            const hasSummaries = Array.isArray(bundle.summaries) && bundle.summaries.length > 0;
            if (!hasSummaries && !hasTheme) {
                window.alert('No AOI statistics to export yet. Select map units with an active scored layer.');
                return;
            }
            const stamp = new Date().toISOString().slice(0, 10);
            if (action === 'export-csv') {
                if (!hasSummaries) {
                    window.alert('CSV export needs an active scored layer with AOI metrics.');
                    return;
                }
                const csv = bundle.summaries.map(s => buildAoiCsv(s)).join('\n\n');
                downloadTextFile(`aoi-summary-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
            } else if (action === 'export-briefing') {
                const btn = button;
                const originalLabel = btn.textContent;
                btn.disabled = true;
                btn.textContent = 'Exporting PDF…';
                try {
                    await exportAoiBriefingPdf(root, bundle);
                } catch (error) {
                    console.error('AOI briefing PDF export failed:', error);
                    window.alert(error?.message || 'Could not export AOI briefing PDF.');
                } finally {
                    btn.disabled = false;
                    btn.textContent = originalLabel;
                }
            }
        });
    });

    const select = root.querySelector('#aoi-district-select');
    const addBtn = root.querySelector('#aoi-district-add-btn');
    if (!select || !addBtn) return;

    const leafletLayer = getPrimaryLeafletLayerForSelection();
    const districts = listDistrictsOnLayer(leafletLayer);
    districts.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });

    select.addEventListener('change', () => {
        addBtn.disabled = !select.value;
    });

    addBtn.addEventListener('click', () => {
        const district = select.value;
        if (!district || !leafletLayer) return;
        const matches = findFeaturesInDistrict(leafletLayer, district);
        addAnalysisSelectionFeatures(
            matches.map(featureLayer => ({
                featureLayer,
                properties: featureLayer.feature?.properties || {},
                layerId: null
            }))
        );
        notify();
    });
}
