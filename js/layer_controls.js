// layer_controls.js - Event handlers for layer controls

import { loadVectorLayer, 
    loadPointLayer, 
    updateTooltip, 
    updateVectorLayerStyle, 
    updatePointLayerStyle, 
    populateAttributeSelector,
    isAcsCodeNoData,
    layerHasAcsCodeNoData,
    ACS_CODE_NO_DATA_COLOR,
    ACS_CODE_NO_DATA_LEGEND_LABEL } from './vector_layers.js';
import { loadTiff } from './zoom-adaptive-tiff-loader.js';
import { setupColorRampSelector, getColorRamp } from './color_ramp_selector.js';
import { generateAdminLabels } from './admin_labels.js';
import { addInfoPopupHandler, hideInfoPopup } from './info_popup.js';
import {
    configureSVSubindicators,
    registerSVSubindicatorPanel,
    getSelectedSubindicators,
    getPrimarySubindicator,
    renderSVSubindicatorPanels,
    renderSVSubindicatorPanel,
} from './sv_subindicators.js';

// Layer configuration - maps checkbox IDs to loading functions and parameters
const layerConfig = {
    // Vector layers
    geojsonLayer: {
        type: 'vector',
        url: 'data/adm1_summary_stats_1.geojson',
        style: {
            color: "#3388ff",
            weight: 0.5,
            opacity: 1,
            fillOpacity: 0.5
        },
        opacityControl: 'geojsonOpacity',
        opacityDisplay: 'geojsonOpacityValue',
        attributeSelector: 'vectorAttribute1',
        colorRampSelector: 'vectorColorRamp1',
        colorRampPreview: 'vectorColorPreview1'
    },
    geojsonLayer2: {
        type: 'vector',
        url: 'data/adm2_summary_stats_3.geojson',
        style: {
            color: "#FF5733",
            weight: 0.5,
            opacity: 1,
            fillOpacity: 0.4
        },
        opacityControl: 'geojsonOpacity2',
        opacityDisplay: 'geojsonOpacityValue2',
        attributeSelector: 'vectorAttribute2',
        colorRampSelector: 'vectorColorRamp2',
        colorRampPreview: 'vectorColorPreview2'
    },
    geojsonLayer3: {
        type: 'vector',
        url: 'data/adm3_summary_stats_1.geojson',
        style: {
            color: "#45358f",
            weight: 0.5,
            opacity: 1,
            fillOpacity: 0.4
        },
        opacityControl: 'geojsonOpacity3',
        opacityDisplay: 'geojsonOpacityValue3',
        attributeSelector: 'vectorAttribute3',
        colorRampSelector: 'vectorColorRamp3',
        colorRampPreview: 'vectorColorPreview3'
    },

    svOverallTensionLayer: {
        fixedColorRamp: 'yellowOrangeRed3',
        type: 'sv-vector',
        url: 'data/Overall_tension_risk_dummy_adm3.geojson',
        legendName: 'Overall Vulnerability Index',
        style: {
            color: '#2b83ba',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.6
        },
        opacityControl: 'svOpacity',
        opacityDisplay: 'svOpacityValue',
        colorRampSelector: 'svColorRamp',
        colorRampPreview: 'svColorPreview',
        svAttribute: 'overall_tension_index_score',
        layerType: 'sv-overall'
    },
    svAdmin1Layer: {
        fixedColorRamp: 'whiteToDarkGreen',
        type: 'sv-vector',
        url: 'data/ADM3_Displacement%20Pressure.geojson',
        renderMode: 'proportional-circles',
        minRadius: 7,
        maxRadius: 22,
        markerColor: '#f59e0b',
        style: {
            color: "#2b83ba",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.6
        },
        opacityControl: 'svOpacity',
        opacityDisplay: 'svOpacityValue',
        colorRampSelector: 'svColorRamp',
        colorRampPreview: 'svColorPreview',
        svAttribute: 'Displacement Pressure Score',
        layerType: 'sv-admin1'
    },
    svAdmin2Layer: {
        fixedColorRamp: 'whiteToDarkBlue',
        type: 'sv-vector',
        url: 'data/sv_socio_adm2.geojson',
        renderMode: 'stripe-pattern',
        patternColor: '#2b83ba',
        style: {
            color: "#2b83ba",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.6
        },
        opacityControl: 'svOpacity',
        opacityDisplay: 'svOpacityValue',
        colorRampSelector: 'svColorRamp',
        colorRampPreview: 'svColorPreview',
        svAttribute: 'composite_score',
        layerType: 'sv-admin2'
    },
    svAdmin3Layer: {
        fixedColorRamp: 'whiteToDarkPurple',
        type: 'sv-vector',
        url: 'data/sv_peace_adm2.geojson',
        legendName: 'Tension and Conflict Risk',
        style: {
            color: "#2b83ba",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.6
        },
        opacityControl: 'svOpacity',
        opacityDisplay: 'svOpacityValue',
        colorRampSelector: 'svColorRamp',
        colorRampPreview: 'svColorPreview',
        svAttribute: 'peace_composite_score',
        layerType: 'sv-admin3'
    },
    svAdmin4Layer: {
        fixedColorRamp: 'whiteToDarkPurple',
        type: 'sv-vector',
        url: null,
        legendName: 'Service & Infrastructure Vulnerability',
        renderMode: 'service-symbol',
        patternColor: '#8b5cf6',
        serviceSymbolColors: ['#22c55e', '#f59e0b', '#dc2626'],
        style: {
            color: "#2b83ba",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.6
        },
        opacityControl: 'svOpacity',
        opacityDisplay: 'svOpacityValue',
        colorRampSelector: 'svColorRamp',
        colorRampPreview: 'svColorPreview',
        svAttribute: 'composite_score',
        layerType: 'sv-admin4'
    },
    svAdmin5Layer: {
        fixedColorRamp: 'yellowOrangeRedShock5',
        type: 'sv-vector',
        url: 'data/ADM3_Demographic_Shock_Factor.geojson',
        legendName: 'Demographic Shock Factor',
        style: {
            color: '#2b83ba',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.6
        },
        opacityControl: 'svOpacity',
        opacityDisplay: 'svOpacityValue',
        colorRampSelector: 'svColorRamp',
        colorRampPreview: 'svColorPreview',
        svAttribute: 'Demographic_Factor (DF = S*H)',
        layerType: 'sv-admin5'
    },
    streetNetworkLayer: {
        type: 'vector',
        url: 'data/street_subset.geojson',
        style: {
            color: "#3388ff",
            weight: 0.5,
            opacity: 1,
            fillOpacity: 0
        },
        opacityControl: 'streetNetworkOpacity',
        opacityDisplay: 'streetNetworkOpacityValue',
        attributeSelector: 'streetNetworkAttribute',
        colorRampSelector: 'streetNetworkColorRamp',
        colorRampPreview: 'streetNetworkColorPreview'
    },
    roadStatusLayer: {
        type: 'vector',
        url: 'data/lbn_Roads%20Status_2026-03-18.geojson',
        style: feature => ({
            color: getRoadStatusColor(feature?.properties?.['Current status']),
            weight: 3,
            opacity: 1
        }),
        layerType: 'road-status'
    },
    ttfHotspotsLayer: {
        type: 'vector',
        url: 'data/TTF_HOTSPOTS_ADM3.geojson',
        style: feature => ({
            color: '#8a8f98',
            weight: 0.8,
            opacity: 1,
            fillColor: getTTFTensionColor(feature?.properties?.Tension),
            fillOpacity: 0.72
        }),
        layerType: 'ttf-hotspots'
    },
    vulnerabilityCadastreLayer: {
        type: 'vector',
        url: 'data/cadastre_join_ntl_night_safety_vul7_v2.geojson',
        style: {
            color: '#4b5563',
            weight: 0.6,
            opacity: 0.9,
            fillOpacity: 0
        },
        opacityControl: 'vulnerabilityOpacity',
        opacityDisplay: 'vulnerabilityOpacityValue',
        attributeSelector: 'vulnerabilityAttribute',
        fixedColorRamp: 'whiteToDarkGreen',
        thinBoundaries: true,
        layerType: 'vulnerability-cadastre'
    },
    pointLayer: {
        type: 'point',
        url: 'data/DHS_stats.geojson',
        opacityControl: 'pointOpacity',
        opacityDisplay: 'pointOpacityValue',
        selectorId: 'pointValueSelector',
        colorRampSelector: 'pointColorRamp',
        colorRampPreview: 'pointColorPreview',
        attributeSelector: 'pointValueSelector'
    },
    pointLayer2: {
        type: 'point',
        url: 'data/cities.geojson',
        opacityControl: 'pointOpacity2',
        opacityDisplay: 'pointOpacityValue2',
        selectorId: 'pointValueSelector2',
        colorRampSelector: 'pointColorRamp2',
        colorRampPreview: 'pointColorPreview2',
        attributeSelector: 'pointValueSelector2'
    },
    escalationLayer: {
        type: 'point',
        url: 'data/CS_DATA_09_03_26_full.geojson',
        opacityControl: 'escalationOpacity',
        opacityDisplay: 'escalationOpacityValue',
        selectorId: 'escalationColumnSelector',
        attributeSelector: 'escalationColumnSelector',
        pointToLayer: createEscalationMarker,
        tooltipFunction: escalationTooltip,
        clusterOptions: {
            showCoverageOnHover: false,
            spiderfyOnMaxZoom: true,
            zoomToBoundsOnClick: true,
            disableClusteringAtZoom: 11,
            maxClusterRadius: 50,
            iconCreateFunction: createEscalationClusterIcon
        }
    },
    // Raster layers
    tiffLayer1: {
        type: 'raster',
        url: 'data/celltower.tif',
        opacityControl: 'tiffOpacity1',
        opacityDisplay: 'tiffOpacityValue1',
        colorScale: 'cellTowerDensity',
        legendTitle: 'Cell Tower Density',
        legendDescription: 'Color gradient representing cell tower density.',
        legendLabels: ['Low', 'Medium-Low', 'Medium', 'High', 'Very High']
    },
    tiffLayer2: {
        type: 'raster',
        url: 'data/pop.tif',
        opacityControl: 'tiffOpacity2',
        opacityDisplay: 'tiffOpacityValue2',
        colorScale: 'populationDensity',
        legendTitle: 'Population Density',
        legendDescription: 'White to Dark Gray gradient representing population density.',
        legendLabels: ['Very Low', 'Low', 'Medium', 'High', 'Very High']
    },
    tiffLayer3: {
        type: 'raster',
        url: 'data/SV_May23_HR_IR_MIS_2021_agg.tif',
        opacityControl: 'tiffOpacity3',
        opacityDisplay: 'tiffOpacityValue3',
        colorScale: 'socialVulnerability',
        legendTitle: 'Social Vulnerability',
        legendDescription: 'Gradient representing social vulnerability index.',
        legendLabels: ['Low', 'Medium-Low', 'Medium', 'High', 'Very High']
    },
    tiffLayer4: {
        type: 'raster',
        url: 'data/rwi.tif',
        opacityControl: 'tiffOpacity4',
        opacityDisplay: 'tiffOpacityValue4',
        colorScale: 'relativeWealth',
        legendTitle: 'Relative Wealth',
        legendDescription: 'Gradient representing relative wealth index.',
        legendLabels: ['Low', 'Medium-Low', 'Medium', 'High', 'Very High']
    },
    tiffLayer5: {
        type: 'raster',
        url: 'data/.tif',
        opacityControl: 'tiffOpacity5',
        opacityDisplay: 'tiffOpacityValue5',
        colorScale: 'nightlightintensity',
        legendTitle: 'Nightlights',
        legendDescription: 'Gradient representing nightlight intensity.',
        legendLabels: ['Low', 'Medium-Low', 'Medium', 'High', 'Very High']
    },
    tiffLayer6: {
        type: 'raster',
        url: 'data/ndvi2.tif',
        opacityControl: 'tiffOpacity6',
        opacityDisplay: 'tiffOpacityValue6',
        colorScale: 'ndvi',
        legendTitle: 'Vegetation Health',
        legendDescription: 'Gradient representing NorLebanonzed Difference Vegetation Index.',
        legendLabels: ['Low', 'Medium-Low', 'Medium', 'High', 'Very High']
    },
    tiffLayer7: {
        type: 'raster',
        url: 'data/conflict.tif',
        opacityControl: 'tiffOpacity7',
        opacityDisplay: 'tiffOpacityValue7',
        colorScale: 'conflict',
        legendTitle: 'Conflicts (ACLED)',
        legendDescription: 'Gradient representing number of conflict events in the past 15 years.',
        legendLabels: ['Low', 'Medium-Low', 'Medium', 'High', 'Very High']
    },
    tiffLayer8: {
        type: 'raster',
        url: 'data/temp_compr.tif',
        opacityControl: 'tiffOpacity8',
        opacityDisplay: 'tiffOpacityValue8',
        colorScale: 'temp',
        legendTitle: 'Temperature',
        legendDescription: 'Gradient representing temperature.',
        legendLabels: ['Low', 'Medium-Low', 'Medium', 'High', 'Very High']
    }
};

// Store reference to current active Social-Vulnerability layer
const activeSVLayers = new Set();
let currentSVLayer = null;
let svResolutionVersion = 0;
const selectedPolygonByLayer = new Map();
const escalationDataCache = new Map();
const svPillarLookupCache = new Map();
const svPatternCache = new Map();
const SV_SERVICE_PRIORITY_TOGGLE_ID = 'svServicePriorityToggle';
const SV_SERVICE_HIGH_PRIORITY_CLASS_INDEX = 2;

const SV_PILLAR_DEFINITIONS = [
    {
        layerId: 'svAdmin1Layer',
        label: 'Displacement Pressure',
        color: '#2e8b57',
        attribute: 'Displacement Pressure Score'
    },
    {
        layerId: 'svAdmin2Layer',
        label: 'Economic Vulnerability',
        color: '#2b83ba',
        attribute: 'composite_score'
    },
    {
        layerId: 'svAdmin3Layer',
        label: 'Tension and Conflict Risk',
        color: '#7b3294',
        attribute: 'peace_composite_score'
    }
];

const SV_ADMIN_RESOLUTION_BUTTON_SELECTOR = '.sv-admin-resolution-btn';
const SV_LAYER_IDS = ['svOverallTensionLayer', 'svAdmin1Layer', 'svAdmin2Layer', 'svAdmin3Layer', 'svAdmin4Layer', 'svAdmin5Layer'];
const SV_OVERALL_LAYER_ID = 'svOverallTensionLayer';
const SV_COMPOSITE_LAYER_IDS = SV_LAYER_IDS.filter(id => id !== SV_OVERALL_LAYER_ID);

function reconcileSVLayerSelection(layerIds) {
    const unique = [...new Set(layerIds)];
    if (unique.includes(SV_OVERALL_LAYER_ID)) {
        return [SV_OVERALL_LAYER_ID];
    }
    return unique.filter(id => SV_COMPOSITE_LAYER_IDS.includes(id));
}

function uncheckSVLayerToggles(layerIds) {
    layerIds.forEach(id => {
        const checkbox = document.getElementById(id);
        if (!checkbox?.checked) return;
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change'));
    });
}

function applySVLayerExclusivity(selectedLayerId) {
    if (selectedLayerId === SV_OVERALL_LAYER_ID) {
        uncheckSVLayerToggles(SV_COMPOSITE_LAYER_IDS);
    } else if (SV_COMPOSITE_LAYER_IDS.includes(selectedLayerId)) {
        uncheckSVLayerToggles([SV_OVERALL_LAYER_ID]);
    }
}
const SV_BASE_LAYER_CONFIG = {
    svOverallTensionLayer: {
        fixedColorRamp: 'yellowOrangeRed3',
        legendName: 'Overall Vulnerability Index ',
        renderMode: 'choropleth',
        svAttribute: 'overall_tension_index_score'
    },
    svAdmin1Layer: {
        fixedColorRamp: 'whiteToDarkGreen',
        legendName: 'Displacement Pressure',
        renderMode: 'proportional-circles',
        minRadius: 7,
        maxRadius: 22,
        markerColor: '#f59e0b',
        svAttribute: 'Displacement Pressure Score'
    },
    svAdmin2Layer: {
        fixedColorRamp: 'whiteToDarkBlue',
        legendName: 'Economic Vulnerability',
        renderMode: 'stripe-pattern',
        patternColor: '#2b83ba',
        svAttribute: 'composite_score'
    },
    svAdmin3Layer: {
        fixedColorRamp: 'whiteToDarkPurple',
        legendName: 'Tension and Conflict Risk',
        renderMode: 'choropleth',
        svAttribute: 'peace_composite_score'
    },
    svAdmin4Layer: {
        fixedColorRamp: 'whiteToDarkPurple',
        legendName: 'Service & Infrastructure Vulnerability',
        renderMode: 'service-symbol',
        patternColor: '#8b5cf6',
        serviceSymbolColors: ['#22c55e', '#f59e0b', '#dc2626'],
        svAttribute: 'composite_score'
    },
    svAdmin5Layer: {
        fixedColorRamp: 'yellowOrangeRedShock5',
        legendName: 'Demographic Shock Factor',
        renderMode: 'choropleth',
        svAttribute: 'Demographic_Factor (DF = S*H)'
    }
};

const SV_RESOLUTION_CONFIG = {
    district: {
        svOverallTensionLayer: {
            url: 'data/Overall_tension_risk_dummy_adm2.geojson',
            available: true,
            svAttribute: 'overall_tension_index_score'
        },
        svAdmin1Layer: {
            url: 'data/ADM2_Displacement%20Pressure.geojson',
            available: true,
            svAttribute: 'Displacement Pressure Score'
        },
        svAdmin2Layer: {
            url: 'data/ADM2_ECONOMIC_VUL.geojson',
            available: true,
            svAttribute: 'composite_score'
        },
        svAdmin3Layer: { url: 'data/sv_peace_adm2.geojson', available: true, svAttribute: 'peace_composite_score' },
        svAdmin4Layer: { url: null, available: false, svAttribute: null },
        svAdmin5Layer: {
            url: 'data/ADM2_Demographic_Shock_Factor.geojson',
            available: true,
            svAttribute: 'Demographic_Factor (DF = S*H)_mean',
            thinBoundaries: false
        }
    },
    cadastre: {
        svOverallTensionLayer: {
            url: 'data/Overall_tension_risk_dummy_adm3.geojson',
            available: true,
            svAttribute: 'overall_tension_index_score',
            thinBoundaries: true
        },
        svAdmin1Layer: {
            url: 'data/ADM3_Displacement%20Pressure.geojson',
            available: true,
            svAttribute: 'Displacement Pressure Score',
            thinBoundaries: true
        },
        svAdmin2Layer: {
            url: 'data/ADM3_ECONOMIC_VUL.geojson',
            available: true,
            svAttribute: 'composite_score',
            thinBoundaries: true
        },
        svAdmin3Layer: { url: 'data/TENSION_PEACE_CAD_MAY_04.geojson', available: true, svAttribute: 'composite_score', thinBoundaries: true },
        svAdmin4Layer: { url: 'data/service_stress_infra_vul_adm3.geojson', available: true, svAttribute: 'composite_score', thinBoundaries: true },
        svAdmin5Layer: {
            url: 'data/ADM3_Demographic_Shock_Factor.geojson',
            available: true,
            svAttribute: 'Demographic_Factor (DF = S*H)',
            thinBoundaries: true
        }
    },
    governorate: {
        svOverallTensionLayer: {
            url: 'data/Overall_tension_risk_dummy_adm1.geojson',
            available: true,
            svAttribute: 'overall_tension_index_score'
        },
        svAdmin1Layer: {
            url: 'data/ADM1_Displacement%20Pressure.geojson',
            available: true,
            svAttribute: 'Displacement Pressure Score'
        },
        svAdmin2Layer: {
            url: 'data/ADM1_ECONOMIC_VUL.geojson',
            available: true,
            svAttribute: 'composite_score'
        },
        svAdmin3Layer: { url: 'data/sv_peace_adm1.geojson', available: true, svAttribute: 'peace_composite_score_mean_mean' },
        svAdmin4Layer: { url: null, available: false, svAttribute: null },
        svAdmin5Layer: {
            url: 'data/ADM1_Demographic_Shock_Factor.geojson',
            available: true,
            svAttribute: 'Demographic_Factor (DF = S*H)_mean',
            thinBoundaries: false
        }
    }
};

const DISPLACEMENT_SCORE_FIELD = 'Displacement Pressure Score';

const DISPLACEMENT_SUBINDICATOR_OPTIONS = [
    { value: DISPLACEMENT_SCORE_FIELD, label: 'Displacement Pressure Score' },
    { value: 'Number of IDPs', label: 'Number of IDPs' },
    { value: 'Number of of Palestinians', label: 'Number of Palestinians' },
    {
        value: 'Number of registered Syrians',
        label: 'Number of registered Syrians'
    },
    {
        value: 'Ratio of IDPs, SYR, and palestinians per host residents, at cadastre level',
        label: 'Ratio of IDPs, Syrians, and Palestinians per host residents'
    }
];

const DEMOGRAPHIC_DF_FIELD_CADASTRE = 'Demographic_Factor (DF = S*H)';
const DEMOGRAPHIC_DF_FIELD_AGG = 'Demographic_Factor (DF = S*H)_mean';

const DEMOGRAPHIC_SUBINDICATOR_OPTIONS_CADASTRE = [
    { value: DEMOGRAPHIC_DF_FIELD_CADASTRE, label: 'Demographic Shock Factor (DF = S×H)' },
    { value: 'Resident_Population (R)', label: 'Resident population (R)' },
    { value: 'Displaced_Population (D)', label: 'Displaced population (D)' },
    { value: 'Heterogeneity (H)', label: 'Heterogeneity (H)' },
    { value: 'Displacement_Ratio (S = D/R)', label: 'Displacement ratio (S = D/R)' }
];

const DEMOGRAPHIC_SUBINDICATOR_OPTIONS_AGGREGATE = [
    { value: DEMOGRAPHIC_DF_FIELD_AGG, label: 'Demographic Shock Factor (DF = S×H, mean)' },
    { value: 'Resident_Population (R)_mean', label: 'Resident population (R, mean)' },
    { value: 'Displaced_Population (D)_mean', label: 'Displaced population (D, mean)' },
    { value: 'Heterogeneity (H)_mean', label: 'Heterogeneity (H, mean)' },
    { value: 'Displacement_Ratio (S = D/R)_mean', label: 'Displacement ratio (S = D/R, mean)' }
];

const ECONOMIC_SCORE_FIELD = 'composite_score';

const ECON_CLIMATE_RENEWABLE =
    'Measures to mitigate impacts of climate change at the personal level? Switching switching to renewable energy';
const ECON_CLIMATE_VEHICLE =
    'Measures to mitigate impacts of climate change at the personal level? Reducing vehicle use';
const ECON_CLIMATE_WATER =
    'Measures to mitigate impacts of climate change at the personal level? Using water wisely';
const ECON_CLIMATE_RECYCLING =
    'Measures to mitigate impacts of climate change at the personal level?  Solid waste recycling';

const ECONOMIC_SUBINDICATOR_OPTIONS_AGGREGATE = [
    { value: ECONOMIC_SCORE_FIELD, label: 'Economic Vulnerability composite score' },
    { value: 'Unemployment Rate', label: 'Unemployment rate' },
    { value: 'Nightlight Intensity', label: 'Nightlight intensity' },
    { value: '332 Vulnerability Map', label: '332 vulnerability map' }
];

const ECONOMIC_SUBINDICATOR_OPTIONS_CADASTRE = [
    ...ECONOMIC_SUBINDICATOR_OPTIONS_AGGREGATE,
    { value: ECON_CLIMATE_RENEWABLE, label: 'Climate mitigation: renewable energy' },
    { value: ECON_CLIMATE_VEHICLE, label: 'Climate mitigation: reducing vehicle use' },
    { value: ECON_CLIMATE_WATER, label: 'Climate mitigation: using water wisely' },
    { value: ECON_CLIMATE_RECYCLING, label: 'Climate mitigation: solid waste recycling' }
];

/** Cadastre Peace: field keys merged from CSV (must match GeoJSON properties + select option values). */
const PEACE_CADASTRE_SUBINDICATOR_OPTIONS = [
    { value: 'composite_score', label: 'Tension and Conflict Risk composite score' },
    {
        value: 'peace_si_intersectarian_per_1k',
        label:
            'Annual rate of UNDPTMS incidents tagged as “intersectarian” or “intercommunal” per 1000 residents'
    },
    {
        value: 'peace_si_battle_events_count',
        label:
            'Number of incidents/events involving battles, explosions, violence against civilians, armed clashes, and airstrikes.'
    },
    {
        value: 'peace_si_ss_typology_non_state',
        label: 'Safety and Security typology incidents without state operations'
    },
    {
        value: 'peace_si_fatalities_per_1k_12m',
        label: 'Fatalities per 1000 residents in the last 12 months'
    },
    {
        value: 'peace_si_worry_travel_hh_share',
        label: 'Share of households who worry about travelling to key destinations within Lebanon safely'
    },
    {
        value: 'peace_si_unsafe_night_pct',
        label:
            '% of population reporting feeling "unsafe" or "very unsafe" in their neighborhoods during the night'
    }
];

function getActiveAdminResolution() {
    return document.querySelector('.sv-admin-resolution-btn.active')?.dataset?.resolution || 'cadastre';
}

registerSVSubindicatorPanel('svAdmin3Layer', {
    wrapId: 'svPeaceSubindicatorsWrap',
    getOptions: () => PEACE_CADASTRE_SUBINDICATOR_OPTIONS,
    getDefaultValues: () => ['composite_score']
});
registerSVSubindicatorPanel('svAdmin1Layer', {
    wrapId: 'svDisplacementSubindicatorsWrap',
    getOptions: () => DISPLACEMENT_SUBINDICATOR_OPTIONS,
    getDefaultValues: () => [DISPLACEMENT_SCORE_FIELD]
});
registerSVSubindicatorPanel('svAdmin2Layer', {
    wrapId: 'svEconomicSubindicatorsWrap',
    getOptions: () => getEconomicSubindicatorOptions(),
    getDefaultValues: () => [ECONOMIC_SCORE_FIELD]
});
registerSVSubindicatorPanel('svAdmin5Layer', {
    wrapId: 'svDemographicSubindicatorsWrap',
    getOptions: () => getDemographicSubindicatorOptions(),
    getDefaultValues: () => {
        const resolution = getActiveAdminResolution();
        return [resolution === 'cadastre' ? DEMOGRAPHIC_DF_FIELD_CADASTRE : DEMOGRAPHIC_DF_FIELD_AGG];
    }
});

const SUBINDICATOR_OVERLAY_OUTLINE = ['#7c3aed', '#0891b2', '#ca8a04', '#be185d'];
const DISPLACEMENT_EXTRA_COLORS = ['#6366f1', '#0d9488', '#d97706', '#be185d'];

function getDemographicSubindicatorOptions(resolution = getActiveAdminResolution()) {
    return resolution === 'cadastre'
        ? DEMOGRAPHIC_SUBINDICATOR_OPTIONS_CADASTRE
        : DEMOGRAPHIC_SUBINDICATOR_OPTIONS_AGGREGATE;
}

function getEconomicSubindicatorOptions(resolution = getActiveAdminResolution()) {
    return resolution === 'cadastre'
        ? ECONOMIC_SUBINDICATOR_OPTIONS_CADASTRE
        : ECONOMIC_SUBINDICATOR_OPTIONS_AGGREGATE;
}

function populateEconomicSubindicatorSelect(resolution = getActiveAdminResolution()) {
    renderSVSubindicatorPanel('svAdmin2Layer');
}

function getEffectiveEconomicAttribute(config) {
    return getPrimarySubindicator('svAdmin2Layer') || config?.svAttribute || ECONOMIC_SCORE_FIELD;
}

function getEconomicSubindicatorLegendTitle(attributeKey, config) {
    const opt = getEconomicSubindicatorOptions().find(o => o.value === attributeKey);
    return opt ? opt.label : config?.legendName || 'Economic Vulnerability';
}

function populateDisplacementSubindicatorSelect() {
    renderSVSubindicatorPanel('svAdmin1Layer');
}

function getEffectiveDisplacementCircleAttribute(config) {
    return getPrimarySubindicator('svAdmin1Layer') || config?.svAttribute || DISPLACEMENT_SCORE_FIELD;
}

function resolveDisplacementPropertyKey(props, attr) {
    if (!props) return attr;
    if (attr === DISPLACEMENT_SCORE_FIELD) {
        if (
            props[DISPLACEMENT_SCORE_FIELD] !== undefined &&
            props[DISPLACEMENT_SCORE_FIELD] !== null &&
            props[DISPLACEMENT_SCORE_FIELD] !== ''
        ) {
            return DISPLACEMENT_SCORE_FIELD;
        }
        if (props.composite_score !== undefined && props.composite_score !== null && props.composite_score !== '') {
            return 'composite_score';
        }
    }
    return attr;
}

function resolveDisplacementPropertyValue(props, attr) {
    const key = resolveDisplacementPropertyKey(props, attr);
    return Number(props?.[key]);
}

function getDisplacementSubindicatorLegendTitle(attributeKey, config) {
    const opt = DISPLACEMENT_SUBINDICATOR_OPTIONS.find(o => o.value === attributeKey);
    return opt ? opt.label : config?.legendName || 'Displacement Pressure';
}

function recomputeSVDisplacementCircleMeta(layer, attr, minRadius = 4, maxRadius = 16) {
    const markerSub = layer?._svDisplacementMarkerLayer;
    if (!markerSub) return;

    const values = [];
    markerSub.eachLayer(marker => {
        const props = marker.feature?.properties;
        if (!props || isAcsCodeNoData(props)) return;
        const value = resolveDisplacementPropertyValue(props, attr);
        if (Number.isFinite(value)) values.push(value);
    });

    const minValue = values.length ? Math.min(...values) : 0;
    const maxValue = values.length ? Math.max(...values) : 1;
    layer._svCircleMeta = {
        ...(layer._svCircleMeta || {}),
        minValue,
        maxValue,
        minRadius,
        maxRadius,
        svAttribute: attr
    };
}

function populateDemographicSubindicatorSelect(resolution = getActiveAdminResolution()) {
    renderSVSubindicatorPanel('svAdmin5Layer');
}

function getEffectiveChoroplethAttribute(layerId, config) {
    if (layerId === 'svAdmin3Layer' && config?.thinBoundaries) {
        return getPrimarySubindicator(layerId) || config?.svAttribute;
    }
    if (layerId === 'svAdmin5Layer') {
        return getPrimarySubindicator(layerId) || config?.svAttribute;
    }
    if (layerId === 'svAdmin2Layer') {
        return getEffectiveEconomicAttribute(config);
    }
    return config?.svAttribute;
}

function buildSubindicatorLegendNote(layerId, labelForValue) {
    const selected = getSelectedSubindicators(layerId);
    if (selected.length <= 1) return '';
    const extras = selected
        .slice(1)
        .map(value => labelForValue(value))
        .filter(Boolean);
    if (!extras.length) return '';
    return `Overlays: ${extras.join(' · ')}`;
}

function removeSubindicatorMapExtras(map, layer) {
    if (!layer) return;
    (layer._svSubindicatorOverlays || []).forEach(overlay => {
        if (map?.hasLayer(overlay)) map.removeLayer(overlay);
    });
    layer._svSubindicatorOverlays = [];
    (layer._svDisplacementExtraGroups || []).forEach(group => {
        if (map?.hasLayer(group)) map.removeLayer(group);
    });
    layer._svDisplacementExtraGroups = [];
}

function syncChoroplethSubindicatorOverlays(map, layerId, layers, config) {
    const layer = layers.vector[layerId];
    if (!map || !layer?.layerData?.raw) return;

    const extras = getSelectedSubindicators(layerId).slice(1);
    (layer._svSubindicatorOverlays || []).forEach(overlay => {
        if (map.hasLayer(overlay)) map.removeLayer(overlay);
    });
    layer._svSubindicatorOverlays = [];
    if (!extras.length) return;

    const opacitySlider = document.getElementById('svOpacity');
    const baseOpacity = opacitySlider ? parseFloat(opacitySlider.value) : 0.6;
    const overlayOpacity = Math.min(0.5, baseOpacity * 0.7);
    const fixedRamp = getColorRamp(config.fixedColorRamp);
    if (!fixedRamp) return;

    extras.forEach((attr, idx) => {
        const overlay = L.geoJSON(layer.layerData.raw, {
            interactive: false,
            style: { weight: 0, opacity: 0, fillOpacity: 0 }
        });
        overlay.layerData = {
            raw: layer.layerData.raw,
            selectedProperty: attr,
            colorRamp: fixedRamp
        };
        updateVectorLayerStyle(overlay, attr, fixedRamp, overlayOpacity, null, { skipTooltips: true });
        const outlineColor = SUBINDICATOR_OVERLAY_OUTLINE[idx % SUBINDICATOR_OVERLAY_OUTLINE.length];
        overlay.eachLayer(featureLayer => {
            if (typeof featureLayer.setStyle !== 'function') return;
            const style = featureLayer.options || {};
            featureLayer.setStyle({
                ...style,
                weight: 0.5,
                color: outlineColor,
                opacity: 0.85
            });
        });
        overlay.addTo(map);
        layer._svSubindicatorOverlays.push(overlay);
    });
}

function syncDisplacementSubindicatorExtras(map, layerId, layers, config) {
    const layer = layers.vector[layerId];
    if (!map || !layer?._svDisplacementMarkerLayer) return;

    const extras = getSelectedSubindicators(layerId).slice(1);
    (layer._svDisplacementExtraGroups || []).forEach(group => {
        if (map.hasLayer(group)) map.removeLayer(group);
    });
    layer._svDisplacementExtraGroups = [];
    if (!extras.length) return;

    const scale = getSVDisplacementRadiusScale(map);
    const minR = (config.minRadius || layer._svCircleMeta?.minRadius || 7) * scale * 0.65;
    const maxR = (config.maxRadius || layer._svCircleMeta?.maxRadius || 22) * scale * 0.65;
    const fillOpacity = getSVDisplacementCircleFillOpacity(map) * 0.55;

    extras.forEach((attr, idx) => {
        const values = [];
        layer._svDisplacementMarkerLayer.eachLayer(marker => {
            const props = marker.feature?.properties;
            if (!props || isAcsCodeNoData(props)) return;
            const value = resolveDisplacementPropertyValue(props, attr);
            if (Number.isFinite(value)) values.push(value);
        });
        const minValue = values.length ? Math.min(...values) : 0;
        const maxValue = values.length ? Math.max(...values) : 1;
        const fillColor = DISPLACEMENT_EXTRA_COLORS[idx % DISPLACEMENT_EXTRA_COLORS.length];
        const group = L.layerGroup();

        layer._svDisplacementMarkerLayer.eachLayer(marker => {
            const props = marker.feature?.properties;
            if (!props || isAcsCodeNoData(props)) return;
            const value = resolveDisplacementPropertyValue(props, attr);
            if (!Number.isFinite(value)) return;
            const t = maxValue > minValue ? (value - minValue) / (maxValue - minValue) : 0;
            const radius = minR + t * (maxR - minR);
            group.addLayer(
                L.circleMarker(marker.getLatLng(), {
                    radius,
                    fillColor,
                    fillOpacity,
                    color: fillColor,
                    weight: 1.5,
                    opacity: 0.9,
                    interactive: false
                })
            );
        });
        group.addTo(map);
        layer._svDisplacementExtraGroups.push(group);
    });
}

function getEffectiveStripeAttribute(layerId, config) {
    if (layerId === 'svAdmin2Layer' && config?.renderMode === 'stripe-pattern') {
        return getEffectiveEconomicAttribute(config);
    }
    return config?.svAttribute;
}

function getPeaceCadastreChoroplethLegendTitle(layerId, attributeKey, config) {
    if (layerId !== 'svAdmin3Layer' || !config?.thinBoundaries) {
        return config?.legendName || 'Layer';
    }
    const opt = PEACE_CADASTRE_SUBINDICATOR_OPTIONS.find(o => o.value === attributeKey);
    return opt ? opt.label : config.legendName || 'Tension and Conflict Risk';
}

function getDemographicChoroplethLegendTitle(layerId, attributeKey, config) {
    if (layerId !== 'svAdmin5Layer') {
        return config?.legendName || 'Layer';
    }
    const options = getDemographicSubindicatorOptions();
    const opt = options.find(o => o.value === attributeKey);
    return opt ? opt.label : config.legendName || 'Demographic Shock Factor';
}

function getChoroplethLegendTitle(layerId, attributeKey, config) {
    if (layerId === 'svAdmin3Layer') {
        return getPeaceCadastreChoroplethLegendTitle(layerId, attributeKey, config);
    }
    if (layerId === 'svAdmin5Layer') {
        return getDemographicChoroplethLegendTitle(layerId, attributeKey, config);
    }
    return config?.legendName || 'Layer';
}

const OVERALL_VULNERABILITY_LEGEND_LABELS = ['Low', 'Medium', 'High'];
const DEMOGRAPHIC_SHOCK_LEGEND_LABELS = [
    'Low to no shock',
    'Slight shock',
    'Moderate shock',
    'Significant shock',
    'Critical shock'
];

function applyDemographicShockLegendLabels(labels) {
    const hasNoData = Array.isArray(labels)
        && labels.some(label => String(label || '').trim().toLowerCase() === ACS_CODE_NO_DATA_LEGEND_LABEL);
    return hasNoData
        ? [...DEMOGRAPHIC_SHOCK_LEGEND_LABELS, ACS_CODE_NO_DATA_LEGEND_LABEL]
        : [...DEMOGRAPHIC_SHOCK_LEGEND_LABELS];
}

function buildOverallVulnerabilityLegendEntry(config, colorScheme, rawGeoJson) {
    const scheme = [...(colorScheme || [])];
    const labels = [...OVERALL_VULNERABILITY_LEGEND_LABELS];
    if (layerHasAcsCodeNoData(rawGeoJson)) {
        scheme.push(ACS_CODE_NO_DATA_COLOR);
        labels.push(ACS_CODE_NO_DATA_LEGEND_LABEL);
    }
    return {
        layerName: (config?.legendName || 'Overall Vulnerability Index').trim(),
        colorScheme: scheme,
        description: '',
        labels,
        scaleDirection: 'yellow-orange-red'
    };
}

function pushOverallVulnerabilityLegend(layerId, config, colorScheme, addLegendEntry, rawGeoJson) {
    if (!addLegendEntry || layerId !== 'svOverallTensionLayer') {
        return;
    }
    addLegendEntry(layerId, buildOverallVulnerabilityLegendEntry(config, colorScheme, rawGeoJson));
}

function refreshSVPeaceCadastreChoropleth(map, layers, addLegendEntry) {
    const layerId = 'svAdmin3Layer';
    const config = layerConfig[layerId];
    const layer = layers.vector[layerId];
    if (!config || !layer || !activeSVLayers.has(layerId)) return;
    if (config.renderMode) return;
    if (!config.thinBoundaries) return;

    const attr = getEffectiveChoroplethAttribute(layerId, config);
    const opacitySlider = document.getElementById('svOpacity');
    const opacity = opacitySlider ? parseFloat(opacitySlider.value) : 0.6;
    const fixedRamp = getColorRamp(config.fixedColorRamp);
    if (!fixedRamp) return;

    const legendTitle = getPeaceCadastreChoroplethLegendTitle(layerId, attr, config);
    const overlayNote = buildSubindicatorLegendNote(layerId, value =>
        getPeaceCadastreChoroplethLegendTitle(layerId, value, config)
    );
    const updateLegendForLayer = (layerName, colorScheme, description, labels) => {
        const demographicLabels = applyDemographicShockLegendLabels(labels);
        addLegendEntry(layerId, {
            layerName: legendTitle,
            colorScheme,
            description: [description, overlayNote].filter(Boolean).join(' '),
            labels: demographicLabels
        });
    };
    updateVectorLayerStyle(layer, attr, fixedRamp, opacity, updateLegendForLayer, { skipTooltips: true });
    applySVPolygonOutlineStyle(layer, config);
    updateSVHoverTooltips(layer, layerId, config);
    reapplySelectedPolygonHighlight(layerId);
    syncChoroplethSubindicatorOverlays(map, layerId, layers, config);
}

function refreshSVDemographicChoropleth(map, layers, addLegendEntry) {
    const layerId = 'svAdmin5Layer';
    const config = layerConfig[layerId];
    const layer = layers.vector[layerId];
    if (!config || !layer || !activeSVLayers.has(layerId)) return;
    if (config.renderMode) return;

    const attr = getEffectiveChoroplethAttribute(layerId, config);
    const opacitySlider = document.getElementById('svOpacity');
    const opacity = opacitySlider ? parseFloat(opacitySlider.value) : 0.6;
    const fixedRamp = getColorRamp(config.fixedColorRamp);
    if (!fixedRamp) return;

    const legendTitle = getDemographicChoroplethLegendTitle(layerId, attr, config);
    const overlayNote = buildSubindicatorLegendNote(layerId, value =>
        getDemographicChoroplethLegendTitle(layerId, value, config)
    );
    const updateLegendForLayer = (layerName, colorScheme, description, labels) => {
        addLegendEntry(layerId, {
            layerName: legendTitle,
            colorScheme,
            description: [description, overlayNote].filter(Boolean).join(' '),
            labels
        });
    };
    updateVectorLayerStyle(layer, attr, fixedRamp, opacity, updateLegendForLayer, { skipTooltips: true });
    applySVPolygonOutlineStyle(layer, config);
    updateSVHoverTooltips(layer, layerId, config);
    reapplySelectedPolygonHighlight(layerId);
    syncChoroplethSubindicatorOverlays(map, layerId, layers, config);
}

function refreshSVDisplacementLayerCircles(layerId, layers, config, map) {
    const layer = layers.vector[layerId];
    if (!layer || !layer._isSVProportionalLayer) return;

    const attr = getEffectiveDisplacementCircleAttribute(config);
    recomputeSVDisplacementCircleMeta(
        layer,
        attr,
        config.minRadius || layer._svCircleMeta?.minRadius || 4,
        config.maxRadius || layer._svCircleMeta?.maxRadius || 16
    );
    refreshSVDisplacementCircles(layerId, layers, config, map);
}


function refreshSVEconomicStripePattern(map, layers, addLegendEntry) {
    const layerId = 'svAdmin2Layer';
    const config = layerConfig[layerId];
    const layer = layers.vector[layerId];
    if (!config || !layer || !activeSVLayers.has(layerId)) return;

    svPatternCache.delete(layerId);
    const opacitySlider = document.getElementById(config.opacityControl);
    const opacity = opacitySlider ? parseFloat(opacitySlider.value) : 0.6;
    applySVLayerOpacity(layerId, layers, opacity, map, addLegendEntry);
    if (layer.layerData) {
        layer.layerData.selectedProperty = getEffectiveEconomicAttribute(config);
    }
    if (map) {
        syncChoroplethSubindicatorOverlays(map, layerId, layers, config);
    }
}


const ESCALATION_TIME_MODE_CONTROL = 'escalationTimeMode';
const ESCALATION_TIME_MODE = {
    SNAPSHOT_09: 'snapshot_09_03_26',
    SNAPSHOT_10: 'snapshot_10_03_26',
    DIFF_09_10: 'diff_09_10',
    COMBINED: 'combined_cs_status'
};

const ESCALATION_SNAPSHOT_URLS = {
    [ESCALATION_TIME_MODE.SNAPSHOT_09]: 'data/CS_DATA_09_03_26_full.geojson',
    [ESCALATION_TIME_MODE.SNAPSHOT_10]: 'data/CS_DATA_10_03_26_full.geojson',
    [ESCALATION_TIME_MODE.COMBINED]: 'data/combined_cs_status.geojson'
};

// Unified polygon outline style for Social Vulnerability polygon layers.
const SV_OUTLINE_COLOR = '#374151';
const SV_OUTLINE_WEIGHT = 0.5;
const SV_OUTLINE_OPACITY = 1;
const SV_OUTLINE_CADASTRE_COLOR = '#6b7280';
const SV_OUTLINE_CADASTRE_WEIGHT = 0.3;
const SV_OUTLINE_CADASTRE_OPACITY = 0.7;
const SV_OUTLINE_PEACE_CADASTRE_COLOR = '#4b5563';
const SV_OUTLINE_PEACE_CADASTRE_WEIGHT = 0.45;
const SV_OUTLINE_PEACE_CADASTRE_OPACITY = 0.9;

const SV_SERVICE_DISABLE_CLUSTERING_AT_ZOOM = 13;
const SV_SERVICE_CADASTRE_OUTLINE_MAX_ZOOM = 12;

/**
 * Setup all layer controls and their event listeners
 * @param {Object} map - Leaflet map instance
 * @param {Object} layers - Object to store all layers
 * @param {Object} colorScales - Color scales for raster layers
 * @param {Function} addLegendEntry - Function to add a legend entry
 * @param {Function} removeLegendEntry - Function to remove a legend entry
 * @param {Function} updateLegend - Legacy function to update legend (single layer)
 * @param {Function} hideLegend - Function to clear legend
 * @param {Object} infoPanel - Info panel instance
 */
export function setupLayerControls(map, layers, colorScales, addLegendEntry, removeLegendEntry, updateLegend, hideLegend, infoPanel = null) {
    window.currentInfoPanel = infoPanel;
    window.addLegendEntry = addLegendEntry;
    window.removeLegendEntry = removeLegendEntry;
    // Initialize layer handlers
    Object.keys(layerConfig).forEach(layerId => {
        const config = layerConfig[layerId];
        
        // Skip Social-Vulnerability layers - they are handled by radio buttons
        if (config.type === 'sv-vector') {
            return;
        }
        
        setupLayerToggle(layerId, map, layers, colorScales, addLegendEntry, removeLegendEntry);
        
        // Setup opacity control if configured
        if (config.opacityControl && config.opacityDisplay) {
            setupOpacityControl(config.opacityControl, config.opacityDisplay, layerId, layers, addLegendEntry, updateLegend);
        }
        
        // Setup vector layer attribute and color controls
        if (config.type === 'vector' && config.attributeSelector && (config.colorRampSelector || config.fixedColorRamp)) {
            setupVectorControls(layerId, map, layers, config, addLegendEntry, updateLegend);
        }

        if (config.type === 'point' && config.colorRampSelector) {
            setupPointControls(layerId, map, layers, config, addLegendEntry, updateLegend);
        }

        // Special setup for Escalation layer
        if (layerId === 'escalationLayer') {
            setupEscalationControls(map, layers, config);
            
            // Auto-load Escalation layer if its checkbox is checked on startup
            const escCheckbox = document.getElementById('escalationLayer');
            if (escCheckbox && escCheckbox.checked) {
                escCheckbox.dispatchEvent(new Event('change'));
            }
        }

        if (layerId === 'roadStatusLayer') {
            const roadCheckbox = document.getElementById('roadStatusLayer');
            if (roadCheckbox && roadCheckbox.checked) {
                roadCheckbox.dispatchEvent(new Event('change'));
            }
        }
        if (layerId === 'ttfHotspotsLayer') {
            const ttfCheckbox = document.getElementById('ttfHotspotsLayer');
            if (ttfCheckbox && ttfCheckbox.checked) {
                ttfCheckbox.dispatchEvent(new Event('change'));
            }
        }
    });
    
    // Setup Social Vulnerability radio button controls
    setupSVRadioControls(map, layers, colorScales, addLegendEntry, removeLegendEntry, updateLegend, hideLegend);
    
    // Setup point layer property selector
    setupPointLayerSelector(layers);
    
    // Auto-load Admin Level 1 Social-Vulnerability on startup
    autoLoadSVAdmin1(map, layers, colorScales, addLegendEntry, removeLegendEntry, updateLegend, hideLegend);
}

function syncSVSubindicatorPanelsVisibility() {
    const btn = document.querySelector('.social-vulnerability-btn');
    if (!btn) return;
    const panel = btn.nextElementSibling;
    const isOpen =
        btn.classList.contains('active') &&
        panel &&
        panel.classList.contains('dropdown-container') &&
        panel.style.display === 'block';

    document.querySelectorAll('[data-subindicator-layer]').forEach(wrap => {
        const layerId = wrap.dataset.subindicatorLayer;
        const layerOn = Boolean(document.getElementById(layerId)?.checked);
        const peaceApplicable =
            layerId !== 'svAdmin3Layer' ||
            (getActiveAdminResolution() === 'cadastre' && Boolean(layerConfig.svAdmin3Layer?.thinBoundaries));
        wrap.hidden = !isOpen || !layerOn || !peaceApplicable;
        if (!wrap.hidden) {
            renderSVSubindicatorPanel(layerId);
        }
    });
}

window.syncSVSubindicatorPanelsVisibility = syncSVSubindicatorPanelsVisibility;

/**
 * Setup Social Vulnerability radio button controls
 */
function setupSVRadioControls(map, layers, colorScales, addLegendEntry, removeLegendEntry, updateLegend, hideLegend) {
    const svToggles = document.querySelectorAll('input[name="svLayer"]');
    setupSVResolutionSelector(map, layers, colorScales, addLegendEntry, removeLegendEntry, updateLegend, hideLegend);
    setupSVServicePriorityToggle(layers);
    syncSVServicePriorityControl();

    svToggles.forEach(toggle => {
        toggle.addEventListener('change', async function() {
            const layerId = this.id;
            const config = layerConfig[layerId];

            if (!config?.url || !config?.svAttribute) {
                this.checked = false;
                syncSVServicePriorityControl();
                return;
            }

            if (this.checked) {
                applySVLayerExclusivity(layerId);
                const loadVersion = svResolutionVersion;
                await loadSVLayer(layerId, map, layers, colorScales, addLegendEntry, removeLegendEntry, updateLegend, hideLegend, loadVersion);
                if (loadVersion !== svResolutionVersion || !this.checked) {
                    syncSVServicePriorityControl();
                    return;
                }
                activeSVLayers.add(layerId);
                currentSVLayer = layerId;
            } else {
                if (layers.vector[layerId]) {
                    removeSubindicatorMapExtras(map, layers.vector[layerId]);
                    if (config?.renderMode === 'proportional-circles') {
                        detachSVDisplacementZoom(map, layers.vector[layerId]);
                    }
                    if (config?.renderMode === 'stripe-pattern' || config?.renderMode === 'service-pattern') {
                        detachSVPatternZoom(map, layers.vector[layerId]);
                        const patternCache = svPatternCache.get(layerId);
                        disposeSocioStripePatterns(patternCache);
                        svPatternCache.delete(layerId);
                    }
                    removeSVAuxiliaryLayers(map, layers.vector[layerId]);
                    clearPolygonSelection(layerId, layers);
                    map.removeLayer(layers.vector[layerId]);
                    removeLegendEntry(layerId);
                }
                if (window.currentInfoPanel) {
                    window.currentInfoPanel.removeLayer(layerId);
                }
                activeSVLayers.delete(layerId);
                if (currentSVLayer === layerId) {
                    currentSVLayer = activeSVLayers.size ? Array.from(activeSVLayers).at(-1) : null;
                }
            }

            const controlsContainer = document.querySelector('.social-vulnerability-btn').nextElementSibling.querySelector('.layer-controls');
            if (controlsContainer) {
                controlsContainer.style.display = activeSVLayers.size > 0 ? 'block' : 'none';
            }

            syncSVServicePriorityControl();
            if (typeof window.syncSVSubindicatorPanelsVisibility === 'function') {
                window.syncSVSubindicatorPanelsVisibility();
            }
        });
    });

    configureSVSubindicators({
        onChange: layerId => {
            if (layerId === 'svAdmin3Layer') {
                refreshSVPeaceCadastreChoropleth(map, layers, addLegendEntry);
            } else if (layerId === 'svAdmin5Layer') {
                refreshSVDemographicChoropleth(map, layers, addLegendEntry);
            } else if (layerId === 'svAdmin1Layer') {
                refreshSVDisplacementLayerCircles('svAdmin1Layer', layers, layerConfig.svAdmin1Layer, map);
            } else if (layerId === 'svAdmin2Layer') {
                refreshSVEconomicStripePattern(map, layers, addLegendEntry);
            }
        }
    });
    renderSVSubindicatorPanels();
    
    // Setup Social-Vulnerability opacity control
    setupSVOpacityControl(map, layers, addLegendEntry, updateLegend);
    
    // Setup Social-Vulnerability color ramp selector
    setupSVColorRampSelector(map, layers, addLegendEntry, updateLegend);

    ['svAdmin3Layer', 'svAdmin1Layer', 'svAdmin2Layer', 'svAdmin5Layer'].forEach(layerId => {
        const cb = document.getElementById(layerId);
        if (!cb) return;
        cb.addEventListener('change', () => {
            if (cb.checked) {
                renderSVSubindicatorPanel(layerId);
            }
            if (typeof window.syncSVSubindicatorPanelsVisibility === 'function') {
                window.syncSVSubindicatorPanelsVisibility();
            }
        });
    });
}

function isSVServicePriorityOnlyEnabled() {
    const toggle = document.getElementById(SV_SERVICE_PRIORITY_TOGGLE_ID);
    return toggle ? toggle.classList.contains('active') : true;
}

function syncSVServicePriorityControl() {
    const serviceCb = document.getElementById('svAdmin4Layer');
    const wrap = document.getElementById('svServicePriorityWrap');

    const visible = Boolean(serviceCb && serviceCb.checked && !serviceCb.disabled);
    if (wrap) {
        wrap.hidden = !visible;
    }
}

function setupSVServicePriorityToggle(layers) {
    const toggle = document.getElementById(SV_SERVICE_PRIORITY_TOGGLE_ID);
    if (!toggle || toggle.dataset.initialized === 'true') return;

    toggle.dataset.initialized = 'true';
    toggle.setAttribute('aria-pressed', 'true');

    toggle.addEventListener('click', () => {
        const wrap = document.getElementById('svServicePriorityWrap');
        if (!wrap || wrap.hidden) return;
        const active = toggle.classList.toggle('active');
        toggle.setAttribute('aria-pressed', active ? 'true' : 'false');

        const serviceLayer = layers?.vector?.svAdmin4Layer;
        if (serviceLayer?._isSVServiceSymbolLayer) {
            applySVServicePriorityFilter(serviceLayer, active);
        }
    });
}

function setupSVResolutionSelector(map, layers, colorScales, addLegendEntry, removeLegendEntry, updateLegend, hideLegend) {
    const buttons = Array.from(document.querySelectorAll(SV_ADMIN_RESOLUTION_BUTTON_SELECTOR));
    const activeButton = buttons.find(button => button.classList.contains('active'));
    const resolution = activeButton?.dataset?.resolution || 'cadastre';

    applySVResolution(
        resolution,
        map,
        layers,
        colorScales,
        addLegendEntry,
        removeLegendEntry,
        updateLegend,
        hideLegend,
        buttons
    );

    buttons.forEach(button => {
        button.addEventListener('click', async () => {
            const selectedResolution = button.dataset?.resolution || 'cadastre';
            await applySVResolution(
                selectedResolution,
                map,
                layers,
                colorScales,
                addLegendEntry,
                removeLegendEntry,
                updateLegend,
                hideLegend,
                buttons
            );
        });
    });
}

async function applySVResolution(resolution, map, layers, colorScales, addLegendEntry, removeLegendEntry, updateLegend, hideLegend, resolutionButtons = null) {
    const requestVersion = ++svResolutionVersion;
    const selectedResolution = SV_RESOLUTION_CONFIG[resolution] ? resolution : 'cadastre';
    const resolutionConfig = SV_RESOLUTION_CONFIG[selectedResolution];
    const buttons = resolutionButtons || Array.from(document.querySelectorAll(SV_ADMIN_RESOLUTION_BUTTON_SELECTOR));
    const previouslySelectedLayerIds = Array.from(document.querySelectorAll('input[name="svLayer"]:checked')).map(input => input.id);

    buttons.forEach(button => {
        const isActive = button.dataset?.resolution === selectedResolution;
        button.classList.toggle('active', isActive);
    });

    for (const layerId of SV_LAYER_IDS) {
        const currentLayer = layers.vector[layerId];
        if (currentLayer) {
            const currentConfig = layerConfig[layerId];
            if (currentConfig?.renderMode === 'proportional-circles') {
                detachSVDisplacementZoom(map, currentLayer);
            }
            if (currentConfig?.renderMode === 'stripe-pattern' || currentConfig?.renderMode === 'service-pattern') {
                detachSVPatternZoom(map, currentLayer);
                const patternCache = svPatternCache.get(layerId);
                disposeSocioStripePatterns(patternCache);
                svPatternCache.delete(layerId);
            }
            removeSVAuxiliaryLayers(map, currentLayer);
            clearPolygonSelection(layerId, layers);
            map.removeLayer(currentLayer);
            removeLegendEntry(layerId);
            delete layers.vector[layerId];
        }
        if (window.currentInfoPanel) {
            window.currentInfoPanel.removeLayer(layerId);
        }
        activeSVLayers.delete(layerId);
        const toggle = document.getElementById(layerId);
        if (toggle) {
            toggle.checked = false;
        }
    }

    currentSVLayer = null;
    svPillarLookupCache.clear();

    SV_LAYER_IDS.forEach(layerId => {
        const config = layerConfig[layerId];
        const base = SV_BASE_LAYER_CONFIG[layerId];
        const resolutionLayer = resolutionConfig[layerId];
        if (!config || !base || !resolutionLayer) return;

        config.url = resolutionLayer.url;
        config.svAttribute = resolutionLayer.svAttribute;
        config.fixedColorRamp = base.fixedColorRamp;
        config.legendName = base.legendName;
        if (resolutionLayer.legendName != null && resolutionLayer.legendName !== '') {
            config.legendName = resolutionLayer.legendName;
        }
        config.renderMode = base.renderMode === 'choropleth' ? undefined : base.renderMode;
        config.patternColor = base.patternColor;
        config.minRadius = base.minRadius;
        config.maxRadius = base.maxRadius;
        config.markerColor = base.markerColor;
        config.thinBoundaries = Boolean(resolutionLayer.thinBoundaries);

        const toggle = document.getElementById(layerId);
        if (!toggle) return;
        toggle.disabled = !resolutionLayer.available;
    });

    syncSVServicePriorityControl();

    const controlsContainer = document.querySelector('.social-vulnerability-btn')?.nextElementSibling?.querySelector('.layer-controls');
    if (controlsContainer) {
        controlsContainer.style.display = 'none';
    }

    const selectedLayersStillAvailable = previouslySelectedLayerIds.filter(layerId => resolutionConfig[layerId]?.available);
    const layersToRestore = reconcileSVLayerSelection(selectedLayersStillAvailable);

    for (const layerId of layersToRestore) {
        if (requestVersion !== svResolutionVersion) {
            return;
        }
        const toggle = document.getElementById(layerId);
        if (!toggle || toggle.disabled) continue;
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change'));
    }

    syncSVServicePriorityControl();
    populateDemographicSubindicatorSelect(selectedResolution);
    populateDisplacementSubindicatorSelect();
    populateEconomicSubindicatorSelect(selectedResolution);
    renderSVSubindicatorPanels();
    if (typeof window.syncSVSubindicatorPanelsVisibility === 'function') {
        window.syncSVSubindicatorPanelsVisibility();
    }
    if (activeSVLayers.has('svAdmin2Layer')) {
        refreshSVEconomicStripePattern(map, layers, window.addLegendEntry);
    }
}

/**
 * Auto-load all checked Social Vulnerability layers on startup
 */
async function autoLoadSVAdmin1(map, layers, colorScales, addLegendEntry, removeLegendEntry, updateLegend, hideLegend) {
    if (activeSVLayers.size > 0) {
        return;
    }

    const svLayerOrder = ['svOverallTensionLayer', 'svAdmin1Layer', 'svAdmin2Layer', 'svAdmin3Layer', 'svAdmin4Layer', 'svAdmin5Layer'];
    let preCheckedIds = svLayerOrder.filter(layerId => {
        const toggle = document.getElementById(layerId);
        return Boolean(toggle?.checked);
    });

    if (preCheckedIds.length === 0) {
        const overallToggle = document.getElementById(SV_OVERALL_LAYER_ID);
        if (overallToggle) {
            overallToggle.checked = true;
            preCheckedIds.push(SV_OVERALL_LAYER_ID);
        } else {
            return;
        }
    }

    preCheckedIds = reconcileSVLayerSelection(preCheckedIds);
    svLayerOrder.forEach(layerId => {
        const toggle = document.getElementById(layerId);
        if (toggle) {
            toggle.checked = preCheckedIds.includes(layerId);
        }
    });

    for (const layerId of preCheckedIds) {
        await loadSVLayer(layerId, map, layers, colorScales, addLegendEntry, removeLegendEntry, updateLegend, hideLegend);
        activeSVLayers.add(layerId);
        currentSVLayer = layerId;
    }

    // Keep the visible selector aligned with the last loaded layer's fixed ramp
    const activeConfig = layerConfig[currentSVLayer];
    const colorRampSelector = document.getElementById('svColorRamp');
    if (activeConfig?.fixedColorRamp && colorRampSelector) {
        colorRampSelector.value = activeConfig.fixedColorRamp;
        colorRampSelector.dispatchEvent(new Event('change'));
    }

    const controlsContainer = document.querySelector('.social-vulnerability-btn').nextElementSibling.querySelector('.layer-controls');
    if (controlsContainer) {
        controlsContainer.style.display = 'block';
    }
}

/**
 * Load a Social Vulnerability layer
 */
async function loadSVLayer(layerId, map, layers, colorScales, addLegendEntry, removeLegendEntry, updateLegend, hideLegend, expectedVersion = svResolutionVersion) {
    const config = layerConfig[layerId];
    if (!config) return;
    
    try {
        if (expectedVersion !== svResolutionVersion) return;
        if (!layers.vector[layerId]) {
            let loadedLayer = null;
            if (config.renderMode === 'proportional-circles') {
                loadedLayer = await loadSVCircleLayer(config);
            } else if (config.renderMode === 'service-symbol') {
                loadedLayer = await loadSVServiceSymbolLayer(config);
            } else if (config.renderMode === 'sectarian-glyph') {
                loadedLayer = await loadSVSectarianGlyphLayer(config);
            } else {
                loadedLayer = await loadVectorLayer(config.url, { style: config.style });
            }
            if (expectedVersion !== svResolutionVersion) return;
            layers.vector[layerId] = loadedLayer;
            let interactionLayer = loadedLayer;
            if (config.renderMode === 'sectarian-glyph' && loadedLayer?._svAdminOutlineLayer) {
                interactionLayer = loadedLayer._svAdminOutlineLayer;
            } else if (config.renderMode === 'proportional-circles' && loadedLayer._svDisplacementMarkerLayer) {
                interactionLayer = loadedLayer._svDisplacementMarkerLayer;
            }
            addInfoPopupHandler(interactionLayer, config.layerType || 'sv-default');
            attachPolygonSelectionHandlers(layerId, interactionLayer, layers, config);
        }
        if (expectedVersion !== svResolutionVersion) return;
        const toggle = document.getElementById(layerId);
        if (toggle && !toggle.checked) return;
        if (map.hasLayer(layers.vector[layerId])) map.removeLayer(layers.vector[layerId]);
        
        layers.vector[layerId].addTo(map);
        if (config.renderMode === 'service-symbol') {
            applySVServicePriorityFilter(layers.vector[layerId], isSVServicePriorityOnlyEnabled());
            updateSVServiceCadastreOutlineVisibility(map, layers.vector[layerId]);
            attachSVServiceCadastreOutlineZoomSync(map, layers.vector[layerId]);
        } else if (config.renderMode === 'proportional-circles' && layers.vector[layerId]?._svAdminOutlineLayer) {
            layers.vector[layerId]._svAdminOutlineLayer.addTo(map);
        } else if (config.renderMode === 'sectarian-glyph' && layers.vector[layerId]?._svAdminOutlineLayer) {
            layers.vector[layerId]._svAdminOutlineLayer.addTo(map);
        }
        keepRoadLayerOnTop(layers);
        
        const opacitySlider = document.getElementById(config.opacityControl);
        const opacity = opacitySlider ? parseFloat(opacitySlider.value) : 0.6;

        if (config.renderMode === 'proportional-circles') {
            applySVLayerOpacity(layerId, layers, opacity);
            attachSVDisplacementZoomSync(map, layerId, layers, config);
            if (layerId === 'svAdmin1Layer') {
                populateDisplacementSubindicatorSelect();
            }
            refreshSVDisplacementLayerCircles(layerId, layers, config, map);
        } else if (config.renderMode === 'service-symbol') {
            applySVLayerOpacity(layerId, layers, opacity, map, addLegendEntry);
        } else if (config.renderMode === 'stripe-pattern' || config.renderMode === 'service-pattern') {
            applySVLayerOpacity(layerId, layers, opacity, map, addLegendEntry);
            attachSVPatternZoomSync(map, layerId, layers, config, addLegendEntry);
            if (layerId === 'svAdmin2Layer') {
                populateEconomicSubindicatorSelect();
            }
        } else if (config.renderMode === 'sectarian-glyph') {
            applySVLayerOpacity(layerId, layers, opacity, map, addLegendEntry);
        } else {
            const colorRamp = getColorRamp(config.fixedColorRamp);
            if (colorRamp) {
                const chAttr = getEffectiveChoroplethAttribute(layerId, config);
                const rawGeoJson = layers.vector[layerId]?.layerData?.raw;
                const updateLegendForLayer = (layerName, colorScheme, description, labels) => {
                    if (layerId === 'svOverallTensionLayer') {
                        pushOverallVulnerabilityLegend(layerId, config, colorRamp.colors, addLegendEntry, rawGeoJson);
                        return;
                    }
                    addLegendEntry(layerId, {
                        layerName: getChoroplethLegendTitle(layerId, chAttr, config) || config.legendName || layerName,
                        colorScheme,
                        description,
                        labels: layerId === 'svAdmin5Layer' ? applyDemographicShockLegendLabels(labels) : labels
                    });
                };
                updateVectorLayerStyle(
                    layers.vector[layerId],
                    chAttr,
                    colorRamp,
                    opacity,
                    updateLegendForLayer,
                    { skipTooltips: true }
                );
                applySVPolygonOutlineStyle(layers.vector[layerId], config);
                reapplySelectedPolygonHighlight(layerId);
                if (layerId === 'svAdmin3Layer' && config.thinBoundaries) {
                    refreshSVPeaceCadastreChoropleth(map, layers, addLegendEntry);
                } else if (layerId === 'svAdmin5Layer') {
                    refreshSVDemographicChoropleth(map, layers, addLegendEntry);
                }
            }
        }
        if (config.renderMode === 'sectarian-glyph' && layers.vector[layerId]?._svAdminOutlineLayer) {
            updateSVHoverTooltips(layers.vector[layerId]._svAdminOutlineLayer, layerId, config);
        }
        updateSVHoverTooltips(layers.vector[layerId], layerId, config);
        
    } catch (error) {
        console.error(`Error loading Social-Vulnerability layer ${layerId}:`, error);
    }
    if (window.currentInfoPanel) {
    const layerInfo = {
        id: layerId,
        name: getLayerDisplayName(layerId, config),
        type: 'sv-vector',
        selectedAttribute: getEffectiveChoroplethAttribute(layerId, config),
        opacity: 0.6,
        layer: layers.vector[layerId]
    };
    
    let featureCount = 0;
    const fcSource = layers.vector[layerId]._svDisplacementMarkerLayer || layers.vector[layerId]._svSectarianMarkerLayer || layers.vector[layerId];
    fcSource.eachLayer(() => featureCount++);
    layerInfo.featureCount = featureCount;
    
    window.currentInfoPanel.addLayer(layerId, layerInfo);
    }
}

function getSVCircleRadius(value, minValue, maxValue, minRadius, maxRadius) {
    if (!Number.isFinite(value)) return minRadius;
    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue) || maxValue <= minValue) {
        return (minRadius + maxRadius) / 2;
    }
    const ratio = (value - minValue) / (maxValue - minValue);
    return minRadius + Math.max(0, Math.min(1, ratio)) * (maxRadius - minRadius);
}

const SV_DISPLACEMENT_FILL_OPACITY_MIN = 0.55;
const SV_DISPLACEMENT_FILL_OPACITY_MAX = 0.92;
const SV_DISPLACEMENT_OPACITY_ZOOM_MIN = 9;
const SV_DISPLACEMENT_OPACITY_ZOOM_MAX = 14;
const SV_DISPLACEMENT_MARKER_COLOR_LIGHT = '#fef08a';
const SV_DISPLACEMENT_MARKER_COLOR_DARK = '#c2410c';
const SV_DISPLACEMENT_LEGEND_RADIUS_LOW = 7;
const SV_DISPLACEMENT_LEGEND_RADIUS_HIGH = 10;

function getSVDisplacementCircleFillOpacity(map) {
    if (!map || typeof map.getZoom !== 'function') {
        return SV_DISPLACEMENT_FILL_OPACITY_MIN;
    }
    const z = map.getZoom();
    const span = SV_DISPLACEMENT_OPACITY_ZOOM_MAX - SV_DISPLACEMENT_OPACITY_ZOOM_MIN;
    const t = span > 0 ? (z - SV_DISPLACEMENT_OPACITY_ZOOM_MIN) / span : 1;
    const u = Math.max(0, Math.min(1, t));
    return SV_DISPLACEMENT_FILL_OPACITY_MIN + (SV_DISPLACEMENT_FILL_OPACITY_MAX - SV_DISPLACEMENT_FILL_OPACITY_MIN) * u;
}

function isSVDisplacementClusteringActive(map) {
    if (!map || typeof map.getZoom !== 'function') {
        return true;
    }
    return map.getZoom() < SV_SERVICE_DISABLE_CLUSTERING_AT_ZOOM;
}

function hexToRgb(hex) {
    if (typeof hex !== 'string') return null;
    const normalized = hex.trim().replace('#', '');
    if (normalized.length === 3) {
        const r = parseInt(normalized[0] + normalized[0], 16);
        const g = parseInt(normalized[1] + normalized[1], 16);
        const b = parseInt(normalized[2] + normalized[2], 16);
        return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) ? { r, g, b } : null;
    }
    if (normalized.length === 6) {
        const r = parseInt(normalized.slice(0, 2), 16);
        const g = parseInt(normalized.slice(2, 4), 16);
        const b = parseInt(normalized.slice(4, 6), 16);
        return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) ? { r, g, b } : null;
    }
    return null;
}

function lerpHexColor(colorA, colorB, t) {
    const a = hexToRgb(colorA);
    const b = hexToRgb(colorB);
    if (!a || !b) return colorB || colorA || '#f59e0b';
    const u = Math.max(0, Math.min(1, t));
    const r = Math.round(a.r + (b.r - a.r) * u);
    const g = Math.round(a.g + (b.g - a.g) * u);
    const bl = Math.round(a.b + (b.b - a.b) * u);
    return `#${[r, g, bl].map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

function getSVDisplacementColorFromRadius(radius, minRadius, maxRadius) {
    const minR = Math.min(minRadius, maxRadius);
    const maxR = Math.max(minRadius, maxRadius);
    if (!Number.isFinite(radius) || maxR <= minR) {
        return SV_DISPLACEMENT_MARKER_COLOR_LIGHT;
    }
    const t = Math.max(0, Math.min(1, (radius - minR) / (maxR - minR)));
    return lerpHexColor(SV_DISPLACEMENT_MARKER_COLOR_LIGHT, SV_DISPLACEMENT_MARKER_COLOR_DARK, t);
}

function getSVDisplacementMarkerStyle(value, minValue, maxValue, minRadius, maxRadius) {
    const radius = getSVCircleRadius(value, minValue, maxValue, minRadius, maxRadius);
    const fillColor = getSVDisplacementColorFromRadius(radius, minRadius, maxRadius);
    return { radius, fillColor };
}

function getDisplacementClusterFillColor(cluster, styleState) {
    if (!styleState) return SV_DISPLACEMENT_MARKER_COLOR_DARK;
    const children = cluster.getAllChildMarkers?.() || [];
    const { minValue, maxValue, minR, maxR, attr } = styleState;
    let peakT = 0;
    const span = Math.max(maxR, minR) - Math.min(maxR, minR);
    children.forEach(marker => {
        const props = marker?.feature?.properties;
        if (!props || isAcsCodeNoData(props)) return;
        const value = resolveDisplacementPropertyValue(props, attr);
        if (!Number.isFinite(value)) return;
        const radius = getSVCircleRadius(value, minValue, maxValue, minR, maxR);
        if (span > 0 && Number.isFinite(radius)) {
            const t = Math.max(0, Math.min(1, (radius - minR) / span));
            if (t > peakT) peakT = t;
        }
    });
    return lerpHexColor(SV_DISPLACEMENT_MARKER_COLOR_LIGHT, SV_DISPLACEMENT_MARKER_COLOR_DARK, peakT);
}

function featureToCenterPointFeature(feature) {
    try {
        const tempLayer = L.geoJSON(feature);
        const bounds = tempLayer.getBounds();
        if (!bounds?.isValid?.() || !bounds.isValid()) return null;
        const center = bounds.getCenter();
        return {
            type: 'Feature',
            properties: { ...(feature.properties || {}) },
            geometry: {
                type: 'Point',
                coordinates: [center.lng, center.lat]
            }
        };
    } catch (error) {
        return null;
    }
}

async function loadSVCircleLayer(config) {
    const response = await fetch(config.url);
    const data = await response.json();
    const sourceFeatures = data?.features || [];
    const pointFeatures = sourceFeatures
        .map(featureToCenterPointFeature)
        .filter(Boolean);

    const circleAttr = getEffectiveDisplacementCircleAttribute(config);
    const numericValues = pointFeatures
        .filter(feature => !isAcsCodeNoData(feature.properties))
        .map(feature => resolveDisplacementPropertyValue(feature.properties, circleAttr))
        .filter(value => Number.isFinite(value));
    const minValue = numericValues.length ? Math.min(...numericValues) : 0;
    const maxValue = numericValues.length ? Math.max(...numericValues) : 1;
    const minRadius = config.minRadius || 4;
    const maxRadius = config.maxRadius || 16;

    const clusterStyleState = {
        fillOpacity: SV_DISPLACEMENT_FILL_OPACITY_MIN,
        minR: minRadius,
        maxR: maxRadius,
        minValue,
        maxValue,
        attr: circleAttr
    };

    const markerLayer = L.geoJSON(
        { type: 'FeatureCollection', features: pointFeatures },
        {
            pointToLayer: (feature, latlng) => {
                const props = feature.properties || {};
                const isNoData = isAcsCodeNoData(props);
                const value = resolveDisplacementPropertyValue(props, circleAttr);
                const style = isNoData
                    ? { radius: minRadius, fillColor: ACS_CODE_NO_DATA_COLOR }
                    : getSVDisplacementMarkerStyle(value, minValue, maxValue, minRadius, maxRadius);
                return L.circleMarker(latlng, {
                    radius: style.radius,
                    fillColor: style.fillColor,
                    color: '#ffffff',
                    weight: 1,
                    fillOpacity: isNoData ? 0.65 : SV_DISPLACEMENT_FILL_OPACITY_MIN,
                    opacity: 1
                });
            }
        }
    );

    const adminOutlineLayer = L.geoJSON(data, {
        style: () => ({
            color: SV_OUTLINE_CADASTRE_COLOR,
            weight: SV_OUTLINE_CADASTRE_WEIGHT,
            opacity: SV_OUTLINE_CADASTRE_OPACITY,
            fill: false,
            fillOpacity: 0
        }),
        interactive: false
    });

    const clusterLayer = typeof L.markerClusterGroup === 'function'
        ? L.markerClusterGroup({
            showCoverageOnHover: false,
            spiderfyOnMaxZoom: true,
            zoomToBoundsOnClick: true,
            disableClusteringAtZoom: SV_SERVICE_DISABLE_CLUSTERING_AT_ZOOM,
            maxClusterRadius: 52,
            iconCreateFunction: cluster => createDisplacementClusterIcon(cluster, clusterStyleState)
        })
        : null;

    const finalLayer = clusterLayer || markerLayer;
    if (clusterLayer) {
        clusterLayer.addLayer(markerLayer);
        clusterLayer._svDisplacementClusterStyleState = clusterStyleState;
    }

    finalLayer._svDisplacementClusterStyleState = clusterStyleState;
    finalLayer.layerData = {
        raw: data,
        propertyFields: Object.keys(pointFeatures[0]?.properties || {}),
        selectedProperty: circleAttr,
        colorRamp: null
    };
    finalLayer._isSVProportionalLayer = true;
    finalLayer._svDisplacementMarkerLayer = markerLayer;
    finalLayer._svDisplacementClusterLayer = clusterLayer;
    finalLayer._svAdminOutlineLayer = adminOutlineLayer;
    finalLayer._svCircleMeta = {
        minValue,
        maxValue,
        minRadius,
        maxRadius,
        svAttribute: circleAttr
    };
    return finalLayer;
}

async function loadSVServiceSymbolLayer(config) {
    const response = await fetch(config.url);
    const data = await response.json();
    const sourceFeatures = data?.features || [];
    const pointFeatures = sourceFeatures.map(featureToCenterPointFeature).filter(Boolean);

    const numericValues = pointFeatures
        .map(feature => Number(feature.properties?.[config.svAttribute]))
        .filter(value => Number.isFinite(value));
    const breaks = buildQuantileBreaks(numericValues, SOCIO_STRIPE_CLASS_COUNT);
    const symbolColors = config.serviceSymbolColors || ['#22c55e', '#f59e0b', '#dc2626'];

    const markerLayer = L.geoJSON({ type: 'FeatureCollection', features: pointFeatures }, {
        pointToLayer: (feature, latlng) => {
            const raw = Number(feature.properties?.[config.svAttribute]);
            const classIndex = getPatternClassIndex(raw, breaks);
            const color = symbolColors[classIndex] || symbolColors[symbolColors.length - 1] || '#dc2626';
            feature.properties = { ...(feature.properties || {}), __svServiceClassIndex: classIndex };
            return L.marker(latlng, {
                icon: L.divIcon({
                    className: 'sv-service-symbol-wrapper',
                    html: `<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:#ffffff;color:${color};border:1px solid rgba(17,24,39,0.35);font-weight:800;font-size:12px;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,0.35);opacity:1;">!</span>`,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                }),
                opacity: 1
            });
        }
    });

    const clusterLayer = typeof L.markerClusterGroup === 'function'
        ? L.markerClusterGroup({
            showCoverageOnHover: false,
            spiderfyOnMaxZoom: true,
            zoomToBoundsOnClick: true,
            disableClusteringAtZoom: SV_SERVICE_DISABLE_CLUSTERING_AT_ZOOM,
            maxClusterRadius: 52,
            iconCreateFunction: cluster => createSVServiceClusterIcon(cluster, symbolColors)
        })
        : null;

    const allMarkers = [];
    markerLayer.eachLayer(marker => {
        allMarkers.push(marker);
    });

    const finalLayer = clusterLayer || markerLayer;
    if (clusterLayer) clusterLayer.addLayer(markerLayer);

    const cadastreOutlineLayer = L.geoJSON(data, {
        style: () => ({
            color: SV_OUTLINE_CADASTRE_COLOR,
            weight: SV_OUTLINE_CADASTRE_WEIGHT,
            opacity: SV_OUTLINE_CADASTRE_OPACITY,
            fill: false,
            fillOpacity: 0
        }),
        interactive: false
    });

    finalLayer.layerData = {
        raw: { type: 'FeatureCollection', features: pointFeatures },
        propertyFields: Object.keys(pointFeatures[0]?.properties || {}),
        selectedProperty: config.svAttribute,
        colorRamp: null
    };
    finalLayer._isSVServiceSymbolLayer = true;
    finalLayer._svServiceSymbolMeta = { breaks, symbolColors, svAttribute: config.svAttribute };
    finalLayer._svServiceMarkerLayer = markerLayer;
    finalLayer._svServiceClusterLayer = clusterLayer;
    finalLayer._svServiceAllMarkers = allMarkers;
    finalLayer._svServicePriorityOnly = true;
    finalLayer._svCadastreOutlineLayer = cadastreOutlineLayer;
    return finalLayer;
}

const SECTARIAN_GLYPH_ICON_SIZE = [28, 28];
const SECTARIAN_GLYPH_ANCHOR = [14, 14];

function getSectarianGlyphClassIndex(properties, attr) {
    const raw = properties?.[attr];
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(3, Math.floor(n)));
}

/**
 * Monochrome SVG "compass tick" glyphs: ring + 0–3 radial ticks (shape encodes dummy class).
 * Not a color ramp, stripes, or punctuation marks.
 */
function buildSectarianGlyphSvg(classIndex) {
    const cx = 14;
    const cy = 14;
    const r = 9;
    const tick = 7;
    const patterns = [
        { lines: [] },
        { lines: [[cx, cy, cx, cy - tick]] },
        { lines: [[cx, cy, cx - tick * 0.75, cy + tick * 0.65], [cx, cy, cx + tick * 0.75, cy + tick * 0.65]] },
        {
            lines: [
                [cx, cy, cx, cy - tick],
                [cx, cy, cx - tick * 0.75, cy + tick * 0.65],
                [cx, cy, cx + tick * 0.75, cy + tick * 0.65]
            ]
        }
    ];
    const spec = patterns[classIndex] || patterns[0];
    const lineEls = spec.lines
        .map(
            ([x1, y1, x2, y2]) =>
                `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#111827" stroke-width="2.1" stroke-linecap="round"/>`
        )
        .join('');
    return `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${lineEls}<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#111827" stroke-width="1.6"/></svg>`;
}

async function loadSVSectarianGlyphLayer(config) {
    const response = await fetch(config.url);
    const data = await response.json();
    const sourceFeatures = data?.features || [];
    const attr = config.svAttribute || 'DUMMY_sectarian_class';
    const pointFeatures = sourceFeatures.map(featureToCenterPointFeature).filter(Boolean);

    const markerLayer = L.geoJSON(
        { type: 'FeatureCollection', features: pointFeatures },
        {
            pointToLayer: (feature, latlng) => {
                const cls = getSectarianGlyphClassIndex(feature.properties, attr);
                const svg = buildSectarianGlyphSvg(cls);
                return L.marker(latlng, {
                    icon: L.divIcon({
                        className: 'sv-sectarian-glyph-icon',
                        html: svg,
                        iconSize: SECTARIAN_GLYPH_ICON_SIZE,
                        iconAnchor: SECTARIAN_GLYPH_ANCHOR
                    }),
                    interactive: true
                });
            }
        }
    );

    const clusterLayer = typeof L.markerClusterGroup === 'function'
        ? L.markerClusterGroup({
            showCoverageOnHover: false,
            spiderfyOnMaxZoom: true,
            zoomToBoundsOnClick: true,
            disableClusteringAtZoom: SV_SERVICE_DISABLE_CLUSTERING_AT_ZOOM,
            maxClusterRadius: 52,
            iconCreateFunction: cluster => createSectarianClusterIcon(cluster, attr)
        })
        : null;

    const finalLayer = clusterLayer || markerLayer;
    if (clusterLayer) clusterLayer.addLayer(markerLayer);

    const isCadastre = Boolean(config?.thinBoundaries);
    const adminOutlineLayer = L.geoJSON(data, {
        style: () => ({
            color: isCadastre ? SV_OUTLINE_CADASTRE_COLOR : SV_OUTLINE_COLOR,
            weight: isCadastre ? SV_OUTLINE_CADASTRE_WEIGHT : SV_OUTLINE_WEIGHT,
            opacity: isCadastre ? SV_OUTLINE_CADASTRE_OPACITY : SV_OUTLINE_OPACITY,
            fill: false,
            fillOpacity: 0
        }),
        interactive: true
    });

    finalLayer.layerData = {
        raw: { type: 'FeatureCollection', features: pointFeatures },
        propertyFields: Object.keys(pointFeatures[0]?.properties || {}),
        selectedProperty: attr,
        colorRamp: null
    };
    finalLayer._isSVSectarianGlyphLayer = true;
    finalLayer._svSectarianMarkerLayer = markerLayer;
    finalLayer._svSectarianClusterLayer = clusterLayer;
    finalLayer._svAdminOutlineLayer = adminOutlineLayer;
    finalLayer._svSectarianGlyphAttr = attr;
    return finalLayer;
}

function applySVServicePriorityFilter(layer, priorityOnlyHigh = true) {
    if (!layer?._isSVServiceSymbolLayer) return;
    const markerLayer = layer._svServiceMarkerLayer;
    const clusterLayer = layer._svServiceClusterLayer;
    const allMarkers = layer._svServiceAllMarkers || [];
    if (!markerLayer || !allMarkers.length) return;

    const visibleMarkers = priorityOnlyHigh
        ? allMarkers.filter(marker => Number(marker?.feature?.properties?.__svServiceClassIndex) === SV_SERVICE_HIGH_PRIORITY_CLASS_INDEX)
        : allMarkers;

    markerLayer.clearLayers();
    visibleMarkers.forEach(marker => markerLayer.addLayer(marker));

    if (clusterLayer) {
        clusterLayer.clearLayers();
        clusterLayer.addLayer(markerLayer);
    }

    layer._svServicePriorityOnly = priorityOnlyHigh;
}

function createDisplacementClusterIcon(cluster, styleState) {
    const count = Math.max(1, cluster.getChildCount());
    const diameter = Math.max(28, Math.min(58, Math.round(24 + Math.sqrt(count) * 5.2)));
    const fillOpacity = styleState?.fillOpacity ?? SV_DISPLACEMENT_FILL_OPACITY_MIN;
    const bgColor = getDisplacementClusterFillColor(cluster, styleState);
    const bg = toRgbaColor(bgColor, fillOpacity);
    return L.divIcon({
        className: 'sv-displacement-cluster-wrapper',
        html: `
            <div style="width:${diameter}px;height:${diameter}px;border-radius:999px;background:${bg};border:2px solid rgba(255,255,255,0.95);box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>
        `,
        iconSize: [diameter, diameter],
        iconAnchor: [Math.round(diameter / 2), Math.round(diameter / 2)]
    });
}

function createSectarianClusterIcon(cluster, attr) {
    const children = cluster.getAllChildMarkers();
    const counts = [0, 0, 0, 0];
    children.forEach(marker => {
        const idx = getSectarianGlyphClassIndex(marker?.feature?.properties, attr);
        if (idx >= 0 && idx < 4) counts[idx] += 1;
    });
    let dominant = 0;
    for (let i = 1; i < 4; i++) {
        if (counts[i] > counts[dominant]) dominant = i;
    }
    const count = Math.max(1, cluster.getChildCount());
    const diameter = Math.max(38, Math.min(68, Math.round(30 + Math.sqrt(count) * 5.5)));
    const scale = Math.min(0.75, (diameter * 0.55) / 28);
    const svg = buildSectarianGlyphSvg(dominant);
    const countSize = Math.max(10, Math.min(14, Math.round(diameter * 0.2)));
    return L.divIcon({
        className: 'sv-sectarian-cluster-wrapper',
        html: `
            <div style="width:${diameter}px;min-height:${diameter}px;border-radius:14px;background:rgba(248,250,252,0.98);border:1px solid #94a3b8;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;padding:4px 6px 6px;">
                <div style="display:flex;align-items:center;justify-content:center;line-height:0;transform:scale(${scale});transform-origin:center;">${svg}</div>
                <div style="font-weight:700;font-size:${countSize}px;color:#0f172a;line-height:1;margin-top:1px;">${count}</div>
            </div>
        `,
        iconSize: [diameter, diameter],
        iconAnchor: [Math.round(diameter / 2), Math.round(diameter / 2)]
    });
}

function createSVServiceClusterIcon(cluster, symbolColors) {
    const children = cluster.getAllChildMarkers();
    const classCounts = [0, 0, 0];
    children.forEach(marker => {
        const idxRaw = marker?.feature?.properties?.__svServiceClassIndex;
        const idx = Number.isFinite(Number(idxRaw)) ? Number(idxRaw) : 0;
        if (idx >= 0 && idx < classCounts.length) classCounts[idx] += 1;
    });
    let dominantClass = 0;
    for (let i = 1; i < classCounts.length; i++) {
        if (classCounts[i] > classCounts[dominantClass]) dominantClass = i;
    }
    const dominantColor = symbolColors[dominantClass] || '#111827';
    const count = Math.max(1, cluster.getChildCount());
    const diameter = Math.max(28, Math.min(58, Math.round(24 + Math.sqrt(count) * 5.2)));
    const fontSize = Math.max(11, Math.min(16, Math.round(diameter * 0.28)));
    return L.divIcon({
        className: 'sv-service-cluster-wrapper',
        html: `<div style="width:${diameter}px;height:${diameter}px;border-radius:999px;background:${toRgbaColor(dominantColor, 0.4)};color:#ffffff;border:2px solid rgba(255,255,255,0.9);box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${fontSize}px;line-height:1;">!</div>`,
        iconSize: [diameter, diameter],
        iconAnchor: [Math.round(diameter / 2), Math.round(diameter / 2)]
    });
}

function toRgbaColor(color, alpha) {
    const a = Math.max(0, Math.min(1, alpha));
    if (typeof color !== 'string') return `rgba(17,24,39,${a})`;
    const hex = color.trim().replace('#', '');
    if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return `rgba(${r},${g},${b},${a})`;
    } else if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return `rgba(${r},${g},${b},${a})`;
    }
    return color;
}

function removeSVAuxiliaryLayers(map, layer) {
    if (!map || !layer) return;
    detachSVServiceCadastreOutlineZoom(map, layer);
    if (layer._svAdminOutlineLayer && map.hasLayer(layer._svAdminOutlineLayer)) map.removeLayer(layer._svAdminOutlineLayer);
    if (layer._svCadastreOutlineLayer && map.hasLayer(layer._svCadastreOutlineLayer)) map.removeLayer(layer._svCadastreOutlineLayer);
}

function updateSVServiceCadastreOutlineVisibility(map, layer) {
    if (!map || !layer?._svCadastreOutlineLayer) return;
    const shouldShow = map.getZoom() <= SV_SERVICE_CADASTRE_OUTLINE_MAX_ZOOM;
    const isShown = map.hasLayer(layer._svCadastreOutlineLayer);
    if (shouldShow && !isShown) layer._svCadastreOutlineLayer.addTo(map);
    else if (!shouldShow && isShown) map.removeLayer(layer._svCadastreOutlineLayer);
}

function attachSVServiceCadastreOutlineZoomSync(map, layer) {
    if (!map || !layer?._svCadastreOutlineLayer) return;
    if (layer._svCadastreOutlineZoomHandler) map.off('zoomend', layer._svCadastreOutlineZoomHandler);
    const handler = () => updateSVServiceCadastreOutlineVisibility(map, layer);
    layer._svCadastreOutlineZoomHandler = handler;
    map.on('zoomend', handler);
}

function detachSVServiceCadastreOutlineZoom(map, layer) {
    if (!map || !layer?._svCadastreOutlineZoomHandler) return;
    map.off('zoomend', layer._svCadastreOutlineZoomHandler);
    layer._svCadastreOutlineZoomHandler = null;
}

const SV_DISPLACEMENT_ZOOM_REF = 10;

function getSVDisplacementRadiusScale(map) {
    if (!map || typeof map.getZoom !== 'function') {
        return 1;
    }
    const z = map.getZoom();
    return Math.max(0.45, Math.min(2.25, Math.pow(2, (SV_DISPLACEMENT_ZOOM_REF - z) * 0.12)));
}

function attachSVDisplacementZoomSync(map, layerId, layers, config) {
    const layer = layers.vector[layerId];
    if (!map || !layer || !config || config.renderMode !== 'proportional-circles') {
        return;
    }

    if (layer._svZoomEndHandler) {
        map.off('zoomend', layer._svZoomEndHandler);
        layer._svZoomEndHandler = null;
    }

    const handler = () => {
        refreshSVDisplacementCircles(layerId, layers, config, map);
    };
    layer._svZoomEndHandler = handler;
    map.on('zoomend', handler);
}

function refreshSVDisplacementCircles(layerId, layers, config, map) {
    const layer = layers.vector[layerId];
    if (!layer || !layer._isSVProportionalLayer || !layer._svCircleMeta) {
        return;
    }

    const attr = getEffectiveDisplacementCircleAttribute(config);
    recomputeSVDisplacementCircleMeta(
        layer,
        attr,
        config.minRadius || layer._svCircleMeta?.minRadius || 7,
        config.maxRadius || layer._svCircleMeta?.maxRadius || 22
    );
    const meta = layer._svCircleMeta;
    const scale = getSVDisplacementRadiusScale(map);
    const minR = (config.minRadius || meta.minRadius || 7) * scale;
    const maxR = (config.maxRadius || meta.maxRadius || 22) * scale;
    const fillOpacity = getSVDisplacementCircleFillOpacity(map);
    const clusterStyleState = layer._svDisplacementClusterStyleState;
    if (clusterStyleState) {
        Object.assign(clusterStyleState, {
            fillOpacity,
            minR,
            maxR,
            minValue: meta.minValue,
            maxValue: meta.maxValue,
            attr
        });
    }
    const clusterLayer = layer._svDisplacementClusterLayer;
    if (clusterLayer?.refreshClusters) {
        clusterLayer.refreshClusters();
    }

    const markerSub = layer._svDisplacementMarkerLayer || layer;
    markerSub.eachLayer(marker => {
        if (!marker.feature?.properties) return;
        const props = marker.feature.properties;
        const isNoData = isAcsCodeNoData(props);
        const value = resolveDisplacementPropertyValue(props, attr);
        const style = isNoData
            ? { radius: minR, fillColor: ACS_CODE_NO_DATA_COLOR }
            : getSVDisplacementMarkerStyle(value, meta.minValue, meta.maxValue, minR, maxR);
        if (typeof marker.setStyle === 'function') {
            marker.setStyle({
                radius: style.radius,
                fillColor: style.fillColor,
                fillOpacity: isNoData ? 0.65 : fillOpacity
            });
        }
    });

    if (window.addLegendEntry) {
        const circleItems = [
            {
                label: 'Lower intensity',
                radius: SV_DISPLACEMENT_LEGEND_RADIUS_LOW,
                color: SV_DISPLACEMENT_MARKER_COLOR_LIGHT,
                fillOpacity
            },
            {
                label: 'Higher intensity',
                radius: SV_DISPLACEMENT_LEGEND_RADIUS_HIGH,
                color: SV_DISPLACEMENT_MARKER_COLOR_DARK,
                fillOpacity
            }
        ];
        if (layerHasAcsCodeNoData(layer.layerData?.raw)) {
            circleItems.push({
                label: ACS_CODE_NO_DATA_LEGEND_LABEL,
                radius: SV_DISPLACEMENT_LEGEND_RADIUS_LOW,
                color: ACS_CODE_NO_DATA_COLOR,
                fillOpacity: 0.75
            });
        }
        const selected = getSelectedSubindicators('svAdmin1Layer');
        const layerTitle = selected
            .map(value => getDisplacementSubindicatorLegendTitle(value, config))
            .join(' · ');
        const overlayNote = buildSubindicatorLegendNote('svAdmin1Layer', value =>
            getDisplacementSubindicatorLegendTitle(value, config)
        );
        window.addLegendEntry(layerId, {
            layerName: `${layerTitle} `,
            type: 'proportional-circles',
            color: SV_DISPLACEMENT_MARKER_COLOR_DARK,
            fillOpacity,
            description: overlayNote,
            items: circleItems
        });
    }

    syncDisplacementSubindicatorExtras(map, 'svAdmin1Layer', layers, config);
}

function detachSVDisplacementZoom(map, layer) {
    if (!map || !layer?._svZoomEndHandler) {
        return;
    }
    map.off('zoomend', layer._svZoomEndHandler);
    layer._svZoomEndHandler = null;
}

function attachSVPatternZoomSync(map, layerId, layers, config, addLegendEntry) {
    const layer = layers.vector[layerId];
    if (!map || !layer || !config || (config.renderMode !== 'stripe-pattern' && config.renderMode !== 'service-pattern')) {
        return;
    }

    if (layer._svPatternZoomHandler) {
        map.off('zoomend', layer._svPatternZoomHandler);
        layer._svPatternZoomHandler = null;
    }

    const handler = () => {
        const opacitySlider = document.getElementById(config.opacityControl);
        const opacity = opacitySlider ? parseFloat(opacitySlider.value) : 0.6;
        applySVStripePatternStyle(layerId, layer, config, opacity, map, addLegendEntry || window.addLegendEntry);
        updateSVHoverTooltips(layer);
    };
    layer._svPatternZoomHandler = handler;
    map.on('zoomend', handler);
}

function detachSVPatternZoom(map, layer) {
    if (!map || !layer?._svPatternZoomHandler) return;
    map.off('zoomend', layer._svPatternZoomHandler);
    layer._svPatternZoomHandler = null;
}

/**
 * Setup Social-Vulnerability opacity control
 */
function setupSVOpacityControl(map, layers, addLegendEntry, updateLegend) {
    const opacitySlider = document.getElementById('svOpacity'); 
    const opacityDisplay = document.getElementById('svOpacityValue');
    
    if (!opacitySlider || !opacityDisplay) return;
    
    opacitySlider.addEventListener('input', function() {
        const value = Math.round(this.value * 100);
        opacityDisplay.textContent = `${value}%`;

        const opacity = parseFloat(this.value);
        activeSVLayers.forEach(layerId => {
            applySVLayerOpacity(layerId, layers, opacity, map, addLegendEntry);
        });
    });
}

/**
 * Setup Social-Vulnerability color ramp selector
 */
function setupSVColorRampSelector(map, layers, addLegendEntry, updateLegend) {
    setupColorRampSelector('svColorRamp', 'svColorPreview', (colorRamp) => {
        activeSVLayers.forEach(layerId => {
            const config = layerConfig[layerId];
            if (!config || !layers.vector[layerId] || config.renderMode === 'proportional-circles' || config.renderMode === 'stripe-pattern' || config.renderMode === 'service-pattern' || config.renderMode === 'service-symbol' || config.renderMode === 'sectarian-glyph') {
                return;
            }

            const opacitySlider = document.getElementById('svOpacity');
            const opacity = opacitySlider ? parseFloat(opacitySlider.value) : 0.6;
            const fixedRamp = getColorRamp(config.fixedColorRamp);
            if (!fixedRamp) return;

            const chAttr = getEffectiveChoroplethAttribute(layerId, config);
            const rawGeoJson = layers.vector[layerId]?.layerData?.raw;
            const updateLegendForLayer = (layerName, colorScheme, description, labels) => {
                if (layerId === 'svOverallTensionLayer') {
                    pushOverallVulnerabilityLegend(layerId, config, fixedRamp.colors, addLegendEntry, rawGeoJson);
                    return;
                }
                addLegendEntry(layerId, {
                    layerName: getChoroplethLegendTitle(layerId, chAttr, config) || config.legendName || layerName,
                    colorScheme,
                    description,
                    labels: layerId === 'svAdmin5Layer' ? applyDemographicShockLegendLabels(labels) : labels
                });
            };
            updateVectorLayerStyle(
                layers.vector[layerId],
                chAttr,
                fixedRamp,
                opacity,
                updateLegendForLayer,
                { skipTooltips: true }
            );
            applySVPolygonOutlineStyle(layers.vector[layerId], config);
            updateSVHoverTooltips(layers.vector[layerId], layerId, config);
            reapplySelectedPolygonHighlight(layerId);
            if (window.currentInfoPanel) {
                window.currentInfoPanel.updateLayer(layerId, {
                    colorRamp: fixedRamp.name || 'Unknown',
                    opacity: opacity
                });
            }
        });
    });
}

/** Number of intensity classes for socio-economic stripe fill (tertiles → 3 classes, 4 breakpoints). */
const SOCIO_STRIPE_CLASS_COUNT = 3;

function formatSocioIntensityValue(v) {
    if (!Number.isFinite(v)) return '—';
    const abs = Math.abs(v);
    if (abs >= 100) return v.toFixed(0);
    if (abs >= 10) return v.toFixed(1);
    return v.toFixed(2);
}

function getPatternClassIndex(value, breaks) {
    if (!Number.isFinite(value) || !breaks.length) return 0;
    for (let i = 0; i < breaks.length - 1; i++) {
        if (value <= breaks[i + 1]) return i;
    }
    return breaks.length - 2;
}

function buildQuantileBreaks(values, classCount) {
    const sorted = values.slice().sort((a, b) => a - b);
    if (!sorted.length) return [0, 1];
    const breaks = [sorted[0]];
    for (let i = 1; i < classCount; i++) {
        const index = Math.min(sorted.length - 1, Math.floor((i / classCount) * sorted.length));
        breaks.push(sorted[index]);
    }
    breaks.push(sorted[sorted.length - 1]);
    return breaks;
}

/**
 * Build legend labels for 3 intensity classes from tertile breakpoints [v0, v1, v2, v3].
 */
function formatSocioIntensityRange(lo, hi) {
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return '—';
    if (Math.abs(hi - lo) < 1e-9) {
        return formatSocioIntensityValue(lo);
    }
    return `${formatSocioIntensityValue(lo)} – ${formatSocioIntensityValue(hi)}`;
}

function socioStripeSwatchInlineStyle(specIndex, patternColor) {
    const spec = SOCIO_STRIPE_CLASS_SPECS[specIndex];
    if (!spec) return '';
    const gapPx = Math.max(2, Math.min(18, Math.round(spec.spaceWeight * 0.45)));
    const barPx = Math.max(1, Math.min(4, Math.round(spec.weight * 1.2)));
    const period = barPx + gapPx;
    const stripeColor = spec.color || patternColor;
    return `background:repeating-linear-gradient(${spec.angle}deg, ${stripeColor} 0, ${stripeColor} ${barPx}px, #eef2f7 ${barPx}px, #eef2f7 ${period}px);`;
}

function buildSocioStripeLegendItems(breaks, patternColor) {
    if (!breaks || breaks.length < 4) {
        return [
            { label: 'Low intensity', color: patternColor, swatchStyle: socioStripeSwatchInlineStyle(0, patternColor) },
            { label: 'Medium intensity', color: patternColor, swatchStyle: socioStripeSwatchInlineStyle(1, patternColor) },
            { label: 'High intensity', color: patternColor, swatchStyle: socioStripeSwatchInlineStyle(2, patternColor) }
        ];
    }
    const [a, b, c, d] = breaks;
    return [
        {
            label: `Low (${formatSocioIntensityRange(a, b)})`,
            color: patternColor,
            swatchStyle: socioStripeSwatchInlineStyle(0, patternColor)
        },
        {
            label: `Medium (${formatSocioIntensityRange(b, c)})`,
            color: patternColor,
            swatchStyle: socioStripeSwatchInlineStyle(1, patternColor)
        },
        {
            label: `High (${formatSocioIntensityRange(c, d)})`,
            color: patternColor,
            swatchStyle: socioStripeSwatchInlineStyle(2, patternColor)
        }
    ];
}

/**
 * Per-class stripe geometry (must match menu legend + CSS swatches in styles.css).
 * Leaflet StripePattern defaults to width/height 8px — far too small; we set explicit tile size
 * so stripe + gap fit inside the pattern and density differences are visible.
 */
const SOCIO_STRIPE_CLASS_SPECS = [
    { angle: 28, weight: 1.4, spaceWeight: 9, patternOpacity: 1.0, fillOpacity: 1.0, color: '#9ca3af' },
    { angle: 48, weight: 1.4, spaceWeight: 3.5, patternOpacity: 1.0, fillOpacity: 1.0, color: '#4b5563' },
    { angle: 90, weight: 1.4, spaceWeight: 0.2, patternOpacity: 1.0, fillOpacity: 1.0, color: '#111827' }
];

// Distinct pattern geometry for Service Stress (separate from socio-economic stripes).
const SERVICE_PATTERN_CLASS_SPECS = [
    { angle: 12, weight: 0.8, spaceWeight: 5 },
    { angle: 35, weight: 1.4, spaceWeight: 8 },
    { angle: 58, weight: 2.2, spaceWeight: 12 }
];

function getSVPatternZoomScale(map) {
    if (!map || typeof map.getZoom !== 'function') return 1;
    const zoom = map.getZoom();
    return Math.max(0.7, Math.min(2.6, Math.pow(2, (zoom - 10) * 0.2)));
}

function createStripePatterns(map, patternColor, opacity, specs = SOCIO_STRIPE_CLASS_SPECS) {
    const StripePatternCtor = L.StripePattern || L?.pattern?.StripePattern;
    const zoomScale = getSVPatternZoomScale(map);
    const constantStripeThickness = 1.4;

    return specs.map(spec => {
        const isHighDensityClass = spec.spaceWeight <= 0.5;
        const stripeThickness = constantStripeThickness;
        const minGap = isHighDensityClass ? 0.05 : 0.2;
        const gap = Math.max(minGap, spec.spaceWeight / zoomScale);
        const minPatternHeight = isHighDensityClass ? 3 : 8;
        const minPatternWidth = isHighDensityClass ? 6 : 20;
        const patternHeight = Math.max(minPatternHeight, Math.ceil(stripeThickness + gap + 1));
        const patternWidth = Math.max(minPatternWidth, Math.ceil(patternHeight * 2.2));

        const pattern = new StripePatternCtor({
            weight: stripeThickness,
            spaceWeight: gap,
            width: patternWidth,
            height: patternHeight,
            color: spec.color || patternColor,
            opacity: 1,
            angle: spec.angle
        });
        pattern.addTo(map);
        return pattern;
    });
}

function disposeSocioStripePatterns(cache) {
    if (!cache?.patterns?.length) return;
    cache.patterns.forEach(pattern => {
        try {
            if (pattern && typeof pattern.remove === 'function') {
                pattern.remove();
            }
        } catch (error) {
            // ignore
        }
    });
}

function applySVColorFallback(layerId, layer, config, opacity) {
    const fixedRamp = getColorRamp(config.fixedColorRamp);
    if (!fixedRamp) return;
    updateVectorLayerStyle(layer, config.svAttribute, fixedRamp, opacity, (layerName, colorScheme, description, labels) => {
        if (window.addLegendEntry) {
            window.addLegendEntry(layerId, {
                layerName: config.legendName || layerName,
                colorScheme,
                description,
                labels
            });
        }
    });
}

function applySVStripePatternStyle(layerId, layer, config, opacity, map, addLegendEntry) {
    const hasStripe = Boolean(L.StripePattern || L?.pattern?.StripePattern);
    if (!hasStripe) {
        applySVColorFallback(layerId, layer, config, opacity);
        return;
    }

    const targetMap = map || window.map;
    if (!targetMap) return;

    const stripeAttr = getEffectiveStripeAttribute(layerId, config);
    const opacityKey = Math.round(opacity * 100) / 100;
    const zoomKey = Math.round(getSVPatternZoomScale(targetMap) * 1000) / 1000;
    let cache = svPatternCache.get(layerId);
    const needsRebuild = !cache
        || cache.map !== targetMap
        || cache.opacity !== opacityKey
        || cache.zoomKey !== zoomKey
        || cache.attr !== stripeAttr;

    if (needsRebuild) {
        if (cache) {
            disposeSocioStripePatterns(cache);
        }

        const values = [];
        layer.eachLayer(featureLayer => {
            const props = featureLayer?.feature?.properties;
            if (isAcsCodeNoData(props)) return;
            const raw = props?.[stripeAttr];
            const value = typeof raw === 'number' ? raw : Number(raw);
            if (Number.isFinite(value)) values.push(value);
        });

        const breaks = buildQuantileBreaks(values, SOCIO_STRIPE_CLASS_COUNT);
        const isServicePattern = config.renderMode === 'service-pattern';
        const patternSpecs = isServicePattern ? SERVICE_PATTERN_CLASS_SPECS : SOCIO_STRIPE_CLASS_SPECS;
        const patterns = createStripePatterns(targetMap, config.patternColor || '#2b83ba', opacity, patternSpecs);
        cache = { map: targetMap, breaks, patterns, opacity: opacityKey, zoomKey, attr: stripeAttr };
        svPatternCache.set(layerId, cache);
    }

    layer.eachLayer(featureLayer => {
        if (typeof featureLayer.setStyle !== 'function') return;
        const props = featureLayer?.feature?.properties;
        const isCadastre = Boolean(config?.thinBoundaries);
        const outlineStyle = {
            color: isCadastre ? SV_OUTLINE_CADASTRE_COLOR : SV_OUTLINE_COLOR,
            weight: isCadastre ? SV_OUTLINE_CADASTRE_WEIGHT : SV_OUTLINE_WEIGHT,
            opacity: isCadastre ? SV_OUTLINE_CADASTRE_OPACITY : SV_OUTLINE_OPACITY
        };
        if (isAcsCodeNoData(props)) {
            featureLayer.setStyle({
                ...outlineStyle,
                fillColor: ACS_CODE_NO_DATA_COLOR,
                fillOpacity: 1
            });
            return;
        }
        const raw = props?.[stripeAttr];
        const value = typeof raw === 'number' ? raw : Number(raw);
        const classIndex = getPatternClassIndex(value, cache.breaks);
        const pattern = cache.patterns[classIndex] || cache.patterns[cache.patterns.length - 1];
        featureLayer.setStyle({
            ...outlineStyle,
            fillColor: 'transparent',
            fillPattern: pattern,
            fillOpacity: 1
        });
    });

    const pushLegend = addLegendEntry || window.addLegendEntry;
    if (typeof pushLegend === 'function') {
        const pc = config.patternColor || '#2b83ba';
        const isServicePattern = config.renderMode === 'service-pattern';
        const legendItems = buildSocioStripeLegendItems(cache.breaks, pc);
        if (layerHasAcsCodeNoData(layer.layerData?.raw)) {
            legendItems.push({
                label: ACS_CODE_NO_DATA_LEGEND_LABEL,
                swatchStyle: `background:${ACS_CODE_NO_DATA_COLOR};`
            });
        }
        const economicLegendTitle =
            layerId === 'svAdmin2Layer'
                ? getSelectedSubindicators('svAdmin2Layer')
                      .map(value => getEconomicSubindicatorLegendTitle(value, config))
                      .join(' · ') || getEconomicSubindicatorLegendTitle(stripeAttr, config)
                : 'Economic Vulnerability';
        const economicOverlayNote =
            layerId === 'svAdmin2Layer'
                ? buildSubindicatorLegendNote('svAdmin2Layer', value =>
                      getEconomicSubindicatorLegendTitle(value, config)
                  )
                : '';
        pushLegend(layerId, {
            layerName: isServicePattern
                ? 'Service & Infrastructure Vulnerability (pattern intensity)'
                : economicLegendTitle,
            type: isServicePattern ? 'service-pattern-intensity' : 'stripe-intensity',
            patternColor: pc,
            description: economicOverlayNote,
            items: legendItems
        });
    }
}

function applySVLayerOpacity(layerId, layers, opacity, map = null, addLegendEntry = null) {
    const config = layerConfig[layerId];
    const layer = layers.vector[layerId];
    if (!config || !layer) return;

    if (config.renderMode === 'proportional-circles') {
        const markerSub = layer._svDisplacementMarkerLayer || layer;
        markerSub.eachLayer(marker => {
            if (typeof marker.setOpacity === 'function') marker.setOpacity(1);
        });
        updateSVHoverTooltips(layer);
        if (window.currentInfoPanel) {
            window.currentInfoPanel.updateLayer(layerId, { opacity });
        }
        return;
    }

    if (config.renderMode === 'service-symbol') {
        const meta = layer._svServiceSymbolMeta || {};
        const breaks = meta.breaks || [0, 1, 2, 3];
        const symbolColors = meta.symbolColors || config.serviceSymbolColors || ['#22c55e', '#f59e0b', '#dc2626'];
        layer.eachLayer(marker => {
            if (typeof marker.setOpacity === 'function') marker.setOpacity(1);
        });
        if (typeof window.removeLegendEntry === 'function') {
            window.removeLegendEntry(layerId);
        }
        const pushLegend = addLegendEntry || window.addLegendEntry;
        if (typeof pushLegend === 'function') {
            const [a, b, c, d] = breaks.length >= 4 ? breaks : [null, null, null, null];
            pushLegend(layerId, {
                layerName: 'Service & Infrastructure Vulnerability',
                type: 'service-symbol',
                markerSymbol: '!',
                items: [
                    { label: `Low (${formatSocioIntensityRange(a, b)})`, color: symbolColors[0] || '#22c55e' },
                    { label: `Medium (${formatSocioIntensityRange(b, c)})`, color: symbolColors[1] || '#f59e0b' },
                    { label: `High (${formatSocioIntensityRange(c, d)})`, color: symbolColors[2] || '#dc2626' }
                ]
            });
        }
        updateSVHoverTooltips(layer);
        return;
    }

    if (config.renderMode === 'sectarian-glyph') {
        const outline = layer._svAdminOutlineLayer;
        const isCadastre = Boolean(config?.thinBoundaries);
        const outlineOpacityFactor = opacity;
        if (outline && typeof outline.eachLayer === 'function') {
            outline.eachLayer(featureLayer => {
                if (typeof featureLayer.setStyle !== 'function') return;
                featureLayer.setStyle({
                    color: isCadastre ? SV_OUTLINE_CADASTRE_COLOR : SV_OUTLINE_COLOR,
                    weight: isCadastre ? SV_OUTLINE_CADASTRE_WEIGHT : SV_OUTLINE_WEIGHT,
                    opacity: (isCadastre ? SV_OUTLINE_CADASTRE_OPACITY : SV_OUTLINE_OPACITY) * outlineOpacityFactor,
                    fill: false,
                    fillOpacity: 0
                });
            });
        }
        const markerSub = layer._svSectarianMarkerLayer || layer;
        markerSub.eachLayer(marker => {
            if (typeof marker.setOpacity === 'function') marker.setOpacity(opacity);
        });
        const pushLegend = addLegendEntry || window.addLegendEntry;
        if (typeof pushLegend === 'function') {
            const items = [0, 1, 2, 3].map(idx => ({
                label:
                    idx === 0
                        ? 'Class 0 — ring only (dummy placeholder)'
                        : `Class ${idx} — ring + ${idx} radial tick(s) (dummy placeholder)`,
                glyphSvg: buildSectarianGlyphSvg(idx)
            }));
            pushLegend(layerId, {
                layerName: config.legendName || 'Secterian Distribution (dummy data)',
                type: 'sectarian-dummy-glyph',
                description:
                    'Columns DUMMY_* in GeoJSON are synthetic. Each unit shows a monochrome “compass tick” glyph at its centroid (shape varies by class), plus a neutral boundary outline. Markers cluster when zoomed out (same as Service Stress).',
                items
            });
        }
        updateSVHoverTooltips(outline || layer, layerId, config);
        reapplySelectedPolygonHighlight(layerId);
        if (window.currentInfoPanel) {
            window.currentInfoPanel.updateLayer(layerId, { opacity });
        }
        return;
    }

    if (config.renderMode === 'stripe-pattern' || config.renderMode === 'service-pattern') {
        applySVStripePatternStyle(layerId, layer, config, opacity, map, addLegendEntry);
        updateSVHoverTooltips(layer);
        if (layerId === 'svAdmin2Layer' && map) {
            syncChoroplethSubindicatorOverlays(map, layerId, layers, config);
        }
        return;
    }

    layer.setStyle({
        fillOpacity: opacity,
        opacity: opacity
    });

    const fixedRamp = getColorRamp(config.fixedColorRamp);
    if (fixedRamp) {
        const chAttr = getEffectiveChoroplethAttribute(layerId, config);
        updateVectorLayerStyle(layer, chAttr, fixedRamp, opacity, (layerName, colorScheme, description, labels) => {
            if (window.addLegendEntry) {
                window.addLegendEntry(layerId, {
                    layerName: getChoroplethLegendTitle(layerId, chAttr, config) || config.legendName || layerName,
                    colorScheme,
                    description,
                    labels: layerId === 'svAdmin5Layer' ? applyDemographicShockLegendLabels(labels) : labels
                });
            }
        }, { skipTooltips: true });
        applySVPolygonOutlineStyle(layer, config);
    }
    updateSVHoverTooltips(layer, layerId, config);
    reapplySelectedPolygonHighlight(layerId);
    if (map && (layerId === 'svAdmin3Layer' || layerId === 'svAdmin5Layer')) {
        syncChoroplethSubindicatorOverlays(map, layerId, layers, config);
    }
    if (window.currentInfoPanel) {
        window.currentInfoPanel.updateLayer(layerId, {
            opacity
        });
    }
}

/**
 * Setup point layer color ramp controls
 */
function setupPointControls(layerId, map, layers, config, addLegendEntry, updateLegend) {
    // Setup color ramp selector
    setupColorRampSelector(config.colorRampSelector, config.colorRampPreview, () => {
        updatePointLayerFromControls(layerId, layers, addLegendEntry, updateLegend);
    });
    
    const attributeSelector = document.getElementById(config.attributeSelector);
    if (attributeSelector) {
        attributeSelector.addEventListener('change', () => {
            updatePointLayerFromControls(layerId, layers, addLegendEntry, updateLegend);
        });
    }
}

/**
 * Setup point layer property selector
 */
function setupPointLayerSelector(layers) {
    // Process all point layer selectors
    Object.keys(layerConfig).forEach(layerId => {
        const config = layerConfig[layerId];
        if (config.type === 'point' && config.selectorId) {
            const selector = document.getElementById(config.selectorId);
            if (!selector) return;
            
            selector.addEventListener('change', function() {
                if (!layers.point[layerId]) return;
                
                layers.point[layerId].eachLayer(layer => {
                    if (layer.feature) {
                        updateTooltip(layer.feature, layer, config.selectorId);
                    }
                });
            });
        }
    });
}

/**
 * Create styled markers for Escalation layer based on school status
 */
// Custom icons for schools (you can replace PNG files with your own)
const openSchoolIcon = L.icon({
    iconUrl: 'assets/school_open.png',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
    tooltipAnchor: [0, -24]
});

const fullSchoolIcon = L.icon({
    iconUrl: 'assets/school_full.png',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
    tooltipAnchor: [0, -24]
});

const defaultSchoolIcon = L.icon({
    iconUrl: 'assets/school_default.png',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
    tooltipAnchor: [0, -24]
});


function createEscalationMarker(feature, latlng) {
    const fillColor = getEscalationMarkerColor(feature.properties);
    return L.circleMarker(latlng, {
        radius: 6,
        fillColor,
        color: '#1f2937',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.9
    });
}

// this is the old version of the escalation marker with PNGS

// function createEscalationMarker(feature, latlng) {
//     const status = (feature.properties?.status || '').toLowerCase();
    
//     const isOpen = status === 'open';
//     const isFull = status === 'full';
    
//     const icon = isOpen ? openSchoolIcon : (isFull ? fullSchoolIcon : defaultSchoolIcon);
    
//     return L.marker(latlng, { icon });
// }

function createEscalationClusterIcon(cluster) {
    const count = cluster.getChildCount();
    const children = cluster.getAllChildMarkers();
    const colorCounts = new Map();
    children.forEach(marker => {
        const color = getEscalationMarkerColor(marker?.feature?.properties || {});
        colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
    });

    let dominantColor = '#3498db';
    let dominantCount = -1;
    colorCounts.forEach((value, color) => {
        if (value > dominantCount) {
            dominantCount = value;
            dominantColor = color;
        }
    });

    return L.divIcon({
        html: `
            <div class="escalation-cluster-marker">
                
                <div class="escalation-cluster-count" style="background:${dominantColor};color:#ffffff;">${count}</div>
            </div>
        `,
        className: 'escalation-cluster-wrapper',
        iconSize: [64, 64],
        iconAnchor: [32, 32]
    });
}

function escalationTooltip(feature, layer) {
    const tooltipText = getEscalationTooltipText(feature.properties || {});
    layer.bindTooltip(tooltipText, {
        permanent: false,
        direction: 'top'
    });
    const popupHtml = buildEscalationPopupContent(feature.properties || {});
    layer.bindPopup(popupHtml, { maxWidth: 340, className: 'escalation-popup' });
}

function getEscalationTooltipText(properties) {
    const changeType = properties?.changeType;
    if (changeType === 'status_changed') {
        return `Status: ${properties.status_old || 'Unknown'} -> ${properties.status_new || 'Unknown'}`;
    }
    if (changeType === 'added') {
        return `Added: ${properties.status_new || 'Unknown'}`;
    }
    if (changeType === 'removed') {
        return `Removed: ${properties.status_old || 'Unknown'}`;
    }
    return `Status: ${properties?.status ?? 'Unknown'}`;
}

function getEscalationMarkerColor(properties = {}) {
    const changeType = properties.changeType;
    if (changeType === 'status_changed') return '#f39c12';
    if (changeType === 'added') return '#2ecc71';
    if (changeType === 'removed') return '#e74c3c';

    const status = String(properties.status || '').toLowerCase();
    if (status === 'open') return '#2ecc71';
    if (status === 'full') return '#f39c12';
    if (status === 'potential') return '#8e44ad';
    return '#3498db';
}

function getEscalationTimeMode() {
    const modeSelector = document.getElementById(ESCALATION_TIME_MODE_CONTROL);
    if (!modeSelector || !modeSelector.value) return ESCALATION_TIME_MODE.SNAPSHOT_09;
    return modeSelector.value;
}

async function getEscalationSnapshotData(mode) {
    const sourceUrl = ESCALATION_SNAPSHOT_URLS[mode];
    if (!sourceUrl) return null;
    if (escalationDataCache.has(sourceUrl)) {
        return escalationDataCache.get(sourceUrl);
    }
    const response = await fetch(sourceUrl);
    let data;
    if (sourceUrl.toLowerCase().endsWith('.csv')) {
        const csvText = await response.text();
        data = parseEscalationStatusCsv(csvText);
    } else {
        data = await response.json();
    }
    escalationDataCache.set(sourceUrl, data);
    return data;
}

function parseEscalationStatusCsv(csvText) {
    const lines = csvText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if (lines.length < 2) {
        return { type: 'FeatureCollection', features: [] };
    }

    const header = lines[0].split(',').map(cell => cell.trim().toLowerCase());
    const latIndex = header.indexOf('lat');
    const lonIndex = header.indexOf('lon');
    const statusIndex = header.indexOf('status');

    if (latIndex === -1 || lonIndex === -1 || statusIndex === -1) {
        console.error('combined_cs_status.csv is missing required headers: lat, lon, status');
        return { type: 'FeatureCollection', features: [] };
    }

    const features = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(',').map(cell => cell.trim());
        const lat = Number(cells[latIndex]);
        const lon = Number(cells[lonIndex]);
        const status = cells[statusIndex];

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            continue;
        }

        features.push({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [lon, lat]
            },
            properties: {
                lat,
                lon,
                status
            }
        });
    }

    return {
        type: 'FeatureCollection',
        name: 'combined_cs_status',
        features
    };
}

function getEscalationFeatureKey(feature) {
    const props = feature?.properties || {};
    const primary = props.globalid || props.old_global_id || props.P_Code;
    if (primary) return String(primary).trim().toLowerCase();

    const name = String(props.shelter_name || '').trim().toLowerCase();
    const district = String(props.district_name || '').trim().toLowerCase();
    const village = String(props.villages || '').trim().toLowerCase();
    const coordinates = feature?.geometry?.coordinates || [];
    return `${name}|${district}|${village}|${coordinates[0] || ''}|${coordinates[1] || ''}`;
}

function buildEscalationStatusDiff(oldSnapshot, newSnapshot) {
    const oldFeatures = oldSnapshot?.features || [];
    const newFeatures = newSnapshot?.features || [];
    const oldByKey = new Map(oldFeatures.map((feature) => [getEscalationFeatureKey(feature), feature]));
    const newByKey = new Map(newFeatures.map((feature) => [getEscalationFeatureKey(feature), feature]));

    const changedFeatures = [];

    newByKey.forEach((newFeature, key) => {
        const oldFeature = oldByKey.get(key);
        const newStatus = String(newFeature?.properties?.status || '').toLowerCase();

        if (!oldFeature) {
            changedFeatures.push({
                ...newFeature,
                properties: {
                    ...(newFeature.properties || {}),
                    changeType: 'added',
                    status_old: null,
                    status_new: newFeature?.properties?.status ?? null
                }
            });
            return;
        }

        const oldStatus = String(oldFeature?.properties?.status || '').toLowerCase();
        if (newStatus !== oldStatus) {
            changedFeatures.push({
                ...newFeature,
                properties: {
                    ...(newFeature.properties || {}),
                    changeType: 'status_changed',
                    status_old: oldFeature?.properties?.status ?? null,
                    status_new: newFeature?.properties?.status ?? null
                }
            });
        }
    });

    oldByKey.forEach((oldFeature, key) => {
        if (newByKey.has(key)) return;

        changedFeatures.push({
            ...oldFeature,
            properties: {
                ...(oldFeature.properties || {}),
                changeType: 'removed',
                status_old: oldFeature?.properties?.status ?? null,
                status_new: null
            }
        });
    });

    return {
        type: 'FeatureCollection',
        name: 'CS_DATA_09_03_26_to_10_03_26_status_diff',
        features: changedFeatures
    };
}

async function getEscalationDataForCurrentMode() {
    const mode = getEscalationTimeMode();
    if (mode === ESCALATION_TIME_MODE.DIFF_09_10) {
        const [oldSnapshot, newSnapshot] = await Promise.all([
            getEscalationSnapshotData(ESCALATION_TIME_MODE.SNAPSHOT_09),
            getEscalationSnapshotData(ESCALATION_TIME_MODE.SNAPSHOT_10)
        ]);
        return buildEscalationStatusDiff(oldSnapshot, newSnapshot);
    }
    return getEscalationSnapshotData(mode);
}

function getEscalationLegendConfig(mode) {
    if (mode === ESCALATION_TIME_MODE.DIFF_09_10) {
        return {
            layerName: 'Collective Shelters: Status Change (09/03/26 -> 10/03/26) - cluster color = dominant type',
            type: 'categorical',
            items: [
                { label: 'Status changed', color: '#f39c12' },
                { label: 'Added in 10/03/26', color: '#2ecc71' },
                { label: 'Removed since 09/03/26', color: '#e74c3c' }
            ]
        };
    }

    if (mode === ESCALATION_TIME_MODE.COMBINED) {
        return {
            layerName: 'Collective Shelters Status (Combined) - cluster color = dominant type',
            type: 'categorical',
            items: [
                { label: 'Open', color: '#2ecc71' },
                { label: 'Full', color: '#f39c12' },
                { label: 'Potential', color: '#8e44ad' }
            ]
        };
    }

    return {
        layerName: mode === ESCALATION_TIME_MODE.SNAPSHOT_10
            ? 'Collective Shelters Status (10/03/26) - cluster color = dominant type'
            : 'Collective Shelters Status (09/03/26) - cluster color = dominant type',
        type: 'categorical',
        items: [
            { label: 'Open', color: '#2ecc71' },
            { label: 'Full', color: '#f39c12' },
            { label: 'Potential', color: '#8e44ad' },
            { label: 'Other', color: '#3498db' }
        ]
    };
}

async function loadEscalationLayer(map, layers, config, addLegendEntry) {
    const escalationData = await getEscalationDataForCurrentMode();
    const pointOptions = {
        selectorId: config.selectorId,
        attributeSelector: config.attributeSelector,
        colorRampSelector: config.colorRampSelector,
        pointToLayer: config.pointToLayer,
        tooltipFunction: config.tooltipFunction,
        clusterOptions: config.clusterOptions,
        data: escalationData
    };

    if (layers.point.escalationLayer) {
        map.removeLayer(layers.point.escalationLayer);
    }

    layers.point.escalationLayer = await loadPointLayer(config.url, pointOptions);
    layers.point.escalationLayer.addTo(map);

    const selector = document.getElementById(config.selectorId);
    if (selector) {
        const hasStatusOption = Array.from(selector.options).some(option => option.value === 'status');
        if (hasStatusOption) {
            selector.value = 'status';
        }
    }

    const mode = getEscalationTimeMode();
    addLegendEntry('escalationLayer', getEscalationLegendConfig(mode));

    // Keep info panel in sync with the latest escalation layer instance.
    if (window.currentInfoPanel) {
        const rawFeatures = layers.point.escalationLayer?.layerData?.raw?.features;
        const featureCount = Array.isArray(rawFeatures) ? rawFeatures.length : 0;
        window.currentInfoPanel.updateLayer('escalationLayer', {
            layer: layers.point.escalationLayer,
            featureCount,
            selectedAttribute: 'status'
        });
    }
}

/**
 * Build popup HTML for a school (escalation) feature. Splits numeric vs qualitative, skips NA/null/empty.
 * @param {Object} properties - Feature properties
 * @returns {string} HTML string for popup
 */
function buildEscalationPopupContent(properties) {
    const naValues = new Set([null, undefined, '', 'NA', 'N/A', 'na', 'n/a', 'null', 'NULL', 'NaN']);
    const isNA = (v) => naValues.has(v) || (typeof v === 'number' && isNaN(v));
    const toLabel = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const numeric = [];
    const qualitative = [];

    for (const [key, value] of Object.entries(properties)) {
        if (isNA(value)) continue;
        const label = toLabel(key);
        const numVal = typeof value === 'number' ? value : Number(value);
        const isNumeric = typeof value === 'number' && !isNaN(value) || (typeof value === 'string' && value.trim() !== '' && !isNaN(numVal) && isFinite(numVal));
        if (isNumeric && (typeof value === 'number' || !isNaN(numVal))) {
            const display = typeof value === 'number'
                ? (Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2))
                : (Number.isInteger(numVal) ? numVal.toLocaleString() : numVal.toFixed(2));
            numeric.push({ label, value: display });
        } else {
            qualitative.push({ label, value: String(value).trim() });
        }
    }

    let html = '<div class="escalation-popup-content">';
    if (qualitative.length > 0) {
        html += '<div class="popup-section"><strong>Details</strong><ul>';
        qualitative.forEach(({ label, value }) => {
            html += `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`;
        });
        html += '</ul></div>';
    }
    if (numeric.length > 0) {
        html += '<div class="popup-section"><strong>Statistics</strong><ul>';
        numeric.forEach(({ label, value }) => {
            html += `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`;
        });
        html += '</ul></div>';
    }
    if (qualitative.length === 0 && numeric.length === 0) {
        html += '<p>No data available.</p>';
    }
    html += '</div>';
    return html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Setup Escalation dropdown behaviour
 */
function setupEscalationControls(map, layers, config) {
    const selector = document.getElementById(config.selectorId);
    const opacitySlider = document.getElementById(config.opacityControl);
    const opacityDisplay = document.getElementById(config.opacityDisplay);
    const timeModeSelector = document.getElementById(ESCALATION_TIME_MODE_CONTROL);
    
    if (selector) {
        // Prefer "status" as default if present
        selector.addEventListener('change', () => {
            if (selector.value !== 'status' || !layers.point.escalationLayer) return;
            layers.point.escalationLayer.eachLayer(layer => {
                if (typeof layer.setStyle !== 'function') return;
                layer.setStyle({ fillColor: getEscalationMarkerColor(layer.feature?.properties || {}) });
            });
        });
    }

    if (timeModeSelector) {
        timeModeSelector.addEventListener('change', async () => {
            const escCheckbox = document.getElementById('escalationLayer');
            if (!escCheckbox?.checked) return;
            if (!window.addLegendEntry) return;

            await loadEscalationLayer(map, layers, config, window.addLegendEntry);
            if (window.currentInfoPanel && layers.point.escalationLayer?.layerData?.raw?.features) {
                window.currentInfoPanel.updateLayer('escalationLayer', {
                    featureCount: layers.point.escalationLayer.layerData.raw.features.length
                });
            }
        });
    }
    
    if (opacitySlider && opacityDisplay) {
        opacitySlider.addEventListener('input', function() {
            const value = Math.round(this.value * 100);
            opacityDisplay.textContent = `${value}%`;
            
            if (layers.point.escalationLayer) {
                layers.point.escalationLayer.eachLayer(layer => {
                    if (typeof layer.setStyle !== 'function') return;
                    layer.setStyle({
                        fillOpacity: parseFloat(this.value),
                        opacity: parseFloat(this.value)
                    });
                });
            }
        });
    }
}

function getRoadStatusColor(statusValue) {
    const status = String(statusValue || '').trim().toLowerCase();
    if (status === 'not passable') return '#b30000';
    if (status === 'passable with restrictions/damaged') return '#f39c12';
    if (status === 'passable/undamaged') return '#35a140';
    return '#7f8c8d';
}

function getRoadStatusLegendConfig() {
    return {
        layerName: 'Road Access Status',
        type: 'categorical',
        items: [
            { label: 'Not Passable', color: '#b30000' },
            { label: 'Passable with restrictions/Damaged', color: '#f39c12' },
            { label: 'Passable/Undamaged', color: '#35a140' }
        ]
    };
}

function getTTFTensionColor(value) {
    const tension = String(value || '').trim().toLowerCase();
    if (tension === 'high') return '#d7301f';
    if (tension === 'moderate') return '#f98e2b';
    if (tension === 'low') return '#ffe04d';
    if (tension === 'no tension/no record' || tension === 'no tension') return '#d3d3d3';
    return '#d3d3d3';
}

function getTTFHotspotsLegendConfig() {
    return {
        layerName: 'TTF Hotspots (Q1 2026)',
        type: 'categorical',
        items: [
            { label: 'No Tension', color: '#d3d3d3' },
            { label: 'Low', color: '#ffe04d' },
            { label: 'Moderate', color: '#f98e2b' },
            { label: 'High', color: '#d7301f' }
        ]
    };
}
/**
 * Setup vector layer attribute controls
 */
function setupVectorControls(layerId, map, layers, config, addLegendEntry, updateLegend) {
    // Setup color ramp selector (if this layer exposes one in the UI)
    if (config.colorRampSelector && config.colorRampPreview) {
        setupColorRampSelector(config.colorRampSelector, config.colorRampPreview, () => {
            updateVectorLayerFromControls(layerId, layers, addLegendEntry, updateLegend);
        });
    }
    
    // Setup attribute selector change event
    const attributeSelector = document.getElementById(config.attributeSelector);
    if (attributeSelector) {
        attributeSelector.addEventListener('change', () => {
            updateVectorLayerFromControls(layerId, layers, addLegendEntry, updateLegend);
        });
    }
}

/**
 * Update vector layer based on selected attribute and color ramp
 */
function updateVectorLayerFromControls(layerId, layers, addLegendEntry, updateLegend) {
    const config = layerConfig[layerId];
    if (!config || !layers.vector[layerId]) return;
    
    // Get selected attribute
    const attributeSelector = document.getElementById(config.attributeSelector);
    if (!attributeSelector || !attributeSelector.value) return;
    
    const selectedRampId = config.fixedColorRamp || (() => {
        const colorRampSelector = document.getElementById(config.colorRampSelector);
        return colorRampSelector?.value || '';
    })();
    if (!selectedRampId) return;

    const colorRamp = getColorRamp(selectedRampId);
    if (!colorRamp) return;
    
    // Get opacity value
    const opacitySlider = document.getElementById(config.opacityControl);
    const opacity = opacitySlider ? parseFloat(opacitySlider.value) : 0.5;
    
    const updateLegendForLayer = (layerName, colorScheme, description, labels) => {
        addLegendEntry(layerId, { layerName, colorScheme, description, labels });
    };
    
    // Update the layer style
    updateVectorLayerStyle(
        layers.vector[layerId], 
        attributeSelector.value, 
        colorRamp, 
        opacity, 
        updateLegendForLayer,
        { skipTooltips: config.type === 'sv-vector' }
    );
    applySVPolygonOutlineStyle(layers.vector[layerId], config);
    reapplySelectedPolygonHighlight(layerId);
    if (window.currentInfoPanel) {
        window.currentInfoPanel.updateLayer(layerId, {
            selectedAttribute: attributeSelector.value,
            colorRamp: colorRamp.name || selectedRampId,
            opacity: opacity
        });
    }
}

function applySVPolygonOutlineStyle(vectorLayer, config = null) {
    if (!vectorLayer || typeof vectorLayer.eachLayer !== 'function') return;
    const isCadastre = Boolean(config?.thinBoundaries);
    const isPeaceCadastre = isCadastre && config?.layerType === 'sv-admin3';
    vectorLayer.eachLayer(featureLayer => {
        if (typeof featureLayer?.setStyle !== 'function') return;
        featureLayer.setStyle({
            weight: isPeaceCadastre
                ? SV_OUTLINE_PEACE_CADASTRE_WEIGHT
                : (isCadastre ? SV_OUTLINE_CADASTRE_WEIGHT : SV_OUTLINE_WEIGHT),
            color: isPeaceCadastre
                ? SV_OUTLINE_PEACE_CADASTRE_COLOR
                : (isCadastre ? SV_OUTLINE_CADASTRE_COLOR : SV_OUTLINE_COLOR),
            opacity: isPeaceCadastre
                ? SV_OUTLINE_PEACE_CADASTRE_OPACITY
                : (isCadastre ? SV_OUTLINE_CADASTRE_OPACITY : SV_OUTLINE_OPACITY)
        });
    });
}

/**
 * Setup layer toggle functionality for a specific layer
 */
function setupLayerToggle(layerId, map, layers, colorScales, addLegendEntry, removeLegendEntry) {
    const checkbox = document.getElementById(layerId);
    if (!checkbox) return;
    
    const config = layerConfig[layerId];
    if (!config) return;
    
    checkbox.addEventListener('change', async function() {
        if (this.checked) {
            if (layerId === 'vulnerabilityCadastreLayer') {
                document.querySelectorAll('input[name="svLayer"]:checked').forEach(cb => {
                    if (cb.disabled) return;
                    cb.checked = false;
                    cb.dispatchEvent(new Event('change'));
                });
            }
            try {
                await loadLayer(layerId, map, layers, colorScales, addLegendEntry);
                
                // If vector layer, populate attribute selector
                if (config.type === 'vector' && config.attributeSelector && layers.vector[layerId]) {
                    populateAttributeSelector(layers.vector[layerId], config.attributeSelector);
                    updateVectorLayerFromControls(layerId, layers, addLegendEntry, null);
                    
                    // Add this block to generate labels for admin boundaries
                    if (layerId === 'geojsonLayer' && layers.labels) {
                        // This is the admin level 1 layer
                        generateAdminLabels(layers.vector[layerId], 'adm1', layers.labels.adm1);
                    } else if (layerId === 'geojsonLayer2' && layers.labels) {
                        // This is the admin level 2 layer
                        generateAdminLabels(layers.vector[layerId], 'adm2', layers.labels.adm2);
                    }
                }
            } catch (error) {
                console.error(`Error loading layer ${layerId}:`, error);
                this.checked = false;
            }
        } else {
            removeLayer(layerId, map, layers, removeLegendEntry);
        }
    });
}

/**
 * Update point layer based on selected attribute and color ramp
 */
function updatePointLayerFromControls(layerId, layers, addLegendEntry, updateLegend) {
    const config = layerConfig[layerId];
    if (!config || !layers.point[layerId]) return;
    
    // Get selected attribute
    const attributeSelector = document.getElementById(config.attributeSelector);
    if (!attributeSelector || !attributeSelector.value) return;
    
    // Get selected color ramp
    const colorRampSelector = document.getElementById(config.colorRampSelector);
    if (!colorRampSelector || !colorRampSelector.value) return;
    
    const colorRamp = getColorRamp(colorRampSelector.value);
    if (!colorRamp) return;
    
    // Get opacity value
    const opacitySlider = document.getElementById(config.opacityControl);
    const opacity = opacitySlider ? parseFloat(opacitySlider.value) : 1;
    
    const updateLegendForLayer = (layerName, colorScheme, description, labels) => {
        addLegendEntry(layerId, { layerName, colorScheme, description, labels });
    };
    
    // Update the point layer style
    updatePointLayerStyle(
        layers.point[layerId], 
        attributeSelector.value, 
        colorRamp, 
        opacity, 
        updateLegendForLayer
    );
}

/**
 * Load a layer by ID
 */
async function loadLayer(layerId, map, layers, colorScales, addLegendEntry) {
    const config = layerConfig[layerId];
    
    switch (config.type) {
        case 'vector':
            if (!layers.vector[layerId]) {
                layers.vector[layerId] = await loadVectorLayer(config.url, { style: config.style });
                
                // Add info popup handler for all vector layers
                addInfoPopupHandler(layers.vector[layerId], config.layerType || 'default');
                attachPolygonSelectionHandlers(layerId, layers.vector[layerId], layers, config);
            }
            layers.vector[layerId].addTo(map);
            reapplySelectedPolygonHighlight(layerId);
            if (layerId === 'roadStatusLayer') {
                addLegendEntry(layerId, getRoadStatusLegendConfig());
            }
            if (layerId === 'ttfHotspotsLayer') {
                addLegendEntry(layerId, getTTFHotspotsLegendConfig());
            }
            keepRoadLayerOnTop(layers);
            break;
            
        case 'point':
            if (layerId === 'escalationLayer') {
                await loadEscalationLayer(map, layers, config, addLegendEntry);
                keepRoadLayerOnTop(layers);
                break;
            }

            if (!layers.point[layerId]) {
                const pointOptions = { 
                    selectorId: config.selectorId,
                    attributeSelector: config.attributeSelector,
                    colorRampSelector: config.colorRampSelector
                };
                
                if (config.pointToLayer) {
                    pointOptions.pointToLayer = config.pointToLayer;
                }
                if (config.tooltipFunction) {
                    pointOptions.tooltipFunction = config.tooltipFunction;
                }
                if (config.clusterOptions) {
                    pointOptions.clusterOptions = config.clusterOptions;
                }
                
                layers.point[layerId] = await loadPointLayer(config.url, pointOptions);
            }
            layers.point[layerId].addTo(map);
            keepRoadLayerOnTop(layers);
            break;
            
        case 'raster':
            // Verify color scale exists
            const selectedColorScale = colorScales[config.colorScale];
            if (!selectedColorScale) {
                throw new Error(`Color scale '${config.colorScale}' not found for layer ${layerId}`);
            }
            
            if (!layers.tiff[layerId]) {
                await loadTiff(config.url, layerId, layers.tiff, map, selectedColorScale);
                console.log(`Raster Layer ${layerId} loaded:`, {
                    url: config.url,
                    bounds: layers.tiff[layerId] ? layers.tiff[layerId].getBounds() : 'N/A'
                });
            } else {
                layers.tiff[layerId].addTo(map);
            }
            
            // Add legend entry for raster layers
            addLegendEntry(layerId, {
                layerName: config.legendTitle,
                colorScheme: selectedColorScale.colors,
                description: config.legendDescription,
                labels: config.legendLabels
            });
            keepRoadLayerOnTop(layers);
            break;
    }
    if (window.currentInfoPanel) {
        const layerInfo = {
            id: layerId,
            name: getLayerDisplayName(layerId, config),
            type: config.type,
            opacity: getLayerOpacity(layerId, config),
            layer: layers.vector[layerId] || layers.point[layerId] || layers.tiff[layerId]
        };
        
        if (config.type === 'vector' || config.type === 'point') {
            if (layerInfo.layer?.layerData?.raw?.features) {
                layerInfo.featureCount = layerInfo.layer.layerData.raw.features.length;
            } else {
                let featureCount = 0;
                layerInfo.layer.eachLayer(() => featureCount++);
                layerInfo.featureCount = featureCount;
            }
        }
        
        window.currentInfoPanel.addLayer(layerId, layerInfo);
    }
}


/**
 * Remove a layer by ID
 */
function removeLayer(layerId, map, layers, removeLegendEntry) {
    const config = layerConfig[layerId];
    
    switch (config.type) {
        case 'vector':
            if (layers.vector[layerId]) {
                clearPolygonSelection(layerId, layers);
                map.removeLayer(layers.vector[layerId]);
                removeLegendEntry(layerId);
            }
            break;
            
        case 'point':
            if (layers.point[layerId]) {
                map.removeLayer(layers.point[layerId]);
                removeLegendEntry(layerId);
            }
            break;
            
        case 'raster':
            if (layers.tiff[layerId]) {
                map.removeLayer(layers.tiff[layerId]);
                const statsContainer = document.getElementById('stats-container');
                if (statsContainer) {
                    statsContainer.style.display = 'none';
                }
                removeLegendEntry(layerId);
            }
            break;
    }
    if (window.currentInfoPanel) {
        window.currentInfoPanel.removeLayer(layerId);
    }
}

/**
 * Setup opacity control for a layer
 */
function setupOpacityControl(sliderId, displayId, layerId, layers, addLegendEntry, updateLegend) {
    const slider = document.getElementById(sliderId);
    const display = document.getElementById(displayId);
    if (!slider || !display) return;
    
    slider.addEventListener('input', function() {
        // Update display
        const value = Math.round(this.value * 100);
        display.textContent = `${value}%`;
        
        // Update layer opacity
        const config = layerConfig[layerId];
        if (!config) return;
        
        updateLayerOpacity(config.type, layerId, layers, this.value, addLegendEntry, updateLegend);
    });
}

/**
 * Update a layer's opacity based on type
 */
function updateLayerOpacity(layerType, layerId, layers, opacity, addLegendEntry, updateLegend) {
    switch (layerType) {
        case 'raster':
            if (layers.tiff[layerId]) {
                layers.tiff[layerId].setOpacity(opacity);
            }
            break;
            
        case 'vector':
            if (!layers.vector[layerId]) return;
            const config = layerConfig[layerId];
            const attributeSelector = config?.attributeSelector
                ? document.getElementById(config.attributeSelector)
                : null;
            const hasSelectedAttribute = Boolean(attributeSelector?.value);
            
            // Apply basic opacity
            layers.vector[layerId].setStyle({ 
                fillOpacity: (config?.thinBoundaries && !hasSelectedAttribute) ? 0 : opacity,
                fillColor: (config?.thinBoundaries && !hasSelectedAttribute) ? 'transparent' : undefined,
                opacity: opacity 
            });
            
            // Update color-based styling if configured
            if (config.attributeSelector && config.colorRampSelector) {
                const colorRampSelector = document.getElementById(config.colorRampSelector);
                
                if (attributeSelector && attributeSelector.value && 
                    colorRampSelector && colorRampSelector.value) {
                    updateVectorLayerFromControls(layerId, layers, addLegendEntry, updateLegend);
                }
            }
            break;
            
        case 'point':
            if (layers.point[layerId]) {
                if (typeof layers.point[layerId].setStyle === 'function') {
                    layers.point[layerId].setStyle({
                        fillOpacity: opacity,
                        opacity: opacity
                    });
                } else if (typeof layers.point[layerId].eachLayer === 'function') {
                    layers.point[layerId].eachLayer((childLayer) => {
                        if (typeof childLayer.setStyle !== 'function') return;
                        childLayer.setStyle({
                            fillOpacity: opacity,
                            opacity: opacity
                        });
                    });
                }
                
                // Update color-based styling if configured
                const config = layerConfig[layerId];
                if (config.attributeSelector && config.colorRampSelector) {
                    updatePointLayerFromControls(layerId, layers, addLegendEntry, updateLegend);
                }
            }
            break;
    }
}
/**
 * Get display name for a layer
 */
function getLayerDisplayName(layerId, config) {
    if (config?.legendName && /^svAdmin\dLayer$/.test(layerId)) {
        return config.legendName;
    }
    const nameMap = {
        'geojsonLayer': 'Statistics: Municipality',
        'geojsonLayer2': 'Statistics: mohafaza',
        'geojsonLayer3': 'Statistics: Cadastre',
        'svOverallTensionLayer': 'Overall Vulnerability Index',
        'svAdmin1Layer': 'Displacement Pressure',
        'svAdmin2Layer': 'Economic Vulnerability',
        'svAdmin3Layer': 'Tension and Conflict Risk',
        'svAdmin4Layer': 'Service & Infrastructure Vulnerability',
        'svAdmin5Layer': 'Demographic Shock Factor',
        'streetNetworkLayer': 'Street Network',
        'roadStatusLayer': 'Road Access Status',
        'ttfHotspotsLayer': 'TTF Hotspots (Q1 2026)',
        'vulnerabilityCadastreLayer': 'Vulnerability: Cadastre',
        'pointLayer': 'Household Survey Statistics',
        'pointLayer2': 'Cities',
        'escalationLayer': 'Collective Shelters',
        'tiffLayer1': 'Cell Tower Density',
        'tiffLayer2': 'Population Density',
        'tiffLayer3': 'Social Vulnerability',
        'tiffLayer4': 'Relative Wealth',
        'tiffLayer5': 'Nightlight Intensity',
        'tiffLayer6': 'NDVI',
        'tiffLayer7': 'Conflicts',
        'tiffLayer8': 'Temperature'
    };
    
    return nameMap[layerId] || layerId;
}

/**
 * Get opacity value for a layer
 */
function getLayerOpacity(layerId, config) {
    if (config.opacityControl) {
        const slider = document.getElementById(config.opacityControl);
        return slider ? parseFloat(slider.value) : 1;
    }
    return 1;
}

function attachPolygonSelectionHandlers(layerId, vectorLayer, layers, config) {
    if (!vectorLayer || typeof vectorLayer.eachLayer !== 'function') return;

    vectorLayer.eachLayer(featureLayer => {
        if (featureLayer._selectionHandlerAttached) {
            return;
        }

        featureLayer.on('click', async () => {
            await handlePolygonSelection(layerId, vectorLayer, featureLayer, layers, config);
        });
        featureLayer._selectionHandlerAttached = true;
    });
}

async function handlePolygonSelection(layerId, vectorLayer, selectedLayer, layers, config) {
    const previousSelection = selectedPolygonByLayer.get(layerId);
    const previousSelected = previousSelection?.featureLayer;

    if (previousSelected && previousSelected !== selectedLayer) {
        restoreSelectedStyle(previousSelection);
    }

    if (previousSelected === selectedLayer) {
        restoreSelectedStyle(previousSelection);
        selectedPolygonByLayer.delete(layerId);
        updateSelectedPolygonInfoPanel(layerId, null, config);
        hideInfoPopup();
        return;
    }

    const baseStyle = captureFeatureStyle(selectedLayer);
    applySelectedStyle(selectedLayer);
    keepRoadLayerOnTop(layers);
    selectedPolygonByLayer.set(layerId, { featureLayer: selectedLayer, baseStyle });
    await updateSelectedPolygonInfoPanel(layerId, selectedLayer.feature?.properties || null, config, layers);
}

function keepRoadLayerOnTop(layers) {
    const roadLayer = layers?.vector?.roadStatusLayer;
    if (roadLayer && typeof roadLayer.bringToFront === 'function') {
        roadLayer.bringToFront();
    }
    const ttfLayer = layers?.vector?.ttfHotspotsLayer;
    if (ttfLayer && typeof ttfLayer.bringToFront === 'function') {
        ttfLayer.bringToFront();
    }
}

function applySelectedStyle(featureLayer) {
    if (typeof featureLayer?.setStyle !== 'function') return;

    featureLayer.setStyle({
        color: '#f59e0b',
        weight: 3,
        fillOpacity: 0.8
    });

    // Ensure the selected polygon border is drawn above adjacent boundaries.
    if (typeof featureLayer.bringToFront === 'function') {
        featureLayer.bringToFront();
    }
}

function captureFeatureStyle(featureLayer) {
    const options = featureLayer?.options || {};
    const styleKeys = [
        'color',
        'weight',
        'opacity',
        'fillColor',
        'fillOpacity',
        'dashArray',
        'fill'
    ];
    const baseStyle = {};

    styleKeys.forEach(key => {
        if (options[key] !== undefined) {
            baseStyle[key] = options[key];
        }
    });

    return baseStyle;
}

function restoreSelectedStyle(selectionState) {
    const featureLayer = selectionState?.featureLayer;
    const baseStyle = selectionState?.baseStyle;
    if (!featureLayer || typeof featureLayer.setStyle !== 'function' || !baseStyle) return;

    featureLayer.setStyle(baseStyle);
}

function refreshSelectedBaseStyle(layerId) {
    const selectionState = selectedPolygonByLayer.get(layerId);
    const featureLayer = selectionState?.featureLayer;
    if (!featureLayer) return;

    selectionState.baseStyle = captureFeatureStyle(featureLayer);
    selectedPolygonByLayer.set(layerId, selectionState);
}

function resetSelectedStyle(vectorLayer, featureLayer) {
    if (typeof vectorLayer?.resetStyle === 'function') {
        vectorLayer.resetStyle(featureLayer);
    }
}

function reapplySelectedPolygonHighlight(layerId) {
    refreshSelectedBaseStyle(layerId);

    const selectedLayer = selectedPolygonByLayer.get(layerId)?.featureLayer;
    if (selectedLayer) {
        applySelectedStyle(selectedLayer);
    }
}

function clearPolygonSelection(layerId, layers) {
    const selectionState = selectedPolygonByLayer.get(layerId);
    if (!selectionState) return;

    restoreSelectedStyle(selectionState);
    selectedPolygonByLayer.delete(layerId);
    updateSelectedPolygonInfoPanel(layerId, null, null);
    hideInfoPopup();
}

function getSelectedFeatureName(properties) {
    if (!properties) return 'Selected polygon';

    const nameFields = [
        'ADM2_NAME',
        'Districts',
        'NAME_2',
        'District',
        'Cercle/District',
        'NAME_3',
        'NAME_1',
        'name',
        'Name',
        'NAME'
    ];
    for (const field of nameFields) {
        if (properties[field]) {
            return String(properties[field]).trim();
        }
    }
    return 'Selected polygon';
}

function getSVHoverFeatureName(parts, layerId, config) {
    const isCadastreView = parts?.ADM3_NAME || (config?.svAttribute === 'composite_score' && config?.url?.includes('cadastre'));
    const featureName = isCadastreView
        ? (parts?.ADM3_NAME || getSelectedFeatureName(parts))
        : getSelectedFeatureName(parts);

    return {
        label: isCadastreView ? 'Cadastre name' : 'District name',
        name: featureName || 'Selected polygon'
    };
}

function updateSVHoverTooltips(layer, layerId, config) {
    if (!layer || typeof layer.eachLayer !== 'function') return;

    const target =
        layer._svDisplacementMarkerLayer ||
        layer._svSectarianMarkerLayer ||
        layer;

    target.eachLayer(featureLayer => {
        const props = featureLayer?.feature?.properties;
        if (!props || typeof featureLayer.bindTooltip !== 'function') return;

        const { label, name } = getSVHoverFeatureName(props, layerId, config);
        const tooltipText = `${label}: ${name}`;
        if (featureLayer._svHoverTooltipText === tooltipText) return;
        featureLayer.unbindTooltip();
        featureLayer.bindTooltip(tooltipText, {
            permanent: false,
            direction: 'top'
        });
        featureLayer._svHoverTooltipText = tooltipText;
    });
}

async function updateSelectedPolygonInfoPanel(layerId, properties, config, layers = null) {
    if (!window.currentInfoPanel) return;

    if (!properties) {
        window.currentInfoPanel.updateLayer(layerId, { selectedFeature: null });
        return;
    }

    const selectedFeature = {
        name: getSelectedFeatureName(properties)
    };

    const attributeName = getSelectionAttributeFromConfig(config, layerId);
    if (attributeName && properties[attributeName] !== undefined && properties[attributeName] !== null) {
        selectedFeature.attribute = getSelectionAttributeLabel(layerId, config, attributeName);
        selectedFeature.value = properties[attributeName];
    }

    if (layers && SV_PILLAR_DEFINITIONS.some(pillar => pillar.layerId === layerId)) {
        const pillarBreakdown = await getSVPillarBreakdown(properties, layers);
        if (pillarBreakdown) {
            selectedFeature.pillarBreakdown = pillarBreakdown;
        }
    }

    window.currentInfoPanel.updateLayer(layerId, { selectedFeature });
}

function getSelectionAttributeFromConfig(config, layerId = null) {
    if (!config) return null;

    if (layerId === 'svAdmin2Layer' || layerId === 'svAdmin3Layer' || layerId === 'svAdmin5Layer') {
        return getEffectiveChoroplethAttribute(layerId, config);
    }

    if (config.svAttribute) {
        return config.svAttribute;
    }

    if (config.attributeSelector) {
        const selector = document.getElementById(config.attributeSelector);
        if (selector && selector.value) {
            return selector.value;
        }
    }

    return null;
}

function getSelectionAttributeLabel(layerId, config, attributeName) {
    if (!config) return attributeName;

    if (layerId === 'svAdmin5Layer') {
        const opt = getDemographicSubindicatorOptions().find(o => o.value === attributeName);
        if (opt) return opt.label;
    }
    if (layerId === 'svAdmin2Layer') {
        const opt = getEconomicSubindicatorOptions().find(o => o.value === attributeName);
        if (opt) return opt.label;
    }
    if (layerId === 'svAdmin3Layer') {
        const opt = PEACE_CADASTRE_SUBINDICATOR_OPTIONS.find(o => o.value === attributeName);
        if (opt) return opt.label;
    }

    // For composite index layers, use the active layer name instead of raw field names.
    if (config.type === 'sv-vector' && config.svAttribute) {
        return `${getLayerDisplayName(layerId, config)} (score)`;
    }

    return attributeName;
}

function getFeatureLookupKey(properties) {
    if (!properties) return null;

    const candidateFields = ['ADM2_NAME', 'NAME_2', 'NAME_1', 'NAME_3', 'name', 'Name'];
    for (const field of candidateFields) {
        if (properties[field] !== undefined && properties[field] !== null) {
            const normalized = String(properties[field]).trim().toLowerCase();
            if (normalized) return normalized;
        }
    }

    return null;
}

async function getSVLayerLookup(layerId, layers) {
    if (svPillarLookupCache.has(layerId)) {
        return svPillarLookupCache.get(layerId);
    }

    const config = layerConfig[layerId];
    if (!config) return null;

    let sourceFeatures = [];
    const loadedLayer = layers?.vector?.[layerId];
    if (loadedLayer?.layerData?.raw?.features) {
        sourceFeatures = loadedLayer.layerData.raw.features;
    } else {
        try {
            const response = await fetch(config.url);
            const data = await response.json();
            sourceFeatures = data?.features || [];
        } catch (error) {
            console.error(`Failed to fetch layer data for ${layerId}:`, error);
            sourceFeatures = [];
        }
    }

    const lookup = new Map();
    sourceFeatures.forEach(feature => {
        const props = feature?.properties || {};
        const key = getFeatureLookupKey(props);
        if (!key) return;
        lookup.set(key, props);
    });

    svPillarLookupCache.set(layerId, lookup);
    return lookup;
}

async function getSVPillarBreakdown(properties, layers) {
    const featureKey = getFeatureLookupKey(properties);
    if (!featureKey) return null;

    const pillars = [];
    for (const pillar of SV_PILLAR_DEFINITIONS) {
        const lookup = await getSVLayerLookup(pillar.layerId, layers);
        const matchedProps = lookup?.get(featureKey);
        const rawValue = matchedProps?.[pillar.attribute];
        const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
        pillars.push({
            label: pillar.label,
            color: pillar.color,
            value: Number.isFinite(value) ? value : 0
        });
    }

    const total = pillars.reduce((sum, item) => sum + Math.max(0, item.value), 0);
    if (total <= 0) {
        return null;
    }

    return pillars.map(item => ({
        ...item,
        proportion: item.value > 0 ? item.value / total : 0
    }));
}