/**
 * Multi-polygon area selection for targeted analysis.
 *
 * Selection highlight is outline-only so choropleth fillColor / class colors
 * are never overwritten (critical for cadastre AOI clear).
 */

const SELECTED_OUTLINE_STYLE = {
    color: '#7c3aed',
    weight: 3,
    opacity: 1
};

const listeners = new Set();

const state = {
    active: false,
    /** @type {Map<string, { key: string, name: string, properties: object, featureLayer: object, baseOutline: object }>} */
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

    const adm3 = properties.adm3_name ?? properties.ADM3_NAME ?? properties.adm3_name1;
    const adm2 = properties.adm2_name ?? properties.ADM2_NAME ?? properties.adm2_name1;
    const adm1 = properties.adm1_name ?? properties.ADM1_NAME ?? properties.adm1_name1;

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
    // Prefer English admin names (adm*_name / ADM*_NAME) over Arabic locals (adm*_name1).
    const keys = [
        'adm3_name', 'ADM3_NAME', 'ADM3_Name',
        'adm2_name', 'ADM2_NAME', 'ADM2_Name',
        'adm1_name', 'ADM1_NAME', 'ADM1_Name',
        'adm3_name1', 'adm2_name1', 'adm1_name1',
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

function captureOutlineStyle(featureLayer) {
    const options = featureLayer?.options || {};
    return {
        color: options.color,
        weight: options.weight,
        opacity: options.opacity
    };
}

function applySelectedStyle(featureLayer) {
    if (typeof featureLayer?.setStyle !== 'function') return;
    // Outline only — never touch fillColor / fillOpacity (choropleth class colors).
    featureLayer.setStyle({ ...SELECTED_OUTLINE_STYLE });
    featureLayer.bringToFront?.();
}

function restoreFeatureStyle(entry) {
    const { featureLayer, baseOutline } = entry;
    if (!featureLayer || typeof featureLayer.setStyle !== 'function' || !baseOutline) return;
    const next = {};
    if (baseOutline.color !== undefined) next.color = baseOutline.color;
    if (baseOutline.weight !== undefined) next.weight = baseOutline.weight;
    if (baseOutline.opacity !== undefined) next.opacity = baseOutline.opacity;
    featureLayer.setStyle(next);
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
        baseOutline: captureOutlineStyle(featureLayer)
    });
    applySelectedStyle(featureLayer);
    notify();
    return true;
}

/**
 * Add a feature to the AOI selection if not already present (never removes).
 * @returns {boolean} true if newly added
 */
export function addAnalysisSelectionFeature(featureLayer, properties, layerId = null, options = {}) {
    const key = getFeatureSelectionKey(properties);
    if (!key || !featureLayer) return false;
    if (state.items.has(key)) return false;

    state.items.set(key, {
        key,
        name: getFeatureDisplayName(properties),
        properties: { ...properties },
        layerId,
        featureLayer,
        baseOutline: captureOutlineStyle(featureLayer)
    });
    applySelectedStyle(featureLayer);
    if (options.silent !== true) {
        notify();
    }
    return true;
}

/**
 * Bulk-add features (single notification).
 * @param {{ featureLayer: object, properties: object, layerId?: string }[]} entries
 */
export function addAnalysisSelectionFeatures(entries) {
    let added = 0;
    (entries || []).forEach(entry => {
        if (
            addAnalysisSelectionFeature(entry.featureLayer, entry.properties, entry.layerId, {
                silent: true
            })
        ) {
            added += 1;
        }
    });
    if (added > 0) notify();
    return added;
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

/**
 * Point AOI selection entries at matching features on a newly created Leaflet layer
 * (e.g. after building an AOI custom index sibling layer).
 */
export function rematchAnalysisSelectionToLayer(leafletLayer, layerId = null) {
    if (!leafletLayer || typeof leafletLayer.eachLayer !== 'function' || !state.items.size) {
        return 0;
    }

    const matched = new Map();
    leafletLayer.eachLayer(featureLayer => {
        const props = featureLayer?.feature?.properties;
        const key = getFeatureSelectionKey(props);
        if (!key || !state.items.has(key) || matched.has(key)) return;
        const prev = state.items.get(key);
        matched.set(key, {
            key,
            name: getFeatureDisplayName(props) || prev.name,
            properties: { ...(props || {}) },
            layerId: layerId ?? prev.layerId,
            featureLayer,
            baseOutline: captureOutlineStyle(featureLayer)
        });
        applySelectedStyle(featureLayer);
    });

    // Keep unmatched units in the AOI set (count / exports) even if map handle is gone.
    state.items.forEach((entry, key) => {
        if (!matched.has(key)) {
            matched.set(key, { ...entry, featureLayer: null, baseOutline: null });
        }
    });

    state.items = matched;
    notify();
    return matched.size;
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
