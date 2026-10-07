/**
 * Theme plates used in Active Layers, and the same plates at legend size.
 */

export const THEME_LAYER_COLORS = {
    svAdmin1Layer: '#2e8b57',
    svAdmin2Layer: '#2b83ba',
    svAdmin3Layer: '#7b3294',
    svAdmin4Layer: '#8b5cf6',
    svClimateLayer: '#b2182b',
    svPoliticalLayer: '#e66101',
    svGenderLayer: '#c51b7d'
};

export function layerVisualCueHtml(layerId, options = {}) {
    const compact = Boolean(options.compact);
    const suffix = String(options.idSuffix || 'main').replace(/[^a-zA-Z0-9_-]/g, '') || 'main';
    const sizeClass = compact ? ' layer-cue-inline' : '';
    const fillSwatch = (c1, c2, c3) => `
        <div class="welcome-composite-swatch welcome-composite-swatch-fill layer-cue${sizeClass}" aria-hidden="true">
            <span style="background:${c1};"></span>
            <span style="background:${c2};"></span>
            <span style="background:${c3};"></span>
        </div>
    `;
    const iconSwatch = (low, medium, high) => `
        <div class="welcome-composite-swatch welcome-composite-swatch-icons layer-cue${sizeClass}" aria-hidden="true">
            <img src="${low}" alt="">
            <img src="${medium}" alt="">
            <img src="${high}" alt="">
        </div>
    `;

    switch (layerId) {
        case 'svOverallTensionLayer':
        case 'svCustomOverallLayer':
            return fillSwatch('#ffffff', '#3b82f6', '#1e3a8a');
        case 'svAdmin3Layer':
            return fillSwatch('#e6d9f2', '#8e5cbf', '#4a1f73');
        case 'svAdmin2Layer':
            return `<div class="welcome-composite-swatch layer-cue layer-cue-stripes-gray${sizeClass}" aria-hidden="true"></div>`;
        case 'svAdmin4Layer':
            return iconSwatch(
                'assets/service-symbol-low.svg',
                'assets/service-symbol-medium.svg',
                'assets/service-symbol-high.svg'
            );
        case 'svClimateLayer':
            return iconSwatch(
                'assets/forest-fire-low.svg',
                'assets/forest-fire-medium.svg',
                'assets/forest-fire-high.svg'
            );
        case 'svPoliticalLayer':
            return `
                <div class="welcome-composite-swatch welcome-composite-swatch-glow layer-cue${sizeClass}" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="56" height="40" viewBox="0 0 56 40">
                        <defs>
                            <clipPath id="activeLayerPoliticalGlowClip-${suffix}">
                                <rect x="6" y="5" width="44" height="30" rx="4"/>
                            </clipPath>
                        </defs>
                        <rect class="layer-cue-plate" x="1" y="1" width="54" height="38" rx="6" fill="#f8fafc"/>
                        <g clip-path="url(#activeLayerPoliticalGlowClip-${suffix})">
                            <rect x="6" y="5" width="44" height="30" rx="4" fill="none" stroke="#93c5fd" stroke-width="12" opacity="0.28"/>
                            <rect x="6" y="5" width="44" height="30" rx="4" fill="none" stroke="#3b82f6" stroke-width="7" opacity="0.45"/>
                            <rect x="6" y="5" width="44" height="30" rx="4" fill="none" stroke="#1e3a8a" stroke-width="3"/>
                        </g>
                    </svg>
                </div>
            `;
        case 'svGenderLayer':
            return iconSwatch(
                'assets/gender-symbol-low.svg',
                'assets/gender-symbol-medium.svg',
                'assets/gender-symbol-high.svg'
            );
        case 'svAdmin1Layer':
            return `
                <div class="welcome-composite-swatch layer-cue layer-cue-circles${sizeClass}" aria-hidden="true">
                    <span class="layer-cue-circle" style="width:8px;height:8px;background:#fef08a;"></span>
                    <span class="layer-cue-circle" style="width:12px;height:12px;background:#ea580c;"></span>
                    <span class="layer-cue-circle" style="width:16px;height:16px;background:#c2410c;"></span>
                </div>
            `;
        default:
            return '';
    }
}
