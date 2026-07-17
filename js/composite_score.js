/**
 * Client-side composite score recomputation (custom weights only).
 * Mirrors scripts/composite_index_score.py normalize + weighted sum steps.
 */

export const CUSTOM_COMPOSITE_FIELD = '_custom_composite';

const BINARY_MAP = {
    true: 1,
    false: 0,
    yes: 1,
    no: 0,
    y: 1,
    n: 0,
    '1': 1,
    '0': 0
};

export function toNumericBinaryAware(value) {
    if (value === null || value === undefined || value === '') return NaN;
    if (typeof value === 'boolean') return value ? 1 : 0;
    const str = String(value).trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(BINARY_MAP, str)) {
        return BINARY_MAP[str];
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : NaN;
}

export function minMax01(values) {
    const finite = values.filter(Number.isFinite);
    if (!finite.length) {
        return { min: 0, max: 1, normalize: () => 0 };
    }
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) {
        return { min, max, normalize: () => 0 };
    }
    return {
        min,
        max,
        normalize: value => {
            if (!Number.isFinite(value)) return 0;
            return (value - min) / (max - min);
        }
    };
}

export function median(values) {
    const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!finite.length) return 0;
    const mid = Math.floor(finite.length / 2);
    return finite.length % 2 === 0
        ? (finite[mid - 1] + finite[mid]) / 2
        : finite[mid];
}

/**
 * Map slider weights (0–1) to normalized weights summing to 1.
 */
export function slidersToWeights(sliderValues) {
    const raw = sliderValues.map(s => Math.max(0, Number(s) || 0));
    const total = raw.reduce((sum, v) => sum + v, 0);
    if (total <= 0) {
        const equal = 1 / raw.length;
        return raw.map(() => equal);
    }
    return raw.map(v => v / total);
}

export function buildPrepCache(features, indicators) {
    const fields = indicators.map(ind => ind.field);
    const inverted = new Set(indicators.filter(ind => ind.inverted).map(ind => ind.field));

    const columns = {};
    fields.forEach(field => {
        columns[field] = [];
    });

    features.forEach(feature => {
        const props = feature?.properties || {};
        fields.forEach(field => {
            columns[field].push(toNumericBinaryAware(props[field]));
        });
    });

    const medians = {};
    const normParams = {};
    fields.forEach(field => {
        const col = columns[field];
        medians[field] = median(col);
        const imputed = col.map(v => (Number.isFinite(v) ? v : medians[field]));
        const mm = minMax01(imputed);
        normParams[field] = {
            min: mm.min,
            max: mm.max,
            invert: inverted.has(field),
            normalize: mm.normalize
        };
    });

    return { fields, medians, normParams, inverted };
}

function normalizedValue(props, field, prep) {
    const raw = toNumericBinaryAware(props[field]);
    const value = Number.isFinite(raw) ? raw : prep.medians[field];
    const params = prep.normParams[field];
    let norm = params.normalize(value);
    if (params.invert) {
        norm = 1 - norm;
    }
    return norm;
}

export function computeCompositeForProperties(props, prep, weights) {
    let sum = 0;
    prep.fields.forEach((field, idx) => {
        sum += normalizedValue(props, field, prep) * weights[idx];
    });
    return sum;
}

export function applyCustomCompositeToGeoJson(rawGeoJson, prep, weights) {
    if (!rawGeoJson?.features?.length) return;
    rawGeoJson.features.forEach(feature => {
        if (!feature.properties) feature.properties = {};
        feature.properties[CUSTOM_COMPOSITE_FIELD] = computeCompositeForProperties(
            feature.properties,
            prep,
            weights
        );
    });
}

export function clearCustomCompositeFromGeoJson(rawGeoJson) {
    if (!rawGeoJson?.features?.length) return;
    rawGeoJson.features.forEach(feature => {
        if (!feature?.properties) return;
        if (CUSTOM_COMPOSITE_FIELD in feature.properties) {
            delete feature.properties[CUSTOM_COMPOSITE_FIELD];
        }
        Object.keys(feature.properties).forEach(key => {
            if (key.startsWith('_pillar_')) {
                delete feature.properties[key];
            }
        });
    });
}

function normalizeJoinKey(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim().toLowerCase();
}

export function pickJoinValue(props, joinKeys = []) {
    if (!props) return '';
    for (const key of joinKeys) {
        if (props[key] !== undefined && props[key] !== null && String(props[key]).trim() !== '') {
            return normalizeJoinKey(props[key]);
        }
    }
    return '';
}

/**
 * Attach pillar scores from source theme GeoJSON maps onto overall features.
 * sourceMaps: { [sourceLayerId]: { byKey: Map, field: string } }
 */
export function attachOverallPillarsToFeatures(overallGeoJson, themeConfig, sourceMaps) {
    if (!overallGeoJson?.features?.length || !themeConfig?.indicators?.length) return;
    const joinKeys = themeConfig.joinKeys || [];

    overallGeoJson.features.forEach(feature => {
        if (!feature.properties) feature.properties = {};
        const joinValue = pickJoinValue(feature.properties, joinKeys);
        themeConfig.indicators.forEach(ind => {
            const source = sourceMaps[ind.sourceLayerId];
            let value = NaN;
            if (source && joinValue) {
                const props = source.byKey.get(joinValue);
                if (props) {
                    value = toNumericBinaryAware(props[ind.sourceField || source.field]);
                }
            }
            feature.properties[ind.field] = Number.isFinite(value) ? value : null;
        });
    });
}

export function buildJoinMapFromGeoJson(geoJson, joinKeys) {
    const byKey = new Map();
    (geoJson?.features || []).forEach(feature => {
        const props = feature?.properties;
        if (!props) return;
        const key = pickJoinValue(props, joinKeys);
        if (!key || byKey.has(key)) return;
        byKey.set(key, props);
    });
    return byKey;
}

