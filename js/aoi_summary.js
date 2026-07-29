/**
 * AOI (area of interest) summary statistics — pure computation.
 *
 * No dependency on weight sandbox, composite UI, or map widgets.
 * Safe to keep as a core module if sandbox code is removed later.
 */

export const AOI_CLASS_LABELS = ['Low', 'Medium', 'High'];

/**
 * @param {number[]} values
 * @returns {{ count: number, mean: number|null, median: number|null, min: number|null, max: number|null }}
 */
export function computeNumericStats(values) {
    const nums = (values || []).filter(v => Number.isFinite(v)).sort((a, b) => a - b);
    if (!nums.length) {
        return { count: 0, mean: null, median: null, min: null, max: null };
    }
    const sum = nums.reduce((acc, v) => acc + v, 0);
    const mid = Math.floor(nums.length / 2);
    const median =
        nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
    return {
        count: nums.length,
        mean: sum / nums.length,
        median,
        min: nums[0],
        max: nums[nums.length - 1]
    };
}

/**
 * @param {{ value: number, weight: number }[]} pairs
 * @returns {{ weightedMean: number|null, weightSum: number, weightedCount: number }}
 */
export function computeWeightedMean(pairs) {
    let weightSum = 0;
    let valueSum = 0;
    let weightedCount = 0;
    (pairs || []).forEach(pair => {
        const value = Number(pair?.value);
        const weight = Number(pair?.weight);
        if (!Number.isFinite(value) || !Number.isFinite(weight) || weight <= 0) return;
        weightSum += weight;
        valueSum += value * weight;
        weightedCount += 1;
    });
    return {
        weightedMean: weightSum > 0 ? valueSum / weightSum : null,
        weightSum,
        weightedCount
    };
}

/**
 * Map a value into a class index using the same edge rules as choropleth styling.
 * @param {number} value
 * @param {number[]} breaks
 * @param {number} numClasses
 * @returns {number|null}
 */
export function getAoiClassIndex(value, breaks, numClasses) {
    if (!Number.isFinite(value) || !Array.isArray(breaks) || breaks.length < 2) {
        return null;
    }
    const classes = Math.max(1, numClasses || breaks.length - 1);
    if (isZeroInflatedBreaks(breaks)) {
        if (value === 0) return 0;
        if (value <= breaks[2]) return Math.min(1, classes - 1);
        return Math.min(2, classes - 1);
    }
    for (let i = 0; i < classes; i++) {
        const lo = breaks[i];
        const hi = breaks[i + 1];
        if (i === classes - 1) {
            if (value >= lo && value <= hi) return i;
        } else if (value >= lo && value < hi) {
            return i;
        }
    }
    if (value <= breaks[0]) return 0;
    return classes - 1;
}

function isZeroInflatedBreaks(breaks) {
    return (
        Array.isArray(breaks) &&
        breaks.length === 4 &&
        breaks[0] === 0 &&
        breaks[1] === 0 &&
        breaks[3] >= breaks[2]
    );
}

/**
 * @param {{ score: number, population?: number|null, noData?: boolean }[]} entries
 * @param {number[]|null} breaks
 * @param {string[]} classLabels
 */
export function buildClassDistribution(entries, breaks, classLabels = AOI_CLASS_LABELS) {
    const labels = classLabels?.length ? classLabels : AOI_CLASS_LABELS;
    const buckets = labels.map(label => ({
        label,
        unitCount: 0,
        population: 0
    }));
    let noDataUnits = 0;
    let noDataPopulation = 0;
    let classifiedUnits = 0;
    let classifiedPopulation = 0;

    (entries || []).forEach(entry => {
        const pop = Number.isFinite(entry?.population) ? entry.population : 0;
        if (entry?.noData || !Number.isFinite(entry?.score)) {
            noDataUnits += 1;
            noDataPopulation += pop;
            return;
        }
        const idx = getAoiClassIndex(entry.score, breaks, labels.length);
        if (idx === null || idx < 0 || idx >= buckets.length) {
            noDataUnits += 1;
            noDataPopulation += pop;
            return;
        }
        buckets[idx].unitCount += 1;
        buckets[idx].population += pop;
        classifiedUnits += 1;
        classifiedPopulation += pop;
    });

    const withShares = buckets.map(bucket => ({
        ...bucket,
        unitShare: classifiedUnits > 0 ? bucket.unitCount / classifiedUnits : 0,
        populationShare:
            classifiedPopulation > 0 ? bucket.population / classifiedPopulation : 0
    }));

    return {
        classes: withShares,
        noDataUnits,
        noDataPopulation,
        classifiedUnits,
        classifiedPopulation,
        highClass: withShares[withShares.length - 1] || null
    };
}

/**
 * @param {{ name: string, score: number, key?: string }[]} entries
 * @param {number} n
 */
export function pickExtremes(entries, n = 3) {
    const sorted = (entries || [])
        .filter(e => Number.isFinite(e?.score))
        .slice()
        .sort((a, b) => a.score - b.score);
    return {
        lowest: sorted.slice(0, n),
        highest: sorted.slice(Math.max(0, sorted.length - n)).reverse()
    };
}

/**
 * Average pillar scores across units (unweighted).
 * @param {{ label: string, color?: string, value: number }[][]} perUnitPillars
 */
export function averagePillars(perUnitPillars) {
    const totals = new Map();
    let unitCount = 0;
    (perUnitPillars || []).forEach(pillars => {
        if (!Array.isArray(pillars) || !pillars.length) return;
        unitCount += 1;
        pillars.forEach(pillar => {
            const label = pillar?.label || 'Pillar';
            const value = Number(pillar?.value);
            if (!Number.isFinite(value)) return;
            const prev = totals.get(label) || { label, color: pillar.color, sum: 0, n: 0 };
            prev.sum += value;
            prev.n += 1;
            if (pillar.color) prev.color = pillar.color;
            totals.set(label, prev);
        });
    });
    const averaged = Array.from(totals.values()).map(item => ({
        label: item.label,
        color: item.color || '#64748b',
        value: item.n > 0 ? item.sum / item.n : 0
    }));
    const total = averaged.reduce((sum, item) => sum + Math.max(0, item.value), 0);
    return {
        unitCount,
        pillars: averaged.map(item => ({
            ...item,
            proportion: total > 0 ? Math.max(0, item.value) / total : 0
        })),
        worst:
            averaged.length > 0
                ? averaged.reduce((a, b) => (a.value >= b.value ? a : b))
                : null
    };
}

/**
 * Build a full AOI summary object for one scored layer (+ optional pillars).
 * @param {object} input
 */
export function buildLayerAoiSummary(input) {
    const {
        layerId,
        layerName,
        attributeLabel,
        resolutionLabel,
        entries = [],
        breaks = null,
        classLabels = AOI_CLASS_LABELS,
        pillarSets = []
    } = input || {};

    const scored = entries.filter(e => Number.isFinite(e?.score) && !e.noData);
    const stats = computeNumericStats(scored.map(e => e.score));
    const weighted = computeWeightedMean(
        scored.map(e => ({ value: e.score, weight: e.population }))
    );
    const distribution = buildClassDistribution(entries, breaks, classLabels);
    const extremes = pickExtremes(scored, 3);
    const pillars = averagePillars(pillarSets);

    return {
        layerId,
        layerName,
        attributeLabel,
        resolutionLabel,
        unitCount: entries.length,
        scoredCount: scored.length,
        stats,
        weighted,
        distribution,
        extremes,
        pillars,
        entries
    };
}

export function formatAoiNumber(value, digits = 2) {
    if (!Number.isFinite(value)) return '—';
    if (Math.abs(value) >= 100 || Number.isInteger(value)) {
        return Math.round(value).toLocaleString();
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function formatAoiPercent(share) {
    if (!Number.isFinite(share)) return '—';
    return `${Math.round(share * 100)}%`;
}

/**
 * Plain-text briefing for copy/download.
 */
export function buildAoiBriefing(summary, meta = {}) {
    if (!summary) return '';
    const lines = [];
    const title = meta.title || 'AOI summary';
    lines.push(title);
    lines.push(`Resolution: ${summary.resolutionLabel || '—'}`);
    lines.push(`Units selected: ${summary.unitCount}`);
    lines.push(`Layer: ${summary.layerName || '—'} (${summary.attributeLabel || 'score'})`);
    lines.push('');
    lines.push('Headline metrics');
    lines.push(`- Mean (unweighted): ${formatAoiNumber(summary.stats.mean)}`);
    lines.push(`- Median: ${formatAoiNumber(summary.stats.median)}`);
    lines.push(
        `- Mean (population-weighted): ${formatAoiNumber(summary.weighted.weightedMean)}` +
            (summary.weighted.weightedCount
                ? ` (${summary.weighted.weightedCount} units with population)`
                : ' (population unavailable)')
    );
    lines.push(
        `- Range: ${formatAoiNumber(summary.stats.min)} – ${formatAoiNumber(summary.stats.max)}`
    );
    if (summary.distribution?.highClass) {
        const high = summary.distribution.highClass;
        lines.push(
            `- Share in ${high.label}: ${formatAoiPercent(high.unitShare)} of units` +
                (summary.distribution.classifiedPopulation > 0
                    ? `, ${formatAoiPercent(high.populationShare)} of population`
                    : '')
        );
    }
    lines.push('');
    lines.push('Class distribution (units)');
    (summary.distribution?.classes || []).forEach(cls => {
        lines.push(
            `- ${cls.label}: ${cls.unitCount} (${formatAoiPercent(cls.unitShare)})`
        );
    });
    if (summary.pillars?.pillars?.length) {
        lines.push('');
        lines.push('Pillar averages (unweighted across AOI)');
        summary.pillars.pillars.forEach(p => {
            lines.push(`- ${p.label}: ${formatAoiNumber(p.value)}`);
        });
        if (summary.pillars.worst) {
            lines.push(`Highest pillar: ${summary.pillars.worst.label}`);
        }
    }
    if (summary.extremes?.highest?.length) {
        lines.push('');
        lines.push('Highest in AOI');
        summary.extremes.highest.forEach(e => {
            lines.push(`- ${e.name}: ${formatAoiNumber(e.score)}`);
        });
    }
    if (summary.extremes?.lowest?.length) {
        lines.push('');
        lines.push('Lowest in AOI');
        summary.extremes.lowest.forEach(e => {
            lines.push(`- ${e.name}: ${formatAoiNumber(e.score)}`);
        });
    }
    lines.push('');
    lines.push(
        'Note: AOI means are summaries of unit scores at the current resolution; they are not a new composite index.'
    );
    return lines.join('\n');
}

/**
 * CSV string: summary header rows + per-unit rows.
 */
export function buildAoiCsv(summary) {
    if (!summary) return '';
    const rows = [];
    const esc = value => {
        const text = value === null || value === undefined ? '' : String(value);
        if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
        return text;
    };

    rows.push(['section', 'field', 'value'].map(esc).join(','));
    rows.push(['summary', 'layer', summary.layerName].map(esc).join(','));
    rows.push(['summary', 'attribute', summary.attributeLabel].map(esc).join(','));
    rows.push(['summary', 'resolution', summary.resolutionLabel].map(esc).join(','));
    rows.push(['summary', 'unit_count', summary.unitCount].map(esc).join(','));
    rows.push(['summary', 'mean_unweighted', summary.stats.mean].map(esc).join(','));
    rows.push(['summary', 'median', summary.stats.median].map(esc).join(','));
    rows.push(['summary', 'mean_pop_weighted', summary.weighted.weightedMean].map(esc).join(','));
    rows.push(['summary', 'min', summary.stats.min].map(esc).join(','));
    rows.push(['summary', 'max', summary.stats.max].map(esc).join(','));

    (summary.distribution?.classes || []).forEach(cls => {
        rows.push(
            ['class', `${cls.label}_units`, cls.unitCount].map(esc).join(',')
        );
        rows.push(
            ['class', `${cls.label}_population`, cls.population].map(esc).join(',')
        );
    });

    rows.push('');
    rows.push(['name', 'key', 'score', 'class', 'population'].map(esc).join(','));
    (summary.entries || []).forEach(entry => {
        let classLabel = '';
        if (entry.noData || !Number.isFinite(entry.score)) {
            classLabel = 'No data';
        } else if (summary.distribution && entry.classIndex != null) {
            classLabel =
                summary.distribution.classes[entry.classIndex]?.label || '';
        }
        rows.push(
            [entry.name, entry.key, entry.score, classLabel, entry.population ?? '']
                .map(esc)
                .join(',')
        );
    });

    return rows.join('\n');
}
