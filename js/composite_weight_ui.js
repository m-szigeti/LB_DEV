/**
 * Experimental composite weight sandbox UI (district rollout).
 */

import {
    buildPrepCache,
    applyCustomCompositeToGeoJson,
    clearCustomCompositeFromGeoJson,
    slidersToWeights
} from './composite_score.js';
import {
    loadIndicatorWeightsConfig,
    getThemeConfig,
    isCompositeWeightEligible,
    COMPOSITE_WEIGHT_ENABLED_RESOLUTIONS
} from './composite_weight_config.js';
import {
    SANDBOX_MODES,
    setSandboxComputing,
    setSandboxActive,
    setSandboxSnapshot,
    resetSandboxState,
    isSandboxActive,
    isSandboxComputing,
    getSandboxLayerId,
    getSandboxCompareView,
    setSandboxCompareView,
    SANDBOX_COMPARE_VIEWS
} from './composite_sandbox_state.js';
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
    const createBtn = document.getElementById('compositeSandboxCreateBtn');
    const deleteBtn = document.getElementById('compositeSandboxDeleteBtn');
    const sliderHost = document.getElementById('compositeSandboxSliders');

    createBtn?.addEventListener('click', () => {
        void createWeightedMap();
    });
    deleteBtn?.addEventListener('click', () => {
        void deleteWeightedMap();
    });
    document.getElementById('compositeSandboxBannerDeleteBtn')?.addEventListener('click', () => {
        void deleteWeightedMap();
    });
    document.querySelectorAll('.composite-sandbox-compare-toggle').forEach(group => {
        group.addEventListener('click', event => {
            const btn = event.target.closest('.composite-sandbox-compare-btn');
            if (!btn?.dataset?.view) return;
            void switchCompareView(btn.dataset.view);
        });
    });
    sliderHost?.addEventListener('input', event => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || !input.classList.contains('composite-sandbox-slider')) {
            return;
        }
        const valueEl = input.closest('.composite-sandbox-slider-row')?.querySelector('.composite-sandbox-slider-value');
        if (valueEl) valueEl.textContent = formatWeight(input.value);
    });
}

export async function syncCompositeSandboxPanel(layerId = null, resolution = null) {
    await ensureWeightsConfig().catch(() => null);

    const panel = document.getElementById('compositeSandboxPanel');
    const banner = document.getElementById('compositeSandboxBanner');
    const computingOverlay = document.getElementById('compositeSandboxComputingOverlay');
    if (!panel) return;

    const res = resolution || context?.getActiveResolution?.() || 'district';
    const currentLayer = layerId || context?.getCurrentCompositeLayerId?.() || null;
    activeLayerId = currentLayer;

    const eligible =
        COMPOSITE_WEIGHT_ENABLED_RESOLUTIONS.has(res) &&
        currentLayer &&
        isCompositeWeightEligible(currentLayer, res, weightsConfig) &&
        context?.isLayerActive?.(currentLayer);

    const inSandbox = isSandboxActive();
    const computing = isSandboxComputing();
    const sectionOpen = isCompositeSectionOpen();

    panel.hidden = (!eligible && !inSandbox) || (!sectionOpen && !inSandbox);
    if (banner) banner.hidden = !inSandbox;
    if (computingOverlay) computingOverlay.hidden = !computing;

    syncSandboxBodyClasses();
    updateModeButtons();
    updateCompareControls();

    if (!eligible && !inSandbox) return;

    const targetLayer = inSandbox ? getSandboxLayerId() : currentLayer;
    const themeConfig = getThemeConfig(targetLayer, res, weightsConfig);
    if (!themeConfig) {
        panel.hidden = true;
        return;
    }

    renderSliderRows(themeConfig, inSandbox || computing);
    const title = document.getElementById('compositeSandboxThemeTitle');
    if (title) title.textContent = themeConfig.themeName || 'Composite theme';
}

function updateModeButtons() {
    const createBtn = document.getElementById('compositeSandboxCreateBtn');
    const deleteBtn = document.getElementById('compositeSandboxDeleteBtn');
    const sandbox = isSandboxActive();
    const computing = isSandboxComputing();

    if (createBtn) {
        createBtn.hidden = sandbox;
        createBtn.disabled = computing;
    }
    if (deleteBtn) {
        deleteBtn.hidden = !sandbox;
        deleteBtn.disabled = computing;
    }

    document.querySelectorAll('.composite-sandbox-slider').forEach(input => {
        input.disabled = sandbox || computing;
    });
}

function updateCompareControls() {
    const sandbox = isSandboxActive();
    const computing = isSandboxComputing();
    const view = getSandboxCompareView();

    document.querySelectorAll('.composite-sandbox-compare-wrap').forEach(wrap => {
        wrap.hidden = !sandbox;
    });

    document.querySelectorAll('.composite-sandbox-compare-btn').forEach(btn => {
        const isActive = btn.dataset.view === view;
        btn.classList.toggle('is-active', isActive);
        btn.disabled = computing;
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    const bannerText = document.getElementById('compositeSandboxBannerText');
    if (bannerText) {
        bannerText.textContent =
            view === SANDBOX_COMPARE_VIEWS.BEFORE
                ? 'Sandbox — viewing Before (official composite score).'
                : 'Sandbox — viewing After (experimental weighted composite).';
    }
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
}

function renderSliderRows(themeConfig, inputsDisabled) {
    const host = document.getElementById('compositeSandboxSliders');
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
                    <label class="composite-sandbox-slider-label" for="compositeSandboxSlider-${index}">
                        ${safeLabel}
                    </label>
                    <div class="composite-sandbox-slider-controls">
                        <input
                            type="range"
                            class="composite-sandbox-slider"
                            id="compositeSandboxSlider-${index}"
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

function collectSliderValues(themeConfig) {
    const host = document.getElementById('compositeSandboxSliders');
    if (!host) return themeConfig.indicators.map(ind => ind.defaultWeight);
    return themeConfig.indicators.map((ind, index) => {
        const input = host.querySelector(`#compositeSandboxSlider-${index}`);
        return input ? Number(input.value) : ind.defaultWeight;
    });
}

async function createWeightedMap() {
    if (!context || isSandboxLockedLocal()) return;

    const layerId = activeLayerId || context.getCurrentCompositeLayerId?.();
    const resolution = context.getActiveResolution?.() || 'district';
    if (!layerId || !context.isLayerActive?.(layerId)) return;

    await ensureWeightsConfig();
    const themeConfig = getThemeConfig(layerId, resolution, weightsConfig);
    if (!themeConfig) return;

    const rawGeoJson = context.getLayerGeoJson?.(layerId);
    if (!rawGeoJson?.features?.length) {
        showSandboxError('Layer data is not loaded yet. Wait for the layer to finish loading.');
        return;
    }

    const sliderValues = collectSliderValues(themeConfig);
    setSandboxSnapshot({
        subindicatorCleared: true
    });
    clearSubindicatorSelection(layerId);
    renderSVSubindicatorPanel(layerId);
    if (typeof window.syncSVSubindicatorPanelsVisibility === 'function') {
        window.syncSVSubindicatorPanelsVisibility();
    }

    setSandboxComputing(layerId, resolution, themeConfig, sliderValues);
    syncCompositeSandboxPanel(layerId, resolution);

    try {
        await deferToNextFrame();
        const prepCache = buildPrepCache(rawGeoJson.features, themeConfig.indicators);
        const weights = slidersToWeights(sliderValues);
        applyCustomCompositeToGeoJson(rawGeoJson, prepCache, weights);
        setSandboxActive(prepCache);
        await context.refreshSandboxLayer?.(layerId);
        syncCompositeSandboxPanel(layerId, resolution);
        updateCompareControls();
    } catch (error) {
        console.error('Composite sandbox compute failed:', error);
        clearCustomCompositeFromGeoJson(rawGeoJson);
        resetSandboxState();
        syncCompositeSandboxPanel(layerId, resolution);
        showSandboxError(error?.message || 'Could not calculate weighted composite.');
    }
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

function showSandboxError(message) {
    const errorEl = document.getElementById('compositeSandboxError');
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
