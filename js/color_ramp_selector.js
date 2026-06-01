// color_ramp_selector.js - Functions for managing color ramps

import { colorRamps } from './color_scales.js';

/**
 * Populate a select element with available color ramps
 * @param {string} selectorId - ID of the select element
 */
export function populateColorRampSelector(selectorId) {
    const selector = document.getElementById(selectorId);
    if (!selector) return;

    // Clear existing options
    selector.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select color scheme...';
    selector.appendChild(defaultOption);
    
    // Add options for each color ramp
    Object.entries(colorRamps).forEach(([key, ramp]) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = formatRampName(key);
        
        // Add color preview if supported
        if (ramp.colors && ramp.colors.length > 0) {
            option.setAttribute('data-colors', JSON.stringify(ramp.colors));
        }
        
        selector.appendChild(option);
    });
}

/**
 * Format a color ramp ID into a readable name
 * @param {string} rampId - Color ramp ID
 * @returns {string} - Formatted name
 */
function formatRampName(rampId) {
    // Split by capital letters and join with spaces
    return rampId
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase());
}

/**
 * Get a color ramp by its ID
 * @param {string} rampId - Color ramp ID
 * @returns {Object|null} - Color ramp object or null if not found
 */
export function getColorRamp(rampId) {
    return colorRamps[rampId] || null;
}

/**
 * Create a visual preview of a color ramp
 * @param {string} containerId - ID of the container to add the preview to
 * @param {Array} colors - Array of color values
 */
export function createColorRampPreview(containerId, colors) {
    const container = document.getElementById(containerId);
    if (!container || !colors || !colors.length) return;
    
    // Clear previous previews
    container.innerHTML = '';
    
    // Create the preview element
    const preview = document.createElement('div');
    preview.className = 'color-ramp-preview';
    preview.style.display = 'flex';
    preview.style.height = '20px';
    preview.style.marginTop = '5px';
    preview.style.borderRadius = '3px';
    preview.style.overflow = 'hidden';
    
    // Add color segments
    colors.forEach(color => {
        const segment = document.createElement('div');
        segment.style.flex = '1';
        segment.style.backgroundColor = color;
        preview.appendChild(segment);
    });
    
    // Add to container
    container.appendChild(preview);
}

/**
 * Setup a color ramp selector with preview
 * @param {string} selectorId - ID of the select element
 * @param {string} previewId - ID of the preview container
 * @param {Function} onChange - Callback when selection changes
 */
export function setupColorRampSelector(selectorId, previewId, onChange) {
    const selector = document.getElementById(selectorId);
    if (!selector) return;
    
    // Populate the selector
    populateColorRampSelector(selectorId);
    
    // Add change event listener
    selector.addEventListener('change', function() {
        const rampId = this.value;
        const ramp = getColorRamp(rampId);
        
        // Update preview if a ramp is selected
        if (ramp && ramp.colors) {
            createColorRampPreview(previewId, ramp.colors);
        } else {
            // Clear preview if no ramp is selected
            const preview = document.getElementById(previewId);
            if (preview) preview.innerHTML = '';
        }
        
        // Call onChange callback if provided
        if (typeof onChange === 'function') {
            onChange(ramp);
        }
    });
}