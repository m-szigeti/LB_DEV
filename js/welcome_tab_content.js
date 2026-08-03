/**
 * Static HTML for the Welcome tab in the docked analysis panel.
 * Keep copy and markup here — not in InfoPanel business logic.
 */
export const WELCOME_TAB_HTML = `
    <div class="info-panel-section">
        <div class="welcome-content">
            <div style="background:#f0f0ec; border:1px solid #d2d2ce; border-radius:8px; padding:10px 12px; margin-bottom:14px;">
                <div style="font-size:18px; font-weight:700; color:#2f2f2f;">TMS 2.0 Vulnerability Tool Guide</div>
            </div>

            <div style="font-size:12px; font-weight:700; color:#6d6d6d; letter-spacing:0.06em; margin:6px 0 8px; border-bottom:1px solid #d9d9d9; padding-bottom:5px;">WHAT THE TOOL SHOWS</div>
            <p style="margin:0 0 10px; font-size:12px; line-height:1.5; color:#3e3e3e;">
                This tool maps composite vulnerability and tension indexes across Lebanon at <strong>cadastre</strong>, <strong>district</strong>, or <strong>governorate</strong> resolution. Layers combine survey-based indicators, perception data, and contextual maps.
                Index scores use a <strong>0&ndash;1 scale</strong> where higher values indicate stronger conditions and lower values indicate greater vulnerability. Scores are comparable <strong>within the selected resolution only</strong>.
            </p>

            <div style="font-size:12px; font-weight:700; color:#6d6d6d; letter-spacing:0.06em; margin:6px 0 8px; border-bottom:1px solid #d9d9d9; padding-bottom:5px;">QUICK START</div>
            <div style="position:relative; margin-bottom:14px;">
                <div style="position:absolute; left:16px; top:10px; bottom:10px; width:2px; background:#5f9be6;"></div>

                <div style="position:relative; border:1px solid #d8d8d8; border-radius:8px; background:#f7f7f7; padding:10px 12px 10px 46px; margin-bottom:8px;">
                    <span style="position:absolute; left:9px; top:12px; width:18px; height:18px; border-radius:50%; background:#dce9fa; color:#3f79c5; font-size:11px; line-height:18px; text-align:center; font-weight:700;">1</span>
                    <div style="font-size:14px; font-weight:700; color:#343434;">Pick a resolution</div>
                    <div style="font-size:12px; color:#555; margin-top:4px;">Use the <strong>Administrative resolution</strong> buttons (Cadastre / District / Governorate) in the left panel to set the map unit.</div>
                </div>

                <div style="position:relative; border:1px solid #d8d8d8; border-radius:8px; background:#f7f7f7; padding:10px 12px 10px 46px; margin-bottom:8px;">
                    <span style="position:absolute; left:9px; top:12px; width:18px; height:18px; border-radius:50%; background:#dce9fa; color:#3f79c5; font-size:11px; line-height:18px; text-align:center; font-weight:700;">2</span>
                    <div style="font-size:14px; font-weight:700; color:#343434;">Turn on a theme</div>
                    <div style="font-size:12px; color:#555; margin-top:4px;">Under <strong>Composite</strong>, enable the Overall Vulnerability Index or any pillar (e.g.&nbsp;Displacement Pressure, Socioeconomic Vulnerability). One or more themes can be active at the same time.</div>
                </div>

                <div style="position:relative; border:1px solid #d8d8d8; border-radius:8px; background:#f7f7f7; padding:10px 12px 10px 46px; margin-bottom:8px;">
                    <span style="position:absolute; left:9px; top:12px; width:18px; height:18px; border-radius:50%; background:#dce9fa; color:#3f79c5; font-size:11px; line-height:18px; text-align:center; font-weight:700;">3</span>
                    <div style="font-size:14px; font-weight:700; color:#343434;">Click a polygon</div>
                    <div style="font-size:12px; color:#555; margin-top:4px;">A popup shows the area&rsquo;s <strong>score and label</strong>, its Arabic name, population, and horizontal bar charts comparing all theme scores for that unit. Open <strong>Active Layers</strong> for top/bottom unit rankings, or <strong>Analysis</strong> to build an area of interest.</div>
                </div>

                <div style="position:relative; border:1px solid #d8d8d8; border-radius:8px; background:#f7f7f7; padding:10px 12px 10px 46px; margin-bottom:8px;">
                    <span style="position:absolute; left:9px; top:12px; width:18px; height:18px; border-radius:50%; background:#dce9fa; color:#3f79c5; font-size:11px; line-height:18px; text-align:center; font-weight:700;">4</span>
                    <div style="font-size:14px; font-weight:700; color:#343434;">Explore sub-indicators</div>
                    <div style="font-size:12px; color:#555; margin-top:4px;">Each pillar shows <strong>sub-indicator chips</strong> below its toggle. Select one to see its individual score on the map. Open the <strong>Active Layers</strong> tab to read indicator definitions and adjust opacity or color ramps.</div>
                </div>

                <div style="position:relative; border:1px solid #d8d8d8; border-radius:8px; background:#f7f7f7; padding:10px 12px 10px 46px;">
                    <span style="position:absolute; left:9px; top:12px; width:18px; height:18px; border-radius:50%; background:#dce9fa; color:#3f79c5; font-size:11px; line-height:18px; text-align:center; font-weight:700;">5</span>
                    <div style="font-size:14px; font-weight:700; color:#343434;">Add context layers</div>
                    <div style="font-size:12px; color:#555; margin-top:4px;">Under <strong>Stressors</strong>, enable population, shelter, road-access, or perception layers for additional context. These are <em>not</em> part of the composite index.</div>
                </div>
            </div>

            <div style="font-size:12px; font-weight:700; color:#6d6d6d; letter-spacing:0.06em; margin:6px 0 8px; border-bottom:1px solid #d9d9d9; padding-bottom:5px;">DISPLAY OPTIONS</div>
            <div style="font-size:12px; color:#3e3e3e; line-height:1.55; margin-bottom:14px;">
                <div style="margin-bottom:6px;"><strong>Show Color Only</strong> &mdash; Replaces circles, stripes, and symbols with a simple filled choropleth so you can compare one theme at a time using a unified color ramp.</div>
                <div style="margin-bottom:6px;"><strong>Show Labels</strong> &mdash; Displays score labels directly on the map for the active layer.</div>
                <div style="margin-bottom:6px;"><strong>Class Limits</strong> &mdash; Cycle between <em>Equal count</em>, <em>Equal interval</em>, and <em>Natural breaks</em> classification to change how score ranges are grouped.</div>
                <div><strong>Custom Overall Index</strong> &mdash; Build your own composite by choosing which themes to include and adjusting their weights.</div>
            </div>

            <div style="font-size:12px; font-weight:700; color:#6d6d6d; letter-spacing:0.06em; margin:6px 0 8px; border-bottom:1px solid #d9d9d9; padding-bottom:5px;">COMPOSITE INDEXES</div>
            <div style="font-size:12px; color:#444; line-height:1.5; margin-bottom:10px;">
                <p style="margin:0 0 8px; color:#3e3e3e;">The <strong>Overall Vulnerability Index</strong> combines all pillar scores below. A very low score on any single pillar can pull down the composite.</p>
                <div style="margin-bottom:5px;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#c0392b; margin-right:6px;"></span><strong>Tensions and Conflict Risk</strong> &mdash; Social unrest, violence, and conflict-related tensions.</div>
                <div style="margin-bottom:5px;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#e67e22; margin-right:6px;"></span><strong>Displacement Pressure</strong> &mdash; Impact of population movements and strain on host communities.</div>
                <div style="margin-bottom:5px;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#f1c40f; margin-right:6px;"></span><strong>Socioeconomic Vulnerability</strong> &mdash; Poverty, unemployment, and livelihood hardship.</div>
                <div style="margin-bottom:5px;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#27ae60; margin-right:6px;"></span><strong>Service &amp; Infrastructure Vulnerability</strong> &mdash; Availability and quality of healthcare, education, water, and transport.</div>
                <div style="margin-bottom:5px;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#2980b9; margin-right:6px;"></span><strong>Demographic Tension Stress</strong> &mdash; Population density, growth, and inter-group resource competition.</div>
                <div style="margin-bottom:5px;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#8e44ad; margin-right:6px;"></span><strong>Climate &amp; Environmental Risk</strong> &mdash; Environmental hazards, pollution, and climate-related pressures.</div>
                <div style="margin-bottom:5px;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#e84393; margin-right:6px;"></span><strong>Political Vulnerability</strong> &mdash; Governance gaps, institutional fragility, and political marginalization.</div>
                <div><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#00b894; margin-right:6px;"></span><strong>Gender-Based Vulnerability</strong> &mdash; Gender disparities in access to services, safety, and participation.</div>
            </div>

            <div style="background:#efefeb; border-left:4px solid #a5a394; color:#555; font-size:12px; line-height:1.45; padding:8px 10px; border-radius:4px; margin-bottom:14px;">
                See the <strong><a href="html/more.html" style="color:#3f79c5;">More Information</a></strong> page for methodology details, data sources, and indicator definitions.
            </div>

            <p class="welcome-conflict-disclaimer" style="margin-top:10px;">This tool provides a structural vulnerability baseline for exploration and reporting. It is not a real-time early warning system. Interpret results alongside local knowledge and other data sources.</p>
        </div>
    </div>
`;
