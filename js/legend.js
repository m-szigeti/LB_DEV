// legend.js - Functions for managing the map legend (stacked entries)

// Stack of legend entries in order of addition
const legendEntries = new Map();
let legendOrderCounter = 0;

/**
 * Initialize the legend with default content
 */
export function initializeLegend() {
    const legend = document.getElementById('legend');
    if (!legend) return;
    
    legend.innerHTML = `
        <h4>Map Legend</h4>
        <p>Activate layers to view more information.</p>
        <div class="color-scheme">
            <p>No active layers</p>
        </div>
    `;
    legend.style.display = 'block';
}

/**
 * Add or update a legend entry for a layer. Entries are stacked in order of addition.
 * @param {string} layerId - Unique layer identifier
 * @param {Object} entry - Entry data. For color scales: { layerName, colorScheme, description, labels, values?, unit? }. For categorical: { layerName, type: 'categorical', items: [{ label, color }] }
 */
export function addLegendEntry(layerId, entry) {
    if (!layerId || !entry) return;
    
    const existing = legendEntries.get(layerId);
    const order = existing?.order ?? ++legendOrderCounter;
    
    legendEntries.set(layerId, { ...entry, order });
    renderLegend();
}

/**
 * Remove a legend entry by layer ID
 * @param {string} layerId - Layer identifier to remove
 */
export function removeLegendEntry(layerId) {
    if (!layerId) return;
    
    legendEntries.delete(layerId);
    renderLegend();
}

/**
 * Rebuild the legend DOM from all entries (stacked in order)
 */
function renderLegend() {
    const legend = document.getElementById('legend');
    if (!legend) return;
    
    if (legendEntries.size === 0) {
        legend.innerHTML = `
            <h4>Map Legend</h4>
            <p>Activate layers to view more information.</p>
            <div class="color-scheme">
                <p>No active layers</p>
            </div>
        `;
        legend.style.display = 'block';
        return;
    }
    
    const sorted = [...legendEntries.entries()]
        .sort((a, b) => a[1].order - b[1].order)
        .map(([id, data]) => ({ id, ...data }));
    
    const entriesHtml = sorted.map(data => renderEntry(data)).join('');
    
    legend.innerHTML = `
        <h4>Map Legend</h4>
        <div class="legend-entries">
            ${entriesHtml}
        </div>
    `;
    legend.style.display = 'block';
}

/**
 * Render a single legend entry to HTML
 */
function renderEntry(entry) {
    if (entry.type === 'proportional-circles' && entry.items?.length) {
        return renderProportionalCirclesEntry(entry);
    }
    if (entry.type === 'stripe-intensity' && entry.items?.length) {
        return renderStripeIntensityEntry(entry);
    }
    if (entry.type === 'service-symbol' && entry.items?.length) {
        return renderServiceSymbolEntry(entry);
    }
    if (entry.type === 'forest-fire-symbol' && entry.items?.length) {
        return renderForestFireSymbolEntry(entry);
    }
    if (entry.type === 'edge-fade-ring' && entry.items?.length) {
        return renderEdgeFadeRingEntry(entry);
    }
    if (entry.type === 'sectarian-dummy-glyph' && entry.items?.length) {
        return renderSectarianDummyGlyphEntry(entry);
    }
    if (entry.type === 'categorical' && entry.items) {
        return renderCategoricalEntry(entry);
    }
    return renderColorScaleEntry(entry);
}

function renderSectarianDummyGlyphEntry(entry) {
    const itemsHtml = entry.items
        .map(item => {
            const svg = item.glyphSvg || '';
            return `
            <div style="display:flex; align-items:center; margin-bottom:8px;">
                <div style="flex-shrink:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid #d1d5db;border-radius:6px;background:#fafafa;">${svg}</div>
                <span style="font-size: 11px; color: #333; margin-left: 8px; line-height: 1.3;">${item.label}</span>
            </div>
        `;
        })
        .join('');

    const desc = entry.description
        ? `<p style="margin: 8px 0 0 0; font-size: 10px; color: #666; line-height: 1.35;">${entry.description}</p>`
        : '';

    return `
        <div class="legend-entry" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #eee;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #333;">${entry.layerName}</h4>
            <div class="color-scheme">
                <div class="color-boxes">${itemsHtml}</div>
                ${desc}
            </div>
        </div>
    `;
}

function renderServiceSymbolEntry(entry) {
    const symbol = entry.markerSymbol || '!';
    const itemsHtml = entry.items
        .map(item => `
            <div style="display:flex; align-items:center; margin-bottom:6px;">
                <div style="
                    width:18px;
                    height:18px;
                    border-radius:999px;
                    border:1px solid rgba(17,24,39,0.35);
                    background:#ffffff;
                    color:${item.color};
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:12px;
                    font-weight:800;
                    line-height:1;
                    box-shadow:0 1px 3px rgba(0,0,0,0.25);
                    flex-shrink:0;
                ">${symbol}</div>
                <span style="font-size: 11px; color: #333; margin-left: 8px; line-height: 1.25;">${item.label}</span>
            </div>
        `)
        .join('');

    return `
        <div class="legend-entry" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #eee;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #333;">${entry.layerName}</h4>
            <div class="color-scheme">
                <div class="color-boxes">${itemsHtml}</div>
                <p style="margin: 8px 0 0 0; font-size: 10px; color: #666; line-height: 1.3;">
                    Circle color follows class intensity; symbols cluster at lower zoom.
                </p>
            </div>
        </div>
    `;
}

function renderForestFireSymbolEntry(entry) {
    const itemsHtml = entry.items
        .map(item => {
            const icon = item.iconUrl
                ? `<img src="${item.iconUrl}" alt="" width="28" height="28" style="width:28px;height:28px;display:block;flex-shrink:0;">`
                : `<div style="width:28px;height:28px;flex-shrink:0;background:#e5e7eb;border-radius:4px;"></div>`;
            return `
            <div style="display:flex; align-items:center; margin-bottom:8px;">
                ${icon}
                <span style="font-size: 11px; color: #333; margin-left: 8px; line-height: 1.25;">${item.label}</span>
            </div>
        `;
        })
        .join('');

    const desc = entry.description
        ? `<p style="margin: 8px 0 0 0; font-size: 10px; color: #666; line-height: 1.3;">${entry.description}</p>`
        : `<p style="margin: 8px 0 0 0; font-size: 10px; color: #666; line-height: 1.3;">
                    Class icons at each unit. Service, Climate, and Gender sit side by side when several are on; at cadastre they cluster by majority class.
                </p>`;

    return `
        <div class="legend-entry" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #eee;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #333;">${entry.layerName}</h4>
            <div class="color-scheme">
                <div class="color-boxes">${itemsHtml}</div>
                ${desc}
            </div>
        </div>
    `;
}

function renderEdgeFadeRingEntry(entry) {
    const itemsHtml = entry.items
        .map(item => {
            const c = item.color || '#94a3b8';
            // Inward-only glow along the boundary (soft strokes clipped to the unit).
            const swatch = `
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" style="display:block;flex-shrink:0;border:1px solid #d1d5db;border-radius:4px;background:#f8fafc;">
                    <defs>
                        <clipPath id="edgeGlowClip-${c.replace('#', '')}">
                            <rect x="4" y="4" width="24" height="24" rx="3"/>
                        </clipPath>
                    </defs>
                    <g clip-path="url(#edgeGlowClip-${c.replace('#', '')})">
                        <rect x="4" y="4" width="24" height="24" rx="3" fill="none" stroke="${c}" stroke-width="10" opacity="0.18"/>
                        <rect x="4" y="4" width="24" height="24" rx="3" fill="none" stroke="${c}" stroke-width="6" opacity="0.35"/>
                        <rect x="4" y="4" width="24" height="24" rx="3" fill="none" stroke="${c}" stroke-width="2.5" opacity="0.85"/>
                    </g>
                </svg>
            `;
            return `
            <div style="display:flex; align-items:center; margin-bottom:6px;">
                ${swatch}
                <span style="font-size: 11px; color: #333; margin-left: 8px; line-height: 1.25;">${item.label}</span>
            </div>
        `;
        })
        .join('');

    const desc = entry.description
        ? `<p style="margin: 8px 0 0 0; font-size: 10px; color: #666; line-height: 1.3;">${entry.description}</p>`
        : `<p style="margin: 8px 0 0 0; font-size: 10px; color: #666; line-height: 1.3;">
                    Colored glow follows the unit boundary and is clipped so it only shows inside.
                </p>`;

    return `
        <div class="legend-entry" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #eee;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #333;">${entry.layerName}</h4>
            <div class="color-scheme">
                <div class="color-boxes">${itemsHtml}</div>
                ${desc}
            </div>
        </div>
    `;
}

function renderStripeIntensityEntry(entry) {
    const itemsHtml = entry.items
        .map(item => {
            const swatch = item.swatchHtml
                ? `<div style="flex-shrink:0; width:40px; height:24px; border:1px solid #c5cdd5; border-radius:4px; overflow:hidden;">${item.swatchHtml}</div>`
                : item.swatchStyle
                ? `<div style="flex-shrink:0; width:40px; height:24px; border:1px solid #c5cdd5; border-radius:4px; ${item.swatchStyle}"></div>`
                : `<div style="background:${item.color}; width:16px; height:16px; margin-right:6px; border-radius: 2px; border: 1px solid rgba(0,0,0,0.2);"></div>`;
            return `
            <div style="display:flex; align-items:center; margin-bottom:6px;">
                ${swatch}
                <span style="font-size: 11px; color: #333; margin-left: 8px; line-height: 1.25;">${item.label}</span>
            </div>
        `;
        })
        .join('');

    return `
        <div class="legend-entry" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #eee;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #333;">${entry.layerName}</h4>
            <div class="color-scheme">
                <div class="color-boxes">${itemsHtml}</div>
                <p style="margin: 8px 0 0 0; font-size: 10px; color: #666; line-height: 1.3;">
                    Patterns densify with intensity (dots → stripes → cross-hatch). Ranges are data quintiles.
                </p>
            </div>
        </div>
    `;
}

function renderProportionalCirclesEntry(entry) {
    const color = entry.color || '#f59e0b';
    const stroke = '#9a3412';
    const items = entry.items;
    const pad = 4;
    const defaultFillOpacity = Number.isFinite(Number(entry.fillOpacity)) ? Number(entry.fillOpacity) : 0.55;

    const itemsHtml = items.map(item => {
        const r = Math.max(4, Math.min(12, Number(item.radius) || 7));
        const fill = item.color || color;
        const fillOpacity = Number.isFinite(Number(item.fillOpacity)) ? Number(item.fillOpacity) : defaultFillOpacity;
        const svgSize = Math.ceil(r * 2 + pad * 2);
        const cx = svgSize / 2;
        const cy = svgSize / 2;
        return `
            <div style="display:flex; align-items:center; margin-bottom:6px;">
                <svg width="${svgSize}" height="${svgSize}" style="flex-shrink:0; display:block;" aria-hidden="true">
                    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="1" />
                </svg>
                <span style="font-size: 11px; color: #333; margin-left: 6px; line-height: 1.2;">${item.label}</span>
            </div>
        `;
    }).join('');

    return `
        <div class="legend-entry" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #eee;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #333;">${entry.layerName}</h4>
            <div class="color-scheme">
                <div class="color-boxes">${itemsHtml}</div>
                <p style="margin: 8px 0 0 0; font-size: 10px; color: #666; line-height: 1.3;">
                    Larger, darker circles = higher intensity; lighter yellow = lower. Opacity increases when you zoom in.
                </p>
            </div>
        </div>
    `;
}

function renderCategoricalEntry(entry) {
    const itemsHtml = entry.items
        .map(item => `
            <div style="display:flex; align-items:center; margin-bottom:4px;">
                <div style="background:${item.color}; width:16px; height:16px; margin-right:6px; border-radius: 2px; border: 1px solid rgba(0,0,0,0.2);"></div>
                <span style="font-size: 11px; color: #333;">${item.label}</span>
            </div>
        `)
        .join('');
    
    return `
        <div class="legend-entry" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #eee;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #333;">${entry.layerName}</h4>
            <div class="color-scheme">
                <div class="color-boxes">${itemsHtml}</div>
            </div>
        </div>
    `;
}

function renderColorScaleEntry(entry) {
    const { layerName, colorScheme, description, labels, values, unit } = entry;
    
    if (!labels || !colorScheme || labels.length !== colorScheme.length) {
        return '';
    }
    
    const isVulnerabilityData = (layerName || '').toLowerCase().includes('vulnerability') || 
        (layerName || '').toLowerCase().includes('sv') ||
        (layerName || '').toLowerCase().includes('social');
    const isPeaceSocialTensionsLayer = (layerName || '').toLowerCase().includes('tension and conflict risk');
    
    const enhancedLabels = labels.map((label, index) => {
        let enhancedLabel = label;
        if (values && values[index]) {
            enhancedLabel = `${values[index]} ${unit || ''}`.trim();
        }
        // Skip auto-wrapping when the entry already provides qualitative + range labels
        // (scaleDirection themes / layers that combine "Low (0.1 - 0.2)" upstream).
        const skipAutoQualitativeWrap =
            entry.scaleDirection === 'yellow-orange-red' ||
            entry.scaleDirection === 'white-to-dark-blue' ||
            entry.scaleDirection === 'white-to-red' ||
            entry.scaleDirection === 'white-to-orange' ||
            entry.scaleDirection === 'white-to-pink' ||
            /\(\s*[\d.]/.test(String(enhancedLabel || ''));
        if (isVulnerabilityData && !skipAutoQualitativeWrap) {
            const vulnTerms = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
            if (index < vulnTerms.length) {
                enhancedLabel = isPeaceSocialTensionsLayer
                    ? `${vulnTerms[index]} (${enhancedLabel})`
                    : `${enhancedLabel} (${vulnTerms[index]})`;
            }
        }
        return enhancedLabel;
    });
    
    let directionalInfo = '';
    if (colorScheme.length > 1) {
        if (entry.scaleDirection === 'green-low-red-high') {
            directionalInfo = `
                <div style="margin-top: 8px; padding: 6px; background: #f8f9fa; border-radius: 4px; font-size: 10px; color: #666; line-height: 1.4;">
                    <strong>Scale:</strong> Green = Lowest &nbsp;→&nbsp; Red = Highest
                </div>
            `;
        } else if (entry.scaleDirection === 'yellow-orange-red') {
            directionalInfo = '';
        } else if (entry.scaleDirection === 'white-to-dark-blue') {
            directionalInfo = `
                <div class="legend-scale-note" style="margin-top: 8px; padding: 6px; background: #f8f9fa; border-radius: 4px; font-size: 10px; color: #666; line-height: 1.35; max-width: 11.5em;">
                    <strong>Scale:</strong> White = lower vulnerability<br>→ Dark blue = higher vulnerability
                </div>
            `;
        } else if (entry.scaleDirection === 'white-to-red') {
            directionalInfo = `
                <div class="legend-scale-note" style="margin-top: 8px; padding: 6px; background: #f8f9fa; border-radius: 4px; font-size: 10px; color: #666; line-height: 1.35; max-width: 11.5em;">
                    <strong>Scale:</strong> White = lower risk<br>→ Red = higher risk
                </div>
            `;
        } else if (entry.scaleDirection === 'white-to-orange') {
            directionalInfo = `
                <div class="legend-scale-note" style="margin-top: 8px; padding: 6px; background: #f8f9fa; border-radius: 4px; font-size: 10px; color: #666; line-height: 1.35; max-width: 11.5em;">
                    <strong>Scale:</strong> White = lower vulnerability<br>→ Orange = higher vulnerability
                </div>
            `;
        } else if (entry.scaleDirection === 'white-to-pink') {
            directionalInfo = `
                <div class="legend-scale-note" style="margin-top: 8px; padding: 6px; background: #f8f9fa; border-radius: 4px; font-size: 10px; color: #666; line-height: 1.35; max-width: 11.5em;">
                    <strong>Scale:</strong> White = lower vulnerability<br>→ Pink = higher vulnerability
                </div>
            `;
        } else if (isVulnerabilityData) {
            directionalInfo = `
                <div style="margin-top: 8px; padding: 6px; background: #f8f9fa; border-radius: 4px; font-size: 10px; color: #666;">
                    <strong>Interpretation:</strong> Blue = Lower vulnerability, Red = Higher vulnerability
                </div>
            `;
        } else {
            directionalInfo = `
                <div style="margin-top: 8px; padding: 6px; background: #f8f9fa; border-radius: 4px; font-size: 10px; color: #666;">
                    <strong>Scale:</strong> Light to Dark = Low to High
                </div>
            `;
        }
    }
    
    const boxesHtml = colorScheme
        .map((color, index) =>
            `<div style="display:flex; align-items:center; margin-bottom:4px;">
                <div style="background:${color}; width:16px; height:16px; margin-right:6px; border-radius: 2px; border: 1px solid rgba(0,0,0,0.2);"></div>
                <span style="font-size: 11px; color: #333;">${enhancedLabels[index]}</span>
            </div>`
        )
        .join('');
    const descriptionHtml = description
        ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #666; line-height: 1.3;">${description}</p>`
        : '';
    
    return `
        <div class="legend-entry" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #eee;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #333;">${layerName}</h4>
            ${descriptionHtml}
            <div class="color-scheme">
                <div class="color-boxes">${boxesHtml}</div>
                ${directionalInfo}
            </div>
        </div>
    `;
}

/**
 * Update the legend for a single layer (backward compatibility).
 * Used when no layerId is available - replaces entire legend with this entry.
 */
export function updateLegend(layerName, colorScheme, description, labels, values = null, unit = '') {
    const legend = document.getElementById('legend');
    if (!legend) return;
    if (!labels || labels.length !== colorScheme.length) return;
    
    const entry = { layerName, colorScheme, description, labels, values, unit };
    legendEntries.clear();
    legendEntries.set('_legacy', { ...entry, order: 0 });
    renderLegend();
}

/**
 * Hide the legend / clear all entries and show default
 */
export function hideLegend() {
    legendEntries.clear();
    renderLegend();
}
