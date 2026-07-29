/**
 * Map spotlight / post-AOI style recovery.
 *
 * Never mutates choropleth fillColor. Selection uses outline-only highlights
 * (see analysis_selection.js). When an AOI is cleared, we ask providers to
 * re-apply authoritative layer styles so path snapshots cannot stick.
 */

import {
    getAnalysisSelectionCount,
    reapplyAnalysisSelectionStyles,
    subscribeAnalysisSelection
} from './analysis_selection.js';

let restyleActiveLayers = null;
let unsubscribe = null;
let lastCount = 0;

/**
 * @param {{ restyleActiveLayers?: () => void | Promise<void> }} options
 */
export function configureAoiSpotlight(options = {}) {
    if (typeof options.restyleActiveLayers === 'function') {
        restyleActiveLayers = options.restyleActiveLayers;
    }
    // Back-compat: older callers passed { getLayers }
    if (!unsubscribe) {
        unsubscribe = subscribeAnalysisSelection(snapshot => {
            void onSelectionChanged(snapshot);
        });
    }
}

export function setAoiSpotlightEnabled(_enabled) {
    // Spotlight no longer dims fills (that corrupted class colors). Kept as API no-op.
}

async function onSelectionChanged(snapshot) {
    const count = snapshot?.count ?? getAnalysisSelectionCount();
    const cleared = lastCount > 0 && count === 0;
    lastCount = count;

    if (cleared && typeof restyleActiveLayers === 'function') {
        try {
            await restyleActiveLayers();
        } catch (error) {
            console.warn('AOI: failed to restyle layers after clear', error);
        }
    }

    // Re-apply outline highlights only (does not touch fillColor).
    reapplyAnalysisSelectionStyles();
}

/**
 * Force choropleth recovery (e.g. before showing custom overall).
 */
export async function forceAoiStyleRecovery() {
    lastCount = getAnalysisSelectionCount();
    if (typeof restyleActiveLayers === 'function') {
        try {
            await restyleActiveLayers();
        } catch (error) {
            console.warn('AOI: style recovery failed', error);
        }
    }
    reapplyAnalysisSelectionStyles();
}

/** @deprecated no-op — fills are no longer dimmed */
export function clearAoiSpotlight() {}

/** @deprecated no-op — fills are no longer dimmed */
export function refreshAoiSpotlight() {
    reapplyAnalysisSelectionStyles();
}
