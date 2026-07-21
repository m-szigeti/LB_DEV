/**
 * Sandbox mode state for experimental composite weight previews.
 */

export const SANDBOX_MODES = {
    NORMAL: 'normal',
    COMPUTING: 'computing',
    SANDBOX: 'sandbox'
};

const state = {
    mode: SANDBOX_MODES.NORMAL,
    layerId: null,
    resolution: null,
    themeConfig: null,
    prepCache: null,
    sliderValues: [],
    snapshot: null,
    compareView: 'after',
    displayMode: 'single-color'
};

export const SANDBOX_COMPARE_VIEWS = {
    BEFORE: 'before',
    AFTER: 'after'
};

export const SANDBOX_DISPLAY_MODES = {
    STANDARD: 'standard',
    SINGLE_COLOR: 'single-color'
};

export function getSandboxState() {
    return { ...state };
}

export function getSandboxMode() {
    return state.mode;
}

export function isSandboxActive() {
    return state.mode === SANDBOX_MODES.SANDBOX;
}

export function isSandboxComputing() {
    return state.mode === SANDBOX_MODES.COMPUTING;
}

export function isSandboxLocked() {
    return state.mode === SANDBOX_MODES.COMPUTING || state.mode === SANDBOX_MODES.SANDBOX;
}

export function usesCustomComposite(layerId) {
    return (
        state.mode === SANDBOX_MODES.SANDBOX &&
        state.layerId === layerId &&
        state.compareView === SANDBOX_COMPARE_VIEWS.AFTER
    );
}

export function getSandboxCompareView() {
    return state.compareView;
}

export function setSandboxCompareView(view) {
    if (state.mode !== SANDBOX_MODES.SANDBOX) return;
    state.compareView = view === SANDBOX_COMPARE_VIEWS.BEFORE
        ? SANDBOX_COMPARE_VIEWS.BEFORE
        : SANDBOX_COMPARE_VIEWS.AFTER;
}

export function getSandboxDisplayMode() {
    return state.displayMode;
}

export function isSandboxSingleColorMode() {
    return state.displayMode === SANDBOX_DISPLAY_MODES.SINGLE_COLOR;
}

export function setSandboxDisplayMode(mode) {
    if (state.mode !== SANDBOX_MODES.SANDBOX) return;
    state.displayMode = mode === SANDBOX_DISPLAY_MODES.SINGLE_COLOR
        ? SANDBOX_DISPLAY_MODES.SINGLE_COLOR
        : SANDBOX_DISPLAY_MODES.STANDARD;
}

export function getSandboxLayerId() {
    return state.layerId;
}

export function setSandboxComputing(layerId, resolution, themeConfig, sliderValues) {
    state.mode = SANDBOX_MODES.COMPUTING;
    state.layerId = layerId;
    state.resolution = resolution;
    state.themeConfig = themeConfig;
    state.sliderValues = [...sliderValues];
}

export function setSandboxActive(prepCache) {
    state.mode = SANDBOX_MODES.SANDBOX;
    state.prepCache = prepCache;
    state.compareView = SANDBOX_COMPARE_VIEWS.AFTER;
    state.displayMode = SANDBOX_DISPLAY_MODES.SINGLE_COLOR;
}

export function setSandboxSnapshot(snapshot) {
    state.snapshot = snapshot;
}

export function getSandboxSnapshot() {
    return state.snapshot;
}

export function resetSandboxState() {
    state.mode = SANDBOX_MODES.NORMAL;
    state.layerId = null;
    state.resolution = null;
    state.themeConfig = null;
    state.prepCache = null;
    state.sliderValues = [];
    state.snapshot = null;
    state.compareView = SANDBOX_COMPARE_VIEWS.AFTER;
    state.displayMode = SANDBOX_DISPLAY_MODES.SINGLE_COLOR;
}

export function isSandboxSingleColorForLayer(layerId) {
    return (
        state.mode === SANDBOX_MODES.SANDBOX &&
        state.layerId === layerId &&
        state.displayMode === SANDBOX_DISPLAY_MODES.SINGLE_COLOR
    );
}
