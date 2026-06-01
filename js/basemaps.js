// basemaps.js - Manages different base map options through a custom control

/**
 * Define the different basemap layers with more reliable sources
 */
export const basemaps = {
    // Standard basemaps
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }),
    
    // Carto basemaps (reliable sources)
    cartoLight: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }),
    
    cartoDark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }),
    
    // Esri basemaps (very reliable)
    esriWorldImagery: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 18
    }),
    
    esriWorldStreetMap: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri — Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012',
        maxZoom: 19
    }),
    
    esriWorldTopoMap: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri — Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community',
        maxZoom: 19
    }),
    
    esriWorldGrayCanvas: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri — Esri, DeLorme, NAVTEQ',
        maxZoom: 16
    }),
    
    // OpenTopoMap (reliable)
    openTopoMap: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: 'Map data: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: © <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
    }),
    
    // Humanitarian style
    osmHOT: L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">Humanitarian OpenStreetMap Team</a> hosted by <a href="https://openstreetmap.fr/" target="_blank">OpenStreetMap France</a>'
    }),
    
    // Mapbox (requires token)
    // To use Mapbox, replace YOUR_MAPBOX_ACCESS_TOKEN with your actual token
    mapboxStreets: L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw', {
        attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18
    }),
    
    // Stadia Maps (newer reliable source)
    stadiaMaps: L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        attribution: '© <a href="https://stadiamaps.com/">Stadia Maps</a>, © <a href="https://openmaptiles.org/">OpenMapTiles</a> © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
    }),
    
    stadiaMapsDark: L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        attribution: '© <a href="https://stadiamaps.com/">Stadia Maps</a>, © <a href="https://openmaptiles.org/">OpenMapTiles</a> © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
    }),
    
    // Thunderforest (requires key for production)
    thunderforestLandscape: L.tileLayer('https://{s}.tile.thunderforest.com/landscape/{z}/{x}/{y}.png?apikey=a5dd6a2f1c934394bce6b0fb077203eb', {
        attribution: '© <a href="http://www.thunderforest.com/">Thunderforest</a>, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 22
    })
};

// List of basemaps for the selector dropdown
export const basemapOptions = [
    { value: 'osm', label: 'OpenStreetMap' },
    { value: 'cartoLight', label: 'Carto Light' },
    { value: 'cartoDark', label: 'Carto Dark' },
    { value: 'esriWorldStreetMap', label: 'ESRI Street Map' },
    { value: 'esriWorldImagery', label: 'ESRI Satellite Imagery' },
    { value: 'esriWorldTopoMap', label: 'ESRI Topographic' },
    { value: 'esriWorldGrayCanvas', label: 'ESRI Light Gray' },
    { value: 'openTopoMap', label: 'OpenTopoMap' },
    { value: 'osmHOT', label: 'Humanitarian' },
    { value: 'mapboxStreets', label: 'Mapbox Streets' },
    { value: 'stadiaMaps', label: 'Stadia Maps' },
    { value: 'stadiaMapsDark', label: 'Stadia Maps Dark' },
    { value: 'thunderforestLandscape', label: 'Thunderforest Landscape' }
];

/**
 * Function to add the default basemap (Carto Light) to the map
 * @param {Object} map - Leaflet map instance
 */
export function addDefaultBasemap(map) {
    basemaps.cartoLight.addTo(map);  // Changed default to Carto Light for reliability
}

/**
 * Custom Leaflet Control for Basemap Selection
 */
export const BasemapControl = L.Control.extend({
    options: {
        position: 'topright' // Position of the control on the map
    },

    onAdd: function (map) {
        // Create a container for the control
        const container = L.DomUtil.create('div', 'leaflet-control-layers leaflet-bar basemap-control');
        container.title = 'Change basemap';

        // Create a select dropdown
        const select = L.DomUtil.create('select', 'basemap-select', container);
        
        // Add a label
        const label = L.DomUtil.create('label', 'basemap-label', container);
        label.textContent = 'Basemap:';
        label.htmlFor = 'basemap-select';
        
        // Position the label before the select element
        container.insertBefore(label, select);
        
        // Add options to the select dropdown
        basemapOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            select.appendChild(optionElement);
        });
        
        // Set initial selected value
        select.value = 'cartoLight';  // Match the default basemap

        // Handle basemap change
        L.DomEvent.on(select, 'change', function () {
            const selectedBasemap = select.value;

            // Remove all basemaps before adding the selected one
            Object.values(basemaps).forEach(layer => {
                if (map.hasLayer(layer)) {
                    map.removeLayer(layer);
                }
            });

            // Add the selected basemap
            basemaps[selectedBasemap].addTo(map);
        });

        // Disable map interactions when interacting with the control
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        return container;
    }
});