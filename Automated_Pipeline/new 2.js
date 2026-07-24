// =========================================================================
// 1. STUDY AREA & CONFIGURATION (Unchanged)
// =========================================================================
var lebanon = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017')
  .filter(ee.Filter.eq('country_na', 'Lebanon'));

var dataset = ee.ImageCollection("NASA/GDDP-CMIP6");

var configs = [
  {name: 'Baseline_1995_2014', scenario: 'historical', startYear: 1995, endYear: 2014},
  {name: 'SSP245_2021_2040',   scenario: 'ssp245',     startYear: 2021, endYear: 2040},
  {name: 'SSP585_2041_2060',   scenario: 'ssp585',     startYear: 2041, endYear: 2060}
];

// CRITICAL FIX 1: Bring the model lists to the client-side using .getInfo()
// This prevents GEE from treating the model loop as a giant server-side graph
var allModels = dataset.aggregate_array('model').distinct().getInfo();
var excludedModels = ['CESM2', 'CESM2-WACCM', 'IITM-ESM'];
var su35Models = allModels.filter(function(model) { 
  return excludedModels.indexOf(model) === -1; 
});
var cddModels = allModels;

// =========================================================================
// 2. CLIMATE INDEX FUNCTIONS (Unchanged logic)
// =========================================================================
// Calculates Mean Annual Hot Days (SU35: tasmax > 35°C / 308.15 Kelvin)
var calculateSU35 = function(model, scenario, startYear, endYear) {
  var years = ee.List.sequence(startYear, endYear);
  
  var annualCounts = years.map(function(year) {
    var dailyTemp = dataset
      .filter(ee.Filter.eq('model', model))
      .filter(ee.Filter.eq('scenario', scenario))
      .filterDate(ee.Date.fromYMD(year, 1, 1), ee.Date.fromYMD(year, 12, 31))
      .select('tasmax');
      
    return dailyTemp.map(function(img) {
      return img.gt(308.15).rename('hot');
    }).sum();
  });
  
  return ee.ImageCollection(annualCounts).mean().clip(lebanon);
};

// Calculates Mean Annual Consecutive Dry Days (CDD: Max streak of Pr < 1mm)
var calculateCDD = function(model, scenario, startYear, endYear) {
  var years = ee.List.sequence(startYear, endYear);
  
  var annualMaxStreaks = years.map(function(year) {
    var dailyPr = dataset
      .filter(ee.Filter.eq('model', model))
      .filter(ee.Filter.eq('scenario', scenario))
      .filterDate(ee.Date.fromYMD(year, 1, 1), ee.Date.fromYMD(year, 12, 31))
      .select('pr');
      
    // Binary map: 1 if dry (<1mm/day), 0 if wet (pr * 86400 converts kg/m^2/s to mm/day)
    var dailyDry = dailyPr.map(function(img) {
      return img.multiply(86400).lt(1.0).rename('dry');
    });
    
    // State tracker: [current_streak, max_streak]
    var initial = ee.Image.cat([ee.Image.constant(0), ee.Image.constant(0)])
                    .rename(['current', 'max'])
                    .double();
    
    var streakIteration = function(img, prev) {
      var prevImg = ee.Image(prev);
      var current = prevImg.select('current').add(1).multiply(ee.Image(img)).rename('current');
      var max = prevImg.select('max').max(current).rename('max');
      return ee.Image.cat([current, max]);
    };
    
    return ee.Image(dailyDry.iterate(streakIteration, initial)).select('max');
  });
  
  return ee.ImageCollection(annualMaxStreaks).mean().clip(lebanon);
};
// =========================================================================
// 3. RUN EXPORT PIPELINE (Modified to break up the graph)
// =========================================================================

configs.forEach(function(config) {
  
  // A. SU35 - Can still be ensembled on-the-fly because .sum() is highly optimized
  var su35List = su35Models.map(function(model) {
    return calculateSU35(model, config.scenario, config.startYear, config.endYear);
  });
  // Because su35Models is now a client-side Array, we convert the result back to an ImageCollection
  var ensembleSU35 = ee.ImageCollection.fromImages(su35List).mean().rename('SU35');
  
  Export.image.toDrive({
    image: ensembleSU35,
    description: 'Lebanon_SU35_Ensemble_' + config.name,
    folder: 'Lebanon_Climate_Indices',
    region: lebanon.geometry(),
    scale: 27830, 
    crs: 'EPSG:4326'
  });

  // B. CDD - Must be exported PER MODEL to avoid OOM
  cddModels.forEach(function(model) {
    var modelCDD = calculateCDD(model, config.scenario, config.startYear, config.endYear);
    
    // Clean up model names for export (removes hyphens/dots which can cause export naming errors)
    var safeModelName = model.replace(/[^a-zA-Z0-9]/g, '_');
    
    Export.image.toDrive({
      image: modelCDD.rename('CDD'),
      description: 'Lebanon_CDD_' + safeModelName + '_' + config.name,
      folder: 'Lebanon_Climate_Indices_CDD_Models', // Group them in a folder
      region: lebanon.geometry(),
      scale: 27830, 
      crs: 'EPSG:4326'
    });
  });
});