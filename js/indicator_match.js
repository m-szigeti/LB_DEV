/**
 * Match spreadsheet indicator names (Indicators_Inside_Tool.xlsx) to GeoJSON
 * property keys. Display labels stay on the sheet; map fields stay on the data.
 */

const POLARITY_PREFIXES = [
    /^abstantion\s+/,
    /^abstention\s+/,
    /^lack of\s+/,
    /^lack in\s+/,
    /^distrust in\s+/,
    /^distrust\s+/,
    /^number of\s+/,
    /^mean annual\s+/
];

const STEM_PREFIXES = [
    /^trust in\s+/,
    /^faith in\s+/
];

const SYNONYM_PAIRS = [
    ['poverty level', 'absolute vulnerability']
];

export function isMetadataFieldKey(key) {
    if (!key || typeof key !== 'string') return true;
    if (key.startsWith('__') || key.startsWith('_pillar_')) return true;
    const lower = key.toLowerCase();
    if (/^adm\d+/.test(lower) || lower.includes('pcode') || lower.includes('_ref_')) return true;
    return [
        'acs_code',
        'acs code',
        'code',
        'code_new',
        'rank',
        'adm3_int',
        'dist name',
        'composite_score'
    ].includes(lower);
}

export function normalizeIndicatorText(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/['’`]/g, '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function stripPrefixes(text, prefixes) {
    let next = text;
    let changed = true;
    while (changed) {
        changed = false;
        for (const prefix of prefixes) {
            const stripped = next.replace(prefix, '');
            if (stripped !== next) {
                next = stripped.trim();
                changed = true;
            }
        }
    }
    return next;
}

export function stemIndicatorText(value) {
    const normalized = normalizeIndicatorText(value);
    return stripPrefixes(stripPrefixes(normalized, POLARITY_PREFIXES), STEM_PREFIXES);
}

function tokens(value) {
    return stemIndicatorText(value).split(' ').filter(Boolean);
}

function areSynonyms(left, right) {
    return SYNONYM_PAIRS.some(([a, b]) =>
        (left === a && right === b) || (left === b && right === a)
    );
}

function scoreNameToField(indicatorName, fieldKey) {
    const nameNorm = normalizeIndicatorText(indicatorName);
    const fieldNorm = normalizeIndicatorText(fieldKey);
    if (!nameNorm || !fieldNorm) return 0;
    if (nameNorm === fieldNorm) return 100;
    if (areSynonyms(nameNorm, fieldNorm)) return 95;

    const nameStem = stemIndicatorText(indicatorName);
    const fieldStem = stemIndicatorText(fieldKey);
    if (nameStem && nameStem === fieldStem) return 96;

    const nameTokens = tokens(indicatorName);
    const fieldTokens = tokens(fieldKey);
    if (!nameTokens.length || !fieldTokens.length) return 0;

    const [small, large] = nameTokens.length <= fieldTokens.length
        ? [nameTokens, fieldTokens]
        : [fieldTokens, nameTokens];
    const largeSet = new Set(large);
    if (small.every(token => largeSet.has(token))) {
        return 70 + 30 * (small.length / large.length);
    }

    const largeName = nameStem.length >= fieldStem.length ? nameStem : fieldStem;
    const smallName = nameStem.length < fieldStem.length ? nameStem : fieldStem;
    if (smallName.length >= 8 && largeName.includes(smallName)) {
        return 70 + 25 * (smallName.length / largeName.length);
    }

    const intersection = nameTokens.filter(token => largeSet.has(token) || fieldTokens.includes(token));
    const union = new Set([...nameTokens, ...fieldTokens]);
    const jaccard = intersection.length / union.size;
    if (intersection.length >= 2 && jaccard >= 0.45) {
        return 45 + 40 * jaccard;
    }
    return 0;
}

const MATCH_THRESHOLD = 70;

/**
 * Pair each spreadsheet definition with at most one GeoJSON field.
 * @param {Array<{ indicator?: string }>} definitions
 * @param {string[]} fieldKeys
 * @returns {Array<object & { field: string }>}
 */
export function matchDefinitionsToFields(definitions, fieldKeys) {
    if (!Array.isArray(definitions) || !definitions.length || !Array.isArray(fieldKeys)) {
        return [];
    }

    const candidates = [];
    definitions.forEach((definition, defIndex) => {
        const name = definition?.indicator;
        if (!name) return;
        fieldKeys.forEach((field, fieldIndex) => {
            const score = scoreNameToField(name, field);
            if (score >= MATCH_THRESHOLD) {
                candidates.push({ defIndex, fieldIndex, field, score });
            }
        });
    });

    candidates.sort((a, b) => b.score - a.score || a.defIndex - b.defIndex);
    const usedDefs = new Set();
    const usedFields = new Set();
    const byDefIndex = new Map();
    for (const candidate of candidates) {
        if (usedDefs.has(candidate.defIndex) || usedFields.has(candidate.field)) continue;
        usedDefs.add(candidate.defIndex);
        usedFields.add(candidate.field);
        byDefIndex.set(candidate.defIndex, candidate.field);
    }

    return definitions
        .map((definition, index) => {
            const field = byDefIndex.get(index);
            if (!field) return null;
            return { ...definition, field };
        })
        .filter(Boolean);
}

export function collectIndicatorFieldKeys(properties, compositeAttr, isExcludedKey) {
    if (!properties || typeof properties !== 'object') return [];
    return Object.keys(properties).filter(key => {
        if (typeof isExcludedKey === 'function' && isExcludedKey(key)) return false;
        if (compositeAttr && key === compositeAttr) return false;
        return true;
    });
}

export function subindicatorOptionsFromDefinitions(matchedDefinitions) {
    return (matchedDefinitions || [])
        .filter(entry => entry?.field && entry?.indicator)
        .map(entry => ({ value: entry.field, label: entry.indicator }));
}
