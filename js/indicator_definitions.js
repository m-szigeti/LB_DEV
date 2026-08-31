/**
 * Indicator definitions for Active Layers (from scripts/Indicators_Inside_Tool.xlsx).
 * Keys are SV layer ids; each entry lists Indicator + Definition for that theme.
 * Generated — re-run scripts/build_indicator_definitions.py to refresh.
 */

/** @typedef {{ code: string, indicator: string, definition: string, typeQuestion: string, themeName: string, themeNumber: number|null }} IndicatorDefinition */

/** @type {Record<string, IndicatorDefinition[]>} */
export const INDICATOR_DEFINITIONS_BY_LAYER = {
  "svPoliticalLayer": [
    {
      "code": "PV1",
      "indicator": "Abstantion municipal elections turnout",
      "definition": "Turnout in last municipal elections minus national average [(x2-x1/x1)*100], in percentage points. Large negative gaps mean disengagement or boycott. Surplus indicates relatively better engagement. For ex, if Beirut's turnout is 50% vs a national turnout of 25%, this means Beirut is 100% more engaged in elections that the rest of the country.",
      "typeQuestion": "Do people bother to vote for local councils here?",
      "themeName": "Political Vulnerability",
      "themeNumber": 7
    },
    {
      "code": "PV3",
      "indicator": "Municipal council entrenchment",
      "definition": "% of uncontested municipal elections",
      "typeQuestion": "How many municipal councils won uncontested?",
      "themeName": "Political Vulnerability",
      "themeNumber": 7
    },
    {
      "code": "PV6",
      "indicator": "Distrust in Parliament",
      "definition": "To what extent do you feel that the Lebanese Parliament reflects your concerns in how it responds to the country’s most pressing needs? :: Poor Job + Very Poor Job",
      "typeQuestion": "Do people trust the parliament in representing their immediate concerns?",
      "themeName": "Political Vulnerability",
      "themeNumber": 7
    },
    {
      "code": "PV7",
      "indicator": "Lack of faith in politics",
      "definition": "Proxy: Generally speaking, how interested would you say you are in politics? Would you say that you are not at all interested in politics, a little interested, interested, or very interested? Not at all interested",
      "typeQuestion": "Do people have faith that elections will bring about actual change?",
      "themeName": "Political Vulnerability",
      "themeNumber": 7
    },
    {
      "code": "PV8",
      "indicator": "Lack in trust in LAF",
      "definition": "How confident are you that the Lebanese Armed Forces are able to protect Lebanon against external threats, attacks, or invasion? Not very confident, Not confident at all",
      "typeQuestion": "Do people trust that the LAF is able to protect Lebanese citizens?",
      "themeName": "Political Vulnerability",
      "themeNumber": 7
    },
    {
      "code": "PV10",
      "indicator": "Lack of faith in elections",
      "definition": "% of people who report being unlikely or very unlikely to vote in the next elections",
      "typeQuestion": "Do people trust the fairness of elections?",
      "themeName": "Political Vulnerability",
      "themeNumber": 7
    },
    {
      "code": "PV11",
      "indicator": "Distrust in the court system",
      "definition": "% of respondents who dont believe that perpetrators of crime will be held accountable by the justice system/courts",
      "typeQuestion": "% of respondents who dont believe that perpetrators of crime will be held accountable by the justic system/courts",
      "themeName": "Political Vulnerability",
      "themeNumber": 7
    },
    {
      "code": "PV15",
      "indicator": "Distrust in security forces",
      "definition": "% of people who report that they would resort to security forces (ISF, LAF, municipal police) if they were involved in a dispute",
      "typeQuestion": "Would people resort to security forces for settling conflict/disputes?",
      "themeName": "Political Vulnerability",
      "themeNumber": 7
    },
    {
      "code": "PV16",
      "indicator": "Number of state Citizen Incidents",
      "definition": "Number of incidents under the state-citizen typology",
      "typeQuestion": "How often do state-citizen tensions break out into incidents of confrontation?",
      "themeName": "Political Vulnerability",
      "themeNumber": 7
    },
    {
      "code": "PV17",
      "indicator": "Demographic Shock Factor",
      "definition": "Demographic pressure combining resident population scale and population heterogeneity (DF = S × H), used as a shock factor within Political Vulnerability.",
      "typeQuestion": "How strongly do demographic scale and heterogeneity amplify local political vulnerability?",
      "themeName": "Political Vulnerability",
      "themeNumber": 7
    }
  ],
  "svGenderLayer": [
    {
      "code": "G1",
      "indicator": "Reported incidents of gender-based violence",
      "definition": "Number of reported GBV incidents per 1,000 women and girls, combining police, GBV IMS and NGO case data where available.",
      "typeQuestion": "How often GBV cases come into the formal system.",
      "themeName": "Gender Based Vulnerabilities",
      "themeNumber": 8
    },
    {
      "code": "G2",
      "indicator": "Service access difficulty (female)",
      "definition": "Share of women and girls who report being unable to access health, legal, psychosocial or protection services when needed, due to safety, cost, discrimination or lack of information.",
      "typeQuestion": "How many women/girls needed services but couldn’t get them.",
      "themeName": "Gender Based Vulnerabilities",
      "themeNumber": 8
    },
    {
      "code": "T10",
      "indicator": "lack of safety at night (female)",
      "definition": "% of population reporting feeling \"unsafe\" or \"very unsafe\" in their neighborhoods during the night",
      "typeQuestion": "Do people feel safe to be in their neighborhoods at night?",
      "themeName": "Gender Based Vulnerabilities",
      "themeNumber": 8
    },
    {
      "code": "T5",
      "indicator": "Fear of movement or travel (female)",
      "definition": "Share of households who worry about travelling to key destinations within Lebanon safely",
      "typeQuestion": "How safe people feel travelling within Lebanon",
      "themeName": "Gender Based Vulnerabilities",
      "themeNumber": 8
    },
    {
      "code": "G4",
      "indicator": "Reports of harassment or violence",
      "definition": "indicator: tell me if you have experienced verbal or physical harassment:: answer choices (experienced personally or witnessed personally or know of a family member who experienced)",
      "typeQuestion": "What proportion of females report physical or verbal harassment?",
      "themeName": "Gender Based Vulnerabilities",
      "themeNumber": 8
    },
    {
      "code": "PV11",
      "indicator": "Distrust in the court system (female)",
      "definition": "% of respondents who dont believe that perpetrators of crime will be held accountable by the justice system/courts",
      "typeQuestion": "% of respondents who dont believe that perpetrators of crime will be held accountable by the justic system/courts",
      "themeName": "Gender Based Vulnerabilities",
      "themeNumber": 8
    },
    {
      "code": "L2",
      "indicator": "Unemployment rate (female)",
      "definition": "Unemployed persons aged 15–64 divided by total 15–64 population.",
      "typeQuestion": "How many working age adults are unemployed.",
      "themeName": "Gender Based Vulnerabilities",
      "themeNumber": 8
    }
  ],
  "svAdmin1Layer": [
    {
      "code": "D1",
      "indicator": "Displacement Ratio",
      "definition": "Any person displaced in Lebanon",
      "typeQuestion": "Number of displaced per capita",
      "themeName": "Displacement Pressure",
      "themeNumber": 1
    }
  ],
  "svAdmin3Layer": [
    {
      "code": "T2",
      "indicator": "Inter-sectarian and inter-communal conflict incidents",
      "definition": "Annual rate of UNDPTMS incidents tagged as “intersectarian” or “intercommunal” per 1000 residents",
      "typeQuestion": "How often tensions between communities/sects break into incidents.",
      "themeName": "Tensions and Conflict Risk",
      "themeNumber": 2
    },
    {
      "code": "T3-1",
      "indicator": "Number of violent incidents",
      "definition": "Number of incidents/events involving battles, explosions, violence against civilians, armed clashes, and airstrikes. These will include the \"Geopolitical Armed clashes typology\" and \"Safety and Security typology without state operations\"",
      "typeQuestion": "Incidence shelling, armed clashes, political violence, or crime",
      "themeName": "Tensions and Conflict Risk",
      "themeNumber": 2
    },
    {
      "code": "T3-2",
      "indicator": "Number of crime incidents",
      "definition": "Number of incidents/events involving battles, explosions, violence against civilians, armed clashes, and airstrikes. These will include the \"Geopolitical Armed clashes typology\" and \"Safety and Security typology without state operations\"",
      "typeQuestion": "Incidence shelling, armed clashes, political violence, or crime",
      "themeName": "Tensions and Conflict Risk",
      "themeNumber": 2
    },
    {
      "code": "T4",
      "indicator": "Number of fatalities in tension incidents",
      "definition": "fatalities per 1000 residents in the last 12 months: these include victims of internal violence from crime and armed clashes/war OR % of incidents that resulted in at least one fatality",
      "typeQuestion": "How many fatalities resulted from incidents of crime, violence, and conflict?",
      "themeName": "Tensions and Conflict Risk",
      "themeNumber": 2
    },
    {
      "code": "T5",
      "indicator": "Fear of traveling within Lebanon safely",
      "definition": "Share of households who worry about travelling to key destinations within Lebanon safely",
      "typeQuestion": "How safe people feel travelling within Lebanon",
      "themeName": "Tensions and Conflict Risk",
      "themeNumber": 2
    },
    {
      "code": "T10",
      "indicator": "Feeling lack of safety during the night",
      "definition": "% of population reporting feeling \"unsafe\" or \"very unsafe\" in their neighborhoods during the night",
      "typeQuestion": "Do people feel safe to be in their neighborhoods at night?",
      "themeName": "Tensions and Conflict Risk",
      "themeNumber": 2
    }
  ],
  "svAdmin2Layer": [
    {
      "code": "L7",
      "indicator": "Nighttime light radiance",
      "definition": "Nightlight Intensity Values as captured by satellites",
      "typeQuestion": "Nightlight Intensity Values as captured by satellites",
      "themeName": "Socioeconomic Vulnerability",
      "themeNumber": 3
    },
    {
      "code": "L15",
      "indicator": "Household Deprivation Score",
      "definition": "Household Deprivation Score derived from the IPC WFP exercise. Affordability of consumption basket as compared to the household income.",
      "typeQuestion": "Household Deprivation Score derived from the IPC WFP exercise. Affordability of consumption basket as compared to the household income.",
      "themeName": "Socioeconomic Vulnerability",
      "themeNumber": 3
    },
    {
      "code": "L14",
      "indicator": "Poverty Level",
      "definition": "Percentage of population within a locality who are registered in the government national povery targeting",
      "typeQuestion": "Amman Score - Poverty Level",
      "themeName": "Socioeconomic Vulnerability",
      "themeNumber": 3
    }
  ],
  "svAdmin4Layer": [
    {
      "code": "T1",
      "indicator": "Service-related incidents",
      "definition": "Annual rate of protest/riot events around services and economics/labor mentioning electricity, generators, fuel, garbage, water, bread or wages, inflation, depositors, banks, rent law, taxes, solid waste, normalised by population. These are incidents where residents confront, obstruct or attack state/security/service providers in their area (e.g. LAF, ISF, municipal police, municipal staff, EDL/water establishment agents, UNRWA or humanitarian field teams), including both nonviolent confrontations (roadblocks, office sit-ins, threats) and violent incidents, per 1000 residents.",
      "typeQuestion": "How often people block roads, demonstrate, or riot about basic services, economic conditions, policies, decisions, etc...",
      "themeName": "Service & Infrastructure Vulnerability",
      "themeNumber": 4
    },
    {
      "code": "S5",
      "indicator": "Perceptions on quality of services: Water",
      "definition": "Respondents ranking water services \"Poor\" \"Very Poor\" or \"No Access\"",
      "typeQuestion": "Rate the quality of the following services in the area where you live: Water",
      "themeName": "Service & Infrastructure Vulnerability",
      "themeNumber": 4
    },
    {
      "code": "S11",
      "indicator": "Perceptions on quality of services: Electricity",
      "definition": "% of population reporting the quality of electrcitiy services as poor or very poor, or no access",
      "typeQuestion": "How negatively are electricity services rated?",
      "themeName": "Service & Infrastructure Vulnerability",
      "themeNumber": 4
    },
    {
      "code": "S12",
      "indicator": "Perceptions on quality of services: Waste Removal",
      "definition": "% of respondents rating waste removal services in their area as \"poor\" \"very poor\" or \"no access\"",
      "typeQuestion": "Are solid waste services in your area reliable?",
      "themeName": "Service & Infrastructure Vulnerability",
      "themeNumber": 4
    },
    {
      "code": "S10",
      "indicator": "Worry about access to healthcare services",
      "definition": "% of population reporting worrying about access to healthcare for themselves or their family",
      "typeQuestion": "Do people worry about accessing healthcare?",
      "themeName": "Service & Infrastructure Vulnerability",
      "themeNumber": 4
    },
    {
      "code": "S4",
      "indicator": "Worry about access to safe drinking water",
      "definition": "% of population reporting worrying about access to safe drinking water sometimes, often, all the time",
      "typeQuestion": "Where do people worry about accessing safe drinking water the most?",
      "themeName": "Service & Infrastructure Vulnerability",
      "themeNumber": 4
    },
    {
      "code": "S8",
      "indicator": "Water availability and accessibility",
      "definition": "% of respondents reporting \"insufficient quantity, good quality\" or \"insufficient quantity, bad quality\" in their household",
      "typeQuestion": "Does the household receive good quality and quantity of water?",
      "themeName": "Service & Infrastructure Vulnerability",
      "themeNumber": 4
    },
    {
      "code": "S9",
      "indicator": "Services as a tension driver",
      "definition": "Share of population who report that services in their area lead to tension: \"Competition for at least one of these services driving tensions: 'Yes'\"",
      "typeQuestion": "Is competition for services and utilities between groups and individuals a source of tension in your area?",
      "themeName": "Service & Infrastructure Vulnerability",
      "themeNumber": 4
    },
    {
      "code": "S13",
      "indicator": "Solid waste pressure (kg)",
      "definition": "Additional kg per day generated in a particular locality",
      "typeQuestion": "How much additional waste is being generated within a certain locality? (adjustable to caza or cadaster)",
      "themeName": "Service & Infrastructure Vulnerability",
      "themeNumber": 4
    },
    {
      "code": "S15",
      "indicator": "Quality of education",
      "definition": "",
      "typeQuestion": "",
      "themeName": "Service & Infrastructure Vulnerability",
      "themeNumber": 4
    },
    {
      "code": "S18",
      "indicator": "Quality of healthcare services",
      "definition": "",
      "typeQuestion": "",
      "themeName": "Service & Infrastructure Vulnerability",
      "themeNumber": 4
    },
    {
      "code": "S19",
      "indicator": "Incidents around electricity",
      "definition": "",
      "typeQuestion": "",
      "themeName": "Service & Infrastructure Vulnerability",
      "themeNumber": 4
    },
    {
      "code": "S20",
      "indicator": "Incidents around generator",
      "definition": "",
      "typeQuestion": "",
      "themeName": "Service & Infrastructure Vulnerability",
      "themeNumber": 4
    },
    {
      "code": "S21",
      "indicator": "Incidents around health",
      "definition": "",
      "typeQuestion": "",
      "themeName": "Service & Infrastructure Vulnerability",
      "themeNumber": 4
    },
    {
      "code": "S22",
      "indicator": "Incidents around education",
      "definition": "",
      "typeQuestion": "",
      "themeName": "Service & Infrastructure Vulnerability",
      "themeNumber": 4
    },
    {
      "code": "S23",
      "indicator": "Incidents around civil defence",
      "definition": "",
      "typeQuestion": "",
      "themeName": "Service & Infrastructure Vulnerability",
      "themeNumber": 4
    }
  ],
  "svClimateLayer": [
    {
      "code": "E1",
      "indicator": "Consecutive Dry Days",
      "definition": "Maximum run of consecutive dry days.",
      "typeQuestion": "How long do dry spells last?",
      "themeName": "Climate Risk",
      "themeNumber": 6
    },
    {
      "code": "E2",
      "indicator": "Consecutive Wet Days",
      "definition": "Maximum run of consecutive wet days.",
      "typeQuestion": "How long do wet spells last?",
      "themeName": "Climate Risk",
      "themeNumber": 6
    },
    {
      "code": "E3",
      "indicator": "Days with at least 10 mm rainfall",
      "definition": "Number of days with at least 10 mm of rainfall.",
      "typeQuestion": "How often does moderate rainfall occur?",
      "themeName": "Climate Risk",
      "themeNumber": 6
    },
    {
      "code": "E4",
      "indicator": "Days with at least 20 mm rainfall",
      "definition": "Number of days with at least 20 mm of rainfall.",
      "typeQuestion": "How often does heavy rainfall occur?",
      "themeName": "Climate Risk",
      "themeNumber": 6
    },
    {
      "code": "E5",
      "indicator": "Very Hot Days (Tmax > 35°C)",
      "definition": "Number of days with maximum temperature above 35°C.",
      "typeQuestion": "How often does extreme heat occur?",
      "themeName": "Climate Risk",
      "themeNumber": 6
    },
    {
      "code": "E6",
      "indicator": "Hot days (Tmax > 30°C)",
      "definition": "Number of days with maximum temperature above 30°C.",
      "typeQuestion": "How often do hot days occur?",
      "themeName": "Climate Risk",
      "themeNumber": 6
    },
    {
      "code": "E7",
      "indicator": "Forest fire risk",
      "definition": "",
      "typeQuestion": "% change in number of forest fires per district;",
      "themeName": "Climate Risk",
      "themeNumber": 6
    },
    {
      "code": "E8",
      "indicator": "Annual Dry Spell Length",
      "definition": "",
      "typeQuestion": "Numbers of consecutive dry days per year",
      "themeName": "Climate Risk",
      "themeNumber": 6
    }
  ]
};

export const LAYER_THEME_NAMES = {
  "svAdmin1Layer": "Displacement Pressure",
  "svAdmin3Layer": "Tensions and Conflict Risk",
  "svAdmin2Layer": "Socioeconomic Vulnerability",
  "svAdmin4Layer": "Service & Infrastructure Vulnerability",
  "svClimateLayer": "Climate Risk",
  "svPoliticalLayer": "Political Vulnerability",
  "svGenderLayer": "Gender Based Vulnerabilities"
};

export function getIndicatorDefinitionsForLayer(layerId) {
    return INDICATOR_DEFINITIONS_BY_LAYER[layerId] || [];
}
