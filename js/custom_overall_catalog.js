/**
 * Catalog for the experimental Custom Overall builder.
 * Self-contained so the feature can be removed without hunting through layer_controls.
 *
 * Display labels follow scripts/Indicators_Inside_Tool.xlsx.
 * `field` values must match GeoJSON property keys (do not rename without updating data).
 */

/** @typedef {{ field: string, label: string }} CustomIndicator */
/** @typedef {{
 *   themeNumber: number,
 *   layerId: string,
 *   weightsKey: string | null,
 *   title: string,
 *   scoreField: string,
 *   resolutions: string[],
 *   indicators: CustomIndicator[]
 * }} CustomThemeDef */

/** @type {CustomThemeDef[]} */
export const CUSTOM_OVERALL_THEMES = [
    {
        themeNumber: 1,
        layerId: 'svAdmin1Layer',
        weightsKey: null,
        title: 'Displacement Pressure',
        scoreField: 'Displacement Ratio',
        resolutions: ['governorate', 'district', 'cadastre'],
        indicators: [
            { field: 'Displacement Ratio', label: 'Displacement Ratio' },
            { field: 'Outside CS', label: 'Outside CS' },
            { field: 'Inside CS', label: 'Inside CS' },
            { field: 'Overall IDPs', label: 'Overall IDPs' },
            { field: 'Population', label: 'Population' },
            { field: 'Number of IDPs', label: 'Number of IDPs' },
            { field: 'Number of of Palestinians', label: 'Number of Palestinians' },
            { field: 'Number of registered Syrians', label: 'Number of registered Syrians' },
            {
                field: 'Ratio of IDPs, SYR, and palestinians per host residents, at cadastre level',
                label: 'Ratio of IDPs / Syrians / Palestinians per host residents'
            }
        ]
    },
    {
        themeNumber: 2,
        layerId: 'svAdmin3Layer',
        weightsKey: '2',
        title: 'Tensions and Conflict Risk',
        scoreField: 'composite_score',
        resolutions: ['governorate', 'district', 'cadastre'],
        indicators: [
            { field: 'Inter-sectarian and inter-communal conflict incidents', label: 'Inter-sectarian and inter-communal conflict incidents' },
            { field: 'Number of violent incidents', label: 'Number of violent incidents' },
            { field: 'Number of crime incidents', label: 'Number of crime incidents' },
            { field: 'Number of fatalities in tension incidents', label: 'Number of fatalities in tension incidents' },
            { field: 'Fear of traveling within Lebanon safely', label: 'Fear of traveling within Lebanon safely' },
            { field: 'Feeling lack of safety during the night', label: 'Feeling lack of safety during the night' }
        ]
    },
    {
        themeNumber: 3,
        layerId: 'svAdmin2Layer',
        weightsKey: '3',
        title: 'Socioeconomic Vulnerability',
        scoreField: 'composite_score',
        resolutions: ['governorate', 'district', 'cadastre'],
        indicators: [
            { field: 'Absolute Vulnerability', label: 'Poverty Level' },
            { field: 'Household Deprivation Score', label: 'Household Deprivation Score' },
            { field: 'Nighttime light radiance', label: 'Nighttime light radiance' }
        ]
    },
    {
        themeNumber: 4,
        layerId: 'svAdmin4Layer',
        weightsKey: '4',
        title: 'Service & Infrastructure Vulnerability',
        scoreField: 'composite_score',
        resolutions: ['governorate', 'district'],
        indicators: [
            { field: 'Service-related incidents', label: 'Service-related incidents' },
            { field: 'Perceptions on quality of services: Water', label: 'Perceptions on quality of services: Water' },
            { field: 'Perceptions on quality of services: Electricity', label: 'Perceptions on quality of services: Electricity' },
            { field: 'Perceptions on quality of services: Waste Removal', label: 'Perceptions on quality of services: Waste Removal' },
            { field: 'Worry about access to healthcare services', label: 'Worry about access to healthcare services' },
            { field: 'Worry about access to safe drinking water', label: 'Worry about access to safe drinking water' },
            { field: 'Water availability and accessibility', label: 'Water availability and accessibility' },
            { field: 'Services as a tension driver', label: 'Services as a tension driver' },
            { field: 'Solid waste pressure (displacement)', label: 'Solid waste pressure (kg)' },
            { field: 'Incidents around civil defence', label: 'Incidents around civil defence' },
            { field: 'Incidents around education', label: 'Incidents around education' },
            { field: 'Incidents around electricity', label: 'Incidents around electricity' },
            { field: 'Incidents around generator', label: 'Incidents around generator' },
            { field: 'Incidents around health', label: 'Incidents around health' },
            { field: 'Quality of education', label: 'Quality of education' },
            { field: 'Quality of healthcare services', label: 'Quality of healthcare services' },
            { field: 'incidents around civil defence', label: 'Incidents around civil defence' },
            { field: 'incidents around education', label: 'Incidents around education' },
            { field: 'incidents around electricity', label: 'Incidents around electricity' },
            { field: 'incidents around generator', label: 'Incidents around generator' },
            { field: 'incidents around health', label: 'Incidents around health' },
            { field: 'quality of education', label: 'Quality of education' },
            { field: 'quality of healthcare services', label: 'Quality of healthcare services' },
            { field: 'quality of waste removal', label: 'Quality of waste removal' }
        ]
    },
    {
        themeNumber: 6,
        layerId: 'svClimateLayer',
        weightsKey: '6',
        title: 'Climate Risk',
        scoreField: 'composite_score',
        resolutions: ['governorate', 'district', 'cadastre'],
        indicators: [
            { field: 'Mean annual hot days', label: 'Mean annual hot days' },
            { field: 'Forest fire risk', label: 'Forest fire risk' },
            { field: 'Annual Dry Spell Length', label: 'Annual Dry Spell Length' }
        ]
    },
    {
        themeNumber: 7,
        layerId: 'svPoliticalLayer',
        weightsKey: '7',
        title: 'Political Vulnerability',
        scoreField: 'composite_score',
        resolutions: ['governorate', 'district'],
        indicators: [
            { field: 'Municipal elections turnout', label: 'Abstantion municipal elections turnout' },
            { field: 'Trust in Parliament', label: 'Distrust in Parliament' },
            { field: 'Faith in politics', label: 'Lack of faith in politics' },
            { field: 'Trust in LAF', label: 'Lack in trust in LAF' },
            { field: 'Faith in elections', label: 'Lack of faith in elections' },
            { field: 'Trust in the court system', label: 'Distrust in the court system' },
            { field: 'Trust in security forces', label: 'Distrust in security forces' },
            { field: 'Municipal council entrenchment', label: 'Municipal council entrenchment' },
            { field: 'State Citizen Incidents ', label: 'Number of state Citizen Incidents' },
            {
                field: 'Municipal authorities effect on quality of life: worsened life somewhat + alot',
                label: 'Municipal authorities effect on quality of life'
            },
            {
                field: 'LAF effect on quality of life: worsened life somewhat + alot',
                label: 'LAF effect on quality of life'
            },
            {
                field: 'ISF effect on quality of life: worsened life somewhat + alot',
                label: 'ISF effect on quality of life'
            },
            { field: 'Demographic Factor', label: 'Demographic Shock Factor' }
        ]
    },
    {
        themeNumber: 8,
        layerId: 'svGenderLayer',
        weightsKey: '8',
        title: 'Gender Based Vulnerabilities',
        scoreField: 'composite_score',
        resolutions: ['governorate', 'district'],
        indicators: [
            { field: 'Reported incidents of gender-based violence', label: 'Reported incidents of gender-based violence' },
            { field: 'Service access difficulty (female)', label: 'Service access difficulty (female)' },
            { field: 'Safety at night (female)', label: 'lack of safety at night (female)' },
            { field: 'Fear of movement or travel (female)', label: 'Fear of movement or travel (female)' },
            { field: 'Reports of harassment or violence', label: 'Reports of harassment or violence' },
            { field: 'Trust in the court system', label: 'Distrust in the court system (female)' },
            { field: 'Female unemployment rate', label: 'Unemployment rate (female)' }
        ]
    }
];

export function themesForResolution(resolution) {
    return CUSTOM_OVERALL_THEMES.filter(theme => theme.resolutions.includes(resolution));
}

export function getThemeByLayerId(layerId) {
    return CUSTOM_OVERALL_THEMES.find(theme => theme.layerId === layerId) || null;
}
