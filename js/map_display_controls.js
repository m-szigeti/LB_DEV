/**
 * Global map display controls (Administrative resolution tray + Advanced Options).
 * Defaults preserve today’s tool behavior until the user toggles a control.
 */

export const CLASSIFICATION_MODES = {
    EQUAL_COUNT: 'equal-count',
    EQUAL_INTERVAL: 'equal-interval',
    NATURAL_BREAKS: 'natural-breaks'
};

const CLASSIFICATION_CYCLE = [
    CLASSIFICATION_MODES.EQUAL_COUNT,
    CLASSIFICATION_MODES.EQUAL_INTERVAL,
    CLASSIFICATION_MODES.NATURAL_BREAKS
];

const CLASSIFICATION_LABELS = {
    [CLASSIFICATION_MODES.EQUAL_COUNT]: 'Equal count',
    [CLASSIFICATION_MODES.EQUAL_INTERVAL]: 'Equal interval',
    [CLASSIFICATION_MODES.NATURAL_BREAKS]: 'Natural breaks'
};

const state = {
    colorOnly: false,
    showLabels: false,
    classificationMode: CLASSIFICATION_MODES.EQUAL_COUNT,
    /** Layer id last targeted by Isolate (null when color-only was toggled globally). */
    isolatedLayerId: null,
    /** @type {null | {
     *   refreshActiveLayersForDisplay: () => void | Promise<void>,
     *   rebuildActiveLayerStyles: () => void | Promise<void>,
     *   syncLabels: () => void | Promise<void>,
     *   enforceColorOnlySingleLayer?: () => void,
     *   isolateSvLayer?: (layerId: string) => void | Promise<void>,
     *   getCurrentSvLayerId?: () => string | null
     * }} */
    context: null
};

export function isColorOnlyMode() {
    return Boolean(state.colorOnly);
}

export function isShowLabelsMode() {
    return Boolean(state.showLabels);
}

export function getClassificationMode() {
    return state.classificationMode || CLASSIFICATION_MODES.EQUAL_COUNT;
}

export function getClassificationModeLabel(mode = getClassificationMode()) {
    return CLASSIFICATION_LABELS[mode] || CLASSIFICATION_LABELS[CLASSIFICATION_MODES.EQUAL_COUNT];
}

export function getIsolatedLayerId() {
    return state.isolatedLayerId;
}

export function setIsolatedLayerId(layerId) {
    state.isolatedLayerId = layerId || null;
    syncIsolateButtons();
}

export function setColorOnlyMode(enabled) {
    state.colorOnly = Boolean(enabled);
    if (!state.colorOnly) {
        state.isolatedLayerId = null;
    } else if (!state.isolatedLayerId) {
        state.isolatedLayerId = state.context?.getCurrentSvLayerId?.() || null;
    }
    syncTrayButtons();
    if (state.colorOnly && typeof state.context?.enforceColorOnlySingleLayer === 'function') {
        state.context.enforceColorOnlySingleLayer();
    }
    const refresh = state.context?.refreshActiveLayersForDisplay?.();
    return Promise.resolve(refresh).then(() => {
        syncIsolateButtons();
    });
}

/**
 * Isolate one SV layer in color-only mode (plain choropleth, other SV layers off).
 * Clicking Isolate again on the same layer turns color-only off.
 * @param {string} layerId
 */
export async function isolateLayer(layerId) {
    if (!layerId) return;
    const currentId = state.context?.getCurrentSvLayerId?.() || null;
    const alreadyIsolated =
        state.colorOnly &&
        (state.isolatedLayerId === layerId || currentId === layerId) &&
        document.getElementById(layerId)?.checked;

    if (alreadyIsolated) {
        await setColorOnlyMode(false);
        return;
    }

    state.isolatedLayerId = layerId;
    state.colorOnly = true;
    syncTrayButtons();
    syncIsolateButtons();

    if (typeof state.context?.isolateSvLayer === 'function') {
        await state.context.isolateSvLayer(layerId);
    } else if (typeof state.context?.enforceColorOnlySingleLayer === 'function') {
        state.context.enforceColorOnlySingleLayer();
    }

    await state.context?.refreshActiveLayersForDisplay?.();
    syncIsolateButtons();
}

export function setShowLabelsMode(enabled) {
    state.showLabels = Boolean(enabled);
    syncTrayButtons();
    return state.context?.syncLabels?.();
}

export function setClassificationMode(mode) {
    if (!CLASSIFICATION_CYCLE.includes(mode)) {
        mode = CLASSIFICATION_MODES.EQUAL_COUNT;
    }
    state.classificationMode = mode;
    syncTrayButtons();
    return state.context?.rebuildActiveLayerStyles?.();
}

export function cycleClassificationMode() {
    const idx = CLASSIFICATION_CYCLE.indexOf(state.classificationMode);
    const next = CLASSIFICATION_CYCLE[(idx + 1) % CLASSIFICATION_CYCLE.length];
    return setClassificationMode(next);
}

function syncTrayButtons() {
    const colorBtn = document.getElementById('mapDisplayColorOnlyBtn');
    const labelsBtn = document.getElementById('mapDisplayLabelsBtn');
    const classBtn = document.getElementById('mapDisplayClassLimitsBtn');

    if (colorBtn) {
        colorBtn.setAttribute('aria-pressed', state.colorOnly ? 'true' : 'false');
        colorBtn.classList.toggle('is-active', state.colorOnly);
    }
    if (labelsBtn) {
        labelsBtn.setAttribute('aria-pressed', state.showLabels ? 'true' : 'false');
        labelsBtn.classList.toggle('is-active', state.showLabels);
    }
    if (classBtn) {
        classBtn.dataset.mode = state.classificationMode;
        classBtn.textContent = `Class Limits: ${getClassificationModeLabel()}`;
        classBtn.classList.toggle(
            'is-active',
            state.classificationMode !== CLASSIFICATION_MODES.EQUAL_COUNT
        );
    }
    syncIsolateButtons();
}

function syncIsolateButtons() {
    const activeId = state.colorOnly
        ? state.context?.getCurrentSvLayerId?.() || state.isolatedLayerId || null
        : null;
    document.querySelectorAll('.sv-isolate-btn[data-isolate-layer]').forEach(btn => {
        const layerId = btn.getAttribute('data-isolate-layer');
        const isActive = Boolean(state.colorOnly && layerId && layerId === activeId);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        btn.classList.toggle('is-active', isActive);
        btn.textContent = 'Color';
    });
}

function bindClassLimitsButton() {
    const classBtn = document.getElementById('mapDisplayClassLimitsBtn');
    if (!classBtn || classBtn.dataset.bound === '1') return;
    classBtn.dataset.bound = '1';
    classBtn.addEventListener('click', () => {
        void cycleClassificationMode();
    });
    syncTrayButtons();
}

function bindColorOnlyButton() {
    const colorBtn = document.getElementById('mapDisplayColorOnlyBtn');
    if (!colorBtn || colorBtn.dataset.bound === '1') return;
    colorBtn.dataset.bound = '1';
    colorBtn.addEventListener('click', () => {
        state.isolatedLayerId = null;
        void setColorOnlyMode(!state.colorOnly);
    });
    syncTrayButtons();
}

function bindIsolateButtons() {
    document.querySelectorAll('.sv-isolate-btn[data-isolate-layer]').forEach(btn => {
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            const layerId = btn.getAttribute('data-isolate-layer');
            void isolateLayer(layerId);
        });
    });
    syncIsolateButtons();
}

function bindAdvancedDisplayButtons() {
    bindColorOnlyButton();
    bindClassLimitsButton();
    bindIsolateButtons();
}

/**
 * @param {{
 *   refreshActiveLayersForDisplay: () => void | Promise<void>,
 *   rebuildActiveLayerStyles: () => void | Promise<void>,
 *   syncLabels: () => void | Promise<void>,
 *   enforceColorOnlySingleLayer?: () => void,
 *   isolateSvLayer?: (layerId: string) => void | Promise<void>,
 *   getCurrentSvLayerId?: () => string | null
 * }} appContext
 */
export function initMapDisplayControls(appContext) {
    state.context = appContext || null;
    syncTrayButtons();

    document.getElementById('mapDisplayLabelsBtn')?.addEventListener('click', () => {
        void setShowLabelsMode(!state.showLabels);
    });
    bindAdvancedDisplayButtons();
    // Advanced Options creates Color only / Class Limits dynamically after init.
    window.__rebindMapDisplayClassLimits = bindAdvancedDisplayButtons;
}
