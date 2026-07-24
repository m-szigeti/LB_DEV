/**
 * Global map display controls (Administrative resolution tray).
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
    /** @type {null | {
     *   refreshActiveLayersForDisplay: () => void | Promise<void>,
     *   rebuildActiveLayerStyles: () => void | Promise<void>,
     *   syncLabels: () => void | Promise<void>
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

export function setColorOnlyMode(enabled) {
    state.colorOnly = Boolean(enabled);
    syncTrayButtons();
    return state.context?.refreshActiveLayersForDisplay?.();
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
}

/**
 * @param {{
 *   refreshActiveLayersForDisplay: () => void | Promise<void>,
 *   rebuildActiveLayerStyles: () => void | Promise<void>,
 *   syncLabels: () => void | Promise<void>
 * }} appContext
 */
export function initMapDisplayControls(appContext) {
    state.context = appContext || null;
    syncTrayButtons();

    document.getElementById('mapDisplayColorOnlyBtn')?.addEventListener('click', () => {
        void setColorOnlyMode(!state.colorOnly);
    });
    document.getElementById('mapDisplayLabelsBtn')?.addEventListener('click', () => {
        void setShowLabelsMode(!state.showLabels);
    });
    document.getElementById('mapDisplayClassLimitsBtn')?.addEventListener('click', () => {
        void cycleClassificationMode();
    });
}
