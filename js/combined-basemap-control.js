// combined-basemap-control.js

import { basemaps, basemapOptions } from './basemaps.js';

/**
 * Combined control for selecting basemaps for both maps and info panel toggle
 */
export const CombinedBasemapControl = L.Control.extend({
    options: {
        position: 'bottomleft'
    },

    initialize: function(mainMap, compareMap, infoPanel, options) {
        L.setOptions(this, options);
        this.mainMap = mainMap;
        this.compareMap = compareMap;
        this.infoPanel = infoPanel;
        this._mainBasemap = 'osm';
        this._compareBasemap = 'esriWorldImagery';
    },

    onAdd: function() {
        // Create control container with unique ID to prevent duplicates
        const container = L.DomUtil.create('div', 'leaflet-control-layers leaflet-bar basemap-control combined-basemap-control');
        container.id = 'combined-basemap-control-unique';
        
        // Only create selectors if we have both maps
        if (this.mainMap && this.compareMap) {
            // Create left map selector
            this._createMapSelector(
                container, 
                'Left Map:', 
                'left-basemap-select', 
                this._mainBasemap,
                (value) => this._updateBasemap('main', value)
            );
            
            // Create right map selector
            this._createMapSelector(
                container, 
                'Right Map:', 
                'right-basemap-select', 
                this._compareBasemap,
                (value) => this._updateBasemap('compare', value)
            );
        } else {
            // If we only have one map, create a single selector
            this._createMapSelector(
                container, 
                'Basemap:', 
                'single-basemap-select', 
                this._mainBasemap,
                (value) => this._updateBasemap('main', value)
            );
        }
        
        // Create separator
        const separator = L.DomUtil.create('div', 'combined-control-separator', container);
        
        // Create info panel toggle button
        this._createInfoPanelToggle(container);
        
        // Prevent map interactions
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        
        return container;
    },
    
    _createMapSelector: function(container, labelText, selectId, defaultValue, onChange) {
        const group = L.DomUtil.create('div', 'basemap-select-group', container);
        
        // Create label
        const label = L.DomUtil.create('label', '', group);
        label.textContent = labelText;
        
        // Create select
        const select = L.DomUtil.create('select', 'basemap-select', group);
        select.id = selectId;
        
        // Add options
        basemapOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            select.appendChild(optionElement);
        });
        
        // Set default value
        select.value = defaultValue;
        
        // Add change handler
        L.DomEvent.on(select, 'change', function() {
            onChange(select.value);
        });
        
        return group;
    },
    
    _createInfoPanelToggle: function(container) {
        const buttonContainer = L.DomUtil.create('div', 'info-panel-toggle-container', container);
        
        const button = L.DomUtil.create('button', 'info-panel-toggle-button', buttonContainer);
        //button.innerHTML = '📊 Analysis Panel';
        //button.title = 'Toggle Layer Analysis & Reports Panel';
        
        L.DomEvent.on(button, 'click', (e) => {
            L.DomEvent.stopPropagation(e);
            if (this.infoPanel) {
                this.infoPanel.toggle();
                button.classList.toggle('active', this.infoPanel.isVisible);
            }
        });
        
        return buttonContainer;
    },
    
    _updateBasemap: function(mapType, basemapId) {
        const map = mapType === 'main' ? this.mainMap : this.compareMap;
        
        // Remove existing basemap
        Object.values(basemaps).forEach(layer => {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        });
        
        // Add selected basemap
        if (basemaps[basemapId]) {
            basemaps[basemapId].addTo(map);
            
            // Update stored selection
            if (mapType === 'main') {
                this._mainBasemap = basemapId;
            } else {
                this._compareBasemap = basemapId;
            }
        }
    }
});