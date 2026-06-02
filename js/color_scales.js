// color_scales.js - Color scale definitions for data visualization

/**
 * Color scales for different data layers
 */
export const colorScales = {
    // Cell tower density color scale

    ndvi: {
        ranges: [0, 1250, 2500, 5000, 10000],
        colors: ['#e0f5e0', '#a3d9a3','#5cb85c', '#2d882d', '#004d00'], // Magma //'rgba(0,0,0,0)',
    },
    nightlightintensity: {
        ranges: [0, 2, 5, 10, 25],
        colors: ['#000004', '#51127c', '#b73779', '#fb8761', '#fcfdbf'], // Magma
    },
    cellTowerDensity: {
        ranges: [0, 2, 5, 10, 25],
        colors: ['#000004', '#51127c', '#b73779', '#fb8761', '#fcfdbf'], // Magma
    },
    conflict: {
        ranges: [0, 2, 5, 10, 25],
        colors: ['#fee0d2', '#fc9272', '#ef3b2c', '#cb181d', '#67000d'], // white to red
    },
    // Population density color scale
    populationDensity: {
        ranges: [0, 25, 50, 75, 100],
        colors: ['#FFFFFF', '#CCCCCC', '#999999', '#666666', '#333333'], // White to Dark Gray
    },
    
    // Social vulnerability color scale
    socialVulnerability: {
        ranges: [0, 0.302, 0.542, 0.68, 0.9, 1],
        colors: ['#2b83ba', '#abdda4', '#ffffbf', '#fdae61', '#d7191c'], // Blue to Red, Custom color ranges from admin
    },
    
    // Relative wealth color scale
    relativeWealth: {
        ranges: [0, 2, 4, 6, 8, 10],
        colors: ['#000004', '#51127c', '#b73779', '#fb8761', '#fcfdbf'], // Magma
    },
     // Temp
     temp: {
        ranges: [15, 20, 25, 30, 35, 40],
        colors: ['#2b83ba', '#abdda4', '#ffffbf', '#fdae61', '#d7191c'], // Blue to Red, Custom color ranges from admin
    }
};

/**
 * Generate a color scale based on a min, max, and color ramp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {Array} colorRamp - Array of color hex codes
 * @param {number} steps - Number of steps in the scale
 * @returns {Object} - Color scale object with ranges and colors
 */
export function generateColorScale(min, max, colorRamp, steps = 5) {
    const range = max - min;
    const stepSize = range / steps;
    
    const ranges = [];
    for (let i = 0; i <= steps; i++) {
        ranges.push(min + (stepSize * i));
    }
    
    return {
        ranges: ranges,
        colors: colorRamp
    };
}

/**
 * Predefined color ramps for different types of data, each with 5 classes
 */
export const colorRamps = {
    whiteToDarkGreen: {
        name: 'White to Dark Green',
        colors: ['#ffffff', '#d8f2d8', '#9ed89e', '#4fae4f', '#0b5d1e']
      },
      whiteToDarkPurple: {
        name: 'White to Dark Purple',
        colors: ['#ffffff', '#e6d9f2', '#c3a6e0', '#8e5cbf', '#4a1f73']
      },
      whiteToDarkBlue: {
        name: 'White to Dark Blue',
        colors: ['#ffffff', '#dbeafe', '#93c5fd', '#3b82f6', '#1e3a8a']
      },
      whiteToDarkGray: {
        name: 'White to Dark Gray',
        colors: ['#ffffff', '#e5e7eb', '#9ca3af', '#4b5563', '#1f2937']
      },
    blueToRed: {
        name: 'Blue to Red',
        colors: ['#2c7bb6', '#abd9e9', '#ffffbf', '#fdae61', '#d7191c']
    },
    redToBlue: {
        name: 'Red to Blue',
        colors: ['#d7191c', '#fdae61', '#ffffbf', '#abd9e9', '#2c7bb6']
    },
    whiteToBlack: {
        name: 'White to Black',
        colors: ['#ffffff', '#d9d9d9', '#bdbdbd', '#737373', '#252525']
    },
    purpleToOrange: {
        name: 'Purple to Orange',
        colors: ['#7b3294', '#c2a5cf', '#f7f7f7', '#fdae61', '#e66101']
    },
    greenToRed: {
        name: 'Green to Red',
        colors: ['#1a9641', '#a6d96a', '#ffffbf', '#fdae61', '#d7191c']
    },
    greenYellowOrangeRed: {
        name: 'Green – Yellow – Orange – Red',
        colors: ['#1a9641', '#ffff33', '#fd8d3c', '#e31a1c']
    },
    yellowOrangeRed3: {
        name: 'Yellow – Orange – Red (3 classes)',
        // Ascending classes: low = yellow, medium = orange, high = red.
        colors: ['#ffff33', '#fd8d3c', '#e31a1c']
    },
    yellowOrangeRedShock5: {
        name: 'Yellow – Orange – Red (Shock 5 classes)',
        colors: ['#fff7bc', '#fee391', '#fec44f', '#fe9929', '#d7301f']
    },
    blueToYellow: {
        name: 'Blue to Yellow',
        colors: ['#0571b0', '#92c5de', '#f7f7f7', '#f4a582', '#ca0020']
    },
    // Popular QGIS/CartoDB color schemes
    viridis: {
        name: 'Viridis',
        colors: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725']
    },
    magma: {
        name: 'Magma',
        colors: ['#000004', '#51127c', '#b73779', '#fb8761', '#fcfdbf']
    },
    plasma: {
        name: 'Plasma',
        colors: ['#0d0887', '#6a00a8', '#b12a90', '#e16462', '#fca636']
    },
    inferno: {
        name: 'Inferno',
        colors: ['#000004', '#420a68', '#932667', '#dd513a', '#fca50a']
    },
    spectral: {
        name: 'Spectral',
        colors: ['#9e0142', '#f46d43', '#ffffbf', '#66c2a5', '#5e4fa2']
    },
    rdYlGn: {
        name: 'Red-Yellow-Green',
        colors: ['#d73027', '#fc8d59', '#ffffbf', '#91cf60', '#1a9850']
    },
    rdYlBu: {
        name: 'Red-Yellow-Blue',
        colors: ['#d73027', '#fc8d59', '#ffffbf', '#91bfdb', '#4575b4']
    }
};