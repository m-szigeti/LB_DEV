// admin_labels.js - Functions for managing admin boundary labels and combined map controls

import { basemaps, basemapOptions } from './basemaps.js';

/** Shared handle so tray “Show labels” can sync Map Controls admin labels. */
let adminLabelControlState = null;

/**
 * Create label layers for administrative boundaries and combined map control
 * @param {Object} map - Leaflet map instance
 * @param {Object} vectorLayers - Object containing vector layers
 * @param {Object} countryOutline - Country outline layer
 * @param {Object} compareMap - Comparison map instance
 * @param {Object} infoPanel - Info panel instance
 * @returns {Object} - Object containing label layers
 */
export function createAdminLabelLayers(map, vectorLayers, countryOutline, compareMap, infoPanel) {
    // Initialize label layers container
    const labelLayers = {
        adm1: L.layerGroup(),
        adm2: L.layerGroup()
    };
    
    // Remove the default zoom control since we're using the top-left corner
    map.removeControl(map.zoomControl);
    
    // Create the combined control (features + basemaps + info panel)
    createMapFeaturesControl(map, labelLayers, countryOutline, compareMap, infoPanel);
    
    return labelLayers;
}

/**
 * Create a custom control combining all map controls including basemap selection and info panel
 * @param {Object} map - Leaflet map instance
 * @param {Object} labelLayers - Label layer groups
 * @param {Object} countryOutline - Country outline layer
 * @param {Object} compareMap - Comparison map instance
 * @param {Object} infoPanel - Info panel instance
 */
function createMapFeaturesControl(map, labelLayers, countryOutline, compareMap, infoPanel) {
    const mountTarget = document.getElementById('map-features-sidebar-slot');
    if (!mountTarget) return;

    mountTarget.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'combined-map-control minimized';

    const toggleButton = document.createElement('div');
    toggleButton.className = 'combined-control-toggle';
    toggleButton.innerHTML = 'Map Controls ▲';
    toggleButton.title = 'Toggle Map Controls';
    container.appendChild(toggleButton);

    const contentContainer = document.createElement('div');
    contentContainer.className = 'combined-control-content';
    container.appendChild(contentContainer);

    const featuresTitle = document.createElement('div');
    featuresTitle.className = 'combined-control-title';
    featuresTitle.innerHTML = '';
    contentContainer.appendChild(featuresTitle);

    // const outlineButton = createButton('🗺️ Outline Lebanon', contentContainer);
    // outlineButton.classList.add('active');

    const adm1Button = createButton('Municipality Labels', contentContainer);
    const adm2Button = createButton('District Labels', contentContainer);
    // const adm3Button = createButton('Cadastre Labels', contentContainer);

    adminLabelControlState = {
        map,
        labelLayers,
        buttons: { adm1: adm1Button, adm2: adm2Button }
    };

    const leftMapLabel = document.createElement('label');
    leftMapLabel.className = 'basemap-label';
    contentContainer.appendChild(leftMapLabel);

    const leftMapSelect = document.createElement('select');
    leftMapSelect.className = 'basemap-select';
    contentContainer.appendChild(leftMapSelect);
    addBasemapOptions(leftMapSelect, 'cartoLight');

    if (compareMap) {
        const rightMapLabel = document.createElement('label');
        rightMapLabel.className = 'basemap-label';
        rightMapLabel.textContent = 'Right Map:';
        contentContainer.appendChild(rightMapLabel);

        const rightMapSelect = document.createElement('select');
        rightMapSelect.className = 'basemap-select';
        contentContainer.appendChild(rightMapSelect);
        addBasemapOptions(rightMapSelect, 'esriWorldImagery');

        rightMapSelect.addEventListener('change', function() {
            updateBasemap(compareMap, this.value);
        });
    }

    const infoPanelTitle = document.createElement('div');
    infoPanelTitle.className = 'combined-control-title';
    infoPanelTitle.innerHTML = '';
    contentContainer.appendChild(infoPanelTitle);

    // const infoPanelButton = createButton('📊 Analysis Panel', contentContainer);
    // syncInfoPanelButtonState(infoPanelButton, infoPanel?.isVisible !== false);

    // outlineButton.addEventListener('click', function(e) {
    //     e.preventDefault();
    //     toggleCountryOutline(outlineButton, map, countryOutline);
    // });

    adm1Button.addEventListener('click', function(e) {
        e.preventDefault();
        toggleLabels('adm1', adm1Button, labelLayers, map);
    });

    adm2Button.addEventListener('click', function(e) {
        e.preventDefault();
        toggleLabels('adm2', adm2Button, labelLayers, map);
    });

    leftMapSelect.addEventListener('change', function() {
        updateBasemap(map, this.value);
    });

    // infoPanelButton.addEventListener('click', function(e) {
    //     e.preventDefault();
    //     toggleInfoPanel(infoPanelButton, infoPanel);
    // });

    // document.addEventListener('info-panel-visibility-change', function(event) {
    //     syncInfoPanelButtonState(infoPanelButton, event.detail?.visible);
    // });

    toggleButton.addEventListener('click', function(e) {
        e.preventDefault();
        const isMinimized = container.classList.toggle('minimized');
        this.innerHTML = isMinimized ? 'Map Controls ▲' : 'Map Controls ▼';
    });

    mountTarget.appendChild(container);
}

/**
 * Add basemap options to select element
 * @param {HTMLElement} select - Select element to populate
 * @param {string} defaultBasemap - ID of the default selected basemap
 */
function addBasemapOptions(select, defaultBasemap) {
    // Use the existing basemapOptions from basemaps.js
    basemapOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.label;
        
        // Set the default selection
        if (option.value === defaultBasemap) {
            optionElement.selected = true;
        }
        
        select.appendChild(optionElement);
    });
}

/**
 * Update a map's basemap
 * @param {Object} map - Map instance
 * @param {string} basemapId - ID of the basemap to use
 */
function updateBasemap(map, basemapId) {
    // Remove all basemaps from this specific map
    map.eachLayer(function(layer) {
        // Check if this layer is a tile layer (basemap) by checking for _url property
        if (layer._url && layer.options && layer.options.attribution) {
            map.removeLayer(layer);
        }
    });
    
    // Create a new instance of the selected basemap for this map
    if (basemaps[basemapId]) {
        const basemapConfig = basemaps[basemapId];
        
        // Create a new tile layer instance with the same configuration
        const newBasemapLayer = L.tileLayer(basemapConfig._url, basemapConfig.options);
        newBasemapLayer.addTo(map);
    }
}

/**
 * Create a styled button element
 * @param {string} text - Button text
 * @param {HTMLElement} container - Parent container
 * @returns {HTMLElement} - Button element
 */
function createButton(text, container) {
    const button = document.createElement('button');
    button.className = 'combined-control-button';
    button.innerHTML = text;
    button.style.padding = '6px 10px';
    button.style.backgroundColor = '#f8f8f8';
    button.style.border = '1px solid #ccc';
    button.style.borderRadius = '3px';
    button.style.cursor = 'pointer';
    button.style.width = '100%';
    button.style.transition = 'all 0.3s';
    button.style.fontWeight = 'normal';
    
    // Add hover effect
    button.onmouseover = function() { 
        if (!this.classList.contains('active')) {
            this.style.backgroundColor = '#e6e6e6'; 
        }
    };
    button.onmouseout = function() { 
        if (!this.classList.contains('active')) {
            this.style.backgroundColor = '#f8f8f8'; 
        }
    };
    container.appendChild(button);
    return button;
}

/**
 * Toggle the visibility of labels for an admin level
 * @param {string} level - Admin level (adm1 or adm2)
 * @param {HTMLElement} button - Button element that triggered the toggle
 * @param {Object} labelLayers - Label layer groups
 * @param {Object} map - Leaflet map instance
 */
function toggleLabels(level, button, labelLayers, map) {
    const isActive = button.classList.contains('active');
    setLabelLevelEnabled(level, !isActive, button, labelLayers, map);
}

/**
 * Enable or disable an admin label level and sync its Map Controls button.
 */
function setLabelLevelEnabled(level, enabled, button, labelLayers, map) {
    if (!button || !labelLayers?.[level] || !map) return;

    const isActive = button.classList.contains('active');
    if (enabled === isActive) {
        if (enabled && !map.hasLayer(labelLayers[level])) {
            labelLayers[level].addTo(map);
        }
        return;
    }

    if (!enabled) {
        button.classList.remove('active');
        button.style.backgroundColor = '#f8f8f8';
        button.style.fontWeight = 'normal';
        if (map.hasLayer(labelLayers[level])) {
            map.removeLayer(labelLayers[level]);
        }
        return;
    }

    button.classList.add('active');
    button.style.backgroundColor = '#d4edda';
    button.style.fontWeight = 'bold';

    if (labelLayers[level].getLayers().length === 0) {
        loadAndGenerateLabels(level, labelLayers[level], map);
    }

    if (!map.hasLayer(labelLayers[level])) {
        labelLayers[level].addTo(map);
    }
}

/**
 * Sync governorate (adm1) + district (adm2) permanent labels from the tray control.
 * Keeps Map Controls buttons in the same on/off state.
 * @param {boolean} enabled
 * @param {Object} [map]
 * @param {Object} [labelLayers]
 */
export function setAdminLabelLayersEnabled(enabled, map = null, labelLayers = null) {
    const state = adminLabelControlState;
    const targetMap = map || state?.map;
    const layers = labelLayers || state?.labelLayers;
    const buttons = state?.buttons;
    if (!targetMap || !layers) return;

    setLabelLevelEnabled('adm1', enabled, buttons?.adm1, layers, targetMap);
    setLabelLevelEnabled('adm2', enabled, buttons?.adm2, layers, targetMap);
}

/**
 * Load and generate labels for admin boundaries when layer is not loaded
 * @param {string} level - Admin level (adm1 or adm2)
 * @param {Object} labelLayer - Label layer group to add markers to
 * @param {Object} map - Leaflet map instance
 */
function loadAndGenerateLabels(level, labelLayer, map) {
    const url = level === 'adm1' 
        ? 'data/adm1_summary_stats_1.geojson'  // Path to ADM1 data
        : 'data/sv_peace_adm2.geojson'; // Use one pillar layer for district labels
    
    // Fetch the GeoJSON file directly
    fetch(url)
        .then(response => response.json())
        .then(data => {
            const tempLayer = L.geoJSON(data);
            generateLabelsFromData(tempLayer, level, labelLayer);
        })
        .catch(error => {
            console.error(`Error loading ${level} data:`, error);
        });
}

/**
 * Generate labels from a temporary layer
 * @param {Object} layer - GeoJSON layer with admin boundaries
 * @param {string} level - Admin level (adm1 or adm2)
 * @param {Object} labelLayer - Label layer group to add markers to
 */
function generateLabelsFromData(layer, level, labelLayer) {
    // Clear existing labels
    labelLayer.clearLayers();
    
    try {
        layer.eachLayer(function(featureLayer) {
            if (!featureLayer.feature || !featureLayer.feature.properties) return;
            
            const name = getLabelName(featureLayer.feature.properties, level);
            if (!name) return;
            
            // Prefer polygon center; fallback to bounds center.
            const center = getPolygonLabelCenter(featureLayer);
            if (!center) return;
            
            // Create a marker with a tooltip for the label
            const marker = L.marker(center, {
                icon: L.divIcon({
                    className: 'admin-label-icon',
                    html: `<div class="admin-label ${level}-label">${name}</div>`,
                    iconSize: [160, 40],
                    iconAnchor: [80, 20]
                }),
                interactive: false // Prevent the label from being clickable
            });
            
            labelLayer.addLayer(marker);
        });
        
        console.log(`Generated ${level} labels independently`);
    } catch (err) {
        console.error(`Error generating ${level} labels:`, err);
    }
}

/**
 * Toggle country outline visibility
 * @param {HTMLElement} button - Button element that triggered the toggle
 * @param {Object} map - Leaflet map instance
 * @param {Object} countryOutline - Country outline layer
 */
function toggleCountryOutline(button, map, countryOutline) {
    if (!countryOutline) return;
    
    const isActive = button.classList.contains('active');
    
    if (isActive) {
        // Turn off outline
        button.classList.remove('active');
        button.style.backgroundColor = '#f8f8f8';
        button.style.fontWeight = 'normal';
        map.removeLayer(countryOutline);
    } else {
        // Turn on outline
        button.classList.add('active');
        button.style.backgroundColor = '#d4edda';
        button.style.fontWeight = 'bold';
        countryOutline.addTo(map);
    }
}

/**
 * Toggle info panel visibility
 * @param {HTMLElement} button - Button element that triggered the toggle
 * @param {Object} infoPanel - Info panel instance
 */
function toggleInfoPanel(button, infoPanel) {
    if (!infoPanel) return;
    
    const isActive = button.classList.contains('active');
    
    if (isActive) {
        // Turn off info panel
        button.classList.remove('active');
        button.style.backgroundColor = '#f8f8f8';
        button.style.fontWeight = 'normal';
        
        if (infoPanel.isVisible) {
            infoPanel.hide();
        }
    } else {
        // Turn on info panel
        button.classList.add('active');
        button.style.backgroundColor = '#d4edda';
        button.style.fontWeight = 'bold';
        
        if (!infoPanel.isVisible) {
            infoPanel.show();
        }
    }
}

function syncInfoPanelButtonState(button, isVisible) {
    if (!button) return;

    if (isVisible) {
        button.classList.add('active');
        button.style.backgroundColor = '#d4edda';
        button.style.fontWeight = 'bold';
    } else {
        button.classList.remove('active');
        button.style.backgroundColor = '#f8f8f8';
        button.style.fontWeight = 'normal';
    }
}

/**
 * Generate labels for admin boundaries - used when vector layers are loaded
 * This is called from layer_controls.js when a vector layer is activated
 * @param {Object} layer - GeoJSON layer with admin boundaries
 * @param {string} level - Admin level (adm1 or adm2)
 * @param {Object} labelLayer - Label layer group to add markers to
 */
export function generateAdminLabels(layer, level, labelLayer) {
    // Clear existing labels
    labelLayer.clearLayers();
    
    if (!layer || !layer.getLayers) {
        console.error("Invalid layer provided to generateAdminLabels");
        return;
    }
    
    try {
        layer.eachLayer(function(featureLayer) {
            if (!featureLayer.feature || !featureLayer.feature.properties) return;
            
            const name = getLabelName(featureLayer.feature.properties, level);
            if (!name) return;
            
            // Prefer polygon center; fallback to bounds center.
            const center = getPolygonLabelCenter(featureLayer);
            if (!center) return;
            
            // Create a marker with a tooltip for the label
            const marker = L.marker(center, {
                icon: L.divIcon({
                    className: 'admin-label-icon',
                    html: `<div class="admin-label ${level}-label">${name}</div>`,
                    iconSize: [160, 40],
                    iconAnchor: [80, 20]
                }),
                interactive: false // Prevent the label from being clickable
            });
            
            labelLayer.addLayer(marker);
        });
        
        console.log(`Generated ${level} labels from layer`);
    } catch (err) {
        console.error(`Error generating ${level} labels:`, err);
    }
}

function getLabelName(properties, level) {
    if (!properties) return null;
    const candidates = level === 'adm1'
        ? ['NAME_1', 'ADM1_NAME', 'adm1_name', 'name', 'Name']
        : ['ADM2_NAME', 'adm2_name', 'NAME_2', 'Cercle/District', 'District', 'name', 'Name'];

    for (const field of candidates) {
        if (properties[field] !== undefined && properties[field] !== null) {
            const value = String(properties[field]).trim();
            if (value) return value;
        }
    }

    return null;
}

function getPolygonLabelCenter(featureLayer) {
    if (!featureLayer) return null;

    if (typeof featureLayer.getBounds === 'function') {
        const bounds = featureLayer.getBounds();
        if (bounds && typeof bounds.getCenter === 'function') {
            const boundsCenter = bounds.getCenter();
            if (boundsCenter) return boundsCenter;
        }
    }

    if (typeof featureLayer.getCenter === 'function') {
        try {
            const center = featureLayer.getCenter();
            if (center) return center;
        } catch (error) {
            // Some Leaflet polygon implementations require the layer to be on a map.
            return null;
        }
    }

    return null;
}