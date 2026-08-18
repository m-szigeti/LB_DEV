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
                This tool maps composite vulnerability indexes across Lebanon at <strong>cadastre</strong>, <strong>district</strong>, or <strong>governorate</strong> resolution. Theme layers combine survey-based indicators, perception data, and geospatial measures into Kendall-weighted scores.
                Scores use a <strong>0&ndash;1 scale</strong>: <strong>higher values indicate lower vulnerability / greater resilience</strong>, and lower values indicate greater vulnerability. Scores are comparable <strong>within the selected resolution only</strong>.
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
                    <div style="font-size:12px; color:#555; margin-top:4px;">Under <strong>Composite Indexes</strong>, enable the Overall Vulnerability Index or any pillar (e.g.&nbsp;Socioeconomic Vulnerability, Climate Risk). Several themes can be on at once; fills, stripes, and icons stack so they remain readable together.</div>
                </div>

                <div style="position:relative; border:1px solid #d8d8d8; border-radius:8px; background:#f7f7f7; padding:10px 12px 10px 46px; margin-bottom:8px;">
                    <span style="position:absolute; left:9px; top:12px; width:18px; height:18px; border-radius:50%; background:#dce9fa; color:#3f79c5; font-size:11px; line-height:18px; text-align:center; font-weight:700;">3</span>
                    <div style="font-size:14px; font-weight:700; color:#343434;">Click a polygon</div>
                    <div style="font-size:12px; color:#555; margin-top:4px;">A popup shows the area&rsquo;s <strong>score and class</strong>, Arabic name, population, and bar charts comparing theme scores for that unit. Open <strong>Active Layers</strong> for indicator definitions and top/bottom rankings, or <strong>Analysis</strong> to build an area of interest.</div>
                </div>

                <div style="position:relative; border:1px solid #d8d8d8; border-radius:8px; background:#f7f7f7; padding:10px 12px 10px 46px; margin-bottom:8px;">
                    <span style="position:absolute; left:9px; top:12px; width:18px; height:18px; border-radius:50%; background:#dce9fa; color:#3f79c5; font-size:11px; line-height:18px; text-align:center; font-weight:700;">4</span>
                    <div style="font-size:14px; font-weight:700; color:#343434;">Explore sub-indicators</div>
                    <div style="font-size:12px; color:#555; margin-top:4px;">Each pillar shows <strong>sub-indicator chips</strong> below its toggle. Select one to map that indicator instead of the composite. Open <strong>Active Layers</strong> for definitions, opacity, and legend detail.</div>
                </div>

                <div style="position:relative; border:1px solid #d8d8d8; border-radius:8px; background:#f7f7f7; padding:10px 12px 10px 46px;">
                    <span style="position:absolute; left:9px; top:12px; width:18px; height:18px; border-radius:50%; background:#dce9fa; color:#3f79c5; font-size:11px; line-height:18px; text-align:center; font-weight:700;">5</span>
                    <div style="font-size:14px; font-weight:700; color:#343434;">Add context layers</div>
                    <div style="font-size:12px; color:#555; margin-top:4px;">Under <strong>Stressors</strong>, add Road Access Status, Collective Shelter Status, TTF Hotspots (Q1 2026), Population, Pilot Zones, or the southern restricted-access line. Under <strong>UNDP Intervention Mapping</strong>, explore ongoing project locations by activity type. These layers are <em>not</em> part of the composite index.</div>
                </div>
            </div>

            <div style="font-size:12px; font-weight:700; color:#6d6d6d; letter-spacing:0.06em; margin:6px 0 8px; border-bottom:1px solid #d9d9d9; padding-bottom:5px;">DISPLAY OPTIONS</div>
            <div style="font-size:12px; color:#3e3e3e; line-height:1.55; margin-bottom:14px;">
                <div style="margin-bottom:6px;"><strong>Show Labels</strong> &mdash; Displays score labels on the map for the active layer.</div>
                <div style="margin-bottom:6px;"><strong>Color</strong> (on each composite layer) &mdash; Shows that layer alone as a plain color choropleth. Click again to return to the default symbol, stripe, or glow style.</div>
                <div style="margin-bottom:6px;"><strong>Show Color Only</strong> (Advanced Options) &mdash; Global toggle for plain choropleth rendering.</div>
                <div style="margin-bottom:6px;"><strong>Class Limits</strong> (Advanced Options) &mdash; Cycle <em>Equal count</em>, <em>Equal interval</em>, and <em>Natural breaks</em> to change how Low / Medium / High ranges are grouped. This does not recalculate scores.</div>
                <div><strong>Custom Overall Index</strong> &mdash; Build an exploratory composite from selected themes and sub-indicators, keeping the official Overall as the reference.</div>
            </div>

            <div style="font-size:12px; font-weight:700; color:#6d6d6d; letter-spacing:0.06em; margin:6px 0 8px; border-bottom:1px solid #d9d9d9; padding-bottom:5px;">COMPOSITE INDEXES</div>
            <div style="font-size:12px; color:#444; line-height:1.5; margin-bottom:10px;">
                <p style="margin:0 0 8px; color:#3e3e3e;">The <strong>Overall Vulnerability Index</strong> combines the pillar scores below. A weak score on any pillar can pull down the composite. Default map styles (stripes, icons, edge glow) are designed so themes can be read together; use <strong>Color</strong> when you want a single choropleth.</p>
                <div style="margin-bottom:5px;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#7b3294; margin-right:6px;"></span><strong>Tensions and Conflict Risk</strong> &mdash; Social unrest, violence, and conflict-related tensions (color fill).</div>
                <div style="margin-bottom:5px;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#2b83ba; margin-right:6px;"></span><strong>Socioeconomic Vulnerability</strong> &mdash; Poverty, household deprivation, and livelihood hardship (stripe pattern, drawn above other fills).</div>
                <div style="margin-bottom:5px;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#8b5cf6; margin-right:6px;"></span><strong>Service &amp; Infrastructure Vulnerability</strong> &mdash; Availability and quality of essential services (class icons).</div>
                <div style="margin-bottom:5px;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#b2182b; margin-right:6px;"></span><strong>Climate Risk</strong> &mdash; Heat, drought, and forest-fire related pressures (pine icons).</div>
                <div style="margin-bottom:5px;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#1e3a8a; margin-right:6px;"></span><strong>Political Vulnerability</strong> &mdash; Governance, institutional trust, and demographic shock pressures (inward edge glow).</div>
                <div><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#525252; margin-right:6px;"></span><strong>Gender Based Vulnerabilities</strong> &mdash; Gender disparities in safety, service access, and participation (equality-symbol icons).</div>
            </div>

            <div style="background:#efefeb; border-left:4px solid #a5a394; color:#555; font-size:12px; line-height:1.45; padding:8px 10px; border-radius:4px; margin-bottom:14px;">
                See the <strong><a href="html/more.html" style="color:#3f79c5;">More Information</a></strong> page for methodology details, data sources, and indicator definitions.
            </div>

            <p class="welcome-conflict-disclaimer" style="margin-top:10px;">This tool provides a structural vulnerability baseline for exploration and reporting. It is not a real-time early warning system. Interpret results alongside local knowledge and other data sources.</p>
        </div>
    </div>
`;
