/**
 * Sidebar sub-indicator chip panels (single-select).
 */

const selections = new Map();
const selectionLabels = new Map();
const PANEL_REGISTRY = new Map();

let onSelectionChange = () => {};
let isSubindicatorLayerActive = () => true;

export function configureSVSubindicators({ onChange, isLayerActive } = {}) {
    onSelectionChange = typeof onChange === 'function' ? onChange : () => {};
    isSubindicatorLayerActive = typeof isLayerActive === 'function' ? isLayerActive : () => true;
}

export function registerSVSubindicatorPanel(layerId, { wrapId, getOptions, getDefaultValues, resolveLabelForValue }) {
    PANEL_REGISTRY.set(layerId, { wrapId, getOptions, getDefaultValues, resolveLabelForValue });
}

export function getSelectedSubindicators(layerId) {
    const panel = PANEL_REGISTRY.get(layerId);
    if (!panel) return [];
    const stored = selections.get(layerId);
    if (stored?.length) return [...stored];
    const defaults = panel.getDefaultValues();
    return Array.isArray(defaults) ? [...defaults] : [];
}

export function getPrimarySubindicator(layerId) {
    return getSelectedSubindicators(layerId)[0] ?? null;
}

export function clearSubindicatorSelection(layerId) {
    selections.delete(layerId);
    selectionLabels.delete(layerId);
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function normalizeSubindicatorLabel(label) {
    return String(label || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[—–]/g, '-');
}

function resolveStoredLabel(layerId, prevValue) {
    const stored = selectionLabels.get(layerId);
    if (stored) return stored;
    const resolver = PANEL_REGISTRY.get(layerId)?.resolveLabelForValue;
    if (typeof resolver === 'function' && prevValue) {
        return resolver(prevValue) || null;
    }
    return null;
}

function reconcileSelection(layerId, options) {
    const validValues = new Set(options.map(o => o.value));
    const prev = selections.get(layerId) || [];

    const kept = prev.filter(v => validValues.has(v));
    if (kept.length) {
        const opt = options.find(o => o.value === kept[0]);
        if (opt) selectionLabels.set(layerId, opt.label);
        return [kept[0]];
    }

    const labelCandidates = [];
    const storedLabel = selectionLabels.get(layerId);
    if (storedLabel) labelCandidates.push(storedLabel);
    for (const prevValue of prev) {
        const resolved = resolveStoredLabel(layerId, prevValue);
        if (resolved && !labelCandidates.includes(resolved)) {
            labelCandidates.push(resolved);
        }
    }

    for (const candidateLabel of labelCandidates) {
        const normalized = normalizeSubindicatorLabel(candidateLabel);
        const match = options.find(o => normalizeSubindicatorLabel(o.label) === normalized);
        if (match) {
            selectionLabels.set(layerId, match.label);
            return [match.value];
        }
    }

    const defaults = PANEL_REGISTRY.get(layerId)?.getDefaultValues() || [];
    const fromDefault = (Array.isArray(defaults) ? defaults : [defaults]).filter(v => validValues.has(v));
    if (fromDefault.length) {
        const opt = options.find(o => o.value === fromDefault[0]);
        if (opt) selectionLabels.set(layerId, opt.label);
        return [fromDefault[0]];
    }

    if (prev.length) return prev;

    return [];
}

function handleChipChange(event) {
    const input = event.target;
    if (!input?.classList?.contains('sv-subindicator-chip-input')) return;

    const layerId = input.dataset.layerId;
    const listHost = input.closest('.sv-subindicator-chips');
    if (!listHost) return;

    const panel = PANEL_REGISTRY.get(layerId);
    const options = panel?.getOptions?.() || [];

    let selected = [];
    if (input.checked) {
        listHost.querySelectorAll('.sv-subindicator-chip-input').forEach(cb => {
            if (cb !== input) cb.checked = false;
        });
        selected = [input.value];
        const opt = options.find(o => o.value === input.value);
        if (opt) selectionLabels.set(layerId, opt.label);
    } else {
        selectionLabels.delete(layerId);
    }

    selections.set(layerId, selected);
    listHost.querySelectorAll('.sv-subindicator-chip').forEach(chip => {
        chip.classList.toggle('is-selected', Boolean(chip.querySelector('input')?.checked));
    });
    onSelectionChange(layerId);
}

let chipsDelegated = false;

function ensureChipDelegation() {
    if (chipsDelegated) return;
    chipsDelegated = true;
    document.addEventListener('change', handleChipChange);
}

export function renderSVSubindicatorPanel(layerId) {
    const panel = PANEL_REGISTRY.get(layerId);
    if (!panel) return;

    const wrap = document.getElementById(panel.wrapId);
    if (!wrap) return;

    const listHost = wrap.querySelector('.sv-subindicator-chips');
    if (!listHost) return;

    ensureChipDelegation();

    const options = panel.getOptions();
    const prevSelected = [...(selections.get(layerId) || [])];
    const selected = reconcileSelection(layerId, options);
    selections.set(layerId, selected);

    listHost.innerHTML = options
        .map(opt => {
            const checked = selected.includes(opt.value);
            const safeVal = escapeHtml(opt.value);
            const safeLabel = escapeHtml(opt.label);
            return `
                <label class="sv-subindicator-chip${checked ? ' is-selected' : ''}">
                    <input
                        type="checkbox"
                        class="sv-subindicator-chip-input"
                        data-layer-id="${escapeHtml(layerId)}"
                        value="${safeVal}"
                        ${checked ? 'checked' : ''}
                    >
                    <span class="sv-subindicator-chip-text">${safeLabel}</span>
                </label>
            `;
        })
        .join('');

    const selectionChanged =
        selected.length !== prevSelected.length ||
        selected.some((value, index) => value !== prevSelected[index]);
    if (
        selectionChanged &&
        selected.length &&
        selected.some(v => options.some(o => o.value === v)) &&
        isSubindicatorLayerActive(layerId)
    ) {
        onSelectionChange(layerId);
    }
}

export function renderSVSubindicatorPanels() {
    PANEL_REGISTRY.forEach((_, layerId) => renderSVSubindicatorPanel(layerId));
}

window.getSelectedSVSubindicators = getSelectedSubindicators;
