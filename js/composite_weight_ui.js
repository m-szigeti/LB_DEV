/**
 * Experimental composite weight sandbox UI — per-layer compact panels.
 */

import {
    buildPrepCache,
    applyCustomCompositeToGeoJson,
    clearCustomCompositeFromGeoJson,
    slidersToWeights,
    attachOverallPillarsToFeatures,
    buildJoinMapFromGeoJson,
    CUSTOM_COMPOSITE_FIELD
} from './composite_score.js';
import {
    loadIndicatorWeightsConfig,
    getThemeConfig,
    isCompositeWeightEligible,
    isOverallPillarMode,
    COMPOSITE_WEIGHT_ENABLED_RESOLUTIONS
} from './composite_weight_config.js';
import {
    setSandboxComputing,
    setSandboxActive,
    setSandboxSnapshot,
    resetSandboxState,
    isSandboxActive,
    isSandboxComputing,
    getSandboxLayerId,
    getSandboxCompareView,
    setSandboxCompareView,
    getSandboxState,
    SANDBOX_COMPARE_VIEWS
} from './composite_sandbox_state.js';
import { isColorOnlyMode } from './map_display_controls.js';
import { syncSandboxBodyClasses, installSandboxGuard } from './composite_sandbox_guard.js';
import { clearSubindicatorSelection, renderSVSubindicatorPanel } from './sv_subindicators.js';

function isCompositeSectionOpen() {
    const btn = document.querySelector('.social-vulnerability-btn');
    if (!btn) return false;
    const panel = btn.nextElementSibling;
    return Boolean(
        btn.classList.contains('active') &&
        panel &&
        panel.classList.contains('dropdown-container') &&
        panel.style.display === 'block'
    );
}

let context = null;
let activeLayerId = null;
let weightsConfig = null;

export function initCompositeWeightSandbox(appContext) {
    context = appContext;
    installSandboxGuard();
    bindPanelControls();
    void ensureWeightsConfig();
}

async function ensureWeightsConfig() {
    if (weightsConfig) return weightsConfig;
    weightsConfig = await loadIndicatorWeightsConfig();
    return weightsConfig;
}

function bindPanelControls() {
    document.addEventListener('click', event => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        if (target.closest('#compositeSandboxCreateBtn, .composite-sandbox-create-btn')) {
            const panel = target.closest('[data-sandbox-layer]');
            const layerId = panel?.dataset?.sandboxLayer || activeLayerId;
            void createWeightedMap(layerId);
            return;
        }
        if (target.closest('#compositeSandboxBannerExportBtn')) {
            void exportWeightedMap();
            return;
        }
        if (target.closest('#compositeSandboxBannerDeleteBtn')) {
            void deleteWeightedMap();
            return;
        }
        const compareBtn = target.closest('.composite-sandbox-compare-btn');
        if (compareBtn?.dataset?.view) {
            void switchCompareView(compareBtn.dataset.view);
        }
    });

    document.addEventListener('input', event => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || !input.classList.contains('composite-sandbox-slider')) {
            return;
        }
        const valueEl = input.closest('.composite-sandbox-slider-row')?.querySelector('.composite-sandbox-slider-value');
        if (valueEl) valueEl.textContent = formatWeight(input.value);
    });
}

function getPanelForLayer(layerId) {
    return document.querySelector(`[data-sandbox-layer="${layerId}"]`);
}

export async function syncCompositeSandboxPanel(layerId = null, resolution = null) {
    await ensureWeightsConfig().catch(() => null);

    const banner = document.getElementById('compositeSandboxBanner');
    const computingOverlay = document.getElementById('compositeSandboxComputingOverlay');
    const res = resolution || context?.getActiveResolution?.() || 'district';
    const currentLayer = layerId || context?.getCurrentCompositeLayerId?.() || null;
    activeLayerId = currentLayer;

    const inSandbox = isSandboxActive();
    const computing = isSandboxComputing();
    const sectionOpen = isCompositeSectionOpen();
    const sandboxLayerId = inSandbox ? getSandboxLayerId() : null;

    document.querySelectorAll('[data-sandbox-layer]').forEach(panel => {
        const panelLayerId = panel.dataset.sandboxLayer;
        const eligible =
            COMPOSITE_WEIGHT_ENABLED_RESOLUTIONS.has(res) &&
            isCompositeWeightEligible(panelLayerId, res, weightsConfig) &&
            context?.isLayerActive?.(panelLayerId);

        const showForSandbox = inSandbox && sandboxLayerId === panelLayerId;
        const visible = sectionOpen && (eligible || showForSandbox);
        panel.hidden = !visible;

        if (!visible) return;

        const themeConfig = getThemeConfig(panelLayerId, res, weightsConfig);
        if (!themeConfig) {
            panel.hidden = true;
            return;
        }

        const lockInputs = (inSandbox && sandboxLayerId === panelLayerId) || computing;
        renderSliderRows(panel, themeConfig, lockInputs);
        updatePanelButtons(panel, panelLayerId);
        if (showForSandbox && panel instanceof HTMLDetailsElement) {
            panel.open = true;
        }
    });

    if (banner) banner.hidden = !inSandbox;
    if (computingOverlay) computingOverlay.hidden = !computing;

    syncSandboxBodyClasses();
    updateCompareControls();
}

function updatePanelButtons(panel, panelLayerId) {
    const sandbox = isSandboxActive() && getSandboxLayerId() === panelLayerId;
    const computing = isSandboxComputing();
    const createBtn = panel.querySelector('.composite-sandbox-create-btn');

    if (createBtn) {
        createBtn.hidden = sandbox;
        createBtn.disabled = computing;
    }
    panel.querySelectorAll('.composite-sandbox-slider').forEach(input => {
        input.disabled = sandbox || computing;
    });
}

function updateCompareControls() {
    const sandbox = isSandboxActive();
    const computing = isSandboxComputing();
    const view = getSandboxCompareView();

    const compareBanner = document.getElementById('compositeSandboxCompareBanner');
    if (compareBanner) {
        compareBanner.hidden = !sandbox;
    }
    const displayBanner = document.getElementById('compositeSandboxDisplayBanner');
    if (displayBanner) {
        displayBanner.hidden = true;
        displayBanner.setAttribute('aria-hidden', 'true');
    }

    document.querySelectorAll('.composite-sandbox-compare-btn[data-view]').forEach(btn => {
        const isActive = btn.dataset.view === view;
        btn.classList.toggle('is-active', isActive);
        btn.disabled = computing;
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    const bannerText = document.getElementById('compositeSandboxBannerText');
    if (bannerText) {
        const colorNote = isColorOnlyMode() ? 'color only' : 'patterns and icons';
        bannerText.textContent =
            view === SANDBOX_COMPARE_VIEWS.BEFORE
                ? `Sandbox — viewing Before (official score, ${colorNote}).`
                : `Sandbox — viewing After (experimental weighted score, ${colorNote}).`;
    }
}

function renderSliderRows(panel, themeConfig, inputsDisabled) {
    const host = panel.querySelector('.composite-sandbox-sliders');
    if (!host) return;

    const existing = new Map();
    if (inputsDisabled) {
        host.querySelectorAll('.composite-sandbox-slider').forEach(input => {
            existing.set(input.dataset.field, input.value);
        });
    }

    host.innerHTML = themeConfig.indicators
        .map((ind, index) => {
            const initial =
                (inputsDisabled && existing.has(ind.field) ? existing.get(ind.field) : null) ??
                String(ind.defaultWeight);
            const safeLabel = escapeHtml(ind.label || ind.field);
            const safeField = escapeHtml(ind.field);
            return `
                <div class="composite-sandbox-slider-row">
                    <label class="composite-sandbox-slider-label" for="cs-slider-${panel.dataset.sandboxLayer}-${index}">
                        ${safeLabel}
                    </label>
                    <div class="composite-sandbox-slider-controls">
                        <input
                            type="range"
                            class="composite-sandbox-slider"
                            id="cs-slider-${panel.dataset.sandboxLayer}-${index}"
                            data-field="${safeField}"
                            min="0"
                            max="1"
                            step="0.001"
                            value="${initial}"
                            ${inputsDisabled ? 'disabled' : ''}
                        >
                        <span class="composite-sandbox-slider-value">${formatWeight(initial)}</span>
                    </div>
                </div>
            `;
        })
        .join('');
}

function collectSliderValues(panel, themeConfig) {
    const host = panel?.querySelector('.composite-sandbox-sliders');
    if (!host) return themeConfig.indicators.map(ind => ind.defaultWeight);
    return themeConfig.indicators.map((ind, index) => {
        const input = host.querySelector(`#cs-slider-${panel.dataset.sandboxLayer}-${index}`);
        return input ? Number(input.value) : ind.defaultWeight;
    });
}

async function createWeightedMap(layerId) {
    if (!context || isSandboxLockedLocal()) return;

    const targetLayerId = layerId || activeLayerId || context.getCurrentCompositeLayerId?.();
    const resolution = context.getActiveResolution?.() || 'district';
    if (!targetLayerId || !context.isLayerActive?.(targetLayerId)) return;

    await ensureWeightsConfig();
    const themeConfig = getThemeConfig(targetLayerId, resolution, weightsConfig);
    if (!themeConfig) return;

    const panel = getPanelForLayer(targetLayerId);
    const rawGeoJson = context.getLayerGeoJson?.(targetLayerId);
    if (!rawGeoJson?.features?.length) {
        showSandboxError(panel, 'Layer data is not loaded yet.');
        return;
    }

    const sliderValues = collectSliderValues(panel, themeConfig);
    setSandboxSnapshot({ subindicatorCleared: true });
    if (targetLayerId !== 'svOverallTensionLayer') {
        clearSubindicatorSelection(targetLayerId);
        renderSVSubindicatorPanel(targetLayerId);
        if (typeof window.syncSVSubindicatorPanelsVisibility === 'function') {
            window.syncSVSubindicatorPanelsVisibility();
        }
    }

    setSandboxComputing(targetLayerId, resolution, themeConfig, sliderValues);
    syncCompositeSandboxPanel(targetLayerId, resolution);

    try {
        await deferToNextFrame();

        if (isOverallPillarMode(themeConfig)) {
            await attachPillarsFromSources(rawGeoJson, themeConfig, resolution);
        }

        const prepCache = buildPrepCache(rawGeoJson.features, themeConfig.indicators);
        const weights = slidersToWeights(sliderValues);
        applyCustomCompositeToGeoJson(rawGeoJson, prepCache, weights);
        setSandboxActive(prepCache);
        await context.refreshSandboxLayer?.(targetLayerId);
        syncCompositeSandboxPanel(targetLayerId, resolution);
        updateCompareControls();
    } catch (error) {
        console.error('Composite sandbox compute failed:', error);
        clearCustomCompositeFromGeoJson(rawGeoJson);
        resetSandboxState();
        syncCompositeSandboxPanel(targetLayerId, resolution);
        showSandboxError(panel, error?.message || 'Could not calculate weighted composite.');
    }
}

async function attachPillarsFromSources(overallGeoJson, themeConfig, resolution) {
    const joinKeys = themeConfig.joinKeys || [];
    const sourceMaps = {};
    const uniqueSources = [...new Set(themeConfig.indicators.map(ind => ind.sourceLayerId))];

    for (const sourceLayerId of uniqueSources) {
        const sourceGeoJson = await context.getSourceLayerGeoJson?.(sourceLayerId, resolution);
        if (!sourceGeoJson?.features?.length) {
            throw new Error(`Could not load pillar source for ${sourceLayerId}`);
        }
        sourceMaps[sourceLayerId] = {
            byKey: buildJoinMapFromGeoJson(sourceGeoJson, joinKeys),
            field: themeConfig.indicators.find(ind => ind.sourceLayerId === sourceLayerId)?.sourceField
        };
    }

    attachOverallPillarsToFeatures(overallGeoJson, themeConfig, sourceMaps);
}

async function deleteWeightedMap() {
    if (!context || !isSandboxActive()) return;
    const layerId = getSandboxLayerId();
    const rawGeoJson = context.getLayerGeoJson?.(layerId);
    clearCustomCompositeFromGeoJson(rawGeoJson);
    resetSandboxState();
    if (layerId) {
        await context.refreshSandboxLayer?.(layerId);
    }
    syncCompositeSandboxPanel(context.getCurrentCompositeLayerId?.(), context.getActiveResolution?.());
}

const EXPORT_DIR_IDB = {
    dbName: 'lb-dev-exports',
    storeName: 'directory-handles',
    handleKey: 'custom-weighted'
};

/**
 * Write sandbox GeoJSON + weights CSV into a project folder the user chooses
 * (recommended: LB_DEV/exports/custom_weighted). The folder handle is remembered.
 */
async function exportWeightedMap() {
    if (!context || !isSandboxActive()) return;

    const exportBtn = document.getElementById('compositeSandboxBannerExportBtn');
    const originalLabel = exportBtn?.textContent?.trim() || 'Export to folder';
    if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.textContent = 'Exporting…';
    }

    try {
        const sandbox = getSandboxState();
        const layerId = sandbox.layerId || getSandboxLayerId();
        const themeConfig = sandbox.themeConfig;
        const resolution = sandbox.resolution || context.getActiveResolution?.() || 'district';
        const sliderValues = Array.isArray(sandbox.sliderValues) ? sandbox.sliderValues : [];

        if (!layerId || !themeConfig?.indicators?.length) {
            throw new Error('Nothing to export yet.');
        }

        const rawGeoJson = context.getLayerGeoJson?.(layerId);
        if (!rawGeoJson?.features?.length) {
            throw new Error('Layer data is not loaded.');
        }

        const officialField = themeConfig.compositeField || 'composite_score';
        const customWeights = slidersToWeights(sliderValues);
        const weightRows = themeConfig.indicators.map((ind, index) => {
            const before = Number(ind.defaultWeight) || 0;
            const sliderRaw = Number(sliderValues[index]);
            const after = Number(customWeights[index]) || 0;
            return {
                field: ind.field,
                label: ind.label || ind.field,
                weight_before_official: before,
                slider_raw: Number.isFinite(sliderRaw) ? sliderRaw : before,
                weight_after_normalized: after,
                delta: after - before,
                inverted: Boolean(ind.inverted)
            };
        });

        const exportedAt = new Date().toISOString();
        const slug = slugifyFilename(themeConfig.themeName || layerId);
        const stamp = exportedAt.slice(0, 19).replace(/[:T]/g, '-');
        const baseName = `${slug}_custom_weighted_${resolution}_${stamp}`;
        const geoJsonName = `${baseName}.geojson`;
        const csvName = `${baseName}_weights_before_after.csv`;

        const csvHeader = [
            'indicator_field',
            'indicator_label',
            'weight_before_official',
            'slider_raw',
            'weight_after_normalized',
            'delta',
            'inverted',
            'layer_id',
            'resolution',
            'theme_name',
            'exported_at'
        ];
        const csvRows = weightRows.map(row => [
            row.field,
            row.label,
            formatExportNumber(row.weight_before_official),
            formatExportNumber(row.slider_raw),
            formatExportNumber(row.weight_after_normalized),
            formatExportNumber(row.delta),
            row.inverted ? 'true' : 'false',
            layerId,
            resolution,
            themeConfig.themeName || '',
            exportedAt
        ]);
        const csvText = `${[csvHeader, ...csvRows].map(line => line.map(csvEscape).join(',')).join('\n')}\n`;

        const exportFeatures = rawGeoJson.features.map(feature => {
            const props = { ...(feature.properties || {}) };
            const beforeScore = Number(props[officialField]);
            const afterScore = Number(props[CUSTOM_COMPOSITE_FIELD]);
            props.score_before_official = Number.isFinite(beforeScore) ? beforeScore : null;
            props.score_after_custom = Number.isFinite(afterScore) ? afterScore : null;
            props.custom_weighted_score = props.score_after_custom;
            return {
                type: feature.type || 'Feature',
                properties: props,
                geometry: feature.geometry || null
            };
        });

        const exportGeoJson = {
            type: 'FeatureCollection',
            metadata: {
                exportType: 'custom-weighted-composite',
                exportedAt,
                layerId,
                resolution,
                themeName: themeConfig.themeName || layerId,
                mode: themeConfig.mode || null,
                officialScoreField: officialField,
                customScoreField: CUSTOM_COMPOSITE_FIELD,
                indicators: weightRows.map(row => ({
                    field: row.field,
                    label: row.label,
                    weightBeforeOfficial: row.weight_before_official,
                    sliderRaw: row.slider_raw,
                    weightAfterNormalized: row.weight_after_normalized,
                    delta: row.delta,
                    inverted: row.inverted
                }))
            },
            features: exportFeatures
        };
        const geoJsonText = JSON.stringify(exportGeoJson, null, 2);

        if (exportBtn) exportBtn.textContent = 'Saving…';
        const saved = await saveCustomWeightedExportFiles({
            geoJsonName,
            csvName,
            geoJsonText,
            csvText
        });

        if (exportBtn) exportBtn.textContent = 'Saved';
        setExportBannerMessage(saved.message);
        setTimeout(() => {
            if (exportBtn && exportBtn.textContent === 'Saved') {
                exportBtn.textContent = originalLabel;
            }
        }, 2500);
    } catch (error) {
        if (error?.name === 'AbortError') {
            setExportBannerMessage('Export cancelled — no files written.');
            if (exportBtn) exportBtn.textContent = originalLabel;
            return;
        }
        const message = error?.message || 'Export failed.';
        showSandboxError(getPanelForLayer(getSandboxLayerId()), message);
        setExportBannerMessage(`Export failed: ${message}`);
        if (exportBtn) exportBtn.textContent = 'Export failed';
        setTimeout(() => {
            if (exportBtn && exportBtn.textContent === 'Export failed') {
                exportBtn.textContent = originalLabel;
            }
        }, 2500);
        console.error('Weighted map export failed:', error);
    } finally {
        if (exportBtn) exportBtn.disabled = false;
        if (
            exportBtn &&
            (exportBtn.textContent === 'Exporting…' ||
                exportBtn.textContent === 'Choose folder…' ||
                exportBtn.textContent === 'Saving…')
        ) {
            exportBtn.textContent = originalLabel;
        }
    }
}

/**
 * Save order:
 * 1) local Python helper → exports/custom_weighted
 * 2) Chrome/Edge folder picker
 * 3) browser download (zip) as last resort
 */
async function saveCustomWeightedExportFiles({ geoJsonName, csvName, geoJsonText, csvText }) {
    const local = await tryLocalProjectExport([
        { name: geoJsonName, content: geoJsonText },
        { name: csvName, content: csvText }
    ]);
    if (local?.ok) {
        const folder = local.exportDir || 'exports/custom_weighted';
        return {
            method: 'local-server',
            message: `Saved to ${folder} (${geoJsonName} + CSV).`
        };
    }

    if (typeof window.showDirectoryPicker === 'function') {
        const dirHandle = await ensureCustomWeightedExportDirectory();
        await writeTextFileToDirectory(dirHandle, geoJsonName, geoJsonText);
        await writeTextFileToDirectory(dirHandle, csvName, csvText);
        const folderLabel = dirHandle.name || 'exports/custom_weighted';
        return {
            method: 'directory-picker',
            message: `Saved to ${folderLabel}/${geoJsonName} (+ weights CSV).`
        };
    }

    // Last resort for browsers without folder write support.
    const encoder = new TextEncoder();
    const zipBlob = buildStoreZipBlob([
        { name: csvName, bytes: encoder.encode(csvText) },
        { name: geoJsonName, bytes: encoder.encode(geoJsonText) }
    ]);
    downloadBlob(`${geoJsonName.replace(/\.geojson$/i, '')}.zip`, zipBlob);
    return {
        method: 'download',
        message:
            'Downloaded a ZIP (folder write unavailable here). For direct project saves, run: python scripts/serve_custom_weighted_export.py'
    };
}

async function tryLocalProjectExport(files) {
    const endpoints = [
        '/__lb_export__/custom_weighted',
        'http://127.0.0.1:8765/__lb_export__/custom_weighted',
        'http://localhost:8765/__lb_export__/custom_weighted'
    ];

    for (const url of endpoints) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files })
            });
            if (!response.ok) continue;
            const payload = await response.json();
            if (payload?.ok) return payload;
        } catch {
            // Try next endpoint.
        }
    }
    return null;
}

function setExportBannerMessage(message) {
    const bannerText = document.getElementById('compositeSandboxBannerText');
    if (!bannerText) return;
    bannerText.dataset.prevText = bannerText.dataset.prevText || bannerText.textContent;
    bannerText.textContent = message;
    setTimeout(() => {
        if (bannerText.dataset.prevText) {
            bannerText.textContent = bannerText.dataset.prevText;
            delete bannerText.dataset.prevText;
        }
    }, 8000);
}

async function ensureCustomWeightedExportDirectory() {
    let handle = await loadExportDirectoryHandle();
    if (handle) {
        const permitted = await ensureDirectoryWritePermission(handle);
        if (permitted) return handle;
    }

    handle = await window.showDirectoryPicker({
        id: 'lb-custom-weighted-exports',
        mode: 'readwrite',
        startIn: 'documents'
    });
    await saveExportDirectoryHandle(handle);
    return handle;
}

async function ensureDirectoryWritePermission(handle) {
    const opts = { mode: 'readwrite' };
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    if ((await handle.requestPermission(opts)) === 'granted') return true;
    return false;
}

async function writeTextFileToDirectory(dirHandle, filename, text) {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(text);
    await writable.close();
}

function openExportHandleDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(EXPORT_DIR_IDB.dbName, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(EXPORT_DIR_IDB.storeName)) {
                db.createObjectStore(EXPORT_DIR_IDB.storeName);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
    });
}

async function loadExportDirectoryHandle() {
    try {
        const db = await openExportHandleDb();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(EXPORT_DIR_IDB.storeName, 'readonly');
            const req = tx.objectStore(EXPORT_DIR_IDB.storeName).get(EXPORT_DIR_IDB.handleKey);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
            tx.oncomplete = () => db.close();
        });
    } catch {
        return null;
    }
}

async function saveExportDirectoryHandle(handle) {
    const db = await openExportHandleDb();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(EXPORT_DIR_IDB.storeName, 'readwrite');
        tx.objectStore(EXPORT_DIR_IDB.storeName).put(handle, EXPORT_DIR_IDB.handleKey);
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = () => reject(tx.error);
    });
}

function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Minimal ZIP (store / no compression) so CSV + GeoJSON download as one file. */
function buildStoreZipBlob(files) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    files.forEach(file => {
        const nameBytes = new TextEncoder().encode(file.name);
        const data = file.bytes;
        const crc = crc32(data);
        const local = new Uint8Array(30 + nameBytes.length + data.length);
        const localView = new DataView(local.buffer);
        localView.setUint32(0, 0x04034b50, true);
        localView.setUint16(4, 20, true);
        localView.setUint16(6, 0, true);
        localView.setUint16(8, 0, true);
        localView.setUint16(10, 0, true);
        localView.setUint16(12, 0, true);
        localView.setUint32(14, crc, true);
        localView.setUint32(18, data.length, true);
        localView.setUint32(22, data.length, true);
        localView.setUint16(26, nameBytes.length, true);
        localView.setUint16(28, 0, true);
        local.set(nameBytes, 30);
        local.set(data, 30 + nameBytes.length);
        localParts.push(local);

        const central = new Uint8Array(46 + nameBytes.length);
        const centralView = new DataView(central.buffer);
        centralView.setUint32(0, 0x02014b50, true);
        centralView.setUint16(4, 20, true);
        centralView.setUint16(6, 20, true);
        centralView.setUint16(8, 0, true);
        centralView.setUint16(10, 0, true);
        centralView.setUint16(12, 0, true);
        centralView.setUint16(14, 0, true);
        centralView.setUint32(16, crc, true);
        centralView.setUint32(20, data.length, true);
        centralView.setUint32(24, data.length, true);
        centralView.setUint16(28, nameBytes.length, true);
        centralView.setUint16(30, 0, true);
        centralView.setUint16(32, 0, true);
        centralView.setUint16(34, 0, true);
        centralView.setUint16(36, 0, true);
        centralView.setUint32(38, 0, true);
        centralView.setUint32(42, offset, true);
        central.set(nameBytes, 46);
        centralParts.push(central);

        offset += local.length;
    });

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, files.length, true);
    endView.setUint16(10, files.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, offset, true);
    endView.setUint16(20, 0, true);

    return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
}

function crc32(bytes) {
    if (!crc32.table) {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i += 1) {
            let c = i;
            for (let j = 0; j < 8; j += 1) {
                c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            }
            table[i] = c;
        }
        crc32.table = table;
    }
    let crc = 0xffffffff;
    const table = crc32.table;
    for (let i = 0; i < bytes.length; i += 1) {
        crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function csvEscape(value) {
    const text = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

function formatExportNumber(value, digits = 6) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '';
    return String(Number(num.toFixed(digits)));
}

function slugifyFilename(value) {
    return String(value || 'layer')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60) || 'layer';
}

async function switchCompareView(view) {
    if (!context || !isSandboxActive() || isSandboxComputing()) return;
    const nextView =
        view === SANDBOX_COMPARE_VIEWS.BEFORE
            ? SANDBOX_COMPARE_VIEWS.BEFORE
            : SANDBOX_COMPARE_VIEWS.AFTER;
    if (getSandboxCompareView() === nextView) return;

    setSandboxCompareView(nextView);
    const layerId = getSandboxLayerId();
    if (layerId) {
        await context.refreshSandboxLayer?.(layerId);
    }
    updateCompareControls();
    syncCompositeSandboxPanel(layerId, context.getActiveResolution?.());
}

function isSandboxLockedLocal() {
    return isSandboxActive() || isSandboxComputing();
}

function deferToNextFrame() {
    return new Promise(resolve => {
        requestAnimationFrame(() => resolve());
    });
}

function formatWeight(value) {
    return Number(value).toFixed(3);
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function showSandboxError(panel, message) {
    const errorEl =
        panel?.querySelector('.composite-sandbox-error') ||
        document.getElementById('compositeSandboxError');
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = false;
    window.setTimeout(() => {
        errorEl.hidden = true;
    }, 6000);
}

export function blockCompositeSandboxNavigation() {
    return isSandboxLockedLocal();
}

window.syncCompositeSandboxPanel = syncCompositeSandboxPanel;

export { usesCustomComposite } from './composite_sandbox_state.js';
export { CUSTOM_COMPOSITE_FIELD } from './composite_score.js';
