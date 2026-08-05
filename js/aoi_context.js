/**
 * AOI runtime context / providers.
 *
 * Layer-controls (or main) registers data accessors here so AOI stays decoupled
 * from sandbox modules and from deep layer_controls internals.
 */

import {
    AOI_CLASS_LABELS,
    averagePillars,
    buildLayerAoiSummary,
    getAoiClassIndex
} from './aoi_summary.js';
import {
    getAnalysisSelectionItems,
    getFeatureDisplayName,
    getFeatureSelectionKey,
    getActiveAdminResolutionLabel
} from './analysis_selection.js';

const POPULATION_FIELD = 'All Populations';
const POPULATION_BREAKDOWN_FIELDS = [
    { field: 'LEB', label: 'Lebanese' },
    { field: 'SYR', label: 'Syrian' },
    { field: 'PRL', label: 'Palestinian (Lebanon)' },
    { field: 'PRS', label: 'Palestinian (Syria)' }
];

const POPULATION_BY_RESOLUTION = {
    governorate: {
        url: 'data/ADM1_POP.geojson',
        nameFields: ['adm1_name', 'ADM1_NAME', 'adm1_name1']
    },
    district: {
        url: 'data/ADM2_POP.geojson',
        nameFields: ['adm2_name', 'ADM2_NAME', 'adm2_name1']
    },
    cadastre: {
        url: 'data/ADM3_POP.geojson',
        nameFields: ['adm3_name', 'ADM3_NAME', 'adm3_name1'],
        useAcs: true
    }
};

/** Spelling variants between vulnerability layers and ADM*_POP files. */
const ADMIN_NAME_ALIASES = {
    beirut: ['beyrouth'],
    beyrouth: ['beirut'],
    'bent jbeil': ['bent jbail'],
    'bent jbail': ['bent jbeil'],
    metn: ['meten', 'el metn', 'el meten'],
    meten: ['metn', 'el metn', 'el meten'],
    nabatiye: ['nabatieh', 'el nabatieh', 'el nabatiye'],
    nabatieh: ['nabatiye', 'el nabatieh', 'el nabatiye'],
    hasbaiya: ['hasbaya'],
    hasbaya: ['hasbaiya'],
    jbail: ['jbeil'],
    jbeil: ['jbail'],
    kesrouane: ['kesrwane', 'keserwan', 'keserwane'],
    kesrwane: ['kesrouane', 'keserwan', 'keserwane'],
    marjayoun: ['marjaayoun', 'marjeyoun'],
    marjaayoun: ['marjayoun', 'marjeyoun'],
    rachaiya: ['rachaya', 'rashaya'],
    rachaya: ['rachaiya', 'rashaya'],
    'bekaa ouest': ['west bekaa', 'west-bekaa'],
    'west bekaa': ['bekaa ouest', 'west-bekaa'],
    'minie danniye': ['minieh dennie', 'el minieh dennie', 'minie-danniye', 'el minieh-dennie'],
    'minieh dennie': ['minie danniye', 'el minieh dennie', 'minie-danniye', 'el minieh-dennie']
};

/** @type {null | {
 *   getMap: () => object|null,
 *   getLayers: () => object|null,
 *   getActiveInfoLayers: () => Iterable<object>,
 *   getScoreAttribute: (layer: object) => string|null,
 *   getLeafletLayer: (layer: object) => object|null,
 *   getColorSpec: (infoLayer: object, leafletLayer: object) => object|null,
 *   getPillarBreakdown: (properties: object) => Promise<object[]|null>,
 *   isOverallLayer: (layerId: string) => boolean,
 *   getActiveResolution: () => string
 * }} */
let providers = null;

/** @type {Map<string, Promise<Map<string, object>>>} */
const populationLookupPromises = new Map();

export function configureAoiProviders(nextProviders) {
    providers = { ...providers, ...nextProviders };
}

export function getAoiProviders() {
    return providers;
}

function parseNumeric(raw) {
    const value = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(value) ? value : null;
}

function firstNameValue(props, fields) {
    for (const field of fields) {
        const value = props?.[field];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return String(value).trim();
        }
    }
    return null;
}

function basicNormalizeAdminName(name) {
    return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/[-_/]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^(el|al)\s+/, '')
        .trim();
}

function adminNameLookupKeys(name) {
    const normalized = basicNormalizeAdminName(name);
    if (!normalized) return [];
    const keys = new Set([`name:${normalized}`]);
    const aliases = ADMIN_NAME_ALIASES[normalized] || [];
    aliases.forEach(alias => {
        const aliasNorm = basicNormalizeAdminName(alias);
        if (aliasNorm) keys.add(`name:${aliasNorm}`);
    });
    return [...keys];
}

function indexPopulationEntry(byKey, entry, rawName) {
    adminNameLookupKeys(rawName).forEach(key => {
        if (!byKey.has(key)) byKey.set(key, entry);
    });
}

async function loadPopulationLookupForResolution(resolution = 'cadastre') {
    const key = POPULATION_BY_RESOLUTION[resolution] ? resolution : 'cadastre';
    if (populationLookupPromises.has(key)) {
        return populationLookupPromises.get(key);
    }

    const promise = (async () => {
        const byKey = new Map();
        const config = POPULATION_BY_RESOLUTION[key];
        try {
            const response = await fetch(config.url);
            if (!response.ok) return byKey;
            const data = await response.json();
            (data.features || []).forEach(feature => {
                const props = feature?.properties || {};
                const total = parseNumeric(props[POPULATION_FIELD]);
                if (total === null) return;

                const breakdown = {};
                POPULATION_BREAKDOWN_FIELDS.forEach(({ field }) => {
                    const part = parseNumeric(props[field]);
                    if (part !== null) breakdown[field] = part;
                });

                const entry = { total, breakdown, properties: props };

                if (config.useAcs) {
                    const acs = props.ACS_CODE ?? props['ACS Code'];
                    if (acs !== undefined && acs !== null && String(acs).trim() !== '') {
                        byKey.set(`acs:${String(acs).trim()}`, entry);
                    }
                }

                const name = firstNameValue(props, config.nameFields);
                if (name) {
                    indexPopulationEntry(byKey, entry, name);
                }

                const code = props.CODE ?? props.CODE_2;
                if (code !== undefined && code !== null && String(code).trim() !== '') {
                    byKey.set(`code:${String(code).trim()}`, entry);
                }
            });
        } catch (error) {
            console.warn('Population lookup failed:', error);
        }
        return byKey;
    })();

    populationLookupPromises.set(key, promise);
    return promise;
}

function getActiveAoiResolution() {
    return providers?.getActiveResolution?.() || 'district';
}

/**
 * Load population lookup for the active admin resolution (or an explicit one).
 * @param {string} [resolution]
 */
export async function loadPopulationLookup(resolution = getActiveAoiResolution()) {
    return loadPopulationLookupForResolution(resolution);
}

export function resolvePopulationForProperties(
    properties,
    lookup,
    resolution = getActiveAoiResolution()
) {
    if (!properties || !lookup) return null;
    const config = POPULATION_BY_RESOLUTION[resolution] || POPULATION_BY_RESOLUTION.cadastre;

    if (config.useAcs) {
        const acs = properties.ACS_CODE ?? properties['ACS Code'];
        if (acs !== undefined && acs !== null && String(acs).trim() !== '') {
            const hit = lookup.get(`acs:${String(acs).trim()}`);
            if (hit != null) return typeof hit === 'object' ? hit.total : hit;
        }
    }

    const name = firstNameValue(properties, [
        ...(config.nameFields || []),
        'adm3_name',
        'ADM3_NAME',
        'adm3_name1',
        'adm2_name',
        'ADM2_NAME',
        'adm2_name1',
        'adm1_name',
        'ADM1_NAME',
        'adm1_name1',
        'NAME_3',
        'NAME_2',
        'NAME_1'
    ]);
    if (name) {
        for (const key of adminNameLookupKeys(name)) {
            const hit = lookup.get(key);
            if (hit != null) return typeof hit === 'object' ? hit.total : hit;
        }
    }

    const code = properties.CODE ?? properties.CODE_NEW ?? properties.CODE_2;
    if (code !== undefined && code !== null && String(code).trim() !== '') {
        const hit = lookup.get(`code:${String(code).trim()}`);
        if (hit != null) return typeof hit === 'object' ? hit.total : hit;
    }
    const direct = parseNumeric(properties[POPULATION_FIELD]);
    return direct;
}

/**
 * Resolve population totals (+ optional nationality breakdown) for a polygon
 * at the active admin resolution (governorate / district / cadastre).
 */
export async function resolvePopulationDetailsForProperties(
    properties,
    resolution = getActiveAoiResolution()
) {
    if (!properties) return null;
    const lookup = await loadPopulationLookupForResolution(resolution);
    const config = POPULATION_BY_RESOLUTION[resolution] || POPULATION_BY_RESOLUTION.cadastre;

    const tryKeys = [];
    if (config.useAcs) {
        const acs = properties.ACS_CODE ?? properties['ACS Code'];
        if (acs !== undefined && acs !== null && String(acs).trim() !== '') {
            tryKeys.push(`acs:${String(acs).trim()}`);
        }
    }
    const name = firstNameValue(properties, [
        ...config.nameFields,
        'adm3_name', 'ADM3_NAME', 'adm3_name1',
        'adm2_name', 'ADM2_NAME', 'adm2_name1',
        'adm1_name', 'ADM1_NAME', 'adm1_name1',
        'NAME_3', 'NAME_2', 'NAME_1'
    ]);
    if (name) tryKeys.push(...adminNameLookupKeys(name));
    const code = properties.CODE ?? properties.CODE_NEW ?? properties.CODE_2;
    if (code !== undefined && code !== null && String(code).trim() !== '') {
        tryKeys.push(`code:${String(code).trim()}`);
    }

    for (const key of tryKeys) {
        const hit = lookup.get(key);
        if (hit) {
            return {
                total: hit.total,
                breakdown: POPULATION_BREAKDOWN_FIELDS
                    .filter(({ field }) => hit.breakdown?.[field] != null)
                    .map(({ field, label }) => ({
                        field,
                        label,
                        value: hit.breakdown[field]
                    }))
            };
        }
    }

    const direct = parseNumeric(properties[POPULATION_FIELD]);
    if (direct === null) return null;
    return { total: direct, breakdown: [] };
}

function collectFeatureIndex(leafletLayer) {
    /** @type {Map<string, { properties: object, featureLayer: object }>} */
    const index = new Map();
    if (!leafletLayer || typeof leafletLayer.eachLayer !== 'function') {
        return index;
    }
    leafletLayer.eachLayer(featureLayer => {
        const properties = featureLayer?.feature?.properties;
        if (!properties) return;
        const key = getFeatureSelectionKey(properties);
        if (!key) return;
        index.set(key, { properties, featureLayer });
    });
    return index;
}

function getDistrictName(properties) {
    if (!properties) return null;
    const name =
        properties.ADM2_NAME ??
        properties.adm2_name ??
        properties.adm2_name1 ??
        properties.NAME_2 ??
        properties.Districts ??
        properties.District;
    if (name === undefined || name === null || String(name).trim() === '') {
        return null;
    }
    return String(name).trim();
}

/**
 * List unique district names present on a leaflet layer (cadastre features).
 */
export function listDistrictsOnLayer(leafletLayer) {
    const names = new Set();
    if (!leafletLayer || typeof leafletLayer.eachLayer !== 'function') {
        return [];
    }
    leafletLayer.eachLayer(featureLayer => {
        const district = getDistrictName(featureLayer?.feature?.properties);
        if (district) names.add(district);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
}

/**
 * Find feature layers whose ADM2 matches the district name.
 */
export function findFeaturesInDistrict(leafletLayer, districtName) {
    const target = String(districtName || '').trim().toLowerCase();
    const matches = [];
    if (!target || !leafletLayer?.eachLayer) return matches;
    leafletLayer.eachLayer(featureLayer => {
        const district = getDistrictName(featureLayer?.feature?.properties);
        if (district && district.toLowerCase() === target) {
            matches.push(featureLayer);
        }
    });
    return matches;
}

/**
 * Build AOI summaries for every active scored info-panel layer.
 */
export async function buildAoiSummaries() {
    if (!providers) {
        return { resolutionLabel: getActiveAdminResolutionLabel(), summaries: [] };
    }

    const items = getAnalysisSelectionItems();
    const resolutionLabel = getActiveAdminResolutionLabel();
    if (!items.length) {
        return { resolutionLabel, summaries: [], selectionCount: 0 };
    }

    const resolution = getActiveAoiResolution();
    const popLookup = await loadPopulationLookup(resolution);
    const infoLayers = Array.from(providers.getActiveInfoLayers?.() || []);
    const summaries = [];

    // Theme contributions once for the whole AOI (all 8 themes where available).
    const themeSets = [];
    if (providers.getPillarBreakdown) {
        for (const item of items) {
            try {
                const pillars = await providers.getPillarBreakdown(item.properties || {});
                if (pillars?.length) themeSets.push(pillars);
            } catch (error) {
                console.warn('AOI theme contribution failed', error);
            }
        }
    }
    const themeContributions = averagePillars(themeSets);

    for (const infoLayer of infoLayers) {
        const attribute = providers.getScoreAttribute?.(infoLayer);
        if (!attribute) continue;

        const leafletLayer = providers.getLeafletLayer?.(infoLayer);
        const index = collectFeatureIndex(leafletLayer);
        const colorSpec = providers.getColorSpec?.(infoLayer, leafletLayer) || null;
        const breaks =
            colorSpec?.mode === 'continuous' && Array.isArray(colorSpec.breaks)
                ? colorSpec.breaks
                : null;
        const classLabels =
            colorSpec?.mode === 'continuous'
                ? AOI_CLASS_LABELS.slice(0, Math.max(1, (breaks?.length || 1) - 1))
                : AOI_CLASS_LABELS;

        const entries = [];

        for (const item of items) {
            const matched = index.get(item.key);
            const properties = matched?.properties || item.properties || {};
            const score = parseNumeric(properties[attribute]);
            const population = resolvePopulationForProperties(properties, popLookup, resolution);
            const noData = score === null;
            let classIndex = null;
            if (!noData && breaks) {
                classIndex = getAoiClassIndex(score, breaks, classLabels.length);
            }
            entries.push({
                key: item.key,
                name: item.name || getFeatureDisplayName(properties),
                score,
                population,
                noData,
                classIndex,
                district: getDistrictName(properties)
            });
        }

        summaries.push(
            buildLayerAoiSummary({
                layerId: infoLayer.id,
                layerName: infoLayer.name || infoLayer.id,
                attributeLabel: String(attribute)
                .replace(/_/g, ' ')
                .replace(/\b\w/g, letter => letter.toUpperCase()),
                resolutionLabel,
                entries,
                breaks,
                classLabels,
                pillarSets: []
            })
        );
    }

    return {
        resolutionLabel,
        selectionCount: items.length,
        summaries,
        themeContributions,
        districtsInSelection: [
            ...new Set(
                items
                    .map(item => getDistrictName(item.properties))
                    .filter(Boolean)
            )
        ].sort((a, b) => a.localeCompare(b))
    };
}

export function getPrimaryLeafletLayerForSelection() {
    if (!providers) return null;
    const infoLayers = Array.from(providers.getActiveInfoLayers?.() || []);
    for (const infoLayer of infoLayers) {
        const leafletLayer = providers.getLeafletLayer?.(infoLayer);
        if (leafletLayer && typeof leafletLayer.eachLayer === 'function') {
            return (
                leafletLayer._svAdminOutlineLayer ||
                leafletLayer._svHitPolygonLayer ||
                leafletLayer._svChoroplethFillLayer ||
                leafletLayer
            );
        }
    }
    const layers = providers.getLayers?.();
    const vector = layers?.vector || {};
    for (const layer of Object.values(vector)) {
        if (layer && typeof layer.eachLayer === 'function') {
            return (
                layer._svAdminOutlineLayer ||
                layer._svHitPolygonLayer ||
                layer._svChoroplethFillLayer ||
                layer
            );
        }
    }
    return null;
}

export function getActiveResolutionFromProviders() {
    return providers?.getActiveResolution?.() || 'district';
}
