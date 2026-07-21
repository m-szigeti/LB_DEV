/**
 * Load official indicator weights (built from Indicator_Weights_Summary_tmp.xlsx).
 */

const WEIGHTS_URL = 'data/indicator_weights.json';

const LAYER_TO_THEME = {
    svOverallTensionLayer: 'overall',
    svAdmin3Layer: '2',
    svAdmin2Layer: '3',
    svAdmin4Layer: '4',
    svClimateLayer: '6',
    svPoliticalLayer: '7',
    svGenderLayer: '8'
};

/** Enabled resolutions for composite weight sandbox. */
export const COMPOSITE_WEIGHT_ENABLED_RESOLUTIONS = new Set(['district', 'governorate']);

let configPromise = null;
let configCache = null;

export async function loadIndicatorWeightsConfig() {
    if (configCache) return configCache;
    if (!configPromise) {
        configPromise = fetch(WEIGHTS_URL)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load indicator weights (${response.status})`);
                }
                return response.json();
            })
            .then(data => {
                configCache = data;
                return data;
            })
            .catch(error => {
                configPromise = null;
                throw error;
            });
    }
    return configPromise;
}

export function getThemeKeyForLayer(layerId) {
    return LAYER_TO_THEME[layerId] || null;
}

export function getThemeConfig(layerId, resolution, config = configCache) {
    if (!config || !layerId || !resolution) return null;
    const themeKey = getThemeKeyForLayer(layerId);
    if (!themeKey) return null;
    const themeConfig = config[resolution]?.[themeKey];
    if (!themeConfig || themeConfig.layerId !== layerId) return null;
    return themeConfig;
}

export function isCompositeWeightEligible(layerId, resolution = 'district', config = configCache) {
    if (!COMPOSITE_WEIGHT_ENABLED_RESOLUTIONS.has(resolution)) return false;
    return Boolean(getThemeConfig(layerId, resolution, config));
}

export function isOverallPillarMode(themeConfig) {
    return themeConfig?.mode === 'overall-pillars';
}
