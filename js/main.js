// main.js - Core application logic

// Import modules
import { addDefaultBasemap, basemaps } from './basemaps.js'; 
import { setupLayerControls } from './layer_controls.js'; 
import { initializeLegend, addLegendEntry, removeLegendEntry, updateLegend, hideLegend } from './legend.js';
import { colorScales } from './color_scales.js'; 
import { loadVectorLayer } from './vector_layers.js';
import { initializeSplitMap } from './split-map.js';
import { createAdminLabelLayers, generateAdminLabels } from './admin_labels.js';
import { initializeInfoPopup } from './info_popup.js';
import { WelcomePopup } from './welcome_popup.js';
import { InfoPanel } from './info_panel.js';
import { CombinedBasemapControl } from './combined-basemap-control.js';

// Global layer storage
export const layers = {
    tiff: {},     // Store TIFF layers
    vector: {},   // Store vector layers
    point: {},    // Store point layer
    countryOutline: null, // Store country outline
    labels: null  // Store label layers
};

// Info panel instance
export let infoPanel = null;
const ENABLE_COMPARE_MAP = false;

// Initialize application
document.addEventListener('DOMContentLoaded', async function() {
    const { mainMap, compareMap } = ENABLE_COMPARE_MAP
        ? initializeSplitMap('map', 'compare-map', setupMainMap, setupCompareMap, 100)
        : { mainMap: setupMainMap('map'), compareMap: null };

    if (infoPanel) {
        infoPanel.setLayoutChangeHandler(() => scheduleMapLayoutRefresh(mainMap, compareMap));
        scheduleMapLayoutRefresh(mainMap, compareMap);
    }

    setupLeftSidebarResize(mainMap, compareMap);
    setupAnalysisSidebarResize(mainMap, compareMap);

    // Store main map reference globally
    window.map = mainMap;
    window.mapLayers = layers;
    
    // Initialize UI components
    initializeLegend();
    initializeInfoPopup(); // Initialize the info popup system
    setupDropdownToggles();
    
    // Load Lebanon outline by default
    //await loadCountryOutline(mainMap);
    
    // Initialize admin label layers with info panel
    layers.labels = createAdminLabelLayers(mainMap, layers.vector, layers.countryOutline, compareMap, infoPanel);
    
    // Setup layer controls (this will auto-load Social-Vulnerability Admin Level 1)
    setupLayerControls(mainMap, layers, colorScales, addLegendEntry, removeLegendEntry, updateLegend, hideLegend, infoPanel);
    
    // Initialize opacity values display
    setupOpacityDisplays();
    
    // Ensure Social Vulnerability dropdown is open by default
    openSocialVulnerabilityDropdown();
    if (typeof window.syncSVSubindicatorPanelsVisibility === 'function') {
        window.syncSVSubindicatorPanelsVisibility();
    }

    syncEscalationControlsWrapVisibility();
    const escalationCb = document.getElementById('escalationLayer');
    if (escalationCb) {
        escalationCb.addEventListener('change', syncEscalationControlsWrapVisibility);
    }
    const stressorsDropdownBtn = document.querySelector('.stressors-section-btn');
    if (stressorsDropdownBtn) {
        stressorsDropdownBtn.addEventListener('click', () => {
            setTimeout(() => {
                syncEscalationControlsWrapVisibility();
                if (typeof window.syncSVSubindicatorPanelsVisibility === 'function') {
                    window.syncSVSubindicatorPanelsVisibility();
                }
            }, 0);
        });
    }
    
    // NOTE: Combined control is now created in createAdminLabelLayers
    
    // Welcome popup disabled on startup (use window.showWelcome() to open manually)
});

const ANALYSIS_SIDEBAR_WIDTH_KEY = 'onlineMap.analysisSidebarWidth';
const LEFT_SIDEBAR_WIDTH_KEY = 'onlineMap.leftSidebarWidth';
const LEFT_SIDEBAR_MIN = 260;
const LEFT_SIDEBAR_MAX = 560;
const ANALYSIS_SIDEBAR_MIN = 280;
const ANALYSIS_SIDEBAR_MAX = 720;
const DESKTOP_ROW_MQ = '(min-width: 1101px)';

function setupLeftSidebarResize(mainMap, compareMap) {
    const sidebar = document.getElementById('sidebar');
    const handle = document.getElementById('leftSidebarResizeHandle');
    if (!sidebar || !handle) {
        return;
    }

    const mq = window.matchMedia(DESKTOP_ROW_MQ);

    function setSidebarWidthPx(w) {
        const clamped = Math.round(Math.min(LEFT_SIDEBAR_MAX, Math.max(LEFT_SIDEBAR_MIN, w)));
        sidebar.style.flex = `0 0 ${clamped}px`;
        sidebar.style.width = `${clamped}px`;
        return clamped;
    }

    function persistSidebarWidth(clamped) {
        try {
            localStorage.setItem(LEFT_SIDEBAR_WIDTH_KEY, String(clamped));
        } catch (_) {
            /* ignore */
        }
    }

    function clearInlineWidth() {
        sidebar.style.removeProperty('flex');
        sidebar.style.removeProperty('width');
    }

    function restoreSavedWidthIfDesktop() {
        if (!mq.matches) {
            return;
        }
        let saved;
        try {
            saved = localStorage.getItem(LEFT_SIDEBAR_WIDTH_KEY);
        } catch (_) {
            saved = null;
        }
        if (saved == null) {
            return;
        }
        const n = Number.parseInt(saved, 10);
        if (!Number.isFinite(n)) {
            return;
        }
        setSidebarWidthPx(n);
        scheduleMapLayoutRefresh(mainMap, compareMap);
    }

    restoreSavedWidthIfDesktop();

    mq.addEventListener('change', (e) => {
        if (!e.matches) {
            clearInlineWidth();
            scheduleMapLayoutRefresh(mainMap, compareMap);
        } else {
            restoreSavedWidthIfDesktop();
        }
    });

    let startX = 0;
    let startWidth = 0;
    let layoutRafPending = false;

    function onPointerMove(e) {
        if (!mq.matches) {
            return;
        }
        const dx = e.clientX - startX;
        setSidebarWidthPx(startWidth + dx);
        if (!layoutRafPending) {
            layoutRafPending = true;
            requestAnimationFrame(() => {
                layoutRafPending = false;
                scheduleMapLayoutRefresh(mainMap, compareMap);
            });
        }
    }

    function onPointerUp(e) {
        handle.removeEventListener('pointermove', onPointerMove);
        handle.removeEventListener('pointerup', onPointerUp);
        handle.removeEventListener('pointercancel', onPointerUp);
        document.body.classList.remove('analysis-sidebar-resize-active');
        document.body.style.removeProperty('cursor');
        document.body.style.removeProperty('user-select');
        try {
            handle.releasePointerCapture(e.pointerId);
        } catch (_) {
            /* ignore */
        }
        const w = Math.round(sidebar.getBoundingClientRect().width);
        persistSidebarWidth(Math.min(LEFT_SIDEBAR_MAX, Math.max(LEFT_SIDEBAR_MIN, w)));
        scheduleMapLayoutRefresh(mainMap, compareMap);
    }

    handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !mq.matches) {
            return;
        }
        e.preventDefault();
        const rect = sidebar.getBoundingClientRect();
        startWidth = rect.width;
        startX = e.clientX;
        handle.setPointerCapture(e.pointerId);
        document.body.classList.add('analysis-sidebar-resize-active');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', onPointerUp);
        handle.addEventListener('pointercancel', onPointerUp);
    });
}

function setupAnalysisSidebarResize(mainMap, compareMap) {
    const sidebar = document.getElementById('analysis-sidebar');
    const handle = sidebar?.querySelector('.analysis-sidebar-resize-handle');
    if (!sidebar || !handle) {
        return;
    }

    const mq = window.matchMedia(DESKTOP_ROW_MQ);

    function setSidebarWidthPx(w) {
        const clamped = Math.round(Math.min(ANALYSIS_SIDEBAR_MAX, Math.max(ANALYSIS_SIDEBAR_MIN, w)));
        sidebar.style.flex = `0 0 ${clamped}px`;
        sidebar.style.width = `${clamped}px`;
        return clamped;
    }

    function persistSidebarWidth(clamped) {
        try {
            localStorage.setItem(ANALYSIS_SIDEBAR_WIDTH_KEY, String(clamped));
        } catch (_) {
            /* ignore */
        }
    }

    function clearInlineWidth() {
        sidebar.style.removeProperty('flex');
        sidebar.style.removeProperty('width');
    }

    function restoreSavedWidthIfDesktop() {
        if (!mq.matches) {
            return;
        }
        let saved;
        try {
            saved = localStorage.getItem(ANALYSIS_SIDEBAR_WIDTH_KEY);
        } catch (_) {
            saved = null;
        }
        if (saved == null) {
            return;
        }
        const n = Number.parseInt(saved, 10);
        if (!Number.isFinite(n)) {
            return;
        }
        setSidebarWidthPx(n);
        scheduleMapLayoutRefresh(mainMap, compareMap);
    }

    restoreSavedWidthIfDesktop();

    mq.addEventListener('change', (e) => {
        if (!e.matches) {
            clearInlineWidth();
            scheduleMapLayoutRefresh(mainMap, compareMap);
        } else {
            restoreSavedWidthIfDesktop();
        }
    });

    let startX = 0;
    let startWidth = 0;
    let layoutRafPending = false;

    function onPointerMove(e) {
        if (!mq.matches) {
            return;
        }
        const dx = startX - e.clientX;
        setSidebarWidthPx(startWidth + dx);
        if (!layoutRafPending) {
            layoutRafPending = true;
            requestAnimationFrame(() => {
                layoutRafPending = false;
                scheduleMapLayoutRefresh(mainMap, compareMap);
            });
        }
    }

    function onPointerUp(e) {
        handle.removeEventListener('pointermove', onPointerMove);
        handle.removeEventListener('pointerup', onPointerUp);
        handle.removeEventListener('pointercancel', onPointerUp);
        document.body.classList.remove('analysis-sidebar-resize-active');
        document.body.style.removeProperty('cursor');
        document.body.style.removeProperty('user-select');
        try {
            handle.releasePointerCapture(e.pointerId);
        } catch (_) {
            /* ignore */
        }
        const w = Math.round(sidebar.getBoundingClientRect().width);
        persistSidebarWidth(Math.min(ANALYSIS_SIDEBAR_MAX, Math.max(ANALYSIS_SIDEBAR_MIN, w)));
        scheduleMapLayoutRefresh(mainMap, compareMap);
    }

    handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !mq.matches) {
            return;
        }
        e.preventDefault();
        const rect = sidebar.getBoundingClientRect();
        startWidth = rect.width;
        startX = e.clientX;
        handle.setPointerCapture(e.pointerId);
        document.body.classList.add('analysis-sidebar-resize-active');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', onPointerUp);
        handle.addEventListener('pointercancel', onPointerUp);
    });
}

function scheduleMapLayoutRefresh(...maps) {
    const validMaps = maps.filter(Boolean);
    if (validMaps.length === 0) {
        return;
    }

    requestAnimationFrame(() => {
        validMaps.forEach(map => map.invalidateSize());
    });

    window.setTimeout(() => {
        validMaps.forEach(map => map.invalidateSize());
    }, 150);
}

/**
 * Set up the main map with all functionality
 */
function setupMainMap(mapId) {
    const map = L.map(mapId, {
        zoomControl: true,  // We'll remove this in createAdminLabelLayers
        attributionControl: true
    }).setView([33.8362512,36.1096576], 9);
    map.attributionControl.setPrefix('The boundaries and names shown and the designations used on this map do not imply official endorsement or acceptance by the United Nations.')
    map.attributionControl.setPosition('bottomleft')
    
    console.log('Main Map CRS Information:', {
        mapId: mapId,
        crs: map.options.crs,
        crsCode: map.options.crs.code,
        projection: map.options.crs.projection ? map.options.crs.projection.toString() : 'No projection info'
    });
    
    addDefaultBasemap(map);
    // Add scale bar
        // L.control.scale({
        //     position: 'bottomright',
        //     metric: true,
        //     imperial: false,
        //     maxWidth: 200
        // }).addTo(map);

    // Initialize Info Panel
    infoPanel = new InfoPanel({
        title: 'Layer Analysis & Reports',
        width: '420px',
        maxHeight: '75vh',
        docked: true,
        mountTarget: '#info-panel-slot'
    });
    infoPanel.setMap(map);
    
    // Show the panel initially (minimized)
    infoPanel.show();
    
    // Set global reference for download functionality
    window.infoPanelInstance = infoPanel;
    
    // NOTE: Combined control will be added after both maps are created

    return map;
}

/**
 * Set up the comparison map with basemap only
 */
function setupCompareMap(mapId) {
    const map = L.map(mapId, {
        zoomControl: false,
        attributionControl: false
    }).setView([17.5707, -3.9962], 6);
    
    basemaps.esriWorldImagery.addTo(map);
    
    return map;
}

/**
 * Load country outline
 */
async function loadCountryOutline(map) {
    try {
        const outlineLayer = await loadVectorLayer('data/cutline_adm2_district.geojson', {
            style: {
                color: "#3388ff",
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0
            }
        });
        
        outlineLayer.eachLayer(layer => {
            layer.unbindTooltip();
        });
        
        outlineLayer.addTo(map);
        layers.countryOutline = outlineLayer;
    } catch (error) {
        console.error("Failed to load country outline:", error);
    }
}

/**
 * Dropdown menu toggle functionality
 */
function setupDropdownToggles() {
    document.querySelectorAll('.dropdown-btn').forEach(button => {
        button.addEventListener('click', function() {
            this.classList.toggle('active');
            
            const container = this.nextElementSibling;
            if (container && container.classList.contains('dropdown-container')) {
                container.style.display = container.style.display === 'block' ? 'none' : 'block';
            }
            if (this.classList.contains('social-vulnerability-btn')) {
                if (typeof window.syncSVSubindicatorPanelsVisibility === 'function') {
                    window.syncSVSubindicatorPanelsVisibility();
                }
            }
            if (this.classList.contains('stressors-section-btn')) {
                syncEscalationControlsWrapVisibility();
                if (typeof window.syncSVSubindicatorPanelsVisibility === 'function') {
                    window.syncSVSubindicatorPanelsVisibility();
                }
            }
        });
    });
}

/**
 * Collective Shelter options panel; visible when Stressors is open and that layer is on.
 */
function syncEscalationControlsWrapVisibility() {
    const btn = document.querySelector('.stressors-section-btn');
    const wrap = document.getElementById('svEscalationControlsWrap');
    if (!btn || !wrap) return;
    const panel = btn.nextElementSibling;
    const isOpen =
        btn.classList.contains('active') &&
        panel &&
        panel.classList.contains('dropdown-container') &&
        panel.style.display === 'block';
    const escalationOn = document.getElementById('escalationLayer')?.checked;
    wrap.hidden = !isOpen || !escalationOn;
}

window.syncEscalationControlsWrapVisibility = syncEscalationControlsWrapVisibility;

/**
 * Open Composite Indexes dropdown by default
 */
function openSocialVulnerabilityDropdown() {
    const compositeButton = document.querySelector('.social-vulnerability-btn');
    const compositeContainer = compositeButton?.nextElementSibling;
    
    if (compositeButton && compositeContainer && compositeContainer.classList.contains('dropdown-container')) {
        compositeButton.classList.add('active');
        compositeContainer.style.display = 'block';
    }
}

/**
 * Initialize the opacity value displays
 */
function setupOpacityDisplays() {
    document.querySelectorAll('input[type="range"]').forEach(slider => {
        const displayId = slider.id.replace('Opacity', 'OpacityValue');
        const display = document.getElementById(displayId);
        
        if (display) {
            const value = Math.round(slider.value * 100);
            display.textContent = `${value}%`;
        }
    });
}

// Make WelcomePopup available globally for testing/help
window.showWelcome = function() {
    new WelcomePopup(true);
};