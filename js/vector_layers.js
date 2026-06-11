// vector_layers.js - Functions for handling vector and point data
export { getColorFromRamp, formatValue, updateVectorLegend };

/** Parcels with ACS_CODE 0 are outside the cadastre linkage — render as neutral no-data. */
export const ACS_CODE_NO_DATA_COLOR = '#9ca3af';
export const ACS_CODE_NO_DATA_LEGEND_LABEL = 'no-data';

export function isAcsCodeNoData(properties) {
    if (!properties || properties.ACS_CODE === undefined || properties.ACS_CODE === null) {
        return false;
    }
    const raw = properties.ACS_CODE;
    if (raw === 0 || raw === '0') return true;
    const n = Number(raw);
    return Number.isFinite(n) && n === 0;
}

export function layerHasAcsCodeNoData(data) {
    return (data?.features || []).some(feature => isAcsCodeNoData(feature?.properties));
}

export function updatePointLayerStyle(layer, property, colorRamp, opacity = 1, updateLegend = null) {
    if (!layer || !property || !colorRamp?.colors) {
        console.error('Missing required parameters for updatePointLayerStyle');
        return;
    }
    
    // Get all data for classification
    const data = {
        features: []
    };
    
    // Collect all features for analysis
    layer.eachLayer(featureLayer => {
        if (featureLayer.feature) {
            data.features.push(featureLayer.feature);
        }
    });
    
    if (data.features.length === 0) return;
    
    try {
        const colorResolver = buildColorResolver(data, property, colorRamp);
        // Update styles and tooltips
        layer.eachLayer(featureLayer => {
            if (!featureLayer.feature?.properties) return;
            
            const props = featureLayer.feature.properties;
            const color = isAcsCodeNoData(props)
                ? ACS_CODE_NO_DATA_COLOR
                : colorResolver(props[property]);
            featureLayer.setStyle({
                fillColor: color,
                color: '#333',
                weight: 1,
                fillOpacity: opacity,
                opacity: opacity
            });
            
            const tooltipContent = isAcsCodeNoData(props)
                ? 'no-data'
                : props[property] === undefined
                    ? `No data for ${property}`
                    : `${property}: ${formatValue(props[property])}`;
                
            featureLayer.unbindTooltip();
            featureLayer.bindTooltip(tooltipContent, {
                permanent: false,
                direction: 'top'
            });
        });
        
        // Update legend if function provided
        if (typeof updateLegend === 'function') {
            updateVectorLegend(layer, property, colorRamp, updateLegend);
        }
    } catch (err) {
        console.error('Error updating point layer style:', err);
    }
}

/**
 * Load a vector layer from a GeoJSON file with updated tooltip handling
 * @param {string} url - URL of the GeoJSON file
 * @param {Object} options - Options for styling and interaction
 * @returns {Promise} - Promise resolving to the created layer
 */
export function loadVectorLayer(url, options = {}) {
    const defaultStyle = {
        color: "#3388ff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.5
    };

    return fetch(url)
        .then(response => response.json())
        .then(data => {
            // Store data and create the layer
            const layerData = { 
                raw: data,
                propertyFields: getPropertyFields(data),
                selectedProperty: options.selectedProperty || null,
                colorRamp: options.colorRamp || null
            };
            
            const vectorLayer = L.geoJSON(data, {
                style: feature => {
                    // Apply styling based on property and color ramp if provided
                    if (options.selectedProperty && options.colorRamp && feature.properties) {
                        return {
                            ...getStyleOptions(options, defaultStyle, feature),
                            fillColor: isAcsCodeNoData(feature.properties)
                                ? ACS_CODE_NO_DATA_COLOR
                                : getColorFromRamp(
                                    feature.properties[options.selectedProperty],
                                    data,
                                    options.selectedProperty,
                                    options.colorRamp
                                )
                        };
                    } 
                    return getStyleOptions(options, defaultStyle, feature);
                },
                onEachFeature: (feature, layer) => {
                    // Set default tooltip
                    if (feature.properties) {
                        layer.bindTooltip("Select an attribute to view values", {
                            permanent: false,
                            direction: 'top'
                        });
                    }
                }
            });
            
            // Attach data to the layer for later use
            vectorLayer.layerData = layerData;
            return vectorLayer;
        });
}

/**
 * Get style options, handling function or object style definitions
 */
function getStyleOptions(options, defaultStyle, feature) {
    return typeof options.style === 'function' 
        ? options.style(feature) 
        : (options.style || defaultStyle);
}

/**
 * Update a vector layer's style based on selected property and color ramp
 * @param {Object} layer - Leaflet GeoJSON layer
 * @param {string} property - Property name to use for coloring
 * @param {Object} colorRamp - Color ramp object
 * @param {number} opacity - Layer opacity
 * @param {Function} updateLegend - Function to update the legend (optional)
 */
export function updateVectorLayerStyle(layer, property, colorRamp, opacity = 1, updateLegend = null, options = {}) {
    if (!layer?.layerData || !property || !colorRamp?.colors) {
        console.error('Missing required parameters for updateVectorLayerStyle');
        return;
    }
    
    // Update the stored layer data
    layer.layerData.selectedProperty = property;
    layer.layerData.colorRamp = colorRamp;
    
    try {
        const colorSpec = buildColorSpec(layer.layerData.raw, property, colorRamp);
        layer.layerData.colorSpec = colorSpec;
        const styleSignature = buildStyleSignature(property, colorRamp, opacity, colorSpec.mode);
        const needsStyleUpdate = layer.layerData._styleSignature !== styleSignature;
        const skipTooltips = options?.skipTooltips === true;
        const needsTooltipUpdate = !skipTooltips && layer.layerData._tooltipProperty !== property;

        if (needsStyleUpdate) {
            const colorResolver = createColorResolverFromSpec(colorSpec, colorRamp);
            applyLayerStyle(layer, property, colorResolver, opacity);
            layer.layerData._styleSignature = styleSignature;
        }

        deferToNextFrame(() => {
            if (needsTooltipUpdate) {
                updateLayerTooltips(layer, property);
                layer.layerData._tooltipProperty = property;
            }

            // Keep legend in sync even when style/tooltip signatures didn't change.
            // This covers cases where legend was removed on toggle-off and the layer object is reused.
            if (typeof updateLegend === 'function') {
                updateVectorLegend(layer, property, colorRamp, updateLegend, colorSpec);
            }
        });
    } catch (err) {
        console.error('Error updating vector layer style:', err);
    }
}

/**
 * Apply style updates to a layer
 */
function applyLayerStyle(layer, property, colorResolver, opacity) {
    layer.setStyle(feature => {
        if (!feature?.properties) {
            return { fillOpacity: opacity, opacity: opacity };
        }
        
        const props = feature.properties;
        return {
            fillColor: isAcsCodeNoData(props)
                ? ACS_CODE_NO_DATA_COLOR
                : colorResolver(props[property]),
            fillOpacity: opacity,
            opacity: opacity,
            weight: 2,
            color: '#333'
        };
    });
}

/**
 * Update tooltips for each feature in a layer
 */
function updateLayerTooltips(layer, property) {
    const featureLayers = [];
    layer.eachLayer(featureLayer => {
        featureLayers.push(featureLayer);
    });

    const batchSize = 250;
    let index = 0;

    const processBatch = () => {
        const end = Math.min(index + batchSize, featureLayers.length);
        for (let i = index; i < end; i++) {
            const featureLayer = featureLayers[i];
            if (!featureLayer?.feature?.properties) continue;

            const props = featureLayer.feature.properties;
            const tooltipContent = isAcsCodeNoData(props)
                ? 'no-data'
                : props[property] === undefined
                    ? `No data for ${property}`
                    : `${property}: ${formatValue(props[property])}`;
            if (featureLayer._vectorTooltipContent === tooltipContent) continue;
            featureLayer.unbindTooltip();
            featureLayer.bindTooltip(tooltipContent, {
                permanent: false,
                direction: 'top'
            });
            featureLayer._vectorTooltipContent = tooltipContent;
        }
        index = end;
        if (index < featureLayers.length) {
            deferToNextFrame(processBatch);
        }
    };

    processBatch();
}

/**
 * Format a value for display in tooltips
 */
function formatValue(value) {
    return typeof value === 'number' 
        ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) 
        : value;
}

/**
 * Get a color from a ramp based on a value using quantile classification
 * @param {number|string} value - Value to determine color
 * @param {Object} data - GeoJSON data
 * @param {string} property - Property name to use for values
 * @param {Object} colorRamp - Color ramp with colors array
 * @returns {string} - Color hex code
 */
function getColorFromRamp(value, data, property, colorRamp) {
    // Validation
    if (!colorRamp?.colors?.length) {
        return '#CCCCCC'; // Default gray if invalid
    }
    
    const spec = buildColorSpec(data, property, colorRamp);
    const resolver = createColorResolverFromSpec(spec, colorRamp);
    return resolver(value);
}

/**
 * Calculate class breaks for choropleth maps (3-class aware, handles zero-heavy counts).
 */
export function calculateQuantileBreaks(values, numClasses) {
    const sorted = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
    const n = sorted.length;
    if (n === 0) {
        return Array.from({ length: numClasses + 1 }, () => 0);
    }

    const min = sorted[0];
    const max = sorted[n - 1];
    if (min === max) {
        return Array.from({ length: numClasses + 1 }, () => min);
    }

    if (numClasses === 3) {
        const zeroCount = sorted.filter(v => v === 0).length;
        const positives = sorted.filter(v => v > 0);
        if (zeroCount > 0 && positives.length > 0 && zeroCount / n >= 0.2) {
            const pMax = positives[positives.length - 1];
            if (positives.length === 1) {
                return [0, 0, pMax, pMax];
            }
            const midIdx = Math.floor((positives.length - 1) / 2);
            const pMid = positives[midIdx];
            if (pMid >= pMax) {
                return [0, 0, pMax, pMax];
            }
            return [0, 0, pMid, pMax];
        }
    }

    const breaks = [min];
    for (let i = 1; i < numClasses; i++) {
        const idx = Math.min(n - 1, Math.round((i / numClasses) * (n - 1)));
        breaks.push(sorted[idx]);
    }
    breaks.push(max);

    if (new Set(breaks).size < numClasses + 1) {
        const step = (max - min) / numClasses;
        return Array.from({ length: numClasses + 1 }, (_, i) =>
            i === numClasses ? max : min + step * i
        );
    }

    return breaks;
}

function isZeroInflatedBreaks(breaks) {
    return (
        Array.isArray(breaks) &&
        breaks.length === 4 &&
        breaks[0] === 0 &&
        breaks[1] === 0 &&
        breaks[3] >= breaks[2]
    );
}

/**
 * Format non-overlapping class ranges for legend display.
 */
export function formatClassLegendRanges(breaks) {
    if (isZeroInflatedBreaks(breaks)) {
        const pMid = breaks[2];
        const pMax = breaks[3];
        const integerEdges = Number.isInteger(pMid) && Number.isInteger(pMax);

        if (pMid >= pMax) {
            return [
                formatValue(0),
                integerEdges
                    ? `${formatValue(1)} - ${formatValue(pMax)}`
                    : `> ${formatValue(0)} - ${formatValue(pMax)}`,
                formatValue(pMax)
            ];
        }

        return [
            formatValue(0),
            integerEdges
                ? `${formatValue(1)} - ${formatValue(pMid)}`
                : `> ${formatValue(0)} - ${formatValue(pMid)}`,
            integerEdges
                ? `${formatValue(pMid + 1)} - ${formatValue(pMax)}`
                : `> ${formatValue(pMid)} - ${formatValue(pMax)}`
        ];
    }

    const labels = [];
    for (let i = 0; i < breaks.length - 1; i++) {
        labels.push(`${formatValue(breaks[i])} - ${formatValue(breaks[i + 1])}`);
    }
    return labels;
}

/**
 * Update the legend for a vector layer based on attribute and color ramp
 */
function appendAcsNoDataLegend(colorScheme, labels, data) {
    if (!layerHasAcsCodeNoData(data)) {
        return { colorScheme, labels };
    }
    return {
        colorScheme: [...colorScheme, ACS_CODE_NO_DATA_COLOR],
        labels: [...labels, ACS_CODE_NO_DATA_LEGEND_LABEL]
    };
}

function updateVectorLegend(layer, property, colorRamp, updateLegend, colorSpec = null) {
    const raw = layer.layerData?.raw;
    const spec = colorSpec || buildColorSpec(raw, property, colorRamp);
    if (!spec || !spec.hasValues) {
        if (layerHasAcsCodeNoData(raw) && typeof updateLegend === 'function') {
            updateLegend(property, [ACS_CODE_NO_DATA_COLOR], '', [ACS_CODE_NO_DATA_LEGEND_LABEL]);
        }
        return;
    }

    if (spec.mode === 'categorical') {
        const legend = appendAcsNoDataLegend(
            spec.colors,
            spec.categories.map(v => String(formatValue(v))),
            raw
        );
        updateLegend(property, legend.colorScheme, '', legend.labels);
        return;
    }

    const numClasses = colorRamp.colors.length;
    const legend = appendAcsNoDataLegend(
        colorRamp.colors,
        formatClassLegendRanges(spec.breaks).slice(0, numClasses),
        raw
    );
    updateLegend(property, legend.colorScheme, '', legend.labels);
}

function buildColorResolver(data, property, colorRamp) {
    const spec = buildColorSpec(data, property, colorRamp);
    return createColorResolverFromSpec(spec, colorRamp);
}

function buildColorSpec(data, property, colorRamp) {
    const stats = computePropertyStats(data, property);
    if (!stats.values.length) {
        return { mode: 'empty', hasValues: false, fallback: colorRamp.colors[0] };
    }
    if (stats.isCategorical) {
        const colors = buildCategoricalColorPool(colorRamp.colors, stats.categories.length);
        const colorMap = new Map();
        stats.categories.forEach((category, idx) => {
            colorMap.set(category, colors[idx % colors.length]);
        });
        return {
            mode: 'categorical',
            hasValues: true,
            categories: stats.categories,
            colors,
            colorMap
        };
    }
    const breaks = calculateQuantileBreaks(stats.values, colorRamp.colors.length);
    return {
        mode: 'continuous',
        hasValues: true,
        breaks
    };
}

/**
 * Map a numeric value to a legend class label using the same quantile breaks as the choropleth.
 * @param {number} value - Feature value
 * @param {number[]} breaks - Quantile break points
 * @param {string[]} classLabels - One label per color class (e.g. Low, Medium, High)
 * @returns {string|null}
 */
export function getQuantileClassLabel(value, breaks, classLabels) {
    const labels = Array.isArray(classLabels) ? classLabels : [];
    const classIndex = getValueClassIndex(Number(value), breaks, labels.length);
    if (classIndex === null) return null;
    return labels[classIndex] || null;
}

export function getClassLabelForLayerValue(value, leafletLayer, classLabels) {
    const spec = leafletLayer?.layerData?.colorSpec;
    if (!spec || spec.mode !== 'continuous' || !spec.breaks) {
        return null;
    }
    return getQuantileClassLabel(value, spec.breaks, classLabels);
}

export function getValueClassIndex(numValue, breaks, numClasses) {
    if (!Number.isFinite(numValue) || !Array.isArray(breaks) || breaks.length < 2) {
        return null;
    }
    const classes = numClasses || breaks.length - 1;

    if (isZeroInflatedBreaks(breaks)) {
        const pMid = breaks[2];
        const pMax = breaks[3];
        if (numValue === 0) return 0;
        if (numValue <= pMid) return 1;
        if (numValue <= pMax) return Math.min(2, classes - 1);
        return classes - 1;
    }

    for (let i = 0; i < breaks.length - 1; i++) {
        if (numValue >= breaks[i] && numValue <= breaks[i + 1]) {
            return Math.min(i, classes - 1);
        }
    }
    return Math.max(0, classes - 1);
}

/**
 * Label and fill color for a value using quantile breaks from a GeoJSON dataset.
 */
export function getQuantilePresentation(value, geoJsonData, property, colorRamp, classLabels) {
    const numValue = Number(value);
    if (!Number.isFinite(numValue) || !geoJsonData || !colorRamp?.colors?.length) {
        return null;
    }
    const spec = buildColorSpec(geoJsonData, property, colorRamp);
    if (spec.mode !== 'continuous' || !spec.breaks) {
        return null;
    }
    const classIndex = getValueClassIndex(numValue, spec.breaks, colorRamp.colors.length);
    if (classIndex === null) {
        return null;
    }
    return {
        label: getQuantileClassLabel(numValue, spec.breaks, classLabels),
        color: colorRamp.colors[classIndex]
    };
}

function createColorResolverFromSpec(spec, colorRamp) {
    if (!spec || !spec.hasValues) {
        return () => colorRamp.colors[0];
    }
    if (spec.mode === 'categorical') {
        return value => spec.colorMap.get(normalizeCategoryValue(value)) || spec.colors[0];
    }
    return value => {
        const numValue = Number(value);
        if (isNaN(numValue)) return colorRamp.colors[0];
        const classIndex = getValueClassIndex(
            numValue,
            spec.breaks,
            colorRamp.colors.length
        );
        return colorRamp.colors[classIndex ?? 0];
    };
}

function buildStyleSignature(property, colorRamp, opacity, mode) {
    const colors = Array.isArray(colorRamp?.colors) ? colorRamp.colors.join('|') : '';
    return `${property}::${opacity}::${mode}::${colors}`;
}

function deferToNextFrame(fn) {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(fn);
    } else {
        setTimeout(fn, 0);
    }
}

function computePropertyStats(data, property) {
    const rawValues = (data?.features || [])
        .filter(feature => !isAcsCodeNoData(feature?.properties))
        .map(feature => feature?.properties?.[property])
        .filter(val => val !== undefined && val !== null && val !== '');
    const numericValues = rawValues
        .map(val => Number(val))
        .filter(val => !isNaN(val))
        .sort((a, b) => a - b);
    const uniqueRawValues = Array.from(new Set(rawValues.map(normalizeCategoryValue)));
    const allNumeric = uniqueRawValues.length > 0 && uniqueRawValues.every(val => !isNaN(Number(val)));
    const categories = allNumeric
        ? uniqueRawValues.sort((a, b) => Number(a) - Number(b))
        : uniqueRawValues.sort((a, b) => String(a).localeCompare(String(b)));
    // Categorical only for non-numeric class labels (e.g. yes/no strings).
    // Integer counts must stay continuous so sub-indicators use 3-class ramps.
    const isCategorical = categories.length > 0 && categories.length <= 10 && !allNumeric;
    return {
        rawValues,
        values: numericValues,
        categories,
        isCategorical
    };
}

function normalizeCategoryValue(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function buildCategoricalColorPool(baseColors, neededCount) {
    const distinctPalette = [
        '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
        '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
    ];
    const seed = Array.isArray(baseColors) && baseColors.length
        ? [...baseColors]
        : ['#3182bd', '#6baed6', '#9ecae1', '#c6dbef', '#e6550d'];
    const pool = [...seed];
    for (const color of distinctPalette) {
        if (pool.length >= neededCount) break;
        if (!pool.includes(color)) pool.push(color);
    }
    while (pool.length < neededCount) {
        pool.push(distinctPalette[pool.length % distinctPalette.length]);
    }
    return pool.slice(0, neededCount);
}

/**
 * Get property fields from GeoJSON data
 */
function getPropertyFields(geojsonData) {
    if (geojsonData?.features?.[0]?.properties) {
        return Object.keys(geojsonData.features[0].properties);
    }
    return [];
}

export function loadPointLayer(url, options = {}) {
    const dataPromise = options.data
        ? Promise.resolve(options.data)
        : fetch(url).then(response => response.json());

    return dataPromise
        .then(data => {
            // Populate property selector if specified
            if (options.selectorId) {
                populateDropdown(data, options.selectorId);
            }

            // Create the point layer
            const pointLayer = L.geoJSON(data, {
                pointToLayer: options.pointToLayer || createDefaultMarker,
                onEachFeature: (feature, layer) => {
                    if (options.tooltipFunction) {
                        options.tooltipFunction(feature, layer);
                    } else {
                        updateTooltip(feature, layer, options.selectorId || 'pointValueSelector');
                    }
                }
            });
            
            // Store property fields for later use (similar to vector layers)
            pointLayer.layerData = {
                raw: data,
                propertyFields: getPropertyFields(data),
                selectedProperty: options.selectedProperty || null,
                colorRamp: options.colorRamp || null
            };

            if (options.clusterOptions && typeof L.markerClusterGroup === 'function') {
                const clusterLayer = L.markerClusterGroup(options.clusterOptions);
                clusterLayer.addLayer(pointLayer);
                clusterLayer.layerData = pointLayer.layerData;
                return clusterLayer;
            }

            return pointLayer;
        });
}

/**
 * Create default marker for point layer
 */
function createDefaultMarker(feature, latlng) {
    return L.circleMarker(latlng, {
        radius: 5,
        fillColor: "#ff7800",
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
    });
}

/**
 * Update tooltip based on selected property
 */
export function updateTooltip(feature, layer, selectorId = 'pointValueSelector') {
    const selector = document.getElementById(selectorId);
    if (!selector) return;
    
    const selectedProperty = selector.value;
    const value = feature.properties?.[selectedProperty];
    
    layer.bindTooltip(
        value !== undefined 
            ? `Value: ${value}` 
            : 'No value available', 
        { permanent: false, direction: 'top' }
    );
}

/**
 * Populate dropdowns with properties from GeoJSON data
 */
export function populateDropdown(data, selectorId) {
    const selector = document.getElementById(selectorId);
    if (!selector) return;
    
    selector.innerHTML = ''; // Clear existing options
    
    const properties = data.features?.[0]?.properties
        ? Object.keys(data.features[0].properties)
        : [];
        
    if (properties.length === 0) {
        console.error('No properties found in the GeoJSON data.');
        return;
    }

    properties.forEach(prop => {
        const option = document.createElement('option');
        option.value = prop;
        option.textContent = prop;
        selector.appendChild(option);
    });
}

/**
 * Populate attribute selector with fields from a layer, excluding NAME_1 and NAME_2
 * @param {Object} layer - Vector layer with GeoJSON data
 * @param {string} selectorId - ID of the select element to populate
 */
export function populateAttributeSelector(layer, selectorId) {
    if (!layer?.layerData?.propertyFields) return;
    
    const selector = document.getElementById(selectorId);
    if (!selector) return;
    
    // Clear and populate selector
    selector.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select indicator...';
    selector.appendChild(defaultOption);
    
    // Define fields to exclude
    const excludeFields = ['fid','GID_0','GID_1', 'GID_2','NAME_1', 'NAME_2', 'Cercle/District'];
    
    // Add property options, excluding the specified fields
    layer.layerData.propertyFields
        .filter(prop => !excludeFields.includes(prop))
        .forEach(prop => {
            const option = document.createElement('option');
            option.value = prop;
            option.textContent = prop;
            selector.appendChild(option);
        });
}