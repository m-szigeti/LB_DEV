/**
 * Sidebar sub-indicator chip panels (multi-select).
 */

const selections = new Map();
const PANEL_REGISTRY = new Map();

let onSelectionChange = () => {};

export function configureSVSubindicators({ onChange } = {}) {
    onSelectionChange = typeof onChange === 'function' ? onChange : () => {};
}

export function registerSVSubindicatorPanel(layerId, { wrapId, getOptions, getDefaultValues }) {
    PANEL_REGISTRY.set(layerId, { wrapId, getOptions, getDefaultValues });
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
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function reconcileSelection(layerId, options) {
    const validValues = new Set(options.map(o => o.value));
    const prev = selections.get(layerId) || [];
    const kept = prev.filter(v => validValues.has(v));
    if (kept.length) return kept;
    const defaults = PANEL_REGISTRY.get(layerId)?.getDefaultValues() || [];
    const fromDefault = (Array.isArray(defaults) ? defaults : [defaults]).filter(v => validValues.has(v));
    if (fromDefault.length) return fromDefault;
    return options[0] ? [options[0].value] : [];
}

function handleChipChange(event) {
    const input = event.target;
    if (!input?.classList?.contains('sv-subindicator-chip-input')) return;

    const layerId = input.dataset.layerId;
    const listHost = input.closest('.sv-subindicator-chips');
    if (!listHost) return;

    const checked = [...listHost.querySelectorAll('.sv-subindicator-chip-input:checked')].map(cb => cb.value);
    if (!checked.length) {
        input.checked = true;
        return;
    }

    selections.set(layerId, checked);
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
}

export function renderSVSubindicatorPanels() {
    PANEL_REGISTRY.forEach((_, layerId) => renderSVSubindicatorPanel(layerId));
}

window.getSelectedSVSubindicators = getSelectedSubindicators;
