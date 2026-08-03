/**
 * Experimental Custom Overall Index builder.
 *
 * Isolated from the per-theme weight sandbox:
 * - Modal to pick themes + sub-indicators
 * - Builds a sibling layer (svCustomOverallLayer) from official data
 * - Uses official theme/overall weights renormalized over the selection
 *
 * Toggle CUSTOM_OVERALL_BUILDER_ENABLED to disable, or delete this module +
 * catalog/CSS/HTML hooks to remove the feature entirely.
 */

import {
    scoreFeaturesOfficialRecipe,
    pickJoinValue,
    toNumericBinaryAware
} from './composite_score.js';
import { loadIndicatorWeightsConfig } from './composite_weight_config.js';
import { themesForResolution, getThemeByLayerId } from './custom_overall_catalog.js';
import { getColorRamp } from './color_ramp_selector.js';
import { getValueClassIndex, resolveClassificationBreaks } from './vector_layers.js';
import { getClassificationMode } from './map_display_controls.js';
import {
    clearAnalysisSelection,
    setAnalysisSelectionActive
} from './analysis_selection.js';
import { forceAoiStyleRecovery } from './aoi_spotlight.js';

/** Flip to false to hide the feature without deleting files. */
export const CUSTOM_OVERALL_BUILDER_ENABLED = true;

export const CUSTOM_OVERALL_LAYER_ID = 'svCustomOverallLayer';
export const CUSTOM_OVERALL_SCORE_FIELD = '_custom_overall_score';
const OFFICIAL_OVERALL_SCORE_FIELD = 'overall_vulnerability_score';
const EXPORT_COLOR_RAMP_ID = 'whiteToDarkBlue3';
const EXPORT_PANEL_WIDTH = 720;
const EXPORT_PANEL_HEIGHT = 900;

/** Themes that enter Overall as a single official metric (not a Kendall sub-composite). */
const DIRECT_PILLAR_THEME_NUMBERS = new Set([1, 5]);

const SCORE_FIELD_ALIASES = {
    'Displacement Ratio': ['Displacement Ratio', 'T1 Displacement Ratio', 'Displacement_Ratio'],
    'Demographic Factor': [
        'Demographic Factor',
        'Demographic Shock Factor',
        'T5 Demographic Shock Factor',
        'Demographic Tension / Stress'
    ],
    composite_score: ['composite_score']
};

const DEFAULT_JOIN_KEYS = [
    'adm2_name',
    'ADM2_NAME',
    'ADM2_Name',
    'adm1_name',
    'ADM1_NAME',
    'adm3_name',
    'ADM3_NAME',
    'adm3_pcode',
    'ACS_CODE',
    'ACS Code'
];

let context = null;
let weightsConfig = null;
let activeGeoJson = null;
let activeSelection = null;
let computing = false;

export function isCustomOverallActive() {
    return Boolean(activeGeoJson?.features?.length);
}

export function getCustomOverallGeoJson() {
    return activeGeoJson;
}

export function getCustomOverallSelection() {
    return activeSelection ? JSON.parse(JSON.stringify(activeSelection)) : null;
}

export function initCustomOverallBuilder(appContext) {
    if (!CUSTOM_OVERALL_BUILDER_ENABLED) {
        hideBuilderChrome();
        return;
    }
    context = appContext;
    ensureModalExists();
    bindUi();
    syncBuilderChrome();
    void ensureWeightsConfig();
}

function hideBuilderChrome() {
    document.getElementById('customOverallBuilderWrap')?.setAttribute('hidden', '');
    document.getElementById('svCustomOverallRow')?.setAttribute('hidden', '');
    document.getElementById('customOverallModal')?.setAttribute('hidden', '');
}

async function ensureWeightsConfig() {
    if (weightsConfig) return weightsConfig;
    try {
        weightsConfig = await loadIndicatorWeightsConfig();
    } catch (error) {
        console.warn('Custom overall: could not load indicator weights', error);
        weightsConfig = null;
    }
    return weightsConfig;
}

function bindUi() {
    document.getElementById('customOverallOpenBtn')?.addEventListener('click', () => {
        void openModal();
    });
    document.getElementById('customOverallDeleteBtn')?.addEventListener('click', () => {
        void deleteCustomOverall();
    });
    document.getElementById('customOverallExportBtn')?.addEventListener('click', () => {
        void exportSideBySideComparison();
    });
    document.getElementById('customOverallModalClose')?.addEventListener('click', closeModal);
    document.getElementById('customOverallModalCancel')?.addEventListener('click', closeModal);
    document.getElementById('customOverallModalCreate')?.addEventListener('click', () => {
        void createCustomOverall();
    });
    document.getElementById('customOverallModalBackdrop')?.addEventListener('click', closeModal);

    document.getElementById('customOverallThemeList')?.addEventListener('change', event => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (target.classList.contains('custom-overall-theme-check')) {
            syncThemeChildren(target);
        } else if (target.classList.contains('custom-overall-indicator-check')) {
            syncThemeParent(target.closest('.custom-overall-theme'));
        }
        updateCreateEnabled();
    });
}

function ensureModalExists() {
    // Markup lives in index.html; nothing to create dynamically.
}

async function openModal() {
    if (!context) return;
    // Avoid AOI selection mode / mutated styles interfering with builder UX.
    clearAnalysisSelection();
    setAnalysisSelectionActive(false);
    await forceAoiStyleRecovery();

    if (context.isWeightSandboxLocked?.()) {
        showModalError('Finish or delete the experimental weight sandbox before building a custom overall.');
        const modal = document.getElementById('customOverallModal');
        if (modal) modal.hidden = false;
        return;
    }

    await ensureWeightsConfig();
    const resolution = context.getActiveResolution?.() || 'district';
    await renderThemeList(resolution);
    clearModalError();
    const modal = document.getElementById('customOverallModal');
    if (modal) modal.hidden = false;
    updateCreateEnabled();
}

function closeModal() {
    const modal = document.getElementById('customOverallModal');
    if (modal) modal.hidden = true;
    clearModalError();
}

async function renderThemeList(resolution) {
    const host = document.getElementById('customOverallThemeList');
    if (!host) return;

    const themes = themesForResolution(resolution);
    const resLabel = resolutionLabel(resolution);

    const subtitle = document.getElementById('customOverallModalSubtitle');
    if (subtitle) {
        subtitle.textContent = `Select themes and sub-indicators for ${resLabel}. Scoring follows the official recipe (median impute, min–max, Kendall τ weights, weighted sum).`;
    }

    const blocks = [];
    for (const theme of themes) {
        const availableIndicators = await indicatorsPresentInSource(theme, resolution);
        if (!availableIndicators.length) continue;

        const themeId = `co-theme-${theme.layerId}`;
        const children = availableIndicators
            .map((ind, idx) => {
                const id = `co-ind-${theme.layerId}-${idx}`;
                return `
                    <label class="custom-overall-indicator" for="${id}">
                        <input
                            type="checkbox"
                            class="custom-overall-indicator-check"
                            id="${id}"
                            data-field="${escapeAttr(ind.field)}"
                            checked
                        >
                        <span>${escapeHtml(ind.label)}</span>
                    </label>
                `;
            })
            .join('');

        blocks.push(`
            <div class="custom-overall-theme" data-theme-layer="${escapeAttr(theme.layerId)}">
                <div class="custom-overall-theme-header">
                    <label class="custom-overall-theme-label" for="${themeId}">
                        <input
                            type="checkbox"
                            class="custom-overall-theme-check"
                            id="${themeId}"
                            checked
                        >
                        <span class="custom-overall-theme-title">
                            Theme ${theme.themeNumber} — ${escapeHtml(theme.title)}
                        </span>
                    </label>
                </div>
                <div class="custom-overall-indicators">
                    ${children}
                </div>
            </div>
        `);
    }

    host.innerHTML = blocks.length
        ? blocks.join('')
        : `<p class="custom-overall-empty">No themes available at ${escapeHtml(resLabel)} resolution.</p>`;
}

async function indicatorsPresentInSource(theme, resolution) {
    try {
        const sourceGeo = await context.getSourceLayerGeoJson?.(theme.layerId, resolution);
        if (!sourceGeo?.features?.length) return [];
        const available = new Set();
        const limit = Math.min(40, sourceGeo.features.length);
        for (let i = 0; i < limit; i++) {
            Object.keys(sourceGeo.features[i]?.properties || {}).forEach(key => available.add(key));
        }
        return theme.indicators
            .map(ind => {
                if (available.has(ind.field)) return ind;
                const stripped = ind.field.trim();
                for (const key of available) {
                    if (key.trim() === stripped) {
                        return { field: key, label: ind.label };
                    }
                }
                return null;
            })
            .filter(Boolean);
    } catch (error) {
        console.warn(`Custom overall: could not inspect ${theme.layerId}`, error);
        return theme.indicators;
    }
}

function syncThemeChildren(themeCheck) {
    const block = themeCheck.closest('.custom-overall-theme');
    if (!block) return;
    const checked = Boolean(themeCheck.checked);
    themeCheck.indeterminate = false;
    block.classList.toggle('is-theme-off', !checked);
    block.querySelectorAll('.custom-overall-indicator-check').forEach(input => {
        input.checked = checked;
        input.disabled = !checked;
    });
}

function syncThemeParent(block) {
    if (!block) return;
    const themeCheck = block.querySelector('.custom-overall-theme-check');
    const children = [...block.querySelectorAll('.custom-overall-indicator-check')];
    if (!(themeCheck instanceof HTMLInputElement) || !children.length) return;
    const checkedCount = children.filter(c => c.checked).length;
    if (checkedCount === 0) {
        themeCheck.checked = false;
        themeCheck.indeterminate = false;
        children.forEach(input => {
            input.disabled = true;
        });
        block.classList.add('is-theme-off');
        return;
    }
    themeCheck.checked = checkedCount === children.length;
    themeCheck.indeterminate = checkedCount > 0 && checkedCount < children.length;
    children.forEach(input => {
        input.disabled = false;
    });
    block.classList.remove('is-theme-off');
}

function collectSelection() {
    /** @type {Record<string, string[]>} */
    const selection = {};
    document.querySelectorAll('#customOverallThemeList .custom-overall-theme').forEach(block => {
        const layerId = block.getAttribute('data-theme-layer');
        if (!layerId) return;
        const themeCheck = block.querySelector('.custom-overall-theme-check');
        if (!(themeCheck instanceof HTMLInputElement) || !themeCheck.checked) return;
        const fields = [...block.querySelectorAll('.custom-overall-indicator-check:checked')].map(
            input => input.getAttribute('data-field')
        ).filter(Boolean);
        if (fields.length) {
            selection[layerId] = fields;
        }
    });
    return selection;
}

function updateCreateEnabled() {
    const btn = document.getElementById('customOverallModalCreate');
    if (!btn) return;
    const selection = collectSelection();
    const hasAny = Object.values(selection).some(fields => fields.length > 0);
    btn.disabled = !hasAny || computing;
}

async function createCustomOverall() {
    if (!context || computing) return;
    if (context.isWeightSandboxLocked?.()) {
        showModalError('Finish or delete the experimental weight sandbox first.');
        return;
    }

    const selection = collectSelection();
    if (!Object.keys(selection).length) {
        showModalError('Select at least one theme or sub-indicator.');
        return;
    }

    computing = true;
    updateCreateEnabled();
    setModalBusy(true);
    clearModalError();

    try {
        await ensureWeightsConfig();
        const resolution = context.getActiveResolution?.() || 'district';
        const geojson = await buildCustomOverallGeoJson(selection, resolution);
        activeGeoJson = geojson;
        activeSelection = selection;
        await context.showCustomOverallLayer?.(geojson);
        closeModal();
    } catch (error) {
        console.error('Custom overall build failed:', error);
        showModalError(error?.message || 'Could not build custom overall index.');
    } finally {
        computing = false;
        setModalBusy(false);
        updateCreateEnabled();
        syncBuilderChrome();
    }
}

async function deleteCustomOverall() {
    activeGeoJson = null;
    activeSelection = null;
    await context?.hideCustomOverallLayer?.();
    syncBuilderChrome();
}

export async function clearCustomOverallOnResolutionChange() {
    if (!isCustomOverallActive()) {
        syncBuilderChrome();
        return;
    }
    await deleteCustomOverall();
}

function syncBuilderChrome() {
    if (!CUSTOM_OVERALL_BUILDER_ENABLED) {
        hideBuilderChrome();
        return;
    }
    const wrap = document.getElementById('customOverallBuilderWrap');
    if (wrap) wrap.hidden = false;

    const row = document.getElementById('svCustomOverallRow');
    const deleteBtn = document.getElementById('customOverallDeleteBtn');
    const exportBtn = document.getElementById('customOverallExportBtn');
    const active = isCustomOverallActive();
    if (row) row.hidden = !active;
    if (deleteBtn) {
        deleteBtn.hidden = !active;
        deleteBtn.disabled = computing;
    }
    if (exportBtn) {
        exportBtn.hidden = !active;
        exportBtn.disabled = computing;
    }
}

async function buildCustomOverallGeoJson(selection, resolution) {
    const overallGeo = await loadOverallBase(resolution);
    if (!overallGeo?.features?.length) {
        throw new Error('Overall vulnerability geometry is not available for this resolution.');
    }

    const joinKeys = getJoinKeys(resolution);
    const cloned = cloneGeoJson(overallGeo);
    const pillarDefs = [];

    for (const [layerId, fields] of Object.entries(selection)) {
        const theme = getThemeByLayerId(layerId);
        if (!theme || !fields.length) continue;

        const sourceGeo = await context.getSourceLayerGeoJson?.(layerId, resolution);
        if (!sourceGeo?.features?.length) {
            throw new Error(`Could not load data for ${theme.title}.`);
        }

        const scoreByKey = buildThemePillarScores(theme, fields, sourceGeo, joinKeys);
        if (!scoreByKey.size) {
            console.warn(`Custom overall: no usable fields for ${theme.title}, skipping.`);
            continue;
        }

        const pillarField = `_custom_pillar_T${theme.themeNumber}`;
        cloned.features.forEach(feature => {
            if (!feature.properties) feature.properties = {};
            const key = pickJoinValue(feature.properties, joinKeys);
            const score = key ? scoreByKey.get(key) : undefined;
            feature.properties[pillarField] = Number.isFinite(score) ? score : null;
        });

        pillarDefs.push({
            field: pillarField,
            label: theme.title,
            inverted: false,
            themeNumber: theme.themeNumber
        });
    }

    if (!pillarDefs.length) {
        throw new Error('None of the selected indicators were found in the source data.');
    }

    // Official overall step: Kendall-weighted composite of the selected pillars.
    const { scoresByIndex } = scoreFeaturesOfficialRecipe(cloned.features, pillarDefs);
    cloned.features.forEach((feature, index) => {
        if (!feature.properties) feature.properties = {};
        const score = scoresByIndex[index];
        feature.properties[CUSTOM_OVERALL_SCORE_FIELD] = Number.isFinite(score) ? score : null;
    });

    cloned._customOverallMeta = {
        resolution,
        pillarCount: pillarDefs.length,
        selection,
        recipe: 'official-kendall'
    };
    return cloned;
}

/**
 * Build per-unit theme pillar scores the same way the pipeline feeds Overall:
 * - Themes 1 & 5: official scoreField when selected (Displacement Ratio / Demographic Factor)
 * - Composite themes with a full indicator selection: stored composite_score
 * - Otherwise: Kendall composite of the selected sub-indicators
 */
function buildThemePillarScores(theme, selectedFields, sourceGeo, joinKeys) {
    const available = collectAvailableFields(sourceGeo);
    const resolvedSelected = selectedFields
        .map(field => resolveFieldName(field, available))
        .filter(Boolean);
    if (!resolvedSelected.length) return new Map();

    const scoreByKey = new Map();
    const putScore = (feature, score) => {
        const props = feature?.properties;
        if (!props) return;
        const key = pickJoinValue(props, joinKeys);
        if (!key || scoreByKey.has(key)) return;
        if (Number.isFinite(score)) scoreByKey.set(key, score);
    };

    if (DIRECT_PILLAR_THEME_NUMBERS.has(theme.themeNumber)) {
        const officialField = resolveScoreField(theme.scoreField, available);
        if (officialField && resolvedSelected.includes(officialField)) {
            sourceGeo.features.forEach(feature => {
                putScore(feature, toNumericBinaryAware(feature?.properties?.[officialField]));
            });
            return scoreByKey;
        }
        // Score field not selected: Kendall-composite the chosen alternatives.
        return kendallScoreByJoinKey(sourceGeo, resolvedSelected, joinKeys);
    }

    if (isFullCompositeSelection(theme, resolvedSelected, available)) {
        const compositeField = resolveFieldName('composite_score', available);
        if (compositeField) {
            sourceGeo.features.forEach(feature => {
                putScore(feature, toNumericBinaryAware(feature?.properties?.[compositeField]));
            });
            if (scoreByKey.size) return scoreByKey;
        }
    }

    return kendallScoreByJoinKey(sourceGeo, resolvedSelected, joinKeys);
}

function kendallScoreByJoinKey(sourceGeo, fields, joinKeys) {
    const indicators = fields.map(field => ({
        field,
        label: field,
        inverted: false
    }));
    const { scoresByIndex } = scoreFeaturesOfficialRecipe(sourceGeo.features, indicators);
    const scoreByKey = new Map();
    sourceGeo.features.forEach((feature, index) => {
        const props = feature?.properties;
        if (!props) return;
        const key = pickJoinValue(props, joinKeys);
        if (!key || scoreByKey.has(key)) return;
        const score = scoresByIndex[index];
        if (Number.isFinite(score)) scoreByKey.set(key, score);
    });
    return scoreByKey;
}

function collectAvailableFields(sourceGeo) {
    const available = new Set();
    const limit = Math.min(40, sourceGeo?.features?.length || 0);
    for (let i = 0; i < limit; i++) {
        Object.keys(sourceGeo.features[i]?.properties || {}).forEach(key => available.add(key));
    }
    return available;
}

function resolveFieldName(preferred, available) {
    if (!preferred) return null;
    if (available.has(preferred)) return preferred;
    const stripped = String(preferred).trim();
    if (available.has(stripped)) return stripped;
    for (const key of available) {
        if (key.trim() === stripped) return key;
    }
    return null;
}

function resolveScoreField(scoreField, available) {
    const aliases = SCORE_FIELD_ALIASES[scoreField] || [scoreField];
    for (const alias of aliases) {
        const resolved = resolveFieldName(alias, available);
        if (resolved) return resolved;
    }
    return null;
}

function isFullCompositeSelection(theme, resolvedSelected, available) {
    const catalogFields = (theme.indicators || [])
        .map(ind => resolveFieldName(ind.field, available))
        .filter(Boolean);
    if (!catalogFields.length) return false;
    if (resolvedSelected.length < catalogFields.length) return false;
    const selectedSet = new Set(resolvedSelected);
    return catalogFields.every(field => selectedSet.has(field));
}

function getJoinKeys(resolution) {
    const fromConfig = weightsConfig?.[resolution]?.overall?.joinKeys;
    if (Array.isArray(fromConfig) && fromConfig.length) {
        return [...fromConfig, ...DEFAULT_JOIN_KEYS];
    }
    return DEFAULT_JOIN_KEYS;
}

async function loadOverallBase(resolution) {
    if (typeof context.getOverallGeoJson === 'function') {
        return context.getOverallGeoJson(resolution);
    }
    return context.getSourceLayerGeoJson?.(CUSTOM_OVERALL_LAYER_ID, resolution) ||
        context.getSourceLayerGeoJson?.('svOverallTensionLayer', resolution);
}

function cloneGeoJson(geojson) {
    return JSON.parse(JSON.stringify(geojson));
}

function setModalBusy(busy) {
    const createBtn = document.getElementById('customOverallModalCreate');
    const cancelBtn = document.getElementById('customOverallModalCancel');
    const status = document.getElementById('customOverallModalStatus');
    if (createBtn) createBtn.disabled = busy;
    if (cancelBtn) cancelBtn.disabled = busy;
    if (status) {
        status.hidden = !busy;
        status.textContent = busy ? 'Calculating custom overall…' : '';
    }
}

function showModalError(message) {
    const el = document.getElementById('customOverallModalError');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
}

function clearModalError() {
    const el = document.getElementById('customOverallModalError');
    if (!el) return;
    el.textContent = '';
    el.hidden = true;
}

function resolutionLabel(resolution) {
    if (resolution === 'governorate') return 'Governorate';
    if (resolution === 'cadastre') return 'Cadastre';
    return 'District';
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(text) {
    return escapeHtml(text).replace(/'/g, '&#39;');
}

function collectNumericScores(geojson, field) {
    const values = [];
    (geojson?.features || []).forEach(feature => {
        const value = Number(feature?.properties?.[field]);
        if (Number.isFinite(value)) values.push(value);
    });
    return values;
}

function collectGeoBounds(geojsonList) {
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    const visitCoord = (lng, lat) => {
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
    };

    const visitCoords = coords => {
        if (!Array.isArray(coords) || !coords.length) return;
        if (typeof coords[0] === 'number') {
            visitCoord(coords[0], coords[1]);
            return;
        }
        coords.forEach(visitCoords);
    };

    geojsonList.forEach(geojson => {
        (geojson?.features || []).forEach(feature => {
            if (feature?.geometry?.coordinates) visitCoords(feature.geometry.coordinates);
        });
    });

    if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) {
        throw new Error('Could not determine Lebanon bounds for export.');
    }
    return { minLng, minLat, maxLng, maxLat };
}

function makeProjector(bounds, width, height, padding = 28) {
    const spanLng = Math.max(1e-9, bounds.maxLng - bounds.minLng);
    const spanLat = Math.max(1e-9, bounds.maxLat - bounds.minLat);
    const availW = Math.max(1, width - padding * 2);
    const availH = Math.max(1, height - padding * 2);
    const scale = Math.min(availW / spanLng, availH / spanLat);
    const offsetX = padding + (availW - spanLng * scale) / 2;
    const offsetY = padding + (availH - spanLat * scale) / 2;
    return (lng, lat) => ({
        x: offsetX + (lng - bounds.minLng) * scale,
        y: offsetY + (bounds.maxLat - lat) * scale
    });
}

function drawPolygonRings(ctx, rings, project) {
    rings.forEach(ring => {
        if (!Array.isArray(ring) || ring.length < 2) return;
        ring.forEach((coord, index) => {
            if (!Array.isArray(coord) || coord.length < 2) return;
            const point = project(coord[0], coord[1]);
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
    });
}

function drawFeaturePath(ctx, feature, project) {
    const geometry = feature?.geometry;
    if (!geometry) return false;
    ctx.beginPath();
    if (geometry.type === 'Polygon') {
        drawPolygonRings(ctx, geometry.coordinates || [], project);
        return true;
    }
    if (geometry.type === 'MultiPolygon') {
        (geometry.coordinates || []).forEach(polygon => {
            drawPolygonRings(ctx, polygon || [], project);
        });
        return true;
    }
    return false;
}

function resolveFillColor(value, breaks, colors) {
    if (!Number.isFinite(value)) return '#e2e8f0';
    const classIndex = getValueClassIndex(value, breaks, colors.length);
    if (classIndex === null) return '#e2e8f0';
    return colors[classIndex] || colors[colors.length - 1] || '#94a3b8';
}

function drawChoroplethPanel(ctx, geojson, field, breaks, colors, project, originX, originY, width, height) {
    ctx.save();
    ctx.translate(originX, originY);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    (geojson?.features || []).forEach(feature => {
        const value = Number(feature?.properties?.[field]);
        if (!drawFeaturePath(ctx, feature, project)) return;
        ctx.fillStyle = resolveFillColor(value, breaks, colors);
        ctx.fill('evenodd');
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 0.45;
        ctx.stroke();
    });
    ctx.restore();
}

function drawLegend(ctx, colors, x, y) {
    const box = 14;
    const gap = 8;
    // Ramp is low → high (white → dark), matching the live map choropleth.
    const labels = ['Lower vulnerability', 'Medium', 'Higher vulnerability'];
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    colors.forEach((color, index) => {
        const left = x + index * 170;
        ctx.fillStyle = color;
        ctx.fillRect(left, y, box, box);
        ctx.strokeStyle = '#64748b';
        ctx.strokeRect(left + 0.5, y + 0.5, box - 1, box - 1);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(labels[index] || `Class ${index + 1}`, left + box + 6, y + 11);
    });
}

/**
 * Class breaks for one export panel — same recipe as the live map choropleth
 * (prefer the styled layer's colorSpec when it matches this GeoJSON + field).
 */
function resolvePanelBreaks(geojson, field, colorRamp, liveLayerId) {
    const liveLayer = context?.layers?.vector?.[liveLayerId];
    const liveBreaks = liveLayer?.layerData?.colorSpec?.breaks;
    const liveProperty = liveLayer?.layerData?.selectedProperty;
    const liveRaw = liveLayer?.layerData?.raw;
    if (
        Array.isArray(liveBreaks) &&
        liveBreaks.length >= 2 &&
        liveProperty === field &&
        liveRaw === geojson
    ) {
        return liveBreaks;
    }

    const values = collectNumericScores(geojson, field);
    if (!values.length) return null;
    return resolveClassificationBreaks(
        values,
        colorRamp.colors.length,
        getClassificationMode()
    );
}

function renderSideBySideChoroplethComparison(officialGeo, customGeo) {
    const colorRamp = getColorRamp(EXPORT_COLOR_RAMP_ID);
    if (!colorRamp?.colors?.length) {
        throw new Error('Color ramp for export is unavailable.');
    }

    // Per-panel class breaks — same as each layer on the live map. Shared
    // official-only breaks made the custom panel diverge from the map view.
    // Identical score sets still produce identical colors (same breaks).
    const officialBreaks = resolvePanelBreaks(
        officialGeo,
        OFFICIAL_OVERALL_SCORE_FIELD,
        colorRamp,
        'svOverallTensionLayer'
    );
    const customBreaks = resolvePanelBreaks(
        customGeo,
        CUSTOM_OVERALL_SCORE_FIELD,
        colorRamp,
        CUSTOM_OVERALL_LAYER_ID
    );
    if (!officialBreaks && !customBreaks) {
        throw new Error('No score values available to export.');
    }

    const bounds = collectGeoBounds([officialGeo, customGeo]);
    const project = makeProjector(bounds, EXPORT_PANEL_WIDTH, EXPORT_PANEL_HEIGHT);

    const gap = 24;
    const headerH = 52;
    const footerH = 44;
    const width = EXPORT_PANEL_WIDTH * 2 + gap * 3;
    const height = EXPORT_PANEL_HEIGHT + headerH + footerH + gap;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create export canvas.');

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 22px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Official Overall Vulnerability Index', gap, 34);
    ctx.fillText('Custom Overall Index', gap * 2 + EXPORT_PANEL_WIDTH, 34);

    const panelY = headerH;
    drawChoroplethPanel(
        ctx,
        officialGeo,
        OFFICIAL_OVERALL_SCORE_FIELD,
        officialBreaks || customBreaks,
        colorRamp.colors,
        project,
        gap,
        panelY,
        EXPORT_PANEL_WIDTH,
        EXPORT_PANEL_HEIGHT
    );
    drawChoroplethPanel(
        ctx,
        customGeo,
        CUSTOM_OVERALL_SCORE_FIELD,
        customBreaks || officialBreaks,
        colorRamp.colors,
        project,
        gap * 2 + EXPORT_PANEL_WIDTH,
        panelY,
        EXPORT_PANEL_WIDTH,
        EXPORT_PANEL_HEIGHT
    );

    drawLegend(ctx, colorRamp.colors, gap, height - 30);
    const stamp = new Date().toLocaleString();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`Class breaks match live map (per panel) · ${stamp}`, gap + 420, height - 18);

    return canvas;
}

function downloadCanvasPng(canvas, filename) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (!blob) {
                reject(new Error('Could not encode PNG.'));
                return;
            }
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            resolve();
        }, 'image/png');
    });
}

async function exportSideBySideComparison() {
    if (!isCustomOverallActive() || !context) return;

    const exportBtn = document.getElementById('customOverallExportBtn');
    const deleteBtn = document.getElementById('customOverallDeleteBtn');
    const originalLabel = exportBtn?.textContent || 'Export side by side comparison';

    computing = true;
    syncBuilderChrome();
    if (exportBtn) exportBtn.textContent = 'Exporting…';

    try {
        const resolution = context.getActiveResolution?.() || 'district';
        const officialGeo = await context.getOverallGeoJson?.(resolution);
        if (!officialGeo?.features?.length) {
            throw new Error('Official overall layer data is not available for export.');
        }
        if (!activeGeoJson?.features?.length) {
            throw new Error('Custom overall layer data is not available for export.');
        }

        const composed = renderSideBySideChoroplethComparison(officialGeo, activeGeoJson);
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        await downloadCanvasPng(composed, `custom-overall-comparison-${stamp}.png`);
    } catch (error) {
        console.error('Custom overall export failed:', error);
        window.alert(error?.message || 'Could not export side-by-side comparison.');
    } finally {
        computing = false;
        if (exportBtn) exportBtn.textContent = originalLabel;
        if (deleteBtn) deleteBtn.disabled = false;
        syncBuilderChrome();
    }
}

