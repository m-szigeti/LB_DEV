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
    getAnalysisSelectionCount,
    getAnalysisSelectionKeys,
    getFeatureSelectionKey,
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
/** @type {'national' | 'aoi'} */
let builderMode = 'national';
/** @type {Set<string> | null} */
let aoiKeysSnapshot = null;

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
        void openModal({ mode: 'national' });
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

/**
 * Open the theme/indicator picker for an AOI-scoped custom index.
 * Preserves the current AOI selection and normalizes scores over those units only.
 */
export async function openCustomOverallBuilderForAoi() {
    if (!CUSTOM_OVERALL_BUILDER_ENABLED) {
        window.alert('Custom overall builder is disabled.');
        return;
    }
    if (getAnalysisSelectionCount() < 1) {
        window.alert('Select at least one map unit in AOI mode first.');
        return;
    }
    await openModal({ mode: 'aoi' });
}

async function openModal({ mode = 'national' } = {}) {
    if (!context) return;
    builderMode = mode === 'aoi' ? 'aoi' : 'national';

    if (builderMode === 'national') {
        // Avoid AOI selection mode / mutated styles interfering with national builder UX.
        clearAnalysisSelection();
        setAnalysisSelectionActive(false);
        await forceAoiStyleRecovery();
        aoiKeysSnapshot = null;
    } else {
        aoiKeysSnapshot = getAnalysisSelectionKeys();
        if (!aoiKeysSnapshot.size) {
            showModalError('Select at least one map unit for the AOI first.');
            const modal = document.getElementById('customOverallModal');
            if (modal) modal.hidden = false;
            return;
        }
    }

    if (context.isWeightSandboxLocked?.()) {
        showModalError('Finish or delete the experimental weight sandbox before building a custom overall.');
        syncModalChromeForMode();
        const modal = document.getElementById('customOverallModal');
        if (modal) modal.hidden = false;
        return;
    }

    await ensureWeightsConfig();
    const resolution = context.getActiveResolution?.() || 'district';
    await renderThemeList(resolution);
    clearModalError();
    syncModalChromeForMode();
    const modal = document.getElementById('customOverallModal');
    if (modal) modal.hidden = false;
    updateCreateEnabled();
}

function syncModalChromeForMode() {
    const title = document.getElementById('customOverallModalTitle');
    const createBtn = document.getElementById('customOverallModalCreate');

    if (builderMode === 'aoi') {
        if (title) title.textContent = 'Design custom index for AOI';
        if (createBtn) createBtn.textContent = 'Create AOI index';
    } else {
        if (title) title.textContent = 'Build custom overall index';
        if (createBtn) createBtn.textContent = 'Create custom overall';
    }
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
    const aoiCount = builderMode === 'aoi' ? aoiKeysSnapshot?.size || getAnalysisSelectionCount() : 0;

    const subtitle = document.getElementById('customOverallModalSubtitle');
    if (subtitle) {
        if (builderMode === 'aoi') {
            subtitle.textContent =
                `Select themes and sub-indicators for ${aoiCount} selected ${resLabel.toLowerCase()} unit${aoiCount === 1 ? '' : 's'}. ` +
                `Scores are recalculated over the AOI only (median impute, min–max, Kendall τ weights, weighted sum). Units outside the AOI stay gray.`;
        } else {
            subtitle.textContent =
                `Select themes and sub-indicators for ${resLabel}. Scoring follows the official recipe (median impute, min–max, Kendall τ weights, weighted sum).`;
        }
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

    const aoiKeys =
        builderMode === 'aoi'
            ? new Set(aoiKeysSnapshot?.size ? aoiKeysSnapshot : getAnalysisSelectionKeys())
            : null;
    if (builderMode === 'aoi' && (!aoiKeys || aoiKeys.size < 1)) {
        showModalError('AOI selection is empty. Select map units first.');
        return;
    }

    computing = true;
    updateCreateEnabled();
    setModalBusy(true);
    clearModalError();

    try {
        await ensureWeightsConfig();
        const resolution = context.getActiveResolution?.() || 'district';
        const geojson = await buildCustomOverallGeoJson(selection, resolution, { aoiKeys });
        activeGeoJson = geojson;
        activeSelection = selection;
        await context.showCustomOverallLayer?.(geojson, {
            preserveAoi: Boolean(aoiKeys),
            legendName: aoiKeys ? 'AOI Custom Index' : null
        });
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

async function buildCustomOverallGeoJson(selection, resolution, options = {}) {
    const aoiKeys = options.aoiKeys instanceof Set && options.aoiKeys.size ? options.aoiKeys : null;
    const overallGeo = await loadOverallBase(resolution);
    if (!overallGeo?.features?.length) {
        throw new Error('Overall vulnerability geometry is not available for this resolution.');
    }

    const joinKeys = getJoinKeys(resolution);
    const cloned = cloneGeoJson(overallGeo);
    const pillarDefs = [];

    // Mark AOI membership up front so outside units stay null / gray on the map.
    if (aoiKeys) {
        let inAoiCount = 0;
        cloned.features.forEach(feature => {
            if (!feature.properties) feature.properties = {};
            const inAoi = featureMatchesAoiKeys(feature.properties, aoiKeys);
            feature.properties._aoi_outside = !inAoi;
            if (inAoi) inAoiCount += 1;
        });
        if (!inAoiCount) {
            throw new Error(
                'None of the selected AOI units match the overall layer at this resolution. Try selecting again on the active map layer.'
            );
        }
    } else {
        cloned.features.forEach(feature => {
            if (!feature.properties) feature.properties = {};
            delete feature.properties._aoi_outside;
        });
    }

    for (const [layerId, fields] of Object.entries(selection)) {
        const theme = getThemeByLayerId(layerId);
        if (!theme || !fields.length) continue;

        const sourceGeo = await context.getSourceLayerGeoJson?.(layerId, resolution);
        if (!sourceGeo?.features?.length) {
            throw new Error(`Could not load data for ${theme.title}.`);
        }

        const scoreByKey = buildThemePillarScores(theme, fields, sourceGeo, joinKeys, {
            aoiKeys,
            aoiOnly: Boolean(aoiKeys)
        });
        if (!scoreByKey.size) {
            console.warn(`Custom overall: no usable fields for ${theme.title}, skipping.`);
            continue;
        }

        const pillarField = `_custom_pillar_T${theme.themeNumber}`;
        cloned.features.forEach(feature => {
            if (!feature.properties) feature.properties = {};
            if (aoiKeys && feature.properties._aoi_outside) {
                feature.properties[pillarField] = null;
                return;
            }
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
    // In AOI mode, normalize / weight only over selected units.
    const scoreTargets = aoiKeys
        ? cloned.features.filter(feature => !feature.properties?._aoi_outside)
        : cloned.features;
    const { scoresByIndex } = scoreFeaturesOfficialRecipe(scoreTargets, pillarDefs);
    scoreTargets.forEach((feature, index) => {
        if (!feature.properties) feature.properties = {};
        const score = scoresByIndex[index];
        feature.properties[CUSTOM_OVERALL_SCORE_FIELD] = Number.isFinite(score) ? score : null;
    });
    if (aoiKeys) {
        cloned.features.forEach(feature => {
            if (!feature.properties) feature.properties = {};
            if (feature.properties._aoi_outside) {
                feature.properties[CUSTOM_OVERALL_SCORE_FIELD] = null;
            }
        });
    }

    cloned._customOverallMeta = {
        resolution,
        pillarCount: pillarDefs.length,
        selection,
        recipe: 'official-kendall',
        aoiMode: Boolean(aoiKeys),
        aoiUnitCount: aoiKeys ? scoreTargets.length : null
    };
    return cloned;
}

function featureMatchesAoiKeys(properties, aoiKeys) {
    if (!aoiKeys?.size || !properties) return false;
    const key = getFeatureSelectionKey(properties);
    return Boolean(key && aoiKeys.has(key));
}

/**
 * Build per-unit theme pillar scores the same way the pipeline feeds Overall:
 * - Themes 1 & 5: official scoreField when selected (Displacement Ratio / Demographic Factor)
 * - Composite themes with a full indicator selection: stored composite_score (national only)
 * - Otherwise: Kendall composite of the selected sub-indicators
 * When aoiOnly: recompute / read only over AOI units so min–max is local to the selection.
 */
function buildThemePillarScores(theme, selectedFields, sourceGeo, joinKeys, options = {}) {
    const aoiKeys = options.aoiKeys instanceof Set && options.aoiKeys.size ? options.aoiKeys : null;
    const aoiOnly = Boolean(options.aoiOnly && aoiKeys);
    const available = collectAvailableFields(sourceGeo);
    const resolvedSelected = selectedFields
        .map(field => resolveFieldName(field, available))
        .filter(Boolean);
    if (!resolvedSelected.length) return new Map();

    const sourceFeatures = aoiOnly
        ? (sourceGeo.features || []).filter(feature =>
              featureMatchesAoiKeys(feature?.properties, aoiKeys)
          )
        : sourceGeo.features || [];
    if (!sourceFeatures.length) return new Map();

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
            sourceFeatures.forEach(feature => {
                putScore(feature, toNumericBinaryAware(feature?.properties?.[officialField]));
            });
            return scoreByKey;
        }
        // Score field not selected: Kendall-composite the chosen alternatives.
        return kendallScoreByJoinKey(sourceFeatures, resolvedSelected, joinKeys);
    }

    // National builder can reuse stored composite when the full theme is selected.
    // AOI mode always recalculates so min–max / Kendall reflect the selection only.
    if (!aoiOnly && isFullCompositeSelection(theme, resolvedSelected, available)) {
        const compositeField = resolveFieldName('composite_score', available);
        if (compositeField) {
            sourceFeatures.forEach(feature => {
                putScore(feature, toNumericBinaryAware(feature?.properties?.[compositeField]));
            });
            if (scoreByKey.size) return scoreByKey;
        }
    }

    return kendallScoreByJoinKey(sourceFeatures, resolvedSelected, joinKeys);
}

function kendallScoreByJoinKey(sourceFeatures, fields, joinKeys) {
    const features = Array.isArray(sourceFeatures) ? sourceFeatures : sourceFeatures?.features || [];
    const indicators = fields.map(field => ({
        field,
        label: field,
        inverted: false
    }));
    const { scoresByIndex } = scoreFeaturesOfficialRecipe(features, indicators);
    const scoreByKey = new Map();
    features.forEach((feature, index) => {
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
        status.textContent = busy
            ? builderMode === 'aoi'
                ? 'Calculating AOI custom index…'
                : 'Calculating custom overall…'
            : '';
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
        if (feature?.properties?._aoi_outside === true) return;
        const raw = feature?.properties?.[field];
        if (raw === null || raw === undefined || raw === '') return;
        const value = Number(raw);
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

const EXPORT_AOI_OUTSIDE_FILL = '#94a3b8';
const EXPORT_NO_DATA_FILL = '#e2e8f0';

function readFeatureScore(feature, field) {
    if (feature?.properties?._aoi_outside === true) return { outside: true, value: null };
    const raw = feature?.properties?.[field];
    if (raw === null || raw === undefined || raw === '') {
        return { outside: false, value: null };
    }
    const value = Number(raw);
    return { outside: false, value: Number.isFinite(value) ? value : null };
}

function featureIsOutsideAoi(feature, aoiKeys) {
    if (!aoiKeys?.size) return feature?.properties?._aoi_outside === true;
    if (feature?.properties?._aoi_outside === true) return true;
    const key = getFeatureSelectionKey(feature?.properties);
    return !key || !aoiKeys.has(key);
}

function resolveFillColor(value, breaks, colors) {
    if (!Number.isFinite(value) || !Array.isArray(breaks) || !breaks.length) {
        return EXPORT_NO_DATA_FILL;
    }
    const classIndex = getValueClassIndex(value, breaks, colors.length);
    if (classIndex === null) return EXPORT_NO_DATA_FILL;
    return colors[classIndex] || colors[colors.length - 1] || '#94a3b8';
}

function drawChoroplethPanel(
    ctx,
    geojson,
    field,
    breaks,
    colors,
    project,
    originX,
    originY,
    width,
    height,
    options = {}
) {
    const aoiKeys = options.aoiKeys || null;
    const maskOutsideAoi = Boolean(options.maskOutsideAoi && aoiKeys?.size);

    ctx.save();
    ctx.translate(originX, originY);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    (geojson?.features || []).forEach(feature => {
        if (!drawFeaturePath(ctx, feature, project)) return;
        const outside = maskOutsideAoi
            ? featureIsOutsideAoi(feature, aoiKeys)
            : feature?.properties?._aoi_outside === true;
        if (outside) {
            ctx.fillStyle = EXPORT_AOI_OUTSIDE_FILL;
            ctx.globalAlpha = 0.45;
            ctx.fill('evenodd');
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 0.35;
            ctx.stroke();
            return;
        }
        const { value } = readFeatureScore(feature, field);
        ctx.fillStyle = resolveFillColor(value, breaks, colors);
        ctx.fill('evenodd');
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 0.45;
        ctx.stroke();
    });

    // Legend inset — top left of this panel
    drawPanelLegend(ctx, colors, 12, 12);

    if (options.centerTitle) {
        drawPanelCenterTitle(ctx, options.centerTitle, width, height);
    }
    ctx.restore();
}

function drawPanelCenterTitle(ctx, text, width, height) {
    ctx.save();
    ctx.font = '700 28px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const x = width / 2;
    const y = 28;
    // Light backdrop so black text stays readable over the map edge.
    const metrics = ctx.measureText(text);
    const padX = 14;
    const padY = 6;
    const boxW = metrics.width + padX * 2;
    const boxH = 32 + padY;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.fillRect(x - boxW / 2, y - boxH / 2, boxW, boxH);
    ctx.fillStyle = '#000000';
    ctx.fillText(text, x, y);
    ctx.restore();
}

function drawPanelLegend(ctx, colors, x, y) {
    const box = 12;
    const rowH = 18;
    const labels = ['Lower', 'Medium', 'Higher'];
    const pad = 8;
    const textW = 72;
    const panelW = pad * 2 + box + 6 + textW;
    const panelH = pad * 2 + colors.length * rowH;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fillRect(x, y, panelW, panelH);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, panelW - 1, panelH - 1);

    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    colors.forEach((color, index) => {
        const top = y + pad + index * rowH;
        ctx.fillStyle = color;
        ctx.fillRect(x + pad, top + 2, box, box);
        ctx.strokeStyle = '#94a3b8';
        ctx.strokeRect(x + pad + 0.5, top + 2.5, box - 1, box - 1);
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(labels[index] || `Class ${index + 1}`, x + pad + box + 6, top + 12);
    });
}

/**
 * Human-readable summary of selected themes / sub-indicators for the PNG caption.
 */
function formatThemeSelectionLines(selection) {
    if (!selection || typeof selection !== 'object') return [];
    const lines = [];
    Object.entries(selection).forEach(([layerId, fields]) => {
        const theme = getThemeByLayerId(layerId);
        const themeTitle = theme
            ? `Theme ${theme.themeNumber} — ${theme.title}`
            : layerId;
        const fieldList = Array.isArray(fields) ? fields : [];
        if (!fieldList.length) return;

        const catalogCount = theme?.indicators?.length || 0;
        const allSelected = catalogCount > 0 && fieldList.length >= catalogCount;
        if (allSelected) {
            lines.push(`${themeTitle} (all indicators)`);
            return;
        }

        const labels = fieldList.map(field => {
            const match = theme?.indicators?.find(ind => ind.field === field);
            return match?.label || field;
        });
        const preview = labels.slice(0, 4).join(', ');
        const more = labels.length > 4 ? ` (+${labels.length - 4} more)` : '';
        lines.push(`${themeTitle}: ${preview}${more}`);
    });
    return lines;
}

function collectAoiKeysFromCustomGeo(customGeo) {
    const keys = new Set();
    (customGeo?.features || []).forEach(feature => {
        if (feature?.properties?._aoi_outside === true) return;
        const key = getFeatureSelectionKey(feature?.properties);
        if (key) keys.add(key);
    });
    return keys;
}

function drawWrappedLines(ctx, lines, x, y, maxWidth, lineHeight, maxLines = 8) {
    const drawn = [];
    lines.forEach(line => {
        const words = String(line).split(/\s+/).filter(Boolean);
        let current = '';
        words.forEach(word => {
            const next = current ? `${current} ${word}` : word;
            if (ctx.measureText(next).width <= maxWidth) {
                current = next;
            } else {
                if (current) drawn.push(current);
                current = word;
            }
        });
        if (current) drawn.push(current);
    });

    const visible = drawn.slice(0, maxLines);
    if (drawn.length > maxLines) {
        visible[visible.length - 1] = `${visible[visible.length - 1]} …`;
    }
    visible.forEach((line, index) => {
        ctx.fillText(line, x, y + index * lineHeight);
    });
    return visible.length * lineHeight;
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

    const meta = customGeo?._customOverallMeta || {};
    const aoiMode = Boolean(meta.aoiMode);
    const aoiKeys = aoiMode ? collectAoiKeysFromCustomGeo(customGeo) : null;
    const selection = activeSelection || meta.selection || null;
    const themeLines = formatThemeSelectionLines(selection);
    const themeCaptionLines = themeLines.length > 0 ? themeLines : ['No theme selection metadata available.'];
    // Rough wrap estimate (~110 chars / line at 12px on this canvas width).
    const estimatedThemeRows = themeCaptionLines.reduce(
        (sum, line) => sum + Math.max(1, Math.ceil(String(line).length / 110)),
        1
    );

    // Per-panel class breaks — same as each layer on the live map.
    // AOI exports ignore outside units when deriving custom breaks.
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
    const titleH = 40;
    const themeBlockH = Math.max(64, 28 + estimatedThemeRows * 16);
    const headerH = titleH + themeBlockH;
    const footerH = 36;
    const width = EXPORT_PANEL_WIDTH * 2 + gap * 3;
    const height = EXPORT_PANEL_HEIGHT + headerH + footerH + gap;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create export canvas.');

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    const leftTitle = aoiMode
        ? 'Official Overall (AOI highlighted)'
        : 'Official Overall Vulnerability Index';
    const rightTitle = aoiMode ? 'AOI Custom Index' : 'Custom Overall Index';

    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 20px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(leftTitle, gap, 28);
    ctx.fillText(rightTitle, gap * 2 + EXPORT_PANEL_WIDTH, 28);

    // Theme selection caption (both national custom overall and AOI custom index)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    const themeHeader = aoiMode
        ? `Themes selected for AOI index (${meta.aoiUnitCount || aoiKeys?.size || '—'} units):`
        : 'Themes selected for custom index:';
    ctx.fillText(themeHeader, gap, titleH + 16);
    ctx.fillStyle = '#cbd5e1';
    drawWrappedLines(
        ctx,
        themeCaptionLines,
        gap,
        titleH + 34,
        width - gap * 2,
        16,
        Math.max(3, estimatedThemeRows + 1)
    );

    const panelY = headerH;
    const panelOptions = {
        maskOutsideAoi: aoiMode,
        aoiKeys
    };
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
        EXPORT_PANEL_HEIGHT,
        { ...panelOptions, centerTitle: 'Before' }
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
        EXPORT_PANEL_HEIGHT,
        { ...panelOptions, centerTitle: 'After' }
    );

    // Footer — single non-overlapping caption
    const stamp = new Date().toLocaleString();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    const footerY = height - 14;
    const footerLeft = aoiMode
        ? `Outside AOI grayed out · Class breaks match live map (per panel) · ${stamp}`
        : `Class breaks match live map (per panel) · ${stamp}`;
    ctx.fillText(footerLeft, gap, footerY);

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
        const aoiMode = Boolean(activeGeoJson?._customOverallMeta?.aoiMode);
        const filename = aoiMode
            ? `aoi-custom-index-comparison-${stamp}.png`
            : `custom-overall-comparison-${stamp}.png`;
        await downloadCanvasPng(composed, filename);
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

