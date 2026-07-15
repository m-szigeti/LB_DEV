/**
 * Multi-polygon area selection for targeted analysis.
 */

const SELECTED_STYLE = {
    color: '#7c3aed',
    weight: 3,
    opacity: 1,
    fillColor: '#a78bfa',
    fillOpacity: 0.35
};

const listeners = new Set();

const state = {
    active: false,
    /** @type {Map<string, { key: string, name: string, properties: object, featureLayer: object, baseStyle: object }>} */
    items: new Map()
};

export function isAnalysisSelectionActive() {
    return state.active;
}

export function setAnalysisSelectionActive(active) {
    state.active = Boolean(active);
    document.body.classList.toggle('analysis-selection-mode', state.active);
    notify();
}

export function getAnalysisSelectionItems() {
    return Array.from(state.items.values());
}

export function getAnalysisSelectionKeys() {
    return new Set(state.items.keys());
}

export function getAnalysisSelectionCount() {
    return state.items.size;
}

export function getFeatureSelectionKey(properties) {
    if (!properties || typeof properties !== 'object') return null;

    const acs = properties.ACS_CODE ?? properties['ACS Code'];
    if (acs !== undefined && acs !== null && String(acs).trim() !== '') {
        return `acs:${String(acs).trim()}`;
    }

    const pcode = properties.adm3_pcode ?? properties.ADM3_INT;
    if (pcode !== undefined && pcode !== null && String(pcode).trim() !== '') {
        return `pcode:${String(pcode).trim()}`;
    }

    const adm3 = properties.ADM3_NAME ?? properties.adm3_name ?? properties.adm3_name1;
    const adm2 = properties.ADM2_NAME ?? properties.adm2_name ?? properties.adm2_name1;
    const adm1 = properties.ADM1_NAME ?? properties.adm1_name ?? properties.adm1_name1;

    if (adm3 && adm2) {
        return `adm3:${String(adm2).trim()}|${String(adm3).trim()}`;
    }
    if (adm2) {
        return `adm2:${String(adm2).trim()}`;
    }
    if (adm1) {
        return `adm1:${String(adm1).trim()}`;
    }

    const code = properties.CODE ?? properties.CODE_NEW ?? properties.CODE_2;
    if (code !== undefined && code !== null && String(code).trim() !== '') {
        return `code:${String(code).trim()}`;
    }

    return null;
}

export function getFeatureDisplayName(properties) {
    if (!properties) return 'Selected unit';
    const keys = [
        'ADM3_NAME', 'adm3_name', 'adm3_name1',
        'ADM2_NAME', 'adm2_name', 'adm2_name1',
        'ADM1_NAME', 'adm1_name', 'adm1_name1',
        'NAME_3', 'NAME_2', 'NAME_1', 'name', 'NAME'
    ];
    for (const key of keys) {
        const value = properties[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return String(value).trim();
        }
    }
    const acs = properties.ACS_CODE ?? properties['ACS Code'];
    if (acs !== undefined && acs !== null) {
        return `ACS ${acs}`;
    }
    return 'Selected unit';
}

function captureFeatureStyle(featureLayer) {
    const options = featureLayer?.options || {};
    const styleKeys = ['color', 'weight', 'opacity', 'fillColor', 'fillOpacity', 'dashArray', 'fill'];
    const baseStyle = {};
    styleKeys.forEach(key => {
        if (options[key] !== undefined) {
            baseStyle[key] = options[key];
        }
    });
    return baseStyle;
}

function applySelectedStyle(featureLayer) {
    if (typeof featureLayer?.setStyle !== 'function') return;
    featureLayer.setStyle(SELECTED_STYLE);
    featureLayer.bringToFront?.();
}

function restoreFeatureStyle(entry) {
    const { featureLayer, baseStyle } = entry;
    if (!featureLayer || typeof featureLayer.setStyle !== 'function' || !baseStyle) return;
    featureLayer.setStyle(baseStyle);
}

export function toggleAnalysisSelectionFeature(featureLayer, properties, layerId = null) {
    const key = getFeatureSelectionKey(properties);
    if (!key || !featureLayer) return false;

    if (state.items.has(key)) {
        const entry = state.items.get(key);
        restoreFeatureStyle(entry);
        state.items.delete(key);
        notify();
        return false;
    }

    state.items.set(key, {
        key,
        name: getFeatureDisplayName(properties),
        properties: { ...properties },
        layerId,
        featureLayer,
        baseStyle: captureFeatureStyle(featureLayer)
    });
    applySelectedStyle(featureLayer);
    notify();
    return true;
}

export function clearAnalysisSelection() {
    state.items.forEach(entry => restoreFeatureStyle(entry));
    state.items.clear();
    notify();
}

export function reapplyAnalysisSelectionStyles() {
    state.items.forEach(entry => {
        if (entry.featureLayer) {
            applySelectedStyle(entry.featureLayer);
        }
    });
}

export function propertiesMatchSelection(properties, keys = getAnalysisSelectionKeys()) {
    const key = getFeatureSelectionKey(properties);
    return key ? keys.has(key) : false;
}

export function getActiveAdminResolutionLabel() {
    const resolution =
        document.querySelector('.sv-admin-resolution-btn.active')?.dataset?.resolution || 'district';
    if (resolution === 'cadastre') return 'Cadastre';
    if (resolution === 'governorate') return 'Governorate';
    return 'District';
}

export function subscribeAnalysisSelection(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function notify() {
    const snapshot = {
        active: state.active,
        count: state.items.size,
        items: getAnalysisSelectionItems()
    };
    listeners.forEach(listener => {
        try {
            listener(snapshot);
        } catch (error) {
            console.error('analysis selection listener error:', error);
        }
    });
    document.dispatchEvent(new CustomEvent('analysis-selection-change', { detail: snapshot }));
}

export function updateMapSelectionBanner() {
    let banner = document.getElementById('map-selection-banner');
    if (!banner) {
        const mapPanel = document.querySelector('.map-panel');
        if (!mapPanel) return;
        banner = document.createElement('div');
        banner.id = 'map-selection-banner';
        banner.className = 'map-selection-banner';
        banner.innerHTML = '<span id="map-selection-banner-text"></span>';
        mapPanel.appendChild(banner);
    }

    const text = document.getElementById('map-selection-banner-text');
    if (!state.active) {
        banner.hidden = true;
        return;
    }

    banner.hidden = false;
    const count = state.items.size;
    const unit = getActiveAdminResolutionLabel().toLowerCase();
    text.textContent =
        count === 0
            ? `Selection mode: click ${unit} units on the map to add them`
            : `${count} ${unit}${count === 1 ? '' : 's'} selected — click to add or remove`;
}

subscribeAnalysisSelection(() => updateMapSelectionBanner());
