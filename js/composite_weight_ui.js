/**
 * Experimental composite weight sandbox UI — per-layer compact panels.
 */

import {
    buildPrepCache,
    applyCustomCompositeToGeoJson,
    clearCustomCompositeFromGeoJson,
    slidersToWeights,
    attachOverallPillarsToFeatures,
    buildJoinMapFromGeoJson
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
    document.addEventListener('click', event => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        if (target.closest('#compositeSandboxCreateBtn, .composite-sandbox-create-btn')) {
            const panel = target.closest('[data-sandbox-layer]');
            const layerId = panel?.dataset?.sandboxLayer || activeLayerId;
            void createWeightedMap(layerId);
            return;
        }
        if (target.closest('#compositeSandboxDeleteBtn, #compositeSandboxBannerDeleteBtn, .composite-sandbox-delete-btn')) {
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
    const deleteBtn = panel.querySelector('.composite-sandbox-delete-btn');
    const compareWrap = panel.querySelector('.composite-sandbox-compare-wrap');

    if (createBtn) {
        createBtn.hidden = sandbox;
        createBtn.disabled = computing;
    }
    if (deleteBtn) {
        deleteBtn.hidden = !sandbox;
        deleteBtn.disabled = computing;
    }
    if (compareWrap) {
        compareWrap.hidden = !sandbox;
    }
    panel.querySelectorAll('.composite-sandbox-slider').forEach(input => {
        input.disabled = sandbox || computing;
    });
}

function updateCompareControls() {
    const sandbox = isSandboxActive();
    const computing = isSandboxComputing();
    const view = getSandboxCompareView();

    document.querySelectorAll('.composite-sandbox-compare-wrap').forEach(wrap => {
        if (wrap.id === 'compositeSandboxCompareBanner') {
            wrap.hidden = !sandbox;
        }
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
                ? 'Sandbox — viewing Before (official score).'
                : 'Sandbox — viewing After (experimental weighted score).';
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
