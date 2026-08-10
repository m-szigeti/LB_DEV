/**
 * Client-side composite score recomputation.
 * - Slider path: normalize + caller-supplied weights (weight sandbox)
 * - Official recipe: mirrors scripts/composite_index_score.py
 *   (median impute → min-max → invert → Kendall-τ weights → weighted sum)
 */

export const CUSTOM_COMPOSITE_FIELD = '_custom_composite';

/** Same inverted set as scripts/composite_index_score.py */
export const OFFICIAL_INVERTED_INDICATORS = new Set([
    'Nighttime light radiance',
    'Nightlight Intensity'
]);

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
            columns[field].push(toNumericBinaryAware(readFeatureProperty(props, field)));
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

function readFeatureProperty(props, field) {
    if (!props || field == null) return undefined;
    if (Object.prototype.hasOwnProperty.call(props, field)) return props[field];
    const trimmed = String(field).trim();
    if (trimmed !== field && Object.prototype.hasOwnProperty.call(props, trimmed)) {
        return props[trimmed];
    }
    // Match GeoJSON keys that differ only by trailing/leading whitespace.
    for (const key of Object.keys(props)) {
        if (String(key).trim() === trimmed) return props[key];
    }
    return undefined;
}

function normalizedValue(props, field, prep) {
    const raw = toNumericBinaryAware(readFeatureProperty(props, field));
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

/**
 * Kendall τ-b for paired finite samples. Returns 0 when undefined (matches safe_kendall).
 */
export function safeKendallTau(xValues, yValues) {
    const n = Math.min(xValues.length, yValues.length);
    const pairs = [];
    for (let i = 0; i < n; i++) {
        const x = xValues[i];
        const y = yValues[i];
        if (Number.isFinite(x) && Number.isFinite(y)) pairs.push([x, y]);
    }
    if (pairs.length < 2) return 0;

    const xSet = new Set();
    const ySet = new Set();
    pairs.forEach(([x, y]) => {
        xSet.add(x);
        ySet.add(y);
    });
    if (xSet.size < 2 || ySet.size < 2) return 0;

    let concordant = 0;
    let discordant = 0;
    let tiesX = 0;
    let tiesY = 0;
    for (let i = 0; i < pairs.length; i++) {
        for (let j = i + 1; j < pairs.length; j++) {
            const dx = Math.sign(pairs[i][0] - pairs[j][0]);
            const dy = Math.sign(pairs[i][1] - pairs[j][1]);
            if (dx === 0 && dy === 0) continue;
            if (dx === 0) {
                tiesX += 1;
                continue;
            }
            if (dy === 0) {
                tiesY += 1;
                continue;
            }
            if (dx === dy) concordant += 1;
            else discordant += 1;
        }
    }

    const denom = Math.sqrt((concordant + discordant + tiesX) * (concordant + discordant + tiesY));
    if (!denom) return 0;
    return (concordant - discordant) / denom;
}

export function indicatorIsOfficiallyInverted(field, explicitInverted = false) {
    if (explicitInverted) return true;
    if (!field) return false;
    if (OFFICIAL_INVERTED_INDICATORS.has(field)) return true;
    const trimmed = String(field).trim();
    return OFFICIAL_INVERTED_INDICATORS.has(trimmed);
}

/**
 * Build prep cache using official invert rules (hardcoded set ∪ indicator.inverted).
 */
export function buildOfficialPrepCache(features, indicators) {
    const withInvert = indicators.map(ind => ({
        ...ind,
        inverted: indicatorIsOfficiallyInverted(ind.field, ind.inverted)
    }));
    return buildPrepCache(features, withInvert);
}

/**
 * Official Kendall weights from normalized indicator columns (sum to 1).
 * Mirrors mean |τ| / total_strength in composite_index_score.score_dataframe.
 */
export function computeKendallWeightsFromPrep(features, prep) {
    const fields = prep?.fields || [];
    if (!fields.length) return [];
    if (fields.length === 1) return [1];

    const normColumns = fields.map(field =>
        (features || []).map(feature => normalizedValue(feature?.properties || {}, field, prep))
    );

    const meanAbsCorr = fields.map((_, i) => {
        const others = [];
        for (let j = 0; j < fields.length; j++) {
            if (i === j) continue;
            others.push(Math.abs(safeKendallTau(normColumns[i], normColumns[j])));
        }
        if (!others.length) return 0;
        return others.reduce((sum, v) => sum + v, 0) / others.length;
    });

    const totalStrength = meanAbsCorr.reduce((sum, v) => sum + v, 0);
    if (totalStrength <= 0) {
        const equal = 1 / fields.length;
        return fields.map(() => equal);
    }
    return meanAbsCorr.map(v => v / totalStrength);
}

/**
 * Full official composite recipe for a feature collection + indicator defs.
 * Returns { prep, weights, scoresByIndex }.
 */
export function scoreFeaturesOfficialRecipe(features, indicators) {
    const prep = buildOfficialPrepCache(features, indicators);
    const weights = computeKendallWeightsFromPrep(features, prep);
    const scoresByIndex = (features || []).map(feature =>
        computeCompositeForProperties(feature?.properties || {}, prep, weights)
    );
    return { prep, weights, scoresByIndex };
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

