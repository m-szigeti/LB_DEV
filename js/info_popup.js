// info_popup.js - Information popup functionality

import { getPrimarySubindicator, getSelectedSubindicators } from './sv_subindicators.js';
import { getClassLabelForLayerValue, getQuantilePresentation } from './vector_layers.js';
import { getColorRamp } from './color_ramp_selector.js';

const VULNERABILITY_CLASS_LABELS = ['Low', 'Medium', 'High'];

/** Pillar scores shown in Additional Data (aligned with composite index names). */
const PILLAR_SCORE_FIELDS = [
    {
        field: 'overall_tension_index_score',
        label: 'Overall Vulnerability Index',
        colorRampId: 'yellowOrangeRed3'
    },
    {
        field: 'tension_peace_score',
        label: 'Tension and Conflict Risk',
        colorRampId: 'whiteToDarkPurple'
    },
    {
        field: 'displacement_pressure_score',
        label: 'Displacement Pressure',
        colorRampId: 'whiteToDarkGreen'
    },
    {
        field: 'economic_vulnerability_score',
        label: 'Socioeconomic Vulnerability',
        colorRampId: 'whiteToDarkBlue'
    }
];

const SV_LAYER_TYPE_TO_ID = {
    'sv-admin5': 'svAdmin5Layer',
    'sv-admin1': 'svAdmin1Layer',
    'sv-admin2': 'svAdmin2Layer',
    'sv-admin3': 'svAdmin3Layer'
};

/**
 * Initialize the information popup system
 */
export function initializeInfoPopup() {
    const popup = document.getElementById('info-popup');
    const closeBtn = document.getElementById('info-popup-close');
    const header = popup?.querySelector('.info-popup-header');
    
    if (!popup || !closeBtn) {
        console.error('Info popup elements not found');
        return;
    }
    
    // Close popup when clicking close button
    closeBtn.addEventListener('click', hideInfoPopup);
    
    // Close popup when clicking outside
    popup.addEventListener('click', function(e) {
        if (e.target === popup) {
            hideInfoPopup();
        }
    });
    
    // Close popup with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && popup.style.display !== 'none') {
            hideInfoPopup();
        }
    });

    // Make popup draggable from header.
    if (header) {
        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        const onMouseMove = (e) => {
            if (!isDragging) return;
            const margin = 8;
            const popupWidth = popup.offsetWidth;
            const popupHeight = popup.offsetHeight;
            const maxLeft = Math.max(margin, window.innerWidth - popupWidth - margin);
            const maxTop = Math.max(margin, window.innerHeight - popupHeight - margin);
            const left = Math.max(margin, Math.min(e.clientX - dragOffsetX, maxLeft));
            const top = Math.max(margin, Math.min(e.clientY - dragOffsetY, maxTop));
            popup.style.left = `${left}px`;
            popup.style.top = `${top}px`;
            popup.style.transform = 'none';
        };

        const stopDragging = () => {
            isDragging = false;
            document.body.style.removeProperty('user-select');
            document.body.style.removeProperty('cursor');
        };

        header.addEventListener('mousedown', (e) => {
            if (e.target === closeBtn || closeBtn.contains(e.target)) {
                return;
            }
            const rect = popup.getBoundingClientRect();
            popup.style.left = `${rect.left}px`;
            popup.style.top = `${rect.top}px`;
            popup.style.transform = 'none';
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
            isDragging = true;
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'move';
        });

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', stopDragging);
    }
}

/**
 * Show the information popup with data for a clicked feature
 * @param {Object} feature - GeoJSON feature object
 * @param {string} layerType - Type of layer (e.g., 'sv-admin1', 'sv-admin2', etc.)
 */
export function showInfoPopup(feature, layerType = 'default', clickEvent = null, sourceLayer = null) {
    const popup = document.getElementById('info-popup');
    const title = document.getElementById('info-popup-title');
    const body = document.getElementById('info-popup-body');
    
    if (!popup || !title || !body || !feature?.properties) {
        return;
    }
    
    // Set title based on layer type and available name fields
    const areaName = getAreaName(feature.properties, layerType);
    title.textContent = areaName || 'Area Information';
    
    // Generate content based on layer type
    const content = generatePopupContent(feature.properties, layerType, sourceLayer);
    body.innerHTML = content;
    
    // Show popup
    popup.style.display = 'block';

    positionInfoPopup(popup, clickEvent);
}

/**
 * Hide the information popup
 */
export function hideInfoPopup() {
    const popup = document.getElementById('info-popup');
    if (popup) {
        popup.style.display = 'none';
        popup.style.left = '';
        popup.style.top = '';
        popup.style.transform = '';
    }
}

/**
 * Position popup near click target while keeping it in viewport.
 * Falls back to centered positioning if click context is unavailable.
 */
function positionInfoPopup(popup, clickEvent = null) {
    if (!popup) return;

    const pointer = getPointerPosition(clickEvent);
    if (!pointer) {
        popup.style.left = '';
        popup.style.top = '';
        popup.style.transform = '';
        return;
    }

    const offsetX = 150;
    const offsetY = 18;
    const margin = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    popup.style.transform = 'none';

    const popupWidth = popup.offsetWidth;
    const popupHeight = popup.offsetHeight;

    let left = pointer.x + offsetX;
    let top = pointer.y - popupHeight - offsetY;

    // If there isn't enough room above the click point, place below it.
    if (top < margin) {
        top = pointer.y + offsetY;
    }

    // Clamp horizontally and vertically to remain visible.
    if (left + popupWidth > viewportWidth - margin) {
        left = pointer.x - popupWidth - offsetX;
    }
    left = Math.max(margin, Math.min(left, viewportWidth - popupWidth - margin));
    top = Math.max(margin, Math.min(top, viewportHeight - popupHeight - margin));

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
}

function getPointerPosition(clickEvent) {
    if (!clickEvent) return null;

    if (clickEvent.originalEvent &&
        typeof clickEvent.originalEvent.clientX === 'number' &&
        typeof clickEvent.originalEvent.clientY === 'number') {
        return {
            x: clickEvent.originalEvent.clientX,
            y: clickEvent.originalEvent.clientY
        };
    }

    if (typeof clickEvent.clientX === 'number' && typeof clickEvent.clientY === 'number') {
        return { x: clickEvent.clientX, y: clickEvent.clientY };
    }

    return null;
}

/**
 * Get the appropriate area name from properties
 * @param {Object} properties - Feature properties
 * @param {string} layerType - Type of layer
 * @returns {string} - Area name
 */
function getAreaName(properties, layerType) {
    // Priority order for name fields
    const nameFields = [
        'NAME_1', 'NAME_2', 'NAME_3',
        'Cercle/District', 'District', 'Commune',
        'name', 'Name', 'AREA_NAME',
        'ADM1_NAME', 'ADM2_NAME', 'ADM3_NAME'
    ];
    
    for (const field of nameFields) {
        if (properties[field] && properties[field].trim()) {
            return properties[field].trim();
        }
    }
    
    return 'Unknown Area';
}

/**
 * Generate popup content based on layer type and properties
 * @param {Object} properties - Feature properties
 * @param {string} layerType - Type of layer
 * @returns {string} - HTML content for popup
 */
function generatePopupContent(properties, layerType, sourceLayer = null) {
    let content = '';

    // Composite score section (if applicable)
    if (layerType.includes('sv-admin') || layerType === 'sv-overall' || getPrimaryVulnerabilityField(properties, layerType)) {
        content += generateSocialVulnerabilitySection(properties, layerType, sourceLayer);
    }
    
    // Statistics Section
    content += generateStatisticsSection(properties, layerType);
    
    // Additional Data Section
    content += generateAdditionalDataSection(properties, sourceLayer);
    
    return content || '<p class="info-no-data">No detailed information available for this area.</p>';
}

/**
 * Generate administrative information section
 * @param {Object} properties - Feature properties
 * @returns {string} - HTML content
 */
function generateAdministrativeSection(properties) {
    const adminFields = {
        'Country': ['COUNTRY', 'GID_0', 'NAME_0'],
        'Region/State': ['NAME_1', 'ADM1_NAME', 'REGION'],
        'District/Province': ['NAME_2', 'ADM2_NAME', 'Cercle/District'],
        'Administrative ID': ['GID_1', 'GID_2', 'GID_3', 'ADMIN_ID']
    };
    
    let content = '<div class="info-section"><h4>Administrative Information</h4>';
    let hasData = false;
    
    Object.entries(adminFields).forEach(([label, fields]) => {
        const value = getFirstAvailableValue(properties, fields);
        if (value) {
            content += createInfoItem(label, value);
            hasData = true;
        }
    });
    
    if (!hasData) {
        content += '<p class="info-no-data">No administrative information available.</p>';
    }
    
    content += '</div>';
    return content;
}

/** Cadastre peace CSV fields merged onto GeoJSON as peace_si_* (see utils/merge_peace_subindicators_into_cadastre.py). */
const PEACE_SUBINDICATOR_DEFS = [
    {
        key: 'peace_si_intersectarian_per_1k',
        label: 'Annual rate of UNDPTMS incidents tagged as “intersectarian” or “intercommunal” per 1000 residents'
    },
    {
        key: 'peace_si_battle_events_count',
        label: 'Number of incidents/events involving battles, explosions, violence against civilians, armed clashes, and airstrikes.'
    },
    {
        key: 'peace_si_ss_typology_non_state',
        label: 'Safety and Security typology incidents without state operations'
    },
    {
        key: 'peace_si_fatalities_per_1k_12m',
        label: 'Fatalities per 1000 residents in the last 12 months'
    },
    {
        key: 'peace_si_worry_travel_hh_share',
        label: 'Share of households who worry about travelling to key destinations within Lebanon safely'
    },
    {
        key: 'peace_si_unsafe_night_pct',
        label: '% of population reporting feeling "unsafe" or "very unsafe" in their neighborhoods during the night'
    }
];

function buildPeaceSubindicatorsInfoItems(properties) {
    if (!properties) return '';
    const parts = [];
    PEACE_SUBINDICATOR_DEFS.forEach(({ key, label }) => {
        if (properties[key] === undefined || properties[key] === null || properties[key] === '') {
            return;
        }
        parts.push(createInfoItem(label, formatValue(properties[key]), false));
    });
    return parts.join('');
}

/**
 * Generate layer score section
 * @param {Object} properties - Feature properties
 * @param {string} layerType - Type of layer
 * @returns {string} - HTML content
 */
function isAcsCodeNoData(properties) {
    if (!properties || properties.ACS_CODE === undefined || properties.ACS_CODE === null) {
        return false;
    }
    const raw = properties.ACS_CODE;
    if (raw === 0 || raw === '0') return true;
    const n = Number(raw);
    return Number.isFinite(n) && n === 0;
}

function generateSocialVulnerabilitySection(properties, layerType = 'default', sourceLayer = null) {
    const sectionTitle = getLayerScoreSectionTitle(layerType);
    let content = `<div class="info-section"><h4>${sectionTitle}</h4>`;

    if (isAcsCodeNoData(properties)) {
        content += createInfoItem('Status', 'no-data', true);
        content += '</div>';
        return content;
    }
    
    // Main vulnerability score (field depends on active composite index dataset)
    const primaryField = getPrimaryVulnerabilityField(properties, layerType);
    let hasVulnData = Boolean(primaryField);
    if (primaryField) {
        const rawValue = properties[primaryField];
        const numericValue = Number(rawValue);
        const svValue = formatValue(rawValue);
        const skipVulnCategory =
            (primaryField && String(primaryField).startsWith('peace_si_')) ||
            (layerType === 'sv-admin5' &&
                (String(primaryField).includes('Population') ||
                    String(primaryField).includes('Heterogeneity') ||
                    String(primaryField).includes('Displacement_Ratio') ||
                    String(primaryField).includes('Demographic_Factor')));
        let svCategory = '';
        if (!skipVulnCategory && Number.isFinite(numericValue)) {
            const categoryLabel =
                getSubindicatorCategoryLabel(numericValue, primaryField, layerType, sourceLayer) ||
                categorizeSVScore(numericValue);
            if (categoryLabel) {
                svCategory = ` (${categoryLabel})`;
            }
        }
        const label = getPrimaryFieldDisplayLabel(primaryField, layerType);
        content += createInfoItem(label, `${svValue}${svCategory}`, false);
    }

    const subLayerId = SV_LAYER_TYPE_TO_ID[layerType];
    if (subLayerId) {
        getSelectedSubindicators(subLayerId)
            .slice(1)
            .forEach(fieldKey => {
                if (fieldKey === primaryField) return;
                const rawValue = properties[fieldKey];
                if (rawValue === undefined || rawValue === null || rawValue === '') return;
                const label = getPrimaryFieldDisplayLabel(fieldKey, layerType);
                const numericValue = Number(rawValue);
                let subCategory = '';
                if (Number.isFinite(numericValue)) {
                    const categoryLabel = getSubindicatorCategoryLabel(
                        numericValue,
                        fieldKey,
                        layerType,
                        sourceLayer
                    );
                    if (categoryLabel) {
                        subCategory = ` (${categoryLabel})`;
                    }
                }
                content += createInfoItem(label, `${formatValue(rawValue)}${subCategory}`, false);
                hasVulnData = true;
            });
    }
    
    // Look for other vulnerability-related fields
    const vulnerabilityFields = {
        'Poverty Rate': ['POVERTY_RATE', 'poverty', 'poor_rate'],
        'Education Index': ['EDUCATION', 'education_index', 'EDU_INDEX'],
        'Health Index': ['HEALTH', 'health_index', 'HEALTH_IDX'],
        'Infrastructure': ['INFRASTRUCTURE', 'infra_index', 'INFRA'],
        'Economic Index': ['ECONOMIC', 'econ_index', 'ECO_INDEX']
    };

    if (layerType === 'sv-admin3') {
        const peaceSub = buildPeaceSubindicatorsInfoItems(properties);
        if (peaceSub) {
            content += `<div class="info-subsection info-peace-subindicators"><h5>Peace cadastre sub-indicators</h5>${peaceSub}</div>`;
            hasVulnData = true;
        }
    }

    Object.entries(vulnerabilityFields).forEach(([label, fields]) => {
        const value = getFirstAvailableValue(properties, fields);
        if (value !== null) {
            content += createInfoItem(label, formatValue(value));
            hasVulnData = true;
        }
    });
    
    if (!hasVulnData) {
        content += '<p class="info-no-data">No composite score data available for this layer.</p>';
    }
    
    content += '</div>';
    return content;
}

function getPrimaryVulnerabilityField(properties, layerType = '') {
    if (!properties) return null;

    if (layerType === 'sv-admin5') {
        const key = getPrimarySubindicator('svAdmin5Layer');
        if (key && properties[key] !== undefined && properties[key] !== null && properties[key] !== '') {
            return key;
        }
        if (
            properties.composite_score !== undefined &&
            properties.composite_score !== null &&
            properties.composite_score !== ''
        ) {
            return 'composite_score';
        }
        if (
            properties['Demographic_Factor (DF = S*H)'] !== undefined &&
            properties['Demographic_Factor (DF = S*H)'] !== null &&
            properties['Demographic_Factor (DF = S*H)'] !== ''
        ) {
            return 'Demographic_Factor (DF = S*H)';
        }
        if (
            properties['Demographic_Factor (DF = S*H)_mean'] !== undefined &&
            properties['Demographic_Factor (DF = S*H)_mean'] !== null &&
            properties['Demographic_Factor (DF = S*H)_mean'] !== ''
        ) {
            return 'Demographic_Factor (DF = S*H)_mean';
        }
    }

    if (layerType === 'sv-admin1') {
        const key = getPrimarySubindicator('svAdmin1Layer');
        if (key && properties[key] !== undefined && properties[key] !== null && properties[key] !== '') {
            return key;
        }
        if (
            properties['Displacement Pressure Score'] !== undefined &&
            properties['Displacement Pressure Score'] !== null &&
            properties['Displacement Pressure Score'] !== ''
        ) {
            return 'Displacement Pressure Score';
        }
    }

    if (layerType === 'sv-admin2') {
        const key = getPrimarySubindicator('svAdmin2Layer');
        if (key && properties[key] !== undefined && properties[key] !== null && properties[key] !== '') {
            return key;
        }
        if (
            properties.composite_score !== undefined &&
            properties.composite_score !== null &&
            properties.composite_score !== ''
        ) {
            return 'composite_score';
        }
    }

    if (layerType === 'sv-admin3') {
        const activeResolution =
            typeof document !== 'undefined' &&
            document.querySelector('.sv-admin-resolution-btn.active')?.dataset?.resolution;
        const subindicatorActive = activeResolution === 'cadastre' || activeResolution === 'district';
        const key = getPrimarySubindicator('svAdmin3Layer');
        if (subindicatorActive && key && properties[key] !== undefined && properties[key] !== null && properties[key] !== '') {
            return key;
        }
        if (
            properties.composite_score !== undefined &&
            properties.composite_score !== null &&
            properties.composite_score !== ''
        ) {
            return 'composite_score';
        }
    }

    if (layerType === 'sv-overall') {
        if (
            properties.composite_score !== undefined &&
            properties.composite_score !== null &&
            properties.composite_score !== ''
        ) {
            return 'composite_score';
        }
        if (
            properties.composite_score_mean !== undefined &&
            properties.composite_score_mean !== null &&
            properties.composite_score_mean !== ''
        ) {
            return 'composite_score_mean';
        }
        if (
            properties.overall_tension_index_score !== undefined &&
            properties.overall_tension_index_score !== null &&
            properties.overall_tension_index_score !== ''
        ) {
            return 'overall_tension_index_score';
        }
    }

    const priorityFields = [
        'Social-Vulnerability',
        'overall_tension_index_score',
        'Displacement Pressure Score',
        'displace_composite_score',
        'displace_composite_score_mean',
        'socio_composite_score',
        'socio_composite_score_mean',
        'peace_composite_score',
        'peace_composite_score_mean_mean',
        'peace_composite_score_mean',
        'composite_score',
        'capacityNightlight Intensity (mean)',
        'age_13_18Nightlight Intensity (mean)',
        '2age_13_18Nightlight Intensity (mean)',
        'peace_composite_score',
        'sv',
        'vulnerability'
    ];

    for (const field of priorityFields) {
        if (properties[field] !== undefined && properties[field] !== null && properties[field] !== '') {
            return field;
        }
    }

    const fallbackField = Object.keys(properties).find(key => {
        const normalized = key.toLowerCase();
        return (
            normalized.includes('vulnerability') ||
            normalized.includes('capacity') ||
            normalized.includes('idp') ||
            normalized.includes('displacement')
        );
    });

    return fallbackField || null;
}

function getLayerScoreSectionTitle(layerType) {
    if (layerType === 'sv-overall') return 'Overall Vulnerability Index';
    if (layerType === 'sv-admin1') return 'Displacement Pressure';
    if (layerType === 'sv-admin2') return 'Socioeconomic Vulnerability';
    if (layerType === 'sv-admin3') return 'Tension and Conflict Risk';
    if (layerType === 'sv-admin5') return 'Demographic Tension / Stress';
    if (layerType === 'population') return 'Population';
    return 'Layer Score';
}

function getPrimaryFieldDisplayLabel(fieldName, layerType) {
    if (layerType === 'sv-admin1' && fieldName === 'Displacement Pressure Score') {
        return 'Displacement Pressure Score';
    }
    if (layerType === 'sv-admin1' && fieldName === 'composite_score') {
        return 'Displacement Pressure Score';
    }
    if (layerType === 'sv-overall' && fieldName === 'composite_score') {
        return 'Overall Vulnerability Index';
    }
    if (layerType === 'sv-overall' && fieldName === 'composite_score_mean') {
        return 'Overall Vulnerability Index';
    }
    if (layerType === 'sv-admin3' && fieldName === 'composite_score') {
        return 'Tension and Conflict Risk';
    }
    if (layerType === 'sv-admin2' && fieldName === 'composite_score') {
        return 'Socioeconomic Vulnerability';
    }
    if (layerType === 'sv-admin5' && fieldName === 'composite_score') {
        return 'Demographic Tension / Stress';
    }
    if (layerType === 'population' && fieldName === 'All Populations') {
        return 'All Populations';
    }

    const labelByField = {
        'Social-Vulnerability': 'Composite Score',
        'Demographic_Factor (DF = S*H)': 'Demographic Tension / Stress',
        'Demographic_Factor (DF = S*H)_mean': 'Demographic Tension / Stress (mean)',
        'Resident_Population (R)': 'Resident population',
        'Resident_Population (R)_mean': 'Resident population (mean)',
        'Displaced_Population (D)': 'Displaced population',
        'Displaced_Population (D)_mean': 'Displaced population (mean)',
        'Heterogeneity (H)': 'Heterogeneity',
        'Heterogeneity (H)_mean': 'Heterogeneity (mean)',
        'Displacement_Ratio (S = D/R)': 'Displacement ratio',
        'Displacement_Ratio (S = D/R)_mean': 'Displacement ratio (mean)',
        'Displacement Pressure Score': 'Displacement Pressure Score',
        'Number of IDPs': 'Number of IDPs',
        'Number of of Palestinians': 'Number of Palestinians',
        'Number of registered Syrians': 'Number of registered Syrians',
        'Ratio of IDPs, SYR, and palestinians per host residents, at cadastre level':
            'Ratio of IDPs, Syrians, and Palestinians per host residents',
        'displace_composite_score': 'Displacement Pressure Score',
        'displace_composite_score_mean': 'Displacement Pressure Score (mean)',
        overall_tension_index_score: 'Overall Vulnerability Index',
        tension_peace_score: 'Tension and Conflict Risk',
        displacement_pressure_score: 'Displacement Pressure',
        economic_vulnerability_score: 'Socioeconomic Vulnerability',
        composite_score: 'Socioeconomic Vulnerability',
        'Unemployment Rate': 'Unemployment rate',
        'Nightlight Intensity': 'Nightlight intensity',
        '332 Vulnerability Map': '332 vulnerability map',
        Coping: 'Coping',
        'Population dependency ratio': 'Population dependency ratio',
        'Unemployment rate': 'Unemployment rate',
        'Nighttime light radiance': 'Nighttime light radiance',
        'Negative coping tendency': 'Negative coping tendency',
        'Food insecurity level (IPC)': 'Food insecurity level (IPC)',
        HDS: 'HDS',
        'Inter-sectarian and inter-communal conflict incidents':
            'Inter-sectarian and inter-communal conflict incidents',
        'Number of violent incidents': 'Number of violent incidents',
        'Number of crime incidents': 'Number of crime incidents',
        'Number of fatalities in tension incidents': 'Number of fatalities in tension incidents',
        'Fear of traveling within Lebanon safely': 'Fear of traveling within Lebanon safely',
        'Feeling lack of safety during the night': 'Feeling lack of safety during the night',
        'All Populations': 'All Populations',
        LEB: 'Lebanese (LEB)',
        PRL: 'Palestinians — Lebanon (PRL)',
        PRS: 'Palestinians — Syria (PRS)',
        SYR: 'Syrians (SYR)',
        'socio_composite_score': 'Socioeconomic Vulnerability',
        'socio_composite_score_mean': 'Socioeconomic Vulnerability (mean)',
        'peace_composite_score': 'Tension and Conflict Risk',
        'peace_composite_score_mean_mean': 'Tension and Conflict Risk (Mean)',
        'peace_composite_score_mean': 'Tension and Conflict Risk (Mean)',
        peace_si_intersectarian_per_1k:
            'Annual rate of UNDPTMS incidents tagged as “intersectarian” or “intercommunal” per 1000 residents',
        peace_si_battle_events_count:
            'Number of incidents/events involving battles, explosions, violence against civilians, armed clashes, and airstrikes.',
        peace_si_ss_typology_non_state: 'Safety and Security typology incidents without state operations',
        peace_si_fatalities_per_1k_12m: 'Fatalities per 1000 residents in the last 12 months',
        peace_si_worry_travel_hh_share:
            'Share of households who worry about travelling to key destinations within Lebanon safely',
        peace_si_unsafe_night_pct:
            '% of population reporting feeling "unsafe" or "very unsafe" in their neighborhoods during the night'
    };
    if (labelByField[fieldName]) return labelByField[fieldName];

    if (layerType === 'sv-admin1') return 'Displacement Pressure Score';
    if (layerType === 'sv-admin2') return 'Socioeconomic Vulnerability';
    if (layerType === 'sv-admin3') return 'Tension and Conflict Risk';
    if (layerType === 'sv-admin5') return 'Demographic Tension / Stress';
    return fieldName.replace(/_/g, ' ');
}

/**
 * Generate statistics section
 * @param {Object} properties - Feature properties
 * @param {string} layerType - Type of layer
 * @returns {string} - HTML content
 */
function generateStatisticsSection(properties, layerType) {
    return '';
}

/**
 * Generate additional data section for other available fields
 * @param {Object} properties - Feature properties
 * @returns {string} - HTML content
 */
function getThreeClassColorRamp(rampId) {
    const ramp = getColorRamp(rampId);
    if (!ramp?.colors?.length) return null;
    if (ramp.colors.length === 3) return ramp;
    const colors = ramp.colors;
    return {
        ...ramp,
        colors: [colors[0], colors[Math.floor((colors.length - 1) / 2)], colors[colors.length - 1]]
    };
}

function getOviReferenceGeoJson(sourceLayer) {
    return (
        window.mapLayers?.vector?.svOverallTensionLayer?.layerData?.raw ||
        (sourceLayer?.layerData?.raw?.features ? sourceLayer.layerData.raw : null)
    );
}

const LAYER_TYPE_TO_MAP_LAYER_ID = {
    'sv-overall': 'svOverallTensionLayer',
    'sv-admin1': 'svAdmin1Layer',
    'sv-admin2': 'svAdmin2Layer',
    'sv-admin3': 'svAdmin3Layer',
    'sv-admin5': 'svAdmin5Layer'
};

function getPillarScoreClassLabel(value, field, colorRampId, referenceGeoJson) {
    const ramp = getThreeClassColorRamp(colorRampId);
    if (!ramp || !referenceGeoJson) return null;
    const presentation = getQuantilePresentation(value, referenceGeoJson, field, ramp, VULNERABILITY_CLASS_LABELS);
    return presentation?.label || null;
}

function getSubindicatorCategoryLabel(numericValue, fieldKey, layerType, sourceLayer) {
    if (layerType === 'sv-overall') {
        return getClassLabelForLayerValue(numericValue, sourceLayer, VULNERABILITY_CLASS_LABELS);
    }
    const mapLayerId = LAYER_TYPE_TO_MAP_LAYER_ID[layerType];
    const mapLayer = mapLayerId ? window.mapLayers?.vector?.[mapLayerId] : null;
    if (mapLayer?.layerData?.colorSpec) {
        return getClassLabelForLayerValue(numericValue, mapLayer, VULNERABILITY_CLASS_LABELS);
    }
    if (mapLayer?.layerData?.raw && fieldKey) {
        const rampId = layerType === 'sv-admin5' ? 'yellowOrangeRed3' : null;
        if (rampId) {
            return getPillarScoreClassLabel(numericValue, fieldKey, rampId, mapLayer.layerData.raw);
        }
    }
    return null;
}

function createScoreInfoItem(label, rawValue, classLabel = null) {
    const formatted = formatValue(rawValue);
    const classSuffix = classLabel ? ` (${classLabel})` : '';
    return createInfoItem(label, `${formatted}${classSuffix}`, false);
}

function generateAdditionalDataSection(properties, sourceLayer = null) {
    const pillarFieldKeys = new Set(PILLAR_SCORE_FIELDS.map(entry => entry.field));

    // Fields to exclude from additional data (already shown in other sections)
    const excludeFields = new Set([
        'fid', 'GID_0', 'GID_1', 'GID_2', 'GID_3',
        'NAME_0', 'NAME_1', 'NAME_2', 'NAME_3',
        'Cercle/District', 'COUNTRY', 'REGION',
        'ADM1_NAME', 'ADM2_NAME', 'ADM3_NAME',
        'ADMIN_ID', 'Social-Vulnerability', 'POPULATION', 'POP',
        'AREA', 'DENSITY', 'HOUSEHOLDS', 'GDP_PC',
        'Shape_Area', 'Shape_Length',
        'CODE', 'ACS_CODE', 'CODE_2', 'CODE_2_int', 'ACS_Code_2',
        ...pillarFieldKeys
    ]);
    
    let content = '<div class="info-section"><h4>Additional Data</h4>';
    let hasAdditionalData = false;

    const referenceGeoJson = getOviReferenceGeoJson(sourceLayer);
    PILLAR_SCORE_FIELDS.forEach(({ field, label, colorRampId }) => {
        const rawValue = properties[field];
        if (rawValue === undefined || rawValue === null || rawValue === '') return;
        const classLabel = getPillarScoreClassLabel(rawValue, field, colorRampId, referenceGeoJson);
        content += createScoreInfoItem(label, rawValue, classLabel);
        hasAdditionalData = true;
    });
    
    Object.entries(properties).forEach(([key, value]) => {
        if (!excludeFields.has(key) && value !== null && value !== undefined && value !== '') {
            const displayLabel = getPrimaryFieldDisplayLabel(key, 'default');
            content += createInfoItem(displayLabel, formatValue(value));
            hasAdditionalData = true;
        }
    });
    
    if (!hasAdditionalData) {
        content += '<p class="info-no-data">No additional data available.</p>';
    }
    
    content += '</div>';
    return content;
}

/**
 * Get the first available value from a list of field names
 * @param {Object} properties - Feature properties
 * @param {Array} fields - Array of field names to check
 * @returns {*} - First available value or null
 */
function getFirstAvailableValue(properties, fields) {
    for (const field of fields) {
        if (properties[field] !== undefined && properties[field] !== null && properties[field] !== '') {
            return properties[field];
        }
    }
    return null;
}

/**
 * Create an info item HTML element
 * @param {string} label - Label for the item
 * @param {*} value - Value to display
 * @param {boolean} highlight - Whether to highlight the value
 * @returns {string} - HTML string
 */
function createInfoItem(label, value, highlight = false) {
    const highlightClass = highlight ? ' highlight' : '';
    return `
        <div class="info-item">
            <span class="info-label">${label}:</span>
            <span class="info-value${highlightClass}">${value}</span>
        </div>
    `;
}

/**
 * Format a value for display
 * @param {*} value - Value to format
 * @returns {string} - Formatted value
 */
function formatValue(value) {
    if (value === null || value === undefined) {
        return 'N/A';
    }
    
    if (typeof value === 'number') {
        // Format numbers with appropriate precision
        if (value > 1000000) {
            return (value / 1000000).toFixed(2) + 'M';
        } else if (value > 1000) {
            return (value / 1000).toFixed(1) + 'K';
        } else if (value % 1 !== 0) {
            return value.toFixed(3);
        }
        return value.toLocaleString();
    }
    
    return String(value);
}

/**
 * Categorize Social Vulnerability score
 * @param {number} score - Social-Vulnerability score
 * @returns {string} - Category label
 */
function categorizeSVScore(score) {
    if (score < 0.2) return 'Very Low';
    if (score < 0.4) return 'Low';
    if (score < 0.6) return 'Medium';
    if (score < 0.8) return 'High';
    return 'Very High';
}

/**
 * Add click handler to a layer for showing info popup
 * @param {Object} layer - Leaflet layer
 * @param {string} layerType - Type of layer
 */
export function addInfoPopupHandler(layer, layerType = 'default') {
    if (!layer || !layer.eachLayer) return;
    
    layer.eachLayer(function(featureLayer) {
        if (featureLayer.feature) {
            featureLayer.on('click', function(e) {
                // Prevent event propagation
                L.DomEvent.stopPropagation(e);
                
                // Show info popup
                showInfoPopup(featureLayer.feature, layerType, e, layer);
            });
            
            // Change cursor on hover
            featureLayer.on('mouseover', function() {
                const cursorTarget = getFeatureLayerCursorTarget(featureLayer);
                if (cursorTarget) {
                    cursorTarget.style.cursor = 'pointer';
                }
            });
            
            featureLayer.on('mouseout', function() {
                const cursorTarget = getFeatureLayerCursorTarget(featureLayer);
                if (cursorTarget) {
                    cursorTarget.style.cursor = '';
                }
            });
        }
    });
}

function getFeatureLayerCursorTarget(featureLayer) {
    if (!featureLayer) return null;
    if (featureLayer._path && featureLayer._path.style) return featureLayer._path;
    if (featureLayer._icon && featureLayer._icon.style) return featureLayer._icon;
    return null;
}