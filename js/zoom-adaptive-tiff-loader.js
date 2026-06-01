// zoom-adaptive-tiff-loader.js

/**
 * Add hover tooltip functionality to display raster values
 */
function addHoverTooltip(map, rasterArray, bounds, width, height, layerName, tiffLayers) {
    // Create a tooltip instance
    const tooltip = L.tooltip({ permanent: false, direction: 'top', offset: [0, -10] });
    
    // Event: Mouse moves on the map
    function onMouseMove(e) {
        if (!bounds.contains(e.latlng)) {
            map.closeTooltip(tooltip);
            return;
        }

        const latLng = e.latlng;
        const x = Math.floor((latLng.lng - bounds.getWest()) / (bounds.getEast() - bounds.getWest()) * width);
        const y = Math.floor((bounds.getNorth() - latLng.lat) / (bounds.getNorth() - bounds.getSouth()) * height);

        const index = y * width + x;

        if (x >= 0 && x < width && y >= 0 && y < height) {
            const value = rasterArray[index];
            if (value !== undefined && !isNaN(value)) {
                tooltip.setLatLng(e.latlng).setContent(`Value: ${value.toFixed(2)}`);
                tooltip.addTo(map);
            } else {
                map.closeTooltip(tooltip);
            }
        } else {
            map.closeTooltip(tooltip);
        }
    }

    // Event: Mouse leaves the map
    function onMouseOut() {
        map.closeTooltip(tooltip);
    }

    // Attach events when the raster layer is added
    function attachEvents() {
        map.on('mousemove', onMouseMove);
        map.on('mouseout', onMouseOut);
    }

    // Detach events when the raster layer is removed
    function detachEvents() {
        map.off('mousemove', onMouseMove);
        map.off('mouseout', onMouseOut);
        map.closeTooltip(tooltip);
    }

    // Bind events to the layer lifecycle
    if (tiffLayers[layerName] && tiffLayers[layerName].on) {
        tiffLayers[layerName].on('add', attachEvents);
        tiffLayers[layerName].on('remove', detachEvents);
    }

    // Explicitly attach events if the layer is already on the map
    if (map.hasLayer(tiffLayers[layerName])) {
        attachEvents();
    }
}

/**
 * Load and render a GeoTIFF with zoom-dependent smoothing
 */
export async function loadTiff(url, layerName, tiffLayers, map, colorScale) {
    console.log("Entered LoadTiff")
    // Add validation for colorScale
    if (!colorScale || !colorScale.ranges || !colorScale.colors) {
        console.error(`Invalid colorScale for ${layerName}:`, colorScale);
        throw new Error(`Invalid colorScale for layer "${layerName}". The colorScale must have ranges and colors properties.`);
    }

    // Load the TIFF data
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();
    console.log(`TIFF loaded: ${layerName}, Size: ${image.getWidth()}x${image.getHeight()}`);
    // Get geographic information
    const tiePoint = image.getTiePoints()[0];
    const pixelScale = image.getFileDirectory().ModelPixelScale;
    console.log(`TIFF geo info for ${layerName}:`, {
        tiePoint: tiePoint,
        pixelScale: pixelScale,
        mapCRS: map.options.crs.code
    });
    const minX = tiePoint.x;
    const maxY = tiePoint.y;
    const maxX = minX + pixelScale[0] * image.getWidth();
    const minY = maxY - pixelScale[1] * image.getHeight();


    console.log(`TIFF bounds for ${layerName}:`, {
        minX: minX, minY: minY,
        maxX: maxX, maxY: maxY
    });
    const bounds = L.latLngBounds([
        [minY, minX],
        [maxY, maxX]
    ]);
    console.log(`Leaflet bounds for ${layerName}:`, {
        southwest: bounds.getSouthWest().toString(),
        northeast: bounds.getNorthEast().toString()
    });

    const geographicWidth = maxX - minX;  // Width in geographic coordinates
    const geographicHeight = maxY - minY; // Height in geographic coordinates
    const geoAspectRatio = geographicWidth / geographicHeight;
    
    const pixelWidth = image.getWidth();  // Width in pixels
    const pixelHeight = image.getHeight(); // Height in pixels
    const pixelAspectRatio = pixelWidth / pixelHeight;
    
    console.log(`GeoTIFF: ${layerName}`);
    console.log(`Dimensions: ${pixelWidth}x${pixelHeight} pixels`);
    console.log(`Geographic coverage: Width=${geographicWidth.toFixed(6)}°, Height=${geographicHeight.toFixed(6)}°`);
    console.log(`Pixel aspect ratio: ${pixelAspectRatio.toFixed(4)}`);
    console.log(`Geographic aspect ratio: ${geoAspectRatio.toFixed(4)}`);
    console.log(`Aspect ratio discrepancy: ${(pixelAspectRatio/geoAspectRatio).toFixed(4)}`);
    
    // If the discrepancy is significant (e.g., more than 5%), log a warning
    if (Math.abs(pixelAspectRatio/geoAspectRatio - 1) > 0.05) {
        console.warn(`WARNING: Significant aspect ratio mismatch for ${layerName}!`);
        console.warn(`The image may appear stretched when rendered.`);
    }


    // Read the raster data
    const rasterData = await image.readRasters();
    const rasterArray = rasterData[0]; // Assume single-band TIFF
    
    // Get min and max values for better color mapping
    let min = Infinity;
    let max = -Infinity;
    let validPixelCount = 0;

    for (let i = 0; i < rasterArray.length; i++) {
        const value = rasterArray[i];
        if (value !== -1 && value !== 0 && !isNaN(value)) {
            min = Math.min(min, value);
            max = Math.max(max, value);
            validPixelCount++;
        }
    }

    console.log(`TIFF data statistics for ${layerName}:`, {
        min: min,
        max: max,
        validPixelCount: validPixelCount,
        totalPixels: rasterArray.length,
        validPercentage: (validPixelCount / rasterArray.length * 100).toFixed(2) + '%'
    });
    // Create the initial image overlay
    createImageOverlay(image, rasterArray, bounds, colorScale, layerName, tiffLayers, map);
    
    // Add hover tooltip functionality
    addHoverTooltip(map, rasterArray, bounds, image.getWidth(), image.getHeight(), layerName, tiffLayers);
    
    // Listen for zoom end events to regenerate the overlay with appropriate smoothing
    map.on('zoomend', function() {
        if (map.hasLayer(tiffLayers[layerName])) {
            // Remove the existing layer
            map.removeLayer(tiffLayers[layerName]);
            
            // Create a new layer with appropriate smoothing for the current zoom
            createImageOverlay(image, rasterArray, bounds, colorScale, layerName, tiffLayers, map);
            addHoverTooltip(map, rasterArray, bounds, image.getWidth(), image.getHeight(), layerName, tiffLayers);
        }
    });
     // Log GeoTIFF projection information
     console.log(`${layerName} - GeoTIFF Projection:`, {
        url: url,
        projection: image.getFileDirectory().GeoAsciiParamsTag || 'Not specified',
        fileDirectory: image.getFileDirectory(),
        tiePoints: image.getTiePoints(),
        pixelScale: image.getFileDirectory().ModelPixelScale,
        width: image.getWidth(),
        height: image.getHeight(),
        mapCRS: map.options.crs.code
     });
    return tiffLayers[layerName];
}

/**
 * Create an image overlay with appropriate smoothing for the current zoom level
 */
function createImageOverlay(image, rasterArray, bounds, colorScale, layerName, tiffLayers, map) {
    const width = image.getWidth();
    const height = image.getHeight();
    console.log(`Creating image overlay for ${layerName} (${width}x${height})`);
    // Check current zoom level to determine smoothing
    const currentZoom = map.getZoom();
    const shouldSmooth = currentZoom < 8; // Adjust this threshold as needed
    
    // Create a canvas for rendering
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Set smoothing based on zoom level
    ctx.imageSmoothingEnabled = shouldSmooth;
    ctx.mozImageSmoothingEnabled = shouldSmooth;
    ctx.webkitImageSmoothingEnabled = shouldSmooth;
    ctx.msImageSmoothingEnabled = shouldSmooth;
    
    if (shouldSmooth) {
        ctx.imageSmoothingQuality = 'medium';
    }
    const samplePoints = [
        0,
        Math.floor(width * height / 4),
        Math.floor(width * height / 2),
        Math.floor(3 * width * height / 4),
        width * height - 1
    ];
    console.log(`Sample raster values for ${layerName}:`, samplePoints.map(idx => {
        return { index: idx, value: rasterArray[idx] };
    }));
    // Create image data at the original size
    const imgData = ctx.createImageData(width, height);
    
    // Create a color lookup table for better performance
    const colorLookup = new Map();

    let transparentCount = 0;
    let coloredCount = 0;
    
    // Fill the image data with colors based on values
    for (let i = 0; i < rasterArray.length; i++) {
        const value = rasterArray[i];
        
        // Handle no-data values
        if (value === -1 || value === 0 || isNaN(value)) {
            imgData.data[4 * i + 3] = 0; // Fully transparent
            transparentCount++;
            continue;
        }

        // Get color with caching for performance
        let color;
        if (colorLookup.has(value)) {
            color = colorLookup.get(value);
        } else {
            color = getColorForValue(value, colorScale);
            colorLookup.set(value, color);
        }
        
        imgData.data[4 * i + 0] = color[0]; // R
        imgData.data[4 * i + 1] = color[1]; // G
        imgData.data[4 * i + 2] = color[2]; // B
        imgData.data[4 * i + 3] = 255;      // A
        coloredCount++;
    }
    console.log(`Pixel stats for ${layerName}: ${coloredCount} colored, ${transparentCount} transparent`);
    // Put the image data on the canvas
    ctx.putImageData(imgData, 0, 0);
    
    // Convert to image URL
    const imgUrl = canvas.toDataURL();
    
    // Create and add the overlay
    tiffLayers[layerName] = L.imageOverlay(imgUrl, bounds, { 
        opacity: 1,
        crossOrigin: true,
        interactive: true,
        className: shouldSmooth ? 'smooth-image' : 'crisp-image'
    });
    console.log(`Leaflet imageOverlay created for ${layerName}`);
    // Add the layer to the map
    tiffLayers[layerName].addTo(map);
    
    // Apply the CSS style directly to the image element
    tiffLayers[layerName].on('load', function() {
        const imgElement = this._image;
        if (imgElement) {
            if (shouldSmooth) {
                imgElement.style.imageRendering = 'auto';
            } else {
                imgElement.style.imageRendering = 'pixelated'; // Chrome
                imgElement.style.imageRendering = '-moz-crisp-edges'; // Firefox
                imgElement.style.imageRendering = 'crisp-edges'; // Standard
            }
            console.log(`Rendered image dimensions for ${layerName}: ${imgElement.width}x${imgElement.height}`);
        }
    });
}

/**
 * Get RGB color for a value based on the color scale
 */
function getColorForValue(value, colorScale) {
    // Handle case where colorScale is undefined or invalid
    if (!colorScale || !colorScale.ranges || !colorScale.colors) {
        return [128, 128, 128]; // Return gray if color scale is invalid
    }

    const { ranges, colors } = colorScale;
    
    // Make sure ranges and colors exist and have length
    if (!Array.isArray(ranges) || !Array.isArray(colors) || ranges.length < 2 || colors.length < 1) {
        return [128, 128, 128]; // Return gray if invalid structure
    }

    // Find the appropriate color range for the value
    for (let i = 0; i < ranges.length - 1; i++) {
        if (value >= ranges[i] && value < ranges[i + 1]) {
            return hexToRgb(colors[i]);
        }
    }
    
    // Return the last color if the value is at or above the highest range
    return hexToRgb(colors[colors.length - 1]);
}

/**
 * Convert hex color to RGB array
 */
function hexToRgb(hex) {
    // Check if this is a valid hex color
    if (!hex || typeof hex !== 'string' || !hex.match(/^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)) {
        return [128, 128, 128]; // Return gray as fallback
    }

    // Remove '#' if present
    hex = hex.replace('#', '');
    
    // Convert 3-digit hex to 6-digit
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    // Parse the hex values
    const bigint = parseInt(hex, 16);
    return [
        (bigint >> 16) & 255, // Red
        (bigint >> 8) & 255,  // Green
        bigint & 255          // Blue
    ];
}