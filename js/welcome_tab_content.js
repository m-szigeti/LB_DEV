/**
 * Static HTML for the Welcome tab in the docked analysis panel.
 * Keep copy and markup here — not in InfoPanel business logic.
 */
export const WELCOME_TAB_HTML = `
    <div class="info-panel-section">
        <div class="welcome-content">
            <div style="background:#f0f0ec; border:1px solid #d2d2ce; border-radius:8px; padding:10px 12px; margin-bottom:14px;">
                <div style="font-size:18px; font-weight:700; color:#2f2f2f;">DSVI Social Vulnerability Tool Guide</div>
            </div>

            <div style="font-size:12px; font-weight:700; color:#6d6d6d; letter-spacing:0.06em; margin:6px 0 8px; border-bottom:1px solid #d9d9d9; padding-bottom:5px;">WHAT THE TOOL SHOWS</div>
            <p style="margin:0 0 8px; font-size:12px; line-height:1.5; color:#3e3e3e;">
                This tool maps social vulnerability and composite tension indexes across Lebanon at cadastre, district, or governorate resolution. Layers combine survey-based indicators, perception data, and high-resolution contextual maps to support area-level analysis.
            </p>
            <p style="margin:0 0 10px; font-size:12px; line-height:1.5; color:#3e3e3e;">
                Index scores use a <strong>0–1 scale</strong>: higher values indicate stronger conditions (lower vulnerability); lower values indicate greater deprivation or tension. Scores are comparable <strong>within the selected administrative unit only</strong> (within Lebanon at the chosen resolution), not across different resolutions or countries.
            </p>
            <div style="background:#efe7d7; border-left:4px solid #b89c67; color:#5b4f36; font-size:12px; line-height:1.4; padding:8px 10px; border-radius:4px; margin-bottom:14px;">
                Stressor layers (e.g. road access, shelter status) and high-resolution rasters are for context and are <strong>not</strong> part of composite index calculations unless noted in layer metadata.
            </div>

            <div style="font-size:12px; font-weight:700; color:#6d6d6d; letter-spacing:0.06em; margin:6px 0 8px; border-bottom:1px solid #d9d9d9; padding-bottom:5px;">HOW TO USE</div>
            <div style="position:relative; margin-bottom:14px;">
                <div style="position:absolute; left:16px; top:10px; bottom:10px; width:2px; background:#5f9be6;"></div>
                <div style="position:relative; border:1px solid #d8d8d8; border-radius:8px; background:#f7f7f7; padding:10px 12px 10px 46px; margin-bottom:8px;">
                    <span style="position:absolute; left:9px; top:12px; width:18px; height:18px; border-radius:50%; background:#dce9fa; color:#3f79c5; font-size:11px; line-height:18px; text-align:center; font-weight:700;">1</span>
                    <div style="font-size:14px; font-weight:700; color:#343434;">Choose administrative resolution</div>
                    <div style="font-size:12px; color:#555; margin-top:4px;">Select Cadastre, District, or Governorate in the left panel to set the map unit.</div>
                </div>
                <div style="position:relative; border:1px solid #d8d8d8; border-radius:8px; background:#f7f7f7; padding:10px 12px 10px 46px; margin-bottom:8px;">
                    <span style="position:absolute; left:9px; top:12px; width:18px; height:18px; border-radius:50%; background:#dce9fa; color:#3f79c5; font-size:11px; line-height:18px; text-align:center; font-weight:700;">2</span>
                    <div style="font-size:14px; font-weight:700; color:#343434;">Select a composite index</div>
                    <div style="font-size:12px; color:#555; margin-top:4px;">Turn on Overall Vulnerability Index or one of the pillar indexes (e.g. Tension and Conflict Risk, Displacement Pressure).</div>
                </div>
                <div style="position:relative; border:1px solid #d8d8d8; border-radius:8px; background:#f7f7f7; padding:10px 12px 10px 46px; margin-bottom:8px;">
                    <span style="position:absolute; left:9px; top:12px; width:18px; height:18px; border-radius:50%; background:#dce9fa; color:#3f79c5; font-size:11px; line-height:18px; text-align:center; font-weight:700;">3</span>
                    <div style="font-size:14px; font-weight:700; color:#343434;">Read the map and legend</div>
                    <div style="font-size:12px; color:#555; margin-top:4px;">Use the map legend for score ranges. <span style="display:inline-block; margin-left:6px; padding:1px 6px; border-radius:10px; background:#f7d9d9; color:#9a2f2f; font-size:11px;">Red = higher vulnerability</span> <span style="display:inline-block; margin-left:4px; padding:1px 6px; border-radius:10px; background:#d9efdc; color:#2f7b38; font-size:11px;">Green = lower vulnerability</span></div>
                </div>
                <div style="position:relative; border:1px solid #d8d8d8; border-radius:8px; background:#f7f7f7; padding:10px 12px 10px 46px; margin-bottom:8px;">
                    <span style="position:absolute; left:9px; top:12px; width:18px; height:18px; border-radius:50%; background:#dce9fa; color:#3f79c5; font-size:11px; line-height:18px; text-align:center; font-weight:700;">4</span>
                    <div style="font-size:14px; font-weight:700; color:#343434;">Click a unit on the map</div>
                    <div style="font-size:12px; color:#555; margin-top:4px;">Open area details, charts, and sub-indicator values in the map popup and this panel’s Analysis tab.</div>
                </div>
                <div style="position:relative; border:1px solid #d8d8d8; border-radius:8px; background:#f7f7f7; padding:10px 12px 10px 46px;">
                    <span style="position:absolute; left:9px; top:12px; width:18px; height:18px; border-radius:50%; background:#dce9fa; color:#3f79c5; font-size:11px; line-height:18px; text-align:center; font-weight:700;">5</span>
                    <div style="font-size:14px; font-weight:700; color:#343434;">Drill into sub-indicators and stressors</div>
                    <div style="font-size:12px; color:#555; margin-top:4px;">Use sub-indicator dropdowns under each pillar, or enable Stressors / high-resolution layers for additional context.</div>
                </div>
            </div>

            <div style="font-size:12px; font-weight:700; color:#6d6d6d; letter-spacing:0.06em; margin:6px 0 8px; border-bottom:1px solid #d9d9d9; padding-bottom:5px;">COMPOSITE INDEXES</div>
            <div style="display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap; margin-bottom:10px;">
                <div style="width:140px; height:140px; border-radius:50%; background: conic-gradient(#c0392b 0% 18%, #e67e22 18% 36%, #f1c40f 36% 54%, #27ae60 54% 72%, #2980b9 72% 90%, #8e44ad 90% 100%); position:relative; flex-shrink:0;">
                    <div style="position:absolute; inset:36px; border-radius:50%; background:#f7f7f7; display:flex; align-items:center; justify-content:center; text-align:center; font-size:11px; font-weight:700; color:#666; line-height:1.2;">Overall<br>Vulnerability</div>
                </div>
                <div style="font-size:12px; color:#444; line-height:1.5; flex:1; min-width:140px;">
                    <div><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#c0392b; margin-right:8px;"></span><strong>Tension and Conflict Risk</strong></div>
                    <div style="margin-top:4px;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#e67e22; margin-right:8px;"></span><strong>Displacement Pressure</strong></div>
                    <div style="margin-top:4px;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#f1c40f; margin-right:8px;"></span><strong>Economic Vulnerability</strong></div>
                    <div style="margin-top:4px;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#27ae60; margin-right:8px;"></span><strong>Service &amp; Infrastructure</strong></div>
                    <div style="margin-top:4px;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#2980b9; margin-right:8px;"></span><strong>Demographic Tension / Stress</strong></div>
                </div>
            </div>
            <div style="background:#efefeb; border-left:4px solid #a5a394; color:#555; font-size:12px; line-height:1.45; padding:8px 10px; border-radius:4px; margin-bottom:12px;">
                The Overall Vulnerability Index combines pillar scores. A very low score on any single pillar can pull down the composite.
            </div>

            <div style="font-size:12px; font-weight:700; color:#6d6d6d; letter-spacing:0.06em; margin:6px 0 8px; border-bottom:1px solid #d9d9d9; padding-bottom:5px;">SCORE RANGES</div>
            <div style="font-size:12px; color:#444; line-height:1.55;">
                <div><span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:#e31a1c; margin-right:8px; vertical-align:middle;"></span><strong>Red</strong> — higher vulnerability (lower index scores)</div>
                <div><span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:#fd8d3c; margin-right:8px; vertical-align:middle;"></span><strong>Orange</strong> — moderate</div>
                <div><span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:#ffff33; margin-right:8px; vertical-align:middle; border:1px solid #ccc;"></span><strong>Yellow</strong> — lower vulnerability (higher index scores)</div>
                <div><span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:#b8b8b8; margin-right:8px; vertical-align:middle;"></span><strong>No data</strong></div>
            </div>
            <div style="background:#efe7d7; border-left:4px solid #b89c67; color:#5b4f36; font-size:12px; line-height:1.4; padding:8px 10px; border-radius:4px; margin-top:10px;">
                Scores are within-unit only at the selected resolution and are not comparable across cadastre, district, and governorate views.
            </div>

            <div class="welcome-conflict-section">
                <div class="welcome-conflict-heading">STRESSORS &amp; CONTEXT LAYERS</div>
                <p class="welcome-conflict-source">Display only · Not included in composite index scores</p>

                <div class="welcome-conflict-grid">
                    <div class="welcome-conflict-card">
                        <div class="card-label">Road Access</div>
                        <p class="card-title">Road access status</p>
                        <p class="card-meta">Point / line context layer</p>
                    </div>
                    <div class="welcome-conflict-card">
                        <div class="card-label">Shelter</div>
                        <p class="card-title">Collective shelter status</p>
                        <p class="card-meta">Snapshot and change views</p>
                    </div>
                    <div class="welcome-conflict-card">
                        <div class="card-label">High resolution</div>
                        <p class="card-title">Raster overlays</p>
                        <p class="card-meta">NDVI, population, services, etc.</p>
                    </div>
                    <div class="welcome-conflict-card">
                        <div class="card-label">Perception</div>
                        <p class="card-title">Cadastre-level perception data</p>
                        <p class="card-meta">Survey-based indicators</p>
                    </div>
                </div>

                <div class="welcome-conflict-block">
                    <div class="block-label">Active Layers tab</div>
                    <p>Use the <strong>Active Layers</strong> tab in this panel to see opacity, color ramp, and metadata for everything currently on the map.</p>
                </div>

                <div class="welcome-conflict-block">
                    <div class="block-label">Map legend</div>
                    <div class="welcome-conflict-legend-bar" aria-hidden="true"></div>
                    <div class="welcome-conflict-legend-labels">
                        <span>Higher severity / vulnerability</span>
                        <span>Lower severity</span>
                    </div>
                    <p>Each layer uses its own color scale. Compare values only within the same layer and administrative resolution.</p>
                </div>

                <p class="welcome-conflict-disclaimer">This tool provides a structural vulnerability baseline for exploration and reporting. It is not a real-time early warning system. Interpret results alongside local knowledge and other data sources.</p>
            </div>
        </div>
    </div>
`;
