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
    findFeaturesInDistrict,
    getActiveResolutionFromProviders,
    getPrimaryLeafletLayerForSelection,
    listDistrictsOnLayer
} from './aoi_context.js';
import {
    addAnalysisSelectionFeatures,
    clearAnalysisSelection,
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

/**
 * Export the Analysis-tab AOI statistics as a multi-page PDF.
 * @param {HTMLElement} root
 * @param {object} bundle
 */
async function exportAoiBriefingPdf(root, bundle) {
    if (typeof html2canvas !== 'function') {
        throw new Error('html2canvas is not available.');
    }
    const jsPdfNamespace = window.jspdf;
    if (!jsPdfNamespace?.jsPDF) {
        throw new Error('jsPDF is not available.');
    }

    const source = buildAoiBriefingPdfSource(root, bundle);
    source.style.cssText = [
        'position: fixed',
        'left: -10000px',
        'top: 0',
        'width: 760px',
        'background: #ffffff',
        'padding: 24px',
        'box-sizing: border-box',
        'z-index: -1'
    ].join(';');
    document.body.appendChild(source);

    try {
        paintThemeSpiderCharts(source);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const canvas = await html2canvas(source, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            width: source.scrollWidth,
            height: source.scrollHeight
        });

        const { jsPDF } = jsPdfNamespace;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const usableWidth = pageWidth - margin * 2;
        const usableHeight = pageHeight - margin * 2;
        const imgHeight = (canvas.height * usableWidth) / canvas.width;
        const imgData = canvas.toDataURL('image/png');

        let heightLeft = imgHeight;
        let position = margin;
        pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
        heightLeft -= usableHeight;

        while (heightLeft > 1) {
            position = margin - (imgHeight - heightLeft);
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
            heightLeft -= usableHeight;
        }

        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        pdf.save(`aoi-briefing-${stamp}.pdf`);
    } finally {
        source.remove();
    }
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

async function captureLeafletMap() {
    const map = window.map;
    const container = map?.getContainer?.();
    if (!map || !container) return null;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#dbe3ea';
    ctx.fillRect(0, 0, width, height);
    const mapRect = container.getBoundingClientRect();

    const tiles = container.querySelectorAll('.leaflet-tile-pane img');
    for (const tile of tiles) {
        if (!tile.src) continue;
        const rect = tile.getBoundingClientRect();
        try {
            const image = await loadCorsImage(tile.src);
            ctx.drawImage(
                image,
                rect.left - mapRect.left,
                rect.top - mapRect.top,
                rect.width,
                rect.height
            );
        } catch (error) {
            /* skip tiles that block cross-origin capture */
        }
    }

    const svg = container.querySelector('.leaflet-overlay-pane svg');
    if (svg) {
        const clone = svg.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        try {
            const image = await loadCorsImage(url);
            const pane = container.querySelector('.leaflet-overlay-pane');
            const paneRect = pane.getBoundingClientRect();
            ctx.drawImage(image, paneRect.left - mapRect.left, paneRect.top - mapRect.top);
        } catch (error) {
            /* overlay is optional if the SVG cannot be painted */
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    return canvas.toDataURL('image/png');
}

function situationStatLines(bundle) {
    const lines = [];
    const pillars = bundle?.themeSums?.pillars || [];
    pillars.forEach(pillar => {
        lines.push(`${pillar.label}: sum ${formatAoiNumber(pillar.value)}`);
    });
    (bundle?.summaries || []).forEach(summary => {
        const high = summary.extremes?.highest?.[0];
        const low = summary.extremes?.lowest?.[0];
        lines.push(`${summary.layerName}: mean ${formatAoiNumber(summary.stats?.mean)}`);
        if (high) lines.push(`  Highest: ${high.name} (${formatAoiNumber(high.score)})`);
        if (low) lines.push(`  Lowest: ${low.name} (${formatAoiNumber(low.score)})`);
    });
    return lines.slice(0, 18);
}

async function exportSituationPdf(root) {
    const jsPdfNamespace = window.jspdf;
    if (!jsPdfNamespace?.jsPDF) {
        throw new Error('jsPDF is not available.');
    }
    const count = getAnalysisSelectionCount();
    const bundle = count ? await buildAoiSummaries() : await buildGlobalThemeSpiderBundle();
    if (!bundle?.themeSums?.pillars?.length) {
        throw new Error('Turn on a theme layer to export the current situation.');
    }

    const mapImage = await captureLeafletMap();
    const spiderCanvas = root.querySelector('.aoi-theme-spider canvas');
    const spiderImage = spiderCanvas ? spiderCanvas.toDataURL('image/png') : null;

    const { jsPDF } = jsPdfNamespace;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('Current situation', margin, y + 6);
    y += 10;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    const scope = bundle.global || !count
        ? `All units (${bundle.selectionCount || bundle.themeSums.unitCount || 0})`
        : `${count} selected unit${count === 1 ? '' : 's'}`;
    pdf.text(
        `${bundle.resolutionLabel || 'Resolution'} · ${scope} · ${new Date().toLocaleString()}`,
        margin,
        y + 4
    );
    y += 8;
    pdf.setFontSize(9);
    pdf.text('Higher theme scores indicate higher vulnerability. Scores are comparable within this resolution only.', margin, y + 4);
    y += 8;

    if (mapImage) {
        const mapHeight = 78;
        pdf.addImage(mapImage, 'PNG', margin, y, contentWidth, mapHeight);
        y += mapHeight + 4;
    }

    const spiderSize = 78;
    if (spiderImage) {
        pdf.addImage(spiderImage, 'PNG', margin, y, spiderSize, spiderSize);
    }

    const textX = margin + (spiderImage ? spiderSize + 6 : 0);
    const textWidth = contentWidth - (spiderImage ? spiderSize + 6 : 0);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('Theme scores', textX, y + 5);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const lines = situationStatLines(bundle);
    const wrapped = pdf.splitTextToSize(lines.join('\n'), textWidth);
    pdf.text(wrapped.slice(0, 22), textX, y + 11);

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    pdf.save(`situation-briefing-${stamp}.pdf`);
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
                <div class="aoi-class-row">
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
            <button type="button" class="aoi-export-btn" data-aoi-action="export-situation">Data Export</button>
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
                const btn = button;
                const originalLabel = btn.textContent;
                btn.disabled = true;
                btn.textContent = 'Exporting PDF…';
                try {
                    await exportSituationPdf(root);
                } catch (error) {
                    console.error('Situation PDF export failed:', error);
                    window.alert(error?.message || 'Could not export the situation PDF.');
                } finally {
                    btn.disabled = false;
                    btn.textContent = originalLabel;
                }
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
