// main.js - Fixed Raster De-selection & Race Conditions

import { addDefaultBasemap } from './basemaps.js';
import { initializeLegend, updateLegend, hideLegend } from './legend.js';
import { LayerManager } from './layer_manager.js';
import { createAdminLabelLayers, loadCountryOutline } from './admin_labels.js';
import { InfoPanel } from './info_panel.js';
import { populateColorRampSelector, setConfigCountry, COUNTRY_VIEWS, getCountryOutlineCandidates, getCountryPath, getCurrentCountry, SUPPORTED_COUNTRIES, LAYER_CONFIG, PILLAR_CONFIG } from './layer_config.js';
import { getSepiDashboardContent } from './sepi_dashboard_content.js';
// We only import loadTiff. We handle removal manually to ensure compatibility.
import { loadTiff } from './zoom-adaptive-tiff-loader.js'; 
import { WelcomePopup } from './welcome_popup.js';
import { attachDraggableSepiPopups } from './draggable_sepi_popup.js';

// Global references
let layerManager = null;
let infoPanel = null;
let map = null;
let activeLayers = new Set();
let tiffLayers = {}; // Global TIFF layers storage for proper cleanup

// Track async loading states to prevent race conditions
const loadingTracker = {};
let activeCountryOutline = null;
const countryOutlines = {};

/** `sidebarInitialized` can fire while this module is still awaiting outline preload — avoid double load. */
let initialSepiActivationDone = false;
const pillarOverviewByDashboardName = new Map();
let pillarOverviewLoadPromise = null;

function resolveConfigUrl(pathOrResolver) {
    return typeof pathOrResolver === 'function' ? pathOrResolver() : pathOrResolver;
}

function parseCsvLine(line) {
    return line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map((cell) =>
        cell.replace(/^\"|\"$/g, '').replace(/\"\"/g, '"').trim()
    );
}

async function loadPillarOverviewDescriptions() {
    if (pillarOverviewLoadPromise) return pillarOverviewLoadPromise;
    pillarOverviewLoadPromise = fetch('descriptions_Pillar.csv')
        .then((response) => (response.ok ? response.text() : ''))
        .then((csvText) => {
            if (!csvText) return;
            const rows = csvText.split(/\r?\n/).filter((line) => line.trim());
            if (rows.length < 2) return;
            const header = parseCsvLine(rows[0]);
            const dashboardCol = header.findIndex((col) => col === 'Dashboard Pillar Name');
            const overviewCol = header.findIndex((col) => col === 'pillar_overview');
            if (dashboardCol < 0 || overviewCol < 0) return;
            for (let i = 1; i < rows.length; i += 1) {
                const cells = parseCsvLine(rows[i]);
                const key = cells[dashboardCol];
                const overview = cells[overviewCol];
                if (!key || !overview) continue;
                pillarOverviewByDashboardName.set(key.trim(), overview.trim());
            }
        })
        .catch((err) => {
            console.debug('Pillar description CSV unavailable:', err?.message || err);
        });
    return pillarOverviewLoadPromise;
}

// Layer configuration for raster layers (consolidated)
const RASTER_LAYER_CONFIG = {
    'streetNetworkLayer': { type: 'vector', url: () => getCountryPath('street_subset.geojson') },
    'tiffLayer1': { colorScale: 'ndviChange', url: () => getCountryPath('mean_ndvi_change_2015_to_2023.tif') },
    'tiffLayer10': { colorScale: 'serviceAccess', url: () => getCountryPath('som_service_area_2.tif') },
    'tiffLayer11': { colorScale: 'nightlights', url: () => getCountryPath(`VNP46A2_2024_${getCurrentCountry()}.tif`) },
    'tiffLayer12': { colorScale: 'elevation', url: () => getCountryPath('elevation.tif') },
    'tiffLayer13': { colorScale: 'soilMoisture', url: () => getCountryPath('soil_moisture.tif') },
    'tiffLayer14': { colorScale: 'temperature', url: () => getCountryPath('temperature.tif') },
    'tiffLayer15': { colorScale: 'rainfall', url: () => getCountryPath('rainfall.tif') },
    'tiffLayer16': { colorScale: 'populationDensity', url: () => getCountryPath('population.tif') },
    'tiffLayer17': { colorScale: 'roadAccess', url: () => getCountryPath('roads.tif') },
    'tiffLayer18': { colorScale: 'educationAccess', url: () => getCountryPath('education.tif') },
    'tiffLayer19': { colorScale: 'healthAccess', url: () => getCountryPath('health.tif') },
    'tiffLayer20': { colorScale: 'cellTowerDensity', url: () => getCountryPath('celltower.tif') }
};

// Initialize application
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing SEPI Mapping Tool...');
    
    try {
        // Setup map and globals
        map = setupMap('map');
        window.map = map;
        window.tiffLayers = tiffLayers;
        attachDraggableSepiPopups(map);
        
        setupCountrySelector();

        // Initialize UI components
        initializeLegend();
        setupDropdownToggles();
        initializeColorRampSelectors();
        void loadPillarOverviewDescriptions();
        
        // Preload all country outlines for map controls.
        await preloadCountryOutlines();

        // Load default country outline
        await loadDefaultCountryOutline();
        
        // Initialize layer management system
        layerManager = new LayerManager(map, updateLegend, hideLegend);
        window.switchApplicationCountry = switchApplicationCountry;

        function isSepiDistrictDataDisplayed() {
            return Boolean(
                layerManager &&
                (layerManager.sepiManager?.isActive() || layerManager.pillarManager?.isActive())
            );
        }

        function hideDataCountryOutlineIfSepiDisplayed() {
            if (!map || !isSepiDistrictDataDisplayed()) return;
            const key = toCountryOutlineKey(getCurrentCountry());
            const outline = countryOutlines[key];
            if (outline && map.hasLayer(outline)) {
                map.removeLayer(outline);
            }
        }

        window.hideDataCountryOutlineIfSepiDisplayed = hideDataCountryOutlineIfSepiDisplayed;
        window.addEventListener('sepiDataLayersDisplayed', hideDataCountryOutlineIfSepiDisplayed);

        // Setup admin labels
        const labelLayers = createAdminLabelLayers(map, layerManager.getActiveLayers().vector, countryOutlines, null);
        layerManager.setLabelLayers(labelLayers);
        
        // Initialize info panel
        setupInfoPanel();
        
        // Setup layer controls (consolidated)
        setupAllLayerControls();

        /** SEPI default (Somalia): `index.html` dispatches `sidebarInitialized` from its DOMContentLoaded.
         * This handler runs async and awaits outline preload first, so that event often fires *before*
         * we could register a listener — then no SEPI layer loads. Re-run if sidebar is already built. */
        scheduleInitialSepiActivation();
        
        // Auto-enable SEPI layer (welcome popup disabled on startup)
        setTimeout(() => {
            enableDefaultLayers();
        }, 1000);
        
        // Initialize opacity displays
        setupOpacityDisplays();
        
        console.log('Application initialized successfully!');
        
    } catch (error) {
        console.error('Failed to initialize application:', error);
        showErrorMessage('Failed to load the mapping application. Please refresh the page.');
    }
});

/**
 * CONSOLIDATED: Setup all layer controls (reduces duplicate code)
 */
function setupAllLayerControls() {
    // Setup raster layer controls
    Object.keys(RASTER_LAYER_CONFIG).forEach(layerId => {
        const checkbox = document.getElementById(layerId);
        if (checkbox) {
            checkbox.addEventListener('change', async function() {
                console.log(`Raster layer ${layerId} toggled: ${this.checked}`);
                
                if (this.checked) {
                    // --- RACE CONDITION FIX START ---
                    // Generate a unique ID for this load request
                    const requestId = Date.now();
                    loadingTracker[layerId] = requestId;
                    
                    try {
                        await loadRasterLayer(layerId, requestId);
                        // The async check happens INSIDE loadRasterLayer now
                    } catch (error) {
                        console.error(`Failed to load ${layerId}:`, error);
                        this.checked = false;
                        removeRasterLayer(layerId); // Ensure cleanup on error
                    }
                } else {
                    // --- RACE CONDITION FIX END ---
                    // Invalidate any pending loads
                    loadingTracker[layerId] = null; 
                    removeRasterLayer(layerId);
                }
                
                setTimeout(updateLegendBasedOnActiveLayers, 100);
            });
        }
    });
    
    // Setup other layer controls (consolidated)
    const otherCheckboxes = document.querySelectorAll('#sepiLayer, #geojsonLayer, #geojsonLayer2, #pointLayer, #pointLayer2, #ndviButtonLayer');
    otherCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', handleLayerChange);
    });
    
    // Monitor pillar select dropdown
    const pillarSelect = document.getElementById('pillarSelect');
    if (pillarSelect) {
        pillarSelect.addEventListener('change', handleLayerChange);
    }
    
    // Setup NDVI button layer
    const ndviButtonCheckbox = document.getElementById('ndviButtonLayer');
    if (ndviButtonCheckbox) {
        ndviButtonCheckbox.addEventListener('change', function() {
            const controls = this.closest('.test-layer')?.querySelector('.layer-controls');
            if (controls) {
                controls.style.display = this.checked ? 'block' : 'none';
            }
        });
    }
    
    console.log('All layer controls setup completed');
}

/**
 * OPTIMIZED: Load raster layer with improved error handling and race condition checks
 */
async function loadRasterLayer(layerId, requestId) {
    console.log(`Loading raster layer: ${layerId}`);
    
    // Clean up any orphaned layers first
    cleanupOrphanedTiffLayers(layerId);
    
    const config = RASTER_LAYER_CONFIG[layerId];
    if (!config) {
        throw new Error(`No configuration found for ${layerId}`);
    }
    
    if (layerId === 'streetNetworkLayer') {
        // Handle street network (vector layer)
        if (!layerManager.layers.vector[layerId]) {
            const { loadVectorLayer } = await import('./vector_layers.js');
            layerManager.layers.vector[layerId] = await loadVectorLayer(resolveConfigUrl(config.url), {
                style: { color: "#3388ff", weight: 0.5, opacity: 1, fillOpacity: 0 }
            });
        }
        
        // Async Check: Did user uncheck while vector was loading?
        if (loadingTracker[layerId] !== requestId || !document.getElementById(layerId).checked) {
             console.log(`Load cancelled for ${layerId}`);
             return; 
        }

        layerManager.layers.vector[layerId].addTo(map);

    } else {
        // Handle TIFF layers
        const { COLOR_SCALES } = await import('./layer_config.js');
        const colorScale = COLOR_SCALES[config.colorScale];
        
        if (!colorScale) {
            throw new Error(`Color scale '${config.colorScale}' not found for ${layerId}`);
        }
        
        try {
            // Pass the global tiffLayers object
            await loadTiff(resolveConfigUrl(config.url), layerId, tiffLayers, map, colorScale);
            
            // --- VITAL ASYNC CHECK ---
            // If the user unchecked the box while `loadTiff` was processing (downloading/parsing),
            // we must immediately remove what we just added.
            if (loadingTracker[layerId] !== requestId || !document.getElementById(layerId).checked) {
                console.warn(`Layer ${layerId} finished loading but was unchecked. Removing immediately.`);
                removeRasterLayer(layerId);
                return;
            }

            // Verify layer was properly stored
            if (!tiffLayers[layerId] || !map.hasLayer(tiffLayers[layerId])) {
                throw new Error(`Layer ${layerId} was not properly loaded`);
            }
            
            // Store in LayerManager for consistency
            if (layerManager?.layers) {
                layerManager.layers.tiff[layerId] = tiffLayers[layerId];
            }
            
            console.log(`✓ Successfully loaded TIFF layer: ${layerId}`);
            
        } catch (error) {
            // Clean up any partial state
            removeRasterLayer(layerId);
            throw error;
        }
    }
}

/**
 * Hardened Removal of Raster Layers
 */
function removeRasterLayer(layerId) {
    console.log(`Force removing layer: ${layerId}`);
    
    // 1. Remove from Global tracking objects
    if (window.tiffLayers && window.tiffLayers[layerId]) {
        if (map.hasLayer(window.tiffLayers[layerId])) {
            map.removeLayer(window.tiffLayers[layerId]);
        }
        delete window.tiffLayers[layerId];
    }

    if (layerManager?.layers?.tiff?.[layerId]) {
        if (map.hasLayer(layerManager.layers.tiff[layerId])) {
            map.removeLayer(layerManager.layers.tiff[layerId]);
        }
        delete layerManager.layers.tiff[layerId];
    }

    // 2. Nuclear scan of the map to ensure NO instances remain
    // This catches "zombie" layers that lost their variable reference
    map.eachLayer(function(layer) {
        if (layer instanceof L.ImageOverlay) {
            const config = RASTER_LAYER_CONFIG[layerId];
            // Match by URL or by a custom property if we assigned one
            const targetUrl = resolveConfigUrl(config?.url);
            if (targetUrl && layer._url && layer._url.includes(targetUrl)) {
                console.log(`Cleaning up orphaned map instance of ${layerId}`);
                map.removeLayer(layer);
            }
        }
    });

    // 3. Clear UI
    hideLegend();
}

/**
 * Clean up orphaned TIFF layers
 */
function cleanupOrphanedTiffLayers(excludeLayerId = null) {
    const orphanedLayers = [];
    map.eachLayer(function(layer) {
        if (layer instanceof L.ImageOverlay) {
            const isTracked = Object.values(tiffLayers).includes(layer) ||
                            Object.values(layerManager?.layers?.tiff || {}).includes(layer);
            
            // Be careful not to remove the layer we are currently trying to load
            if (!isTracked && layer._layerName !== excludeLayerId) {
                orphanedLayers.push(layer);
            }
        }
    });
    
    orphanedLayers.forEach(orphan => {
        console.log(`Removing orphaned layer: ${orphan._layerName || orphan._leaflet_id}`);
        map.removeLayer(orphan);
    });
    
    return orphanedLayers.length;
}

/**
 * Handle layer changes and update legend
 */
function handleLayerChange() {
    setTimeout(updateLegendBasedOnActiveLayers, 100);
}

/**
 * Update legend based on currently active layers
 */
function updateLegendBasedOnActiveLayers() {
    const activeLayerTypes = [];
    const activeSEPIOption = document.querySelector('.sepi-option.active');
    
    // Check various layer types for active layers
    const layerChecks = [
        { id: 'sepiLayer', type: 'sepi' },
        { id: 'pillarSelect', type: 'pillar', isSelect: true },
        { id: 'geojsonLayer', type: 'vector', hasAttribute: 'vectorAttribute1' },
        { id: 'geojsonLayer2', type: 'vector', hasAttribute: 'vectorAttribute2' },
        { id: 'pointLayer', type: 'point', hasAttribute: 'pointValueSelector' },
        { id: 'pointLayer2', type: 'point', hasAttribute: 'pointValueSelector2' }
    ];
    
    layerChecks.forEach(({ id, type, isSelect, hasAttribute }) => {
        const element = document.getElementById(id);
        if (!element) return;
        
        const isActive = isSelect ? element.value : element.checked;
        
        if (isActive) {
            if (hasAttribute) {
                const attributeSelector = document.getElementById(hasAttribute);
                if (attributeSelector?.value) {
                    activeLayerTypes.push(type);
                }
            } else {
                activeLayerTypes.push(type);
            }
        }
    });
    
    // Check TIFF/raster layers
    Object.keys(RASTER_LAYER_CONFIG).forEach(layerId => {
        const checkbox = document.getElementById(layerId);
        if (checkbox?.checked) {
            activeLayerTypes.push('raster');
        }
    });
    
    // Keep legend visible when SEPI is active from the SEPI selector.
    if (activeLayerTypes.length === 0 && !activeSEPIOption) {
        hideLegend();
    }
}


// === UTILITY FUNCTIONS ===

/**
 * Setup the main map
 */


function syncCountrySelectorUi() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const currentCountry = getCurrentCountry();
    sidebar.querySelectorAll('.country-dot-option').forEach((option) => {
        option.classList.toggle('active', option.dataset.country === currentCountry);
    });
}

async function switchApplicationCountry(selectedCountry) {
    if (!SUPPORTED_COUNTRIES.includes(selectedCountry)) return;
    if (selectedCountry === getCurrentCountry()) return;

    console.log(`Switching to country: ${selectedCountry}`);
    setConfigCountry(selectedCountry);
    document.dispatchEvent(new CustomEvent('countryChanged', { detail: { country: selectedCountry } }));
    syncCountrySelectorUi();

    clearCountryDependentLayers();
    layerManager?.resetCountryScopedData();

    const countryView = COUNTRY_VIEWS[selectedCountry] || COUNTRY_VIEWS.Somalia;
    map.setView(countryView.center, countryView.zoom);

    await loadOutlineWithFallbacks(selectedCountry);
    await activateDefaultSEPISelection();
    handleLayerChange();
}

function setupCountrySelector() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    syncCountrySelectorUi();
    setTimeout(syncCountrySelectorUi, 0);

    sidebar.addEventListener('click', async (event) => {
        const infoTrigger = event.target.closest('.country-info-trigger');
        if (infoTrigger && sidebar.contains(infoTrigger)) {
            if (typeof window.showSEPIInfo === 'function') {
                window.showSEPIInfo();
            }
            return;
        }

        const clickedOption = event.target.closest('.country-dot-option');
        if (!clickedOption || !sidebar.contains(clickedOption)) return;

        const selectedCountry = clickedOption.dataset.country;
        if (!selectedCountry || selectedCountry === getCurrentCountry()) return;

        await switchApplicationCountry(selectedCountry);
    });
}

function resetSepiSubpillarSelectionUi() {
    document.querySelectorAll('.sepi-subpillar-option').forEach((el) => el.classList.remove('active'));
    document.querySelectorAll('.sepi-subpillars').forEach((el) => el.classList.remove('show'));
    const conflictYearControl = document.getElementById('conflictYearControl');
    if (conflictYearControl) conflictYearControl.style.display = 'none';
}

function scheduleInitialSepiActivation() {
    const run = () => {
        if (initialSepiActivationDone) return;
        initialSepiActivationDone = true;
        void activateDefaultSEPISelection().catch((err) =>
            console.error('Initial Somalia / SEPI activation failed:', err)
        );
    };
    document.addEventListener('sidebarInitialized', run, { once: true });
    if (document.querySelector('.sepi-option[data-sepi-type="main"]')) {
        run();
    }
}

async function activateDefaultSEPISelection() {
    const sepiOptions = document.querySelectorAll('.sepi-option');
    const defaultOption = document.querySelector('.sepi-option[data-sepi-type="main"]');
    if (!defaultOption) return;

    sepiOptions.forEach(option => option.classList.remove('active'));
    defaultOption.classList.add('active');
    document.querySelector('.sepi-section')?.classList.remove('no-active-layers');

    resetSepiSubpillarSelectionUi();

    await layerManager?.handleSEPIOptionChange('main', null);
}
function setupMap(mapId) {
    const leafletMap = L.map(mapId, {
        zoomControl: true,
        attributionControl: true
    }).setView([6.5707, 40.9962], 5);
    
    leafletMap.attributionControl.setPrefix('The boundaries and names shown do not imply official endorsement by the United Nations.');
    leafletMap.attributionControl.setPosition('bottomleft');
    
    addDefaultBasemap(leafletMap);
    
    L.control.scale({
        position: 'bottomleft',
        metric: true,
        imperial: false,
        maxWidth: 200
    }).addTo(leafletMap);
    
    console.log('Map initialized');
    return leafletMap;
}

/**
 * Load default country outline
 */
async function loadDefaultCountryOutline() {
    try {
        await loadOutlineWithFallbacks(getCurrentCountry());
    } catch (error) {
        console.error('Failed to load country outline:', error);
    }
}

async function loadOutlineWithFallbacks(country) {
    const countryKey = toCountryOutlineKey(country);
    if (countryOutlines[countryKey]) {
        activeCountryOutline = countryOutlines[countryKey];
        showAllCountryOutlines(countryKey);
        window.activeCountryOutline = activeCountryOutline;
        return;
    }

    const outlineCandidates = getCountryOutlineCandidates(country);
    for (const outlinePath of outlineCandidates) {
        const outline = await loadCountryOutline(country.toLowerCase(), outlinePath);
        if (outline) {
            countryOutlines[countryKey] = outline;
            activeCountryOutline = outline;
            showAllCountryOutlines(countryKey);
            window.activeCountryOutline = outline;
            console.log(`${country} outline loaded from ${outlinePath}`);
            return;
        }
    }
    console.warn(`No valid outline file found for ${country}`);
    showAllCountryOutlines(countryKey);
}

async function preloadCountryOutlines() {
    for (const country of SUPPORTED_COUNTRIES) {
        const key = toCountryOutlineKey(country);
        if (countryOutlines[key]) continue;

        const candidates = getCountryOutlineCandidates(country);
        for (const outlinePath of candidates) {
            const outline = await loadCountryOutline(key, outlinePath);
            if (outline) {
                countryOutlines[key] = outline;
                break;
            }
        }
    }
}

function toCountryOutlineKey(country) {
    return country.toLowerCase();
}

function clearAllCountryOutlinesFromMap() {
    Object.values(countryOutlines).forEach(outline => {
        if (outline && map.hasLayer(outline)) {
            map.removeLayer(outline);
        }
    });
}

function addOutlineToMapBottom(outline) {
    if (!outline) return;
    outline.addTo(map);
    safelySetLayerOrder(outline, 'back');
    outline.eachLayer(layer => safelySetLayerOrder(layer, 'back'));
}

function showAllCountryOutlines(activeCountryKey) {
    clearAllCountryOutlinesFromMap();
    Object.entries(countryOutlines).forEach(([key, outline]) => {
        if (!outline) return;
        addOutlineToMapBottom(outline);

        // Keep the selected country's outline on top so context remains clear.
        if (key === activeCountryKey) {
            safelySetLayerOrder(outline, 'front');
            outline.eachLayer(layer => safelySetLayerOrder(layer, 'front'));
        }
    });
}

function safelySetLayerOrder(layer, direction) {
    if (!layer) return;
    try {
        if (direction === 'front') {
            layer.bringToFront?.();
        } else {
            layer.bringToBack?.();
        }
    } catch (err) {
        // Some Leaflet layer types (or detached layers) don't support path z-order ops safely.
        console.debug(`Skipped bringTo${direction === 'front' ? 'Front' : 'Back'} for layer:`, err);
    }
}

function clearCountryDependentLayers() {
    Object.keys(RASTER_LAYER_CONFIG).forEach(layerId => {
        loadingTracker[layerId] = null;
        removeRasterLayer(layerId);
        const checkbox = document.getElementById(layerId);
        if (checkbox) checkbox.checked = false;
    });

    ['geojsonLayer', 'geojsonLayer2', 'pointLayer', 'pointLayer2', 'ndviButtonLayer'].forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox?.checked) {
            checkbox.checked = false;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    layerManager?.removeCurrentSEPILayers();

    if (layerManager?.layers) {
        layerManager.layers.vector = {};
        layerManager.layers.point = {};
        layerManager.layers.tiff = {};
    }
    layerManager?.activeLayers?.clear?.();
    tiffLayers = {};
    window.tiffLayers = tiffLayers;
}

/**
 * Setup info panel
 */
function setupInfoPanel() {
    try {
        infoPanel = new InfoPanel({
            position: 'topright',
            width: '420px',
            title: 'SEPI Analysis & Layer Information',
            docked: true,
            mountTarget: '#info-panel-slot'
        });
        
        infoPanel.setMap(map);
        setupAnalysisSidebarResizer();
        
        // Update info panel with current layer state
        setInterval(updateInfoPanelWithSEPI, 2000);
        
        // Set global reference for PDF download functionality
        window.infoPanelManager = { getInfoPanel: () => infoPanel };
        window.infoPanelInstance = infoPanel;

        document.addEventListener('conflictTimelineUpdated', (e) => {
            infoPanel?.setConflictTimelineData?.(e.detail || null);
        });
        
        infoPanel.show();
        
        console.log('SEPI Info panel initialized');
        
    } catch (error) {
        console.error('Failed to initialize info panel:', error);
    }
}

function setupAnalysisSidebarResizer() {
    const sidebar = document.getElementById('analysis-sidebar');
    const handle = sidebar?.querySelector('.analysis-sidebar-resize-handle');
    if (!sidebar || !handle) return;
    if (handle.dataset.bound === '1') return;
    handle.dataset.bound = '1';

    let startX = 0;
    let startWidth = 0;
    let dragging = false;

    const onMouseMove = (event) => {
        if (!dragging) return;
        const delta = startX - event.clientX;
        const newWidth = Math.max(300, Math.min(window.innerWidth * 0.5, startWidth + delta));
        sidebar.style.width = `${newWidth}px`;
    };

    const onMouseUp = () => {
        dragging = false;
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', (event) => {
        event.preventDefault();
        dragging = true;
        startX = event.clientX;
        startWidth = sidebar.getBoundingClientRect().width;
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

function findLayerConfigByDomId(domId) {
    for (const cfg of Object.values(LAYER_CONFIG)) {
        if (cfg && cfg.id === domId) return cfg;
    }
    return null;
}

function getConfigSidebarDescription(domId) {
    const cfg = findLayerConfigByDomId(domId);
    const s = cfg?.legend?.description ?? cfg?.description ?? '';
    return typeof s === 'string' ? s.trim() : '';
}

/**
 * Update info panel with current layer state
 */
function updateInfoPanelWithSEPI() {
    if (!infoPanel || !layerManager) return;
    
    const activeLayers = layerManager.getActiveLayers();
    
    // Update TIFF layers
    Object.entries(activeLayers.tiff).forEach(([id, layer]) => {
        if (map.hasLayer(layer)) {
            infoPanel.addLayer(id, {
                name: getLayerDisplayName(id),
                type: 'raster',
                layer: layer,
                opacity: layer.options?.opacity || 1,
                description: getConfigSidebarDescription(id)
            });
        } else {
            infoPanel.removeLayer(id);
        }
    });
    
    // Update vector layers
    Object.entries(activeLayers.vector).forEach(([id, layer]) => {
        if (map.hasLayer(layer)) {
            const selectedAttribute = getSelectedAttribute(id);
            
            infoPanel.addLayer(id, {
                name: getLayerDisplayName(id),
                type: 'vector',
                layer: layer,
                selectedAttribute: selectedAttribute,
                featureCount: layer.getLayers ? layer.getLayers().length : 0,
                description: getConfigSidebarDescription(id)
            });
        } else {
            infoPanel.removeLayer(id);
        }
    });
    
    // Update SEPI layer specifically
    if (layerManager.sepiManager?.isActive()) {
        const country = getCurrentCountry();
        const dashboardContent = getSepiDashboardContent(country);
        infoPanel.addLayer('sepi', {
            name: dashboardContent
                ? `Overall Peace Index — ${dashboardContent.countryLabel}`
                : 'Socioeconomic Peace Index (SEPI)',
            type: 'sepi',
            layer: layerManager.sepiManager.sepiLayer,
            selectedAttribute: layerManager.sepiManager?.config?.property || 'peacebuilding_index',
            featureCount: layerManager.sepiManager.sepiLayer?.getLayers?.()?.length || 0,
            description: dashboardContent ? '' : getConfigSidebarDescription('sepiLayer'),
            dashboardContent,
            source: 'SEPI composite dataset',
            year: 'Latest available'
        });
    } else {
        infoPanel.removeLayer('sepi');
    }
    
    // Update pillar and conflict layers
    if (layerManager.pillarManager?.isActive()) {
        const currentPillar = layerManager.pillarManager.getCurrentPillarId();
        if (currentPillar) {
            const isConflictData = currentPillar.startsWith('conflict_');
            const layerType = isConflictData ? 'conflict' : 'pillar';
            const displayName = isConflictData 
                ? `Conflict: ${getPillarDisplayName(currentPillar)}`
                : `Pillar: ${getPillarDisplayName(currentPillar)}`;

            const pillarCfg = PILLAR_CONFIG[currentPillar];
            let pillarDescription = pillarCfg?.description || '';
            if (!isConflictData) {
                const dashboardName = getPillarDisplayName(currentPillar);
                const csvOverview = pillarOverviewByDashboardName.get(dashboardName);
                if (csvOverview) {
                    pillarDescription = csvOverview;
                }
            }
            if (isConflictData && layerManager.pillarManager?.conflictPooledScale) {
                const note =
                    'Scale: pooled 2nd–98th percentile across Kenya, Somalia, and South Sudan (counts use log before pooling).';
                pillarDescription = pillarDescription ? `${pillarDescription} ${note}` : note;
            }

            infoPanel.addLayer(layerType, {
                name: displayName,
                type: layerType,
                layer: layerManager.pillarManager.getCurrentLayer(),
                selectedAttribute: currentPillar,
                rankingAttribute: layerManager.pillarManager?.currentPropertyName || currentPillar,
                featureCount: layerManager.pillarManager.getCurrentLayer()?.getLayers?.()?.length || 0,
                description: pillarDescription,
                source: isConflictData ? 'ACLED API' : 'SEPI pillar dataset',
                year: isConflictData
                    ? (layerManager.pillarManager?.conflictYear || 'Selected year')
                    : 'Latest available'
            });

            // Keep only the currently relevant derived layer entry to avoid stale state in Active Layers UI.
            if (isConflictData) {
                infoPanel.removeLayer('pillar');
            } else {
                infoPanel.removeLayer('conflict');
            }

            if (isConflictData) {
                const timelinePayload = layerManager.pillarManager.getConflictTimelinePayload?.(
                    layerManager.pillarManager.selectedConflictDistrict || null
                );
                infoPanel.setConflictTimelineData?.(timelinePayload || null);
            } else {
                infoPanel.clearConflictTimelineData?.();
            }
        }
    } else {
        infoPanel.removeLayer('pillar');
        infoPanel.removeLayer('conflict');
        infoPanel.clearConflictTimelineData?.();
    }
}


function getPillarDisplayName(pillarId) {
    const pillarNames = {
        education: 'Education Index',
        food_security: 'Food Security Index',
        poverty: 'Poverty Reduction Index',
        health: 'Health Access Index',
        climate_vulnerability: 'Climate Resilience Index',
        literacy_percent_total: 'Literacy percent total',
        primary_school_net_attendance_total: 'Primary school net attendance rate (total)',
        percent_highest_level_secondary_education: 'Percent highest level secondary education',
        net_attendance_total: 'Secondary Attendance (Total)',
        school_access_pop: 'Population with school access',
        on_payroll_pct: 'Share of teachers on payroll',
        dropout_pct: 'Student dropout rate',
        healthcare_access_pop: 'Population with healthcare access',
        health_fac_per_10k_pop: 'Health facilities per 10,000 population',
        hospitals_per_100k_pop: 'Hospitals per 100,000 population',
        pop_frac_3plus: 'IPC Phase 3+ population fraction',
        poverty_headcount_pct: 'Poverty headcount (below poverty line)',
        gcp_pc: 'Gross County Product Per Capita',
        total_expenditure_usd: 'Total expenditure (USD)',
        annual_cmb_mean: 'Average annual CMB cost',
        rs_ndvi: 'NDVI',
        rs_soil_moist: 'Soil moisture anomaly',
        rs_fapar: 'FAPAR',
        rs_pdsi: 'PDSI',
        conflict_events: 'Conflict Events',
        conflict_fatalities: 'Conflict Fatalities',
        conflict_events_per_1k: 'Conflict Events per 100k population',
        conflict_fatalities_per_1k: 'Conflict Fatalities per 100k population'
    };
    
    return pillarNames[pillarId] || pillarId;
}

function getLayerDisplayName(layerId) {
    const layerNames = {
        'sepi': 'Socioeconomic Peace Index (SEPI)',
        'geojsonLayer': 'Subnational (Regional) Statistics',
        'geojsonLayer2': 'Subnational (District) Statistics',
        'admin1': 'Subnational (Regional) Statistics',
        'admin2': 'Subnational (District) Statistics',
        'streetNetworkLayer': 'Street Network',
        'tiffLayer1': 'NDVI Change (2015-2023)',
        'tiffLayer10': 'Service Coverage Areas',
        'tiffLayer11': 'Nighttime Lights (2024)',
        'tiffLayer12': 'Elevation',
        'tiffLayer13': 'Soil Moisture',
        'tiffLayer14': 'Temperature',
        'tiffLayer15': 'Rainfall',
        'tiffLayer16': 'Population Density',
        'tiffLayer17': 'Road Network',
        'tiffLayer18': 'Education Access',
        'tiffLayer19': 'Health Facility Access',
        'tiffLayer20': 'Cell Tower Coverage',
        'pointLayer': 'DHS Statistics',
        'pointLayer2': 'Cities',
        'conflict_events': 'Conflict Events',
        'conflict_fatalities': 'Conflict Fatalities',
        'conflict_events_per_1k': 'Conflict Events per 100k population',
        'conflict_fatalities_per_1k': 'Conflict Fatalities per 100k population'
    };
    
    return layerNames[layerId] || layerId.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

function initializeSEPIFeatures() {
    setTimeout(() => {
        const sepiCheckbox = document.getElementById('sepiLayer');
        if (sepiCheckbox && !sepiCheckbox.checked) {
            sepiCheckbox.checked = true;
            sepiCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
            
            const sepiSection = sepiCheckbox.closest('.sepi-section');
            if (sepiSection) {
                const controls = sepiSection.querySelector('.layer-controls');
                if (controls) {
                    controls.style.display = 'block';
                    controls.classList.add('show');
                    sepiSection.classList.add('active');
                }
            }
        }
    }, 1500);
}

function getSelectedAttribute(layerId) {
    const attributeSelectors = {
        'geojsonLayer': 'vectorAttribute1',
        'geojsonLayer2': 'vectorAttribute2',
        'admin1': 'vectorAttribute1',
        'admin2': 'vectorAttribute2'
    };
    
    const selectorId = attributeSelectors[layerId];
    if (selectorId) {
        const selector = document.getElementById(selectorId);
        return selector?.value || null;
    }
    
    return null;
}

function initializeColorRampSelectors() {
    const colorRampSelectors = [
        'vectorColorRamp1', 'vectorColorRamp2',
        'pointColorRamp', 'pointColorRamp2'
    ];
    colorRampSelectors.forEach((selectorId) => {
        if (document.getElementById(selectorId)) {
            populateColorRampSelector(selectorId);
        }
    });
}

function enableDefaultLayers() {
    console.log('Combined SEPI section initialized with Overall Peace Index active by default');
}

function setupDropdownToggles() {
    document.querySelectorAll('.dropdown-btn').forEach(button => {
        button.addEventListener('click', function() {
            this.classList.toggle('active');
            
            const container = this.nextElementSibling;
            if (container?.classList.contains('dropdown-container')) {
                const isVisible = container.style.display === 'block';
                container.style.display = isVisible ? 'none' : 'block';
            }
        });
    });
}

function setupOpacityDisplays() {
    document.querySelectorAll('input[type="range"]').forEach(slider => {
        const displayId = slider.id.replace('Opacity', 'OpacityValue');
        const display = document.getElementById(displayId);
        
        if (display) {
            const updateDisplay = () => {
                const value = Math.round(slider.value * 100);
                display.textContent = `${value}%`;
            };
            
            updateDisplay();
            slider.addEventListener('input', updateDisplay);
        }
    });
}

function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #dc3545;
        color: white;
        padding: 15px;
        border-radius: 5px;
        z-index: 10000;
        max-width: 300px;
        font-family: Arial, sans-serif;
    `;
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.key === 'i' || e.key === 'I') {
        infoPanel?.toggle();
    }
    
    if (e.key === 'h' || e.key === 'H') {
        new WelcomePopup(true);
    }
    
    if ((e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey)) {
        const cleaned = cleanupOrphanedTiffLayers();
        console.log(`Manual cleanup: ${cleaned} orphaned layers removed`);
    }
});

// Export for debugging
window.debug = {
    layerManager: () => layerManager,
    infoPanel: () => infoPanel,
    map: () => map,
    updateLegend: updateLegendBasedOnActiveLayers,
    tiffLayers: () => tiffLayers,
    removeRasterLayer: removeRasterLayer,
    loadRasterLayer: loadRasterLayer,
    cleanupOrphans: cleanupOrphanedTiffLayers,
    showWelcome: () => new WelcomePopup(true)
};

console.log('Optimized main application loaded. Shortcuts: I=Info, H=Help, Ctrl+C=Cleanup');