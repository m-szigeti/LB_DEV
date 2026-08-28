/**
 * Shared theme spider / radar chart for polygon popups and AOI Analysis.
 */

const OVERALL_LAYER_IDS = new Set([
    'svOverallTensionLayer',
    'svCustomOverallLayer'
]);

const SHORT_THEME_LABELS = {
    svAdmin1Layer: 'Displacement',
    svAdmin2Layer: 'Socioeconomic',
    svAdmin3Layer: 'Tensions',
    svAdmin4Layer: 'Services',
    svClimateLayer: 'Climate',
    svPoliticalLayer: 'Political',
    svGenderLayer: 'Gender',
    svOverallTensionLayer: 'Overall',
    svCustomOverallLayer: 'Custom overall'
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function formatSpiderValue(value) {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') {
        if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
        if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
        if (value % 1 !== 0) {
            return Math.abs(value) >= 10 ? value.toFixed(2) : value.toFixed(3);
        }
        return value.toLocaleString();
    }
    return String(value);
}

export function shortThemeLabel(theme) {
    if (theme?.layerId && SHORT_THEME_LABELS[theme.layerId]) {
        return SHORT_THEME_LABELS[theme.layerId];
    }
    const label = String(theme?.label || 'Theme');
    return label.length > 16 ? `${label.slice(0, 15)}…` : label;
}

function normalizeSpiderTheme(theme) {
    if (!theme) return null;
    const value = typeof theme.value === 'number' ? theme.value : Number(theme.value);
    if (!Number.isFinite(value)) return null;
    return {
        layerId: theme.layerId || '',
        label: theme.label || shortThemeLabel(theme),
        color: theme.color || '#64748b',
        value
    };
}

/**
 * One active theme / Overall: all theme scores as corners.
 * Several selected themes: only those themes, stacked in their colours.
 */
export function buildThemeSpiderModel({
    themes = [],
    activeLayerIds = [],
    activeScores = []
} = {}) {
    const allThemes = (themes || []).map(normalizeSpiderTheme).filter(Boolean);
    const activeIds = new Set(Array.isArray(activeLayerIds) ? activeLayerIds : []);
    const scores = Array.isArray(activeScores) ? activeScores : [];
    const themeById = new Map(allThemes.map(theme => [theme.layerId, theme]));

    const selectedThemes = [];
    const seen = new Set();
    const addSelected = source => {
        const item = normalizeSpiderTheme(source);
        if (!item?.layerId || OVERALL_LAYER_IDS.has(item.layerId) || seen.has(item.layerId)) {
            return;
        }
        seen.add(item.layerId);
        selectedThemes.push({
            ...item,
            label: themeById.get(item.layerId)?.label || item.label,
            color: item.color || themeById.get(item.layerId)?.color || '#64748b'
        });
    };

    Array.from(activeIds).forEach(layerId => {
        addSelected(themeById.get(layerId) || scores.find(score => score.layerId === layerId));
    });
    scores.forEach(score => addSelected(score));

    const stacked = selectedThemes.length > 1;
    return {
        stacked,
        items: stacked ? selectedThemes : allThemes
    };
}

function generateThemeBarsFallback(themes, title, hint) {
    const sorted = [...themes].sort((a, b) => Number(b.value) - Number(a.value));
    const outlierMax = Math.max(
        0.001,
        ...sorted.filter(theme => theme.value > 1.0001).map(theme => theme.value)
    );
    const rows = sorted
        .map(theme => {
            const width = theme.value <= 1.0001
                ? Math.round(Math.max(0, Math.min(1, theme.value)) * 100)
                : Math.round((Math.max(0, theme.value) / outlierMax) * 100);
            return `
                <div class="info-theme-row">
                    <div class="info-theme-label" title="${escapeHtml(theme.label)}">${escapeHtml(theme.label)}</div>
                    <div class="info-theme-bar-track">
                        <div class="info-theme-bar-fill" style="width:${width}%;background:${escapeHtml(theme.color)}"></div>
                    </div>
                    <div class="info-theme-value">${escapeHtml(formatSpiderValue(theme.value))}</div>
                </div>
            `;
        })
        .join('');
    return `
        <div class="info-section info-theme-section">
            <h4>${escapeHtml(title)}</h4>
            <p class="info-theme-hint">${hint}</p>
            <div class="info-theme-bars">${rows}</div>
        </div>
    `;
}

const DEFAULT_COPY = {
    titleProfile: 'Theme scores',
    titleStacked: 'Selected themes',
    hintProfile:
        'Each corner is a theme that has a score on this unit. Distance from the centre is that theme&rsquo;s own composite (usually 0&ndash;1). Higher = higher vulnerability. Scores do <strong>not</strong> add up to 1.',
    hintStacked:
        'Each coloured web is one selected theme (not every theme on this unit). Larger web = higher vulnerability on that theme. Scores are independent and do <strong>not</strong> add up to 1.'
};

export function generateThemeSpiderHtml(model, copy = {}) {
    if (!model?.items?.length) return '';

    const titles = { ...DEFAULT_COPY, ...copy };
    const title = model.stacked ? titles.titleStacked : titles.titleProfile;
    const hint = model.stacked ? titles.hintStacked : titles.hintProfile;

    if (!model.stacked && model.items.length < 3) {
        return generateThemeBarsFallback(model.items, title, hint);
    }

    const payload = encodeURIComponent(JSON.stringify({
        stacked: Boolean(model.stacked),
        items: model.items.map(theme => ({
            layerId: theme.layerId,
            label: shortThemeLabel(theme),
            fullLabel: theme.label,
            color: theme.color,
            value: theme.value
        }))
    }));

    const legend = model.items
        .map(theme => `
            <div class="info-theme-spider-legend-item">
                <span class="info-theme-spider-swatch" style="background:${escapeHtml(theme.color)}"></span>
                <span class="info-theme-spider-legend-label" title="${escapeHtml(theme.label)}">${escapeHtml(shortThemeLabel(theme))}</span>
                <span class="info-theme-spider-legend-value">${escapeHtml(formatSpiderValue(theme.value))}</span>
            </div>
        `)
        .join('');

    return `
        <div class="info-section info-theme-section">
            <h4>${escapeHtml(title)}</h4>
            <p class="info-theme-hint">${hint}</p>
            <div class="info-theme-spider">
                <canvas class="info-theme-spider-canvas" data-spider="${payload}" width="360" height="340" aria-label="Theme spider chart"></canvas>
                <div class="info-theme-spider-legend">${legend}</div>
            </div>
        </div>
    `;
}

export function paintThemeSpiderCharts(root) {
    if (!root) return;
    root.querySelectorAll('canvas[data-spider]').forEach(canvas => {
        try {
            const raw = canvas.getAttribute('data-spider');
            if (!raw) return;
            const model = JSON.parse(decodeURIComponent(raw));
            drawThemeSpiderChart(canvas, model);
        } catch (error) {
            console.warn('Theme spider chart failed:', error);
        }
    });
}

function colorWithAlpha(hex, alpha) {
    const raw = String(hex || '#64748b').trim();
    const match = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!match) {
        return `rgba(100, 116, 139, ${alpha})`;
    }
    let hexValue = match[1];
    if (hexValue.length === 3) {
        hexValue = hexValue.split('').map(char => char + char).join('');
    }
    const numeric = parseInt(hexValue, 16);
    const r = (numeric >> 16) & 255;
    const g = (numeric >> 8) & 255;
    const b = numeric & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function spiderRadiusScale(values) {
    const numeric = values.map(value => Math.max(0, Number(value) || 0));
    const max = Math.max(0.001, ...numeric);
    return numeric.some(value => value > 1.0001) ? max : 1;
}

export function drawThemeSpiderChart(canvas, model) {
    const items = Array.isArray(model?.items) ? model.items : [];
    if (!canvas || !items.length) return;
    if (!model.stacked && items.length < 3) return;

    const cssWidth = 360;
    const cssHeight = 340;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const stacked = Boolean(model.stacked);
    const spokeCount = stacked ? 6 : items.length;
    const cx = cssWidth / 2;
    const cy = cssHeight / 2 + (stacked ? 0 : 4);
    const radius = stacked ? 118 : 108;
    const scale = spiderRadiusScale(items.map(item => item.value));
    const startAngle = -Math.PI / 2;

    const pointAt = (index, value, count = items.length) => {
        const angle = startAngle + (index * 2 * Math.PI) / count;
        const t = Math.max(0, Math.min(1, (Number(value) || 0) / scale));
        return {
            x: cx + Math.cos(angle) * radius * t,
            y: cy + Math.sin(angle) * radius * t,
            angle,
            t
        };
    };

    const axisEnd = (index, count = spokeCount) => {
        const angle = startAngle + (index * 2 * Math.PI) / count;
        return {
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
            angle
        };
    };

    const drawWeb = (count, ringColor, edgeColor) => {
        [0.25, 0.5, 0.75, 1].forEach(ring => {
            ctx.beginPath();
            for (let index = 0; index < count; index += 1) {
                const angle = startAngle + (index * 2 * Math.PI) / count;
                const x = cx + Math.cos(angle) * radius * ring;
                const y = cy + Math.sin(angle) * radius * ring;
                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.strokeStyle = ring === 1 ? edgeColor : ringColor;
            ctx.lineWidth = ring === 1 ? 1.1 : 0.8;
            ctx.stroke();
        });
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 0.8;
        for (let index = 0; index < count; index += 1) {
            const end = axisEnd(index, count);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        }
    };

    if (stacked) {
        drawWeb(spokeCount, '#e2e8f0', '#cbd5e1');
        const ordered = [...items].sort((a, b) => Number(b.value) - Number(a.value));
        ordered.forEach(theme => {
            const t = Math.max(0, Math.min(1, (Number(theme.value) || 0) / scale));
            ctx.beginPath();
            for (let index = 0; index < spokeCount; index += 1) {
                const angle = startAngle + (index * 2 * Math.PI) / spokeCount;
                const x = cx + Math.cos(angle) * radius * t;
                const y = cy + Math.sin(angle) * radius * t;
                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fillStyle = colorWithAlpha(theme.color, 0.16);
            ctx.fill();
            ctx.strokeStyle = theme.color;
            ctx.lineWidth = 2;
            ctx.stroke();
        });
        ctx.font = '600 9px Calibri, "Segoe UI", sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        [0.5, 1].forEach(ring => {
            const label = Math.abs(scale - 1) < 0.0001 ? String(ring) : formatSpiderValue(ring * scale);
            ctx.fillText(label, cx + 4, cy - radius * ring);
        });
        return;
    }

    drawWeb(items.length, '#e2e8f0', '#cbd5e1');
    ctx.beginPath();
    items.forEach((theme, index) => {
        const point = pointAt(index, theme.value);
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(51, 65, 85, 0.12)';
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    items.forEach((theme, index) => {
        const point = pointAt(index, theme.value);
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = theme.color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.1;
        ctx.stroke();
    });

    ctx.font = '600 10px Calibri, "Segoe UI", sans-serif';
    ctx.fillStyle = '#475569';
    items.forEach((theme, index) => {
        const end = axisEnd(index, items.length);
        const labelRadius = radius + 22;
        const x = cx + Math.cos(end.angle) * labelRadius;
        const y = cy + Math.sin(end.angle) * labelRadius;
        if (Math.abs(x - cx) < 12) ctx.textAlign = 'center';
        else if (x < cx) ctx.textAlign = 'right';
        else ctx.textAlign = 'left';
        if (y < cy - 8) ctx.textBaseline = 'bottom';
        else if (y > cy + 8) ctx.textBaseline = 'top';
        else ctx.textBaseline = 'middle';
        ctx.fillText(shortThemeLabel(theme), x, y);
    });
}
