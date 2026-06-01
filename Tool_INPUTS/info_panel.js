// info_panel.js - Updated with SEPI integration and correlation analysis

import { renderSepiDashboardHtml } from './sepi_dashboard_content.js';
import { getCurrentCountry } from './layer_config.js';
import {
    buildCountryReport,
    renderCountryReportHTML,
    drawCountryReportCharts
} from './country_report.js';
import { getCountryDisplayLabel } from './conflict_context_content.js';

function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Match layer_manager.parseNumericIfPossible — null/empty must not become 0 in rankings. */
function parseRankingValue(raw) {
    if (raw == null || raw === '') return null;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : null;
}

/**
 * InfoPanel class - Creates and manages a floating info/analysis panel
 */
export class InfoPanel {
    constructor(options = {}) {
        this.options = {
            position: options.position || 'topright',
            width: options.width || '400px',
            maxHeight: options.maxHeight || '70vh',
            title: options.title || 'Layer Analysis & Reports',
            docked: options.docked !== undefined ? options.docked : false,
            mountTarget: options.mountTarget || '#info-panel-slot',
            ...options
        };
        
        this.isVisible = false;
        this.isMinimized = false;
        this.originalHeight = null;
        this.activeLayers = new Map();
        this.container = null;
        this.map = null;
        
        this.init();
    }
    
    /**
     * Initialize the info panel
     */
    init() {
        this.createPanel();
        this.setupEventListeners();
    }
    
    /**
     * Set the map reference for geographic analysis
     * @param {Object} map - Leaflet map instance
     */
    setMap(map) {
        this.map = map;
    }
    
    /**
     * Create the main panel structure
     */
    createPanel() {
        // Create main container
        this.container = document.createElement('div');
        this.container.className = `info-panel-container ${this.options.docked ? 'docked' : 'floating'}`;
        this.container.id = 'info-panel';
        
        if (!this.options.docked) {
            // Apply floating positioning
            this.container.style.cssText = `
                position: fixed;
                top: 15%;
                right: 10px;
                width: ${this.options.width};
                height: 400px;
                min-width: 300px;
                min-height: 200px;
                max-height: none;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 2001;
                display: none;
                overflow: hidden;
                font-family: Calibri, sans-serif;
                border: 1px solid #ddd;
                resize: both;
            `;
        } else {
            this.container.style.display = 'none';
        }
        
        let header = null;
        if (!this.options.docked) {
            // Floating mode keeps full header controls.
            header = document.createElement('div');
            header.className = 'info-panel-header';
            header.innerHTML = `
                <div class="info-panel-title">${this.options.title}</div>
                <div class="info-panel-controls">
                    <button class="info-panel-btn minimize-btn" title="Minimize/Maximize">−</button>
                    <button class="info-panel-btn close-btn" title="Close">×</button>
                </div>
            `;
        }
        
        // Create content area
        const content = document.createElement('div');
        content.className = 'info-panel-content';
        content.style.display = this.options.docked ? 'flex' : 'none'; // Docked starts expanded
        content.innerHTML = `
            <div class="info-panel-tabs" role="tablist" aria-label="Info panel sections">
                <button class="info-panel-tab active" type="button" data-tab="welcome" role="tab" aria-selected="true">
                    Welcome
                </button>
                <button class="info-panel-tab" type="button" data-tab="layers" role="tab" aria-selected="false">
                    Active Layers
                </button>
                <button class="info-panel-tab" type="button" data-tab="analysis" role="tab" aria-selected="false">
                    Analysis
                </button>
            </div>

            <div class="info-panel-tab-panels">
                <section class="info-panel-tab-panel active" data-panel="welcome" role="tabpanel">
                    <div class="info-panel-section">
                        <div class="welcome-content">
                            <div style="background:#f0f0ec; border:1px solid #d2d2ce; border-radius:8px; padding:10px 12px; margin-bottom:14px;">
                                <div style="font-size:18px; font-weight:700; color:#2f2f2f;">SEPI Analysis Tool Guide</div>
                            </div>

                            <div style="font-size:12px; font-weight:700; color:#6d6d6d; letter-spacing:0.06em; margin:6px 0 8px; border-bottom:1px solid #d9d9d9; padding-bottom:5px;">WHAT THE TOOL SHOWS</div>
                            <p style="margin:0 0 8px; font-size:12px; line-height:1.5; color:#3e3e3e;">
                                The SEPI Analysis Tool maps the Socioeconomic Peace Index and its component pillars at the sub-national (Admin-1) level across three countries. SEPI measures structural socioeconomic conditions associated with conflict vulnerability, covering education, health, food security, poverty, and climate resilience.
                            </p>
                            <p style="margin:0 0 10px; font-size:12px; line-height:1.5; color:#3e3e3e;">
                                Scores run from 0 to 1, where higher values reflect stronger conditions and lower vulnerability. Scores are relative within each country and are not comparable across countries.
                            </p>
                            <div style="background:#efe7d7; border-left:4px solid #b89c67; color:#5b4f36; font-size:12px; line-height:1.4; padding:8px 10px; border-radius:4px; margin-bottom:14px;">
                                Scores are relative within each country and are not comparable across countries.
                            </div>

                            <div style="font-size:12px; font-weight:700; color:#6d6d6d; letter-spacing:0.06em; margin:6px 0 8px; border-bottom:1px solid #d9d9d9; padding-bottom:5px;">HOW TO USE</div>
                            <div style="position:relative; margin-bottom:14px;">
                                <div style="position:absolute; left:16px; top:10px; bottom:10px; width:2px; background:#5f9be6;"></div>
                                <div style="position:relative; border:1px solid #d8d8d8; border-radius:8px; background:#f7f7f7; padding:10px 12px 10px 46px; margin-bottom:8px;">
                                    <span style="position:absolute; left:9px; top:12px; width:18px; height:18px; border-radius:50%; background:#dce9fa; color:#3f79c5; font-size:11px; line-height:18px; text-align:center; font-weight:700;">1</span>
                                    <div style="font-size:14px; font-weight:700; color:#343434;">Select a country</div>
                                    <div style="font-size:12px; color:#555; margin-top:4px;">Use the country buttons in the left panel to choose Somalia, South Sudan, or Kenya.</div>
                                </div>
                                <div style="position:relative; border:1px solid #d8d8d8; border-radius:8px; background:#f7f7f7; padding:10px 12px 10px 46px; margin-bottom:8px;">
                                    <span style="position:absolute; left:9px; top:12px; width:18px; height:18px; border-radius:50%; background:#dce9fa; color:#3f79c5; font-size:11px; line-height:18px; text-align:center; font-weight:700;">2</span>
                                    <div style="font-size:14px; font-weight:700; color:#343434;">Choose a layer</div>
                                    <div style="font-size:12px; color:#555; margin-top:4px;">Select Overall Peace Index for the composite score, or one of the five pillar indices.</div>
                                </div>
                                <div style="position:relative; border:1px solid #d8d8d8; border-radius:8px; background:#f7f7f7; padding:10px 12px 10px 46px; margin-bottom:8px;">
                                    <span style="position:absolute; left:9px; top:12px; width:18px; height:18px; border-radius:50%; background:#dce9fa; color:#3f79c5; font-size:11px; line-height:18px; text-align:center; font-weight:700;">3</span>
                                    <div style="font-size:14px; font-weight:700; color:#343434;">Read the map</div>
                                    <div style="font-size:12px; color:#555; margin-top:4px;">Use the legend to interpret region colours by score range. <span style="display:inline-block; margin-left:6px; padding:1px 6px; border-radius:10px; background:#f7d9d9; color:#9a2f2f; font-size:11px;">Red = deprivation</span> <span style="display:inline-block; margin-left:4px; padding:1px 6px; border-radius:10px; background:#d9efdc; color:#2f7b38; font-size:11px;">Green = resilience</span></div>
                                </div>
                                <div style="position:relative; border:1px solid #d8d8d8; border-radius:8px; background:#f7f7f7; padding:10px 12px 10px 46px; margin-bottom:8px;">
                                    <span style="position:absolute; left:9px; top:12px; width:18px; height:18px; border-radius:50%; background:#dce9fa; color:#3f79c5; font-size:11px; line-height:18px; text-align:center; font-weight:700;">4</span>
                                    <div style="font-size:14px; font-weight:700; color:#343434;">Click a region</div>
                                    <div style="font-size:12px; color:#555; margin-top:4px;">Open district details with the SEPI score, pillar scores, and district overview.</div>
                                </div>
                                <div style="position:relative; border:1px solid #d8d8d8; border-radius:8px; background:#f7f7f7; padding:10px 12px 10px 46px;">
                                    <span style="position:absolute; left:9px; top:12px; width:18px; height:18px; border-radius:50%; background:#dce9fa; color:#3f79c5; font-size:11px; line-height:18px; text-align:center; font-weight:700;">5</span>
                                    <div style="font-size:14px; font-weight:700; color:#343434;">Drill into sub-indicators</div>
                                    <div style="font-size:12px; color:#555; margin-top:4px;">Select any indicator listed under a pillar to map it directly and inspect district values.</div>
                                </div>
                            </div>

                            <div style="font-size:12px; font-weight:700; color:#6d6d6d; letter-spacing:0.06em; margin:6px 0 8px; border-bottom:1px solid #d9d9d9; padding-bottom:5px;">THE FIVE PILLARS</div>
                            <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap; margin-bottom:10px;">
                                <div style="width:160px; height:160px; border-radius:50%; background: conic-gradient(#1f9d75 0% 20%, #7b72d8 20% 40%, #de6130 40% 60%, #bd7a10 60% 80%, #3a8ad8 80% 100%); position:relative; flex-shrink:0;">
                                    <div style="position:absolute; inset:42px; border-radius:50%; background:#f7f7f7; display:flex; align-items:center; justify-content:center; text-align:center; font-size:12px; font-weight:700; color:#666; line-height:1.2;">Overall<br>SEPI</div>
                                </div>
                                <div style="font-size:12px; color:#444; line-height:1.5;">
                                    <div><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#1f9d75; margin-right:8px;"></span><strong>Education</strong><br><span style="padding-left:18px; color:#666;">Attendance, literacy, school access</span></div>
                                    <div style="margin-top:4px;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#7b72d8; margin-right:8px;"></span><strong>Food security</strong><br><span style="padding-left:18px; color:#666;">IPC Phase 3+ population fraction</span></div>
                                    <div style="margin-top:4px;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#de6130; margin-right:8px;"></span><strong>Poverty reduction</strong><br><span style="padding-left:18px; color:#666;">Headcount, expenditure, income</span></div>
                                    <div style="margin-top:4px;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#bd7a10; margin-right:8px;"></span><strong>Health access</strong><br><span style="padding-left:18px; color:#666;">Facilities per population, access share</span></div>
                                    <div style="margin-top:4px;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:#3a8ad8; margin-right:8px;"></span><strong>Climate resilience</strong><br><span style="padding-left:18px; color:#666;">NDVI, PDSI, FAPAR, soil moisture</span></div>
                                </div>
                            </div>
                            <div style="background:#efefeb; border-left:4px solid #a5a394; color:#555; font-size:12px; line-height:1.45; padding:8px 10px; border-radius:4px; margin-bottom:12px;">
                                The overall score is a geometric mean of all five pillars. A very low score on any one pillar significantly depresses the overall score.
                            </div>

                            <div style="font-size:12px; font-weight:700; color:#6d6d6d; letter-spacing:0.06em; margin:6px 0 8px; border-bottom:1px solid #d9d9d9; padding-bottom:5px;">SCORE RANGES</div>
                            <div style="font-size:12px; color:#444; line-height:1.55;">
                                <div><span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:#c5312a; margin-right:8px; vertical-align:middle;"></span><strong>0.0 - 0.2</strong></div>
                                <div><span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:#e26d28; margin-right:8px; vertical-align:middle;"></span><strong>0.2 - 0.4</strong></div>
                                <div><span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:#efc64a; margin-right:8px; vertical-align:middle;"></span><strong>0.4 - 0.6</strong></div>
                                <div><span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:#69b34c; margin-right:8px; vertical-align:middle;"></span><strong>0.6 - 0.8</strong></div>
                                <div><span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:#2c7a2c; margin-right:8px; vertical-align:middle;"></span><strong>0.8 - 1.0</strong></div>
                                <div><span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:#b8b8b8; margin-right:8px; vertical-align:middle;"></span><strong>No data</strong></div>
                            </div>
                            <div style="background:#efe7d7; border-left:4px solid #b89c67; color:#5b4f36; font-size:12px; line-height:1.4; padding:8px 10px; border-radius:4px; margin-top:10px;">
                                Scores are within-country only and not comparable across countries.
                            </div>

                            <div class="welcome-conflict-section">
                                <div class="welcome-conflict-heading">CONFLICT DATA</div>
                                <p class="welcome-conflict-source">Source: ACLED · Annual data 2016–2025 · Display only, not part of SEPI computation</p>

                                <div class="welcome-conflict-grid">
                                    <div class="welcome-conflict-card">
                                        <div class="card-label">Conflict Fatalities</div>
                                        <p class="card-title">Total fatalities per year</p>
                                        <p class="card-meta">Count, Admin-1 level</p>
                                    </div>
                                    <div class="welcome-conflict-card">
                                        <div class="card-label">Conflict Events</div>
                                        <p class="card-title">Total incidents per year</p>
                                        <p class="card-meta">Count, Admin-1 level</p>
                                    </div>
                                    <div class="welcome-conflict-card">
                                        <div class="card-label">Conflict Fatalities per 100k</div>
                                        <p class="card-title">Fatalities relative to population</p>
                                        <p class="card-meta">Rate, Admin-1 level</p>
                                    </div>
                                    <div class="welcome-conflict-card">
                                        <div class="card-label">Conflict Events per 100k</div>
                                        <p class="card-title">Incidents relative to population</p>
                                        <p class="card-meta">Rate, Admin-1 level</p>
                                    </div>
                                </div>

                                <div class="welcome-conflict-block">
                                    <div class="block-label">Year Selector</div>
                                    <div class="welcome-conflict-slider-track" aria-hidden="true"></div>
                                    <div class="welcome-conflict-years">
                                        <span>2016</span><span>2017</span><span>2018</span><span>2019</span><span>2020</span>
                                        <span>2021</span><span>2022</span><span>2023</span><span>2024</span><span>2025</span>
                                    </div>
                                    <p style="margin-top:8px;">Use the slider in the left panel to select a single year. The map updates to show data for that year only.</p>
                                </div>

                                <div class="welcome-conflict-block">
                                    <div class="block-label">Map Legend</div>
                                    <div class="welcome-conflict-legend-bar" aria-hidden="true"></div>
                                    <div class="welcome-conflict-legend-labels">
                                        <span>Higher severity</span>
                                        <span>Lower severity</span>
                                    </div>
                                    <p>Each indicator uses its own scale. Red indicates higher conflict severity; yellow indicates lower. Scales are not shared across indicators.</p>
                                </div>

                                <div class="welcome-conflict-opens">
                                    <div class="welcome-conflict-opens-header">Clicking a conflict indicator opens</div>
                                    <div class="welcome-conflict-opens-item">
                                        <span class="item-icon" aria-hidden="true">📋</span>
                                        <div>
                                            <strong>Indicator overview</strong>
                                            <p>A description of what the indicator measures and how to interpret its values.</p>
                                        </div>
                                    </div>
                                    <div class="welcome-conflict-opens-item">
                                        <span class="item-icon" aria-hidden="true">📈</span>
                                        <div>
                                            <strong>Time series (2016–2025)</strong>
                                            <p>Annual trend chart showing how the indicator has changed over the full data period for the selected country.</p>
                                        </div>
                                    </div>
                                    <div class="welcome-conflict-opens-item">
                                        <span class="item-icon" aria-hidden="true">💡</span>
                                        <div>
                                            <strong>Country analysis</strong>
                                            <p>A brief contextual summary highlighting key patterns and notable regions for the selected country.</p>
                                        </div>
                                    </div>
                                </div>

                                <p class="welcome-conflict-disclaimer">SEPI is a structural baseline, not a real-time early warning tool. Results should be read alongside contextual knowledge and other data sources.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="info-panel-tab-panel" data-panel="layers" role="tabpanel" hidden>
                    <div class="info-panel-section">
                        <div class="section-header">
                            <h4>Active Layers</h4>
                            <span class="layer-count">0 layers</span>
                        </div>
                        <div class="layers-list" id="layers-list">
                            <p class="no-layers-message">No layers currently active</p>
                        </div>
                        <div id="sepi-ranking-panel" style="display:none; margin-top: 12px; padding: 12px; border: 1px solid #dee2e6; border-radius: 8px; background: #f8f9fa;">
                            <h5 style="margin: 0 0 8px 0;">SEPI District Ranking</h5>
                            <p style="margin: 0 0 10px 0; font-size: 12px; color: #555;">Ranked from highest to lowest Overall Peace Index score.</p>
                            <div id="sepi-ranking-chart"></div>
                        </div>
                        <div id="conflict-timeline-panel" style="display:none; margin-top: 12px; padding: 12px; border: 1px solid #dee2e6; border-radius: 8px; background: #f8f9fa;">
                            <h5 style="margin: 0 0 8px 0;">Conflict Temporal Evolution</h5>
                            <p style="margin: 0 0 10px 0; font-size: 12px; color: #555;">Year-by-year trend for the active conflict metric.</p>
                            <canvas id="conflict-timeline-chart" width="520" height="240" style="width: 100%; max-width: 100%; height: auto; border: 1px solid #e5e5e5; background: #fff; border-radius: 6px;"></canvas>
                        </div>
                    </div>
                </section>

                <section class="info-panel-tab-panel" data-panel="analysis" role="tabpanel" hidden>
                    <div class="info-panel-section analysis-section">
                        <div class="section-header">
                            <h4>Analysis & Reports</h4>
                        </div>
                        <div class="analysis-content">
                            <div class="analysis-tool">
                                <h5>Country SEPI Report</h5>
                                <p>Build a report for the selected country using Active Layers context, district rankings, conflict narrative, and charts.</p>
                                <button class="run-analysis-btn" data-analysis="summary">Generate Report</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="info-panel-section results-section">
                        <div class="section-header">
                            <h4>Report Results</h4>
                        </div>
                        <div class="results-content">
                            <p class="no-results-message">No reports generated yet</p>
                        </div>
                    </div>
                </section>
            </div>
        `;
        
        // Create resize handles only for floating mode
        if (!this.options.docked) {
            this.createResizeHandles();
        }
        
        // Assemble panel
        if (header) {
            this.container.appendChild(header);
        }
        this.container.appendChild(content);
        
        // Add to page
        if (this.options.docked) {
            const mount = document.querySelector(this.options.mountTarget);
            if (mount) {
                mount.appendChild(this.container);
            } else {
                document.body.appendChild(this.container);
            }
        } else {
            document.body.appendChild(this.container);
        }
        
        // Start in minimized state only for floating mode
        if (!this.options.docked) {
            this.updateMinimizeState();
        } else {
            this.isMinimized = false;
            this.updateMinimizeState();
        }
    }
    
    /**
     * Create resize handles for the panel
     */
    createResizeHandles() {
        // Bottom-right corner resize handle
        const cornerHandle = document.createElement('div');
        cornerHandle.className = 'resize-handle corner-handle';
        cornerHandle.style.cssText = `
            position: absolute;
            bottom: 0;
            right: 0;
            width: 15px;
            height: 15px;
            cursor: nw-resize;
            background: linear-gradient(-45deg, transparent 40%, #ccc 40%, #ccc 60%, transparent 60%);
            border-radius: 0 0 8px 0;
        `;
        
        // Right edge resize handle
        const rightHandle = document.createElement('div');
        rightHandle.className = 'resize-handle right-handle';
        rightHandle.style.cssText = `
            position: absolute;
            top: 20px;
            right: 0;
            width: 5px;
            height: calc(100% - 40px);
            cursor: ew-resize;
            background: transparent;
        `;
        
        // Bottom edge resize handle
        const bottomHandle = document.createElement('div');
        bottomHandle.className = 'resize-handle bottom-handle';
        bottomHandle.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 20px;
            width: calc(100% - 40px);
            height: 5px;
            cursor: ns-resize;
            background: transparent;
        `;
        
        this.container.appendChild(cornerHandle);
        this.container.appendChild(rightHandle);
        this.container.appendChild(bottomHandle);
    }
    
    /**
     * Make the panel resizable
     */
    makeResizable() {
        const handles = this.container.querySelectorAll('.resize-handle');
        
        handles.forEach(handle => {
            let isResizing = false;
            let startX, startY, startWidth, startHeight;
            
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                startWidth = parseInt(document.defaultView.getComputedStyle(this.container).width, 10);
                startHeight = parseInt(document.defaultView.getComputedStyle(this.container).height, 10);
                
                document.addEventListener('mousemove', resize);
                document.addEventListener('mouseup', stopResize);
                
                // Prevent text selection during resize
                document.body.style.userSelect = 'none';
            });
            
            const resize = (e) => {
                if (!isResizing) return;
                
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                
                if (handle.classList.contains('corner-handle')) {
                    // Resize both width and height
                    const newWidth = Math.max(300, startWidth + deltaX);
                    const newHeight = Math.max(200, startHeight + deltaY);
                    this.container.style.width = newWidth + 'px';
                    this.container.style.height = newHeight + 'px';
                    this.container.style.maxHeight = 'none';
                } else if (handle.classList.contains('right-handle')) {
                    // Resize width only
                    const newWidth = Math.max(300, startWidth + deltaX);
                    this.container.style.width = newWidth + 'px';
                } else if (handle.classList.contains('bottom-handle')) {
                    // Resize height only
                    const newHeight = Math.max(200, startHeight + deltaY);
                    this.container.style.height = newHeight + 'px';
                    this.container.style.maxHeight = 'none';
                }
            };
            
            const stopResize = () => {
                isResizing = false;
                document.removeEventListener('mousemove', resize);
                document.removeEventListener('mouseup', stopResize);
                document.body.style.userSelect = '';
            };
        });
    }
    
    /**
     * Setup event listeners for panel interactions
     */
    setupEventListeners() {
        // Header controls (floating mode only)
        const minimizeBtn = this.container.querySelector('.minimize-btn');
        const closeBtn = this.container.querySelector('.close-btn');
        
        if (minimizeBtn) {
            // Handle minimize button click
            minimizeBtn.addEventListener('click', () => {
                this.isMinimized = !this.isMinimized;
                
                if (this.isMinimized) {
                    // Save current height before minimizing
                    this.originalHeight = this.container.style.height || '400px';
                    
                    // Minimize panel
                    this.container.classList.add('minimized');
                    this.container.style.height = '48px';
                    this.container.style.minHeight = '48px';
                    this.container.style.maxHeight = '48px';
                    this.container.style.resize = 'none';
                    
                    const content = this.container.querySelector('.info-panel-content');
                    content.style.display = 'none';
                    
                    minimizeBtn.textContent = '+';
                    minimizeBtn.title = 'Restore';
                    
                    // Round header corners when minimized
                    const headerEl = this.container.querySelector('.info-panel-header');
                    if (headerEl) {
                        headerEl.style.borderRadius = '8px';
                    }
                    
                } else {
                    // Restore panel
                    this.container.classList.remove('minimized');
                    this.container.style.height = this.originalHeight || '400px';
                    this.container.style.minHeight = '200px';
                    this.container.style.maxHeight = 'none';
                    this.container.style.resize = 'both';
                    
                    const content = this.container.querySelector('.info-panel-content');
                    content.style.display = 'flex';
                    
                    minimizeBtn.textContent = '−';
                    minimizeBtn.title = 'Minimize';
                    
                    // Restore header corners
                    const headerEl = this.container.querySelector('.info-panel-header');
                    if (headerEl) {
                        headerEl.style.borderRadius = '8px 8px 0 0';
                    }
                }
            });
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
        
        const tabs = this.container.querySelectorAll('.info-panel-tab');
        tabs.forEach((tab) => {
            tab.addEventListener('click', () => this.setActiveTab(tab.dataset.tab));
        });

        // Analysis button
        const analysisBtn = this.container.querySelector('.run-analysis-btn');
        if (analysisBtn) {
            analysisBtn.addEventListener('click', () => this.generateSummaryReport());
        }
        
        // Make panel draggable and resizable only in floating mode
        if (!this.options.docked) {
            this.makeDraggable();
            this.makeResizable();
        }
    }

    setActiveTab(tabName) {
        const tabs = this.container.querySelectorAll('.info-panel-tab');
        const panels = this.container.querySelectorAll('.info-panel-tab-panel');

        tabs.forEach((tab) => {
            const isActive = tab.dataset.tab === tabName;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        panels.forEach((panel) => {
            const isActive = panel.dataset.panel === tabName;
            panel.classList.toggle('active', isActive);
            panel.hidden = !isActive;
        });
    }
    
    /**
     * Make the panel draggable
     */
    makeDraggable() {
        const header = this.container.querySelector('.info-panel-header');
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;
        
        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('info-panel-btn')) return;
            
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            
            if (e.target === header || header.contains(e.target)) {
                isDragging = true;
                header.style.cursor = 'grabbing';
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                
                xOffset = currentX;
                yOffset = currentY;
                
                this.container.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                header.style.cursor = 'move';
            }
        });
    }
    
    /**
     * Show the info panel
     */
    show() {
        this.container.style.display = this.options.docked ? 'flex' : 'block';
        this.isVisible = true;
        this.updateLayersList();
    }
    
    /**
     * Hide the info panel
     */
    hide() {
        this.container.style.display = 'none';
        this.isVisible = false;
    }
    
    /**
     * Toggle panel visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    /**
     * Toggle minimize/maximize state
     */
    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        this.updateMinimizeState();
    }
    
    /**
     * Update the visual state based on minimize status
     */
    updateMinimizeState() {
        const content = this.container.querySelector('.info-panel-content');
        const minimizeBtn = this.container.querySelector('.minimize-btn');
        const header = this.container.querySelector('.info-panel-header');
        
        if (this.isMinimized) {
            if (this.options.docked) {
                this.container.classList.add('minimized');
                content.style.display = 'none';
                if (minimizeBtn) {
                    minimizeBtn.textContent = '+';
                    minimizeBtn.title = 'Restore';
                }
                return;
            }

            // Save current height before minimizing
            if (!this.originalHeight) {
                this.originalHeight = this.container.style.height || '400px';
            }
            
            this.container.classList.add('minimized');
            this.container.style.height = '48px';
            this.container.style.minHeight = '48px';
            this.container.style.maxHeight = '48px';
            this.container.style.resize = 'none';
            
            content.style.display = 'none';
            minimizeBtn.textContent = '+';
            minimizeBtn.title = 'Restore';
            
            // Round header corners when minimized
            header.style.borderRadius = '8px';
            
        } else {
            if (this.options.docked) {
                this.container.classList.remove('minimized');
                content.style.display = 'flex';
                if (minimizeBtn) {
                    minimizeBtn.textContent = '−';
                    minimizeBtn.title = 'Minimize';
                }
                return;
            }

            this.container.classList.remove('minimized');
            this.container.style.height = this.originalHeight || '400px';
            this.container.style.minHeight = '200px';
            this.container.style.maxHeight = 'none';
            this.container.style.resize = 'both';
            
            content.style.display = 'flex';
            minimizeBtn.textContent = '−';
            minimizeBtn.title = 'Minimize';
            
            // Restore header corners
            header.style.borderRadius = '8px 8px 0 0';
        }
    }
    
    /**
     * Add a layer to tracking
     * @param {string} id - Layer ID
     * @param {Object} layerInfo - Layer information
     */
    addLayer(id, layerInfo) {
        this.activeLayers.set(id, {
            id,
            name: layerInfo.name || id,
            type: layerInfo.type || 'unknown',
            layer: layerInfo.layer,
            selectedAttribute: layerInfo.selectedAttribute,
            properties: layerInfo.properties || {},
            ...layerInfo
        });
        
        if (this.isVisible) {
            this.updateLayersList();
        }
    }
    
    /**
     * Remove a layer from tracking
     * @param {string} id - Layer ID
     */
    removeLayer(id) {
        this.activeLayers.delete(id);
        
        if (this.isVisible) {
            this.updateLayersList();
        }
    }
    
    /**
     * Update layer information
     * @param {string} id - Layer ID
     * @param {Object} updates - Updates to apply
     */
    updateLayer(id, updates) {
        if (this.activeLayers.has(id)) {
            const existing = this.activeLayers.get(id);
            this.activeLayers.set(id, { ...existing, ...updates });
            
            if (this.isVisible) {
                this.updateLayersList();
            }
        }
    }
    
    /**
     * Update the layers list display
     */
    updateLayersList() {
        const layersList = document.getElementById('layers-list');
        const layerCount = this.container.querySelector('.layer-count');
        
        if (!layersList || !layerCount) return;
        
        layerCount.textContent = `${this.activeLayers.size} layer${this.activeLayers.size !== 1 ? 's' : ''}`;
        
        if (this.activeLayers.size === 0) {
            layersList.innerHTML = '<p class="no-layers-message">No layers currently active</p>';
            this.updateSepiRankingChart();
            return;
        }
        
        const layersHTML = Array.from(this.activeLayers.values())
            .map((layer) => {
                const desc =
                    layer.description && String(layer.description).trim()
                        ? `<div class="layer-description">${escapeHtml(layer.description)}</div>`
                        : '';
                const dashboardHtml = layer.dashboardContent
                    ? renderSepiDashboardHtml(layer.dashboardContent)
                    : '';
                const detailsHtml = dashboardHtml || this.generateLayerDetails(layer);
                return `
            <div class="layer-item" data-layer-id="${escapeHtml(layer.id)}">
                <div class="layer-header">
                    <span class="layer-name">${escapeHtml(layer.name)}</span>
                    <span class="layer-type">${escapeHtml(layer.type)}</span>
                </div>
                ${desc}
                <div class="layer-details">
                    ${detailsHtml}
                </div>
            </div>
        `;
            })
            .join('');
        
        layersList.innerHTML = layersHTML;
        this.updateSepiRankingChart();
    }

    updateSepiRankingChart() {
        const panel = this.container?.querySelector('#sepi-ranking-panel');
        const chart = this.container?.querySelector('#sepi-ranking-chart');
        if (!panel || !chart) return;
        const titleEl = panel.querySelector('h5');
        const subtitleEl = panel.querySelector('p');

        const sepiLayerInfo = this.activeLayers.get('sepi');
        const pillarLayerInfo = this.activeLayers.get('pillar');
        const layerInfo = sepiLayerInfo || pillarLayerInfo;
        const geojsonLayer = layerInfo?.layer;
        const valueKey = layerInfo?.rankingAttribute || layerInfo?.selectedAttribute || 'peacebuilding_index';
        const layerName = layerInfo?.name || 'SEPI';

        if (!geojsonLayer?.eachLayer || this.activeLayers.has('conflict')) {
            panel.style.display = 'none';
            this._lastRankingHtml = null;
            return;
        }

        const scrollEl = chart.querySelector('.sepi-ranking-scroll');
        const prevScrollTop = scrollEl?.scrollTop ?? 0;

        const rows = [];
        geojsonLayer.eachLayer((layer) => {
            const props = layer?.feature?.properties || {};
            const raw = props[valueKey];
            const value = parseRankingValue(raw);
            if (value == null) return;
            rows.push({
                name: this.getDistrictNameForRanking(props),
                value
            });
        });

        const filtered = rows.filter((row) => {
            const n = String(row.name || '').trim().toLowerCase();
            return n !== 'unknown district';
        });

        if (!filtered.length) {
            panel.style.display = 'none';
            this._lastRankingHtml = null;
            return;
        }

        filtered.sort((a, b) => b.value - a.value);
        const maxValue = Math.max(...filtered.map((r) => r.value), 1);
        const html = filtered.map((row, idx) => {
            const pct = Math.max(2, (row.value / maxValue) * 100);
            return `
                <div style="display:flex; align-items:center; gap:8px; margin: 0 0 6px 0; font-size: 11px;">
                    <div style="width:22px; color:#6c757d; text-align:right; flex-shrink:0;">${idx + 1}.</div>
                    <div style="width:120px; color:#343a40; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex-shrink:0;" title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</div>
                    <div style="flex:1; height:14px; background:#e9ecef; border-radius:7px; overflow:hidden;">
                        <div style="width:${pct}%; height:100%; background:#60a5fa;"></div>
                    </div>
                    <div style="width:40px; text-align:right; color:#2563eb; font-weight:600; flex-shrink:0;">${row.value.toFixed(2)}</div>
                </div>
            `;
        }).join('');

        if (titleEl) {
            titleEl.textContent = `${layerName.replace(/^Pillar:\s*/i, '')} District Ranking`;
        }
        if (subtitleEl) {
            subtitleEl.textContent = 'Ranked from highest to lowest score.';
        }
        const rankingHtml = `<div class="sepi-ranking-scroll" style="max-height: 280px; overflow-y: auto; padding-right: 2px;">${html}</div>`;
        if (this._lastRankingHtml === rankingHtml) {
            panel.style.display = 'block';
            return;
        }
        this._lastRankingHtml = rankingHtml;
        chart.innerHTML = rankingHtml;
        const newScrollEl = chart.querySelector('.sepi-ranking-scroll');
        if (newScrollEl) newScrollEl.scrollTop = prevScrollTop;
        panel.style.display = 'block';
    }

    getDistrictNameForRanking(properties) {
        const p = properties || {};
        return (
            p.ADM1_EN ||
            p.adm1_name ||
            p.NAME_1 ||
            p.admin1_name ||
            p.region ||
            p.district ||
            'Unknown District'
        );
    }

    setConflictTimelineData(timelineData) {
        const panel = this.container?.querySelector('#conflict-timeline-panel');
        if (!panel) return;

        if (!timelineData || !Array.isArray(timelineData.years) || !timelineData.years.length) {
            panel.style.display = 'none';
            return;
        }

        panel.style.display = 'block';
        this.renderConflictTimelineChart(timelineData);
    }

    clearConflictTimelineData() {
        const panel = this.container?.querySelector('#conflict-timeline-panel');
        if (!panel) return;
        panel.style.display = 'none';
    }

    renderConflictTimelineChart(timelineData) {
        const canvas = this.container?.querySelector('#conflict-timeline-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const years = timelineData.years || [];
        const overall = timelineData.overallSeries || [];
        const district = timelineData.districtSeries || null;

        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        const leftPad = 44;
        const rightPad = 16;
        const topPad = 26;
        const bottomPad = 46;
        const chartW = width - leftPad - rightPad;
        const chartH = height - topPad - bottomPad;

        const combined = district ? overall.concat(district) : overall;
        const safeValues = combined.filter((v) => Number.isFinite(v));
        const maxValue = safeValues.length ? Math.max(...safeValues) : 1;
        const yMax = maxValue > 0 ? maxValue * 1.1 : 1;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#2f3b47';
        ctx.font = 'bold 12px Calibri, sans-serif';
        const titleSuffix = timelineData.districtName ? ` • ${timelineData.districtName}` : ` • ${timelineData.aggregationLabel}`;
        ctx.fillText(`${timelineData.metricName}${titleSuffix}`, leftPad, 16);

        ctx.strokeStyle = '#e6e9ec';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = topPad + (i / 4) * chartH;
            ctx.beginPath();
            ctx.moveTo(leftPad, y);
            ctx.lineTo(leftPad + chartW, y);
            ctx.stroke();
        }

        const groupWidth = chartW / Math.max(years.length, 1);
        const hasDistrict = Array.isArray(district);
        const barWidth = hasDistrict ? Math.max(6, groupWidth * 0.32) : Math.max(10, groupWidth * 0.55);

        years.forEach((year, i) => {
            const gx = leftPad + i * groupWidth + groupWidth / 2;
            const overallValue = Number(overall[i] || 0);
            const overallHeight = (overallValue / yMax) * chartH;
            const overallX = hasDistrict ? gx - barWidth - 2 : gx - barWidth / 2;
            const overallY = topPad + chartH - overallHeight;

            ctx.fillStyle = '#60a5fa';
            ctx.fillRect(overallX, overallY, barWidth, overallHeight);

            if (hasDistrict) {
                const districtValue = Number(district[i] || 0);
                const districtHeight = (districtValue / yMax) * chartH;
                const districtX = gx + 2;
                const districtY = topPad + chartH - districtHeight;
                ctx.fillStyle = '#93c5fd';
                ctx.fillRect(districtX, districtY, barWidth, districtHeight);
            }

            ctx.fillStyle = '#555';
            ctx.font = '11px Calibri, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(String(year), gx, topPad + chartH + 16);
        });

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(leftPad, topPad);
        ctx.lineTo(leftPad, topPad + chartH);
        ctx.lineTo(leftPad + chartW, topPad + chartH);
        ctx.stroke();

        ctx.fillStyle = '#444';
        ctx.font = '11px Calibri, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('0', 6, topPad + chartH + 4);
        ctx.fillText(`${yMax.toFixed(yMax >= 10 ? 0 : 2)}`, 6, topPad + 4);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#60a5fa';
        ctx.fillRect(leftPad, height - 14, 10, 10);
        ctx.fillStyle = '#555';
        ctx.fillText(timelineData.aggregationLabel || 'Overall', leftPad + 14, height - 5);
        if (hasDistrict) {
            ctx.fillStyle = '#93c5fd';
            ctx.fillRect(leftPad + 170, height - 14, 10, 10);
            ctx.fillStyle = '#555';
            ctx.fillText(timelineData.districtName || 'Selected district', leftPad + 184, height - 5);
        }
    }
    
    /**
     * Generate details for a specific layer
     * @param {Object} layer - Layer information
     */
    generateLayerDetails(layer) {
        if (layer.dashboardContent) {
            return '';
        }

        const details = [];
        
        if (layer.opacity !== undefined) {
            details.push(`Opacity: ${Math.round(layer.opacity * 100)}%`);
        }
        
        if (layer.featureCount !== undefined) {
            details.push(`Features: ${layer.featureCount}`);
        }
        
        if (layer.selectedAttribute) {
            details.push(`Attribute: ${layer.selectedAttribute}`);
        }

        if (layer.source) {
            details.push(`Source: ${layer.source}`);
        }

        if (layer.year) {
            details.push(`Year: ${layer.year}`);
        }
        
        if (layer.colorRamp) {
            details.push(`Color Scheme: ${layer.colorRamp}`);
        }
        
        if (details.length === 0) return 'Layer active';
        return details.map((d) => escapeHtml(d)).join(' • ');
    }
    
    /**
     * Generate country SEPI report for the selected country (Analysis → Report Results).
     */
    async generateSummaryReport() {
        const button = this.container.querySelector('.run-analysis-btn');
        const resultsContent = this.container.querySelector('.results-content');
        const country = getCurrentCountry();
        const countryLabel = getCountryDisplayLabel(country);

        button.disabled = true;
        button.textContent = 'Generating...';
        resultsContent.innerHTML = `
            <div class="analysis-loading">
                <div class="loading-spinner"></div>
                <p>Building report for ${escapeHtml(countryLabel)}…</p>
            </div>
        `;

        try {
            const reportData = await buildCountryReport({
                country,
                activeLayers: this.activeLayers
            });

            this._lastCountryReport = reportData;
            resultsContent.innerHTML = renderCountryReportHTML(reportData);
            this.setActiveTab('analysis');

            setTimeout(() => drawCountryReportCharts(reportData), 100);
        } catch (error) {
            console.error('Error generating report:', error);
            resultsContent.innerHTML = `
                <div class="analysis-error">
                    <h5>Report Generation Error</h5>
                    <p>Failed to generate country report: ${escapeHtml(error.message)}</p>
                </div>
            `;
        } finally {
            button.disabled = false;
            button.textContent = 'Generate Report';
        }
    }
    
    /**
     * Show message when no suitable data is available
     */
    showNoDataMessage(container) {
        container.innerHTML = `
            <div class="analysis-info">
                <h5>Insufficient Data</h5>
                <p>To generate a correlation report, you need:</p>
                <ul>
                    <li>At least one SEPI layer OR one Pillar indicator active</li>
                    <li>At least one Subnational Statistics layer with an attribute selected</li>
                </ul>
                <p>Please activate the required layers and try again.</p>
            </div>
        `;
    }
    
    /**
     * Generate correlation data between layers using REAL data
     * UPDATED: Use SEPI or Pillar data instead of social vulnerability
     */
    generateCorrelationData(sepiLayers, statLayers) {
        const primaryLayer = sepiLayers[0];
        const statLayer = statLayers[0];
        
        console.log('Analyzing real data from layers:', {
            primaryLayer: primaryLayer.name,
            statLayer: statLayer.name,
            statAttribute: statLayer.selectedAttribute
        });
        
        // Extract real data from the layers
        const data = this.extractRealLayerData(primaryLayer, statLayer);
        
        if (data.length === 0) {
            throw new Error('No matching regional data found between layers');
        }
        
        // Calculate actual correlation coefficient
        const primaryValues = data.map(d => d.primaryValue);
        const statValues = data.map(d => d.statistic);
        const correlation = this.calculateCorrelation(primaryValues, statValues);
        
        console.log('Real correlation calculated:', {
            correlation: correlation.toFixed(3),
            dataPoints: data.length,
            primaryRange: [Math.min(...primaryValues), Math.max(...primaryValues)],
            statRange: [Math.min(...statValues), Math.max(...statValues)]
        });
        
        return {
            data,
            correlation: correlation.toFixed(3),
            primaryLayer: primaryLayer.name,
            statLayer: statLayer.name,
            statAttribute: statLayer.selectedAttribute,
            timestamp: new Date().toLocaleString()
        };
    }

    /**
     * Extract real data from the actual layers
     * UPDATED: Use SEPI or Pillar data instead of social vulnerability
     */
    extractRealLayerData(primaryLayer, statLayer) {
        const data = [];
        
        // Get the actual Leaflet layer objects
        const primaryLeafletLayer = primaryLayer.layer;
        const statLeafletLayer = statLayer.layer;
        
        if (!primaryLeafletLayer || !statLeafletLayer) {
            console.error('Could not access layer data');
            return data;
        }
        
        // Create maps for quick lookup
        const primaryData = new Map();
        const statData = new Map();
        
        // Extract Primary layer data (SEPI or Pillar)
        primaryLeafletLayer.eachLayer(function(layer) {
            if (layer.feature && layer.feature.properties) {
                const props = layer.feature.properties;
                const regionName = this.getRegionName(props);
                
                let primaryValue;
                
                // Check if this is a SEPI layer
                if (primaryLayer.type === 'sepi' || primaryLayer.name.toLowerCase().includes('sepi')) {
                    primaryValue = props['peacebuilding_index'] || props['index'] || props.sepi || props.peace_index;
                } 
                // Check if this is a Pillar layer
                else if (primaryLayer.type === 'pillar' || primaryLayer.name.toLowerCase().includes('pillar')) {
                    // For pillars, use the selectedAttribute or look for common pillar properties
                    const pillarProperty = primaryLayer.selectedAttribute || this.detectPillarProperty(props);
                    primaryValue = props[pillarProperty];
                }
                
                console.log('primaryValue:', primaryValue, 'from layer:', primaryLayer.name);
                if (regionName && primaryValue !== undefined && primaryValue !== null) {
                    primaryData.set(regionName, parseFloat(primaryValue));
                }
            }
        }.bind(this));
        
        // Extract statistics data
        statLeafletLayer.eachLayer(function(layer) {
            if (layer.feature && layer.feature.properties) {
                const props = layer.feature.properties;
                const regionName = this.getRegionName(props);
                const statValue = props[statLayer.selectedAttribute];
                
                if (regionName && statValue !== undefined && statValue !== null) {
                    statData.set(regionName, parseFloat(statValue));
                }
            }
        }.bind(this));
        
        console.log('Extracted data:', {
            primaryRegions: Array.from(primaryData.keys()),
            statRegions: Array.from(statData.keys()),
            primarySample: Array.from(primaryData.entries()).slice(0, 3),
            statSample: Array.from(statData.entries()).slice(0, 3)
        });
        
        // Match regions and create final dataset
        primaryData.forEach((primaryValue, regionName) => {
            if (statData.has(regionName)) {
                const statValue = statData.get(regionName);
                
                // Only include if both values are valid numbers
                if (!isNaN(primaryValue) && !isNaN(statValue)) {
                    data.push({
                        region: regionName,
                        primaryValue: primaryValue,
                        statistic: statValue,
                        population: this.getPopulationEstimate(regionName)
                    });
                }
            }
        });
        
        return data;
    }
    
    /**
     * Detect pillar property from layer properties
     */
    detectPillarProperty(properties) {
 const pillarPatterns = [
        'education',
        'Food_security',
        'poverty',
        'health',
        'climate_vulnerability'
    ];
    
    for (const pattern of pillarPatterns) {
        if (properties[pattern] !== undefined) {
            return pattern;
        }
    }
    
    // Fallback: find any property that looks like an index
    const indexProps = Object.keys(properties).filter(key => 
        key.toLowerCase().includes('index') || 
        key.toLowerCase().includes('score')
    );
    
    return indexProps[0] || Object.keys(properties)[0];
}

    /**
     * Get region name from feature properties
     */
    getRegionName(properties) {
        // Try different possible name fields
        const nameFields = [
        'column_names2',  // New standardized names from pillars2.geojson
        'ADM1_EN', 'adm1_name', 'NAME_1', 'NAME_2', 'NAME_3',
        'name', 'Name', 'AREA_NAME'
    ];
    
    for (const field of nameFields) {
        if (properties[field] && typeof properties[field] === 'string') {
            return properties[field].trim();
        }
    }
    
    return null;
}
    /**
     * Get population estimate for a region
     */
    getPopulationEstimate(regionName) {
        const estimates = {
            'Kayes': 2418305,
            'Koulikoro': 2418618,
            'Sikasso': 3137917,
            'Ségou': 2336255,
            'Mopti': 2037330,
            'Tombouctou': 681691,
            'Gao': 544120,
            'Kidal': 67638,
            'Taoudénit': 32125,
            'Ménaka': 62180,
            // Add Somalia regions
            'Awdal': 673263,
            'Woqooyi Galbeed': 1242003,
            'Togdheer': 721363,
            'Sool': 327307,
            'Sanaag': 544123,
            'Bari': 719512,
            'Nugaal': 392698,
            'Mudug': 717863,
            'Galgaduud': 569434,
            'Hiran': 520685,
            'Middle Shabelle': 516036,
            'Banadir': 1650227,
            'Lower Shabelle': 1202219,
            'Bay': 792182,
            'Bakool': 367226,
            'Gedo': 508405,
            'Middle Juba': 362921,
            'Lower Juba': 489307
        };
        
        return estimates[regionName] || Math.floor(Math.random() * 1000000) + 100000;
    }
    
    /**
     * Calculate Pearson correlation coefficient
     */
    calculateCorrelation(x, y) {
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.map((xi, i) => xi * y[i]).reduce((a, b) => a + b, 0);
        const sumX2 = x.map(xi => xi * xi).reduce((a, b) => a + b, 0);
        const sumY2 = y.map(yi => yi * yi).reduce((a, b) => a + b, 0);
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        
        return denominator === 0 ? 0 : numerator / denominator;
    }
    
    /**
     * Create the HTML structure for the report with interpretation
     * UPDATED: Use SEPI instead of social vulnerability
     */
    createReportHTML(reportData) {
        const interpretation = this.generateCorrelationInterpretation(
            reportData.correlation, 
            reportData.statAttribute
        );
        
        return `
            <div class="report-container">
                <div class="report-header">
                    <h5>Correlation Analysis Report</h5>
                    <button class="download-btn" onclick="window.infoPanelInstance.downloadReport()">
                        📄 Download PDF
                    </button>
                </div>
                
                <div class="report-summary">
                    <div class="summary-grid">
                        <div class="summary-item">
                            <label>Primary Layer:</label>
                            <span>${reportData.primaryLayer}</span>
                        </div>
                        <div class="summary-item">
                            <label>Statistics Layer:</label>
                            <span>${reportData.statLayer}</span>
                        </div>
                        <div class="summary-item">
                            <label>Selected Attribute:</label>
                            <span>${reportData.statAttribute}</span>
                        </div>
                        <div class="summary-item">
                            <label>Correlation Coefficient:</label>
                            <span class="correlation-value ${this.getCorrelationClass(reportData.correlation)}">${reportData.correlation}</span>
                        </div>
                    </div>
                </div>
                
                <div class="report-section interpretation-section">
                    <h6>📊 Interpretation</h6>
                    <div class="interpretation-content">
                        ${interpretation.summary}
                        <div class="interpretation-details">
                            <p><strong>What this means:</strong></p>
                            <ul>
                                ${interpretation.bullets.map(bullet => `<li>${bullet}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="interpretation-implications">
                            <p><strong>Implications:</strong></p>
                            <p>${interpretation.implications}</p>
                        </div>
                    </div>
                </div>
                
                <div class="report-section">
                    <h6>Regional Data Table</h6>
                    <div class="data-table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Region</th>
                                    <th>Primary Value</th>
                                    <th>${reportData.statAttribute}</th>
                                    <th>Population</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${reportData.data.map(row => `
                                    <tr>
                                        <td>${row.region}</td>
                                        <td>${row.primaryValue.toFixed(3)}</td>
                                        <td>${row.statistic.toFixed(1)}${this.getAttributeUnit(reportData.statAttribute)}</td>
                                        <td>${row.population.toLocaleString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div class="report-section">
                    <h6>Visualizations</h6>
                    <div class="charts-container">
                        <div class="chart-item">
                            <h7>Correlation Scatter Plot</h7>
                            <canvas id="correlation-chart" width="350" height="200"></canvas>
                        </div>
                        <div class="chart-item">
                            <h7>Regional Comparison</h7>
                            <canvas id="bar-chart" width="350" height="200"></canvas>
                        </div>
                    </div>
                </div>
                
                <div class="report-footer">
                    <small>Generated: ${reportData.timestamp}</small>
                </div>
            </div>
        `;
    }
    
    /**
     * Generate intelligent interpretation based on correlation and attribute type
     * UPDATED: Use SEPI instead of social vulnerability
     */
    generateCorrelationInterpretation(correlationStr, attribute) {
        const correlation = parseFloat(correlationStr);
        const absCorr = Math.abs(correlation);
        const isPositive = correlation > 0;
        
        // Determine attribute type and expected relationship
        const attributeInfo = this.analyzeAttribute(attribute);
        
        // Determine correlation strength
        let strength, strengthDesc;
        if (absCorr >= 0.8) {
            strength = 'very strong';
            strengthDesc = 'very strong relationship';
        } else if (absCorr >= 0.6) {
            strength = 'strong';
            strengthDesc = 'strong relationship';
        } else if (absCorr >= 0.4) {
            strength = 'moderate';
            strengthDesc = 'moderate relationship';
        } else if (absCorr >= 0.2) {
            strength = 'weak';
            strengthDesc = 'weak relationship';
        } else {
            strength = 'very weak';
            strengthDesc = 'very weak or no meaningful relationship';
        }
        
        // Generate interpretation
        const direction = isPositive ? 'positively' : 'negatively';
        const relationshipType = isPositive ? 'increases' : 'decreases';
        
        // Create summary - UPDATED for SEPI
        let summary = `
            <div class="correlation-summary ${isPositive ? 'positive' : 'negative'}">
                <p><strong>${attribute} and SEPI (Peace Index) are ${direction} correlated (r = ${correlationStr})</strong></p>
                <p>This indicates a <strong>${strengthDesc}</strong> between these two variables.</p>
            </div>
        `;
        
        // Generate detailed bullets - UPDATED for SEPI
        const bullets = [
            `As SEPI (peace levels) ${isPositive ? 'increase' : 'decrease'}, ${attribute} tends to ${relationshipType}`,
            `The correlation coefficient of ${correlationStr} indicates a ${strength} ${direction} relationship`,
            `This relationship explains approximately ${Math.round(correlation * correlation * 100)}% of the variance between the variables`
        ];
        
        // Add context-specific bullets based on attribute type
        if (attributeInfo.isHealthIndicator) {
            if (isPositive) {
                bullets.push(`Higher peace regions tend to have better ${attributeInfo.displayName} outcomes`);
            } else {
                bullets.push(`Higher peace regions tend to have worse ${attributeInfo.displayName} outcomes (unexpected - may warrant further investigation)`);
            }
        } else if (attributeInfo.isEconomicIndicator) {
            if (isPositive) {
                bullets.push(`Regions with higher peace levels show higher ${attributeInfo.displayName}`);
            } else {
                bullets.push(`Regions with higher peace levels show lower ${attributeInfo.displayName}`);
            }
        }
        
        // Generate policy implications - UPDATED for SEPI
        let implications;
        if (absCorr >= 0.6) {
            if (attributeInfo.isHealthIndicator && isPositive) {
                implications = `The strong positive correlation suggests that peacebuilding_index interventions could significantly improve ${attributeInfo.displayName} outcomes. Priority should be given to regions with lower peace scores for maximum impact.`;
            } else if (attributeInfo.isEconomicIndicator && isPositive) {
                implications = `The strong correlation indicates that ${attributeInfo.displayName} could serve as a reliable indicator of peace levels. Resources should be allocated proportionally to support both peace and economic development.`;
            } else {
                implications = `The strong ${direction} correlation suggests that peace levels and ${attributeInfo.displayName} are closely linked and should be considered together in policy planning and resource allocation decisions.`;
            }
        } else if (absCorr >= 0.3) {
            implications = `The moderate correlation suggests some relationship between peace levels and ${attributeInfo.displayName}, but other factors also play important roles. A multi-faceted approach addressing various determinants would be most effective.`;
        } else {
            implications = `The weak correlation suggests peace levels and ${attributeInfo.displayName} are largely independent. Different intervention strategies may be needed for each, and peacebuilding_index may not directly impact ${attributeInfo.displayName}.`;
        }
        
        return {
            summary,
            bullets,
            implications
        };
    }

    /**
     * Analyze attribute to determine type and characteristics
     */
    analyzeAttribute(attribute) {
        const lowerAttr = attribute.toLowerCase();
        
        let isHealthIndicator = false;
        let isEconomicIndicator = false;
        let displayName = attribute;
        
        // Health indicators
        if (lowerAttr.includes('stunting') || lowerAttr.includes('wasting') || 
            lowerAttr.includes('underweight') || lowerAttr.includes('malnutrition')) {
            isHealthIndicator = true;
            displayName = 'malnutrition';
        } else if (lowerAttr.includes('mortality') || lowerAttr.includes('death')) {
            isHealthIndicator = true;
            displayName = 'health outcomes';
        } else if (lowerAttr.includes('vaccination') || lowerAttr.includes('immunization')) {
            isHealthIndicator = true;
            displayName = 'vaccination coverage';
        }
        
        // Economic indicators
        else if (lowerAttr.includes('poverty') || lowerAttr.includes('income') || 
                 lowerAttr.includes('wealth') || lowerAttr.includes('gdp')) {
            isEconomicIndicator = true;
            displayName = 'economic conditions';
        } else if (lowerAttr.includes('education') || lowerAttr.includes('literacy') || 
                   lowerAttr.includes('school')) {
            isEconomicIndicator = true;
            displayName = 'educational outcomes';
        }
        
        return {
            isHealthIndicator,
            isEconomicIndicator,
            displayName
        };
    }

    /**
     * Get appropriate unit for attribute display
     */
    getAttributeUnit(attribute) {
        const lowerAttr = attribute.toLowerCase();
        
        if (lowerAttr.includes('%') || lowerAttr.includes('percent')) {
            return ''; // Already includes %
        } else if (lowerAttr.includes('rate') || lowerAttr.includes('ratio')) {
            return '%';
        } else if (lowerAttr.includes('per') && lowerAttr.includes('1000')) {
            return ' per 1,000';
        } else if (lowerAttr.includes('per') && lowerAttr.includes('100')) {
            return ' per 100,000';
        }
        
        return '';
    }
    
    /**
     * Get CSS class for correlation strength
     */
    getCorrelationClass(correlation) {
        const absCorr = Math.abs(parseFloat(correlation));
        if (absCorr >= 0.7) return 'strong-correlation';
        if (absCorr >= 0.3) return 'moderate-correlation';
        return 'weak-correlation';
    }
    
    /**
     * Create charts using Canvas API
     */
    createCharts(reportData) {
        this.createScatterPlot(reportData);
        this.createBarChart(reportData);
    }
    
    /**
     * Create scatter plot for correlation with proper labels and grid
     * UPDATED: Use SEPI instead of vulnerability
     */
    createScatterPlot(reportData) {
        const canvas = document.getElementById('correlation-chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const padding = 60;
        const bottomPadding = 80;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        const chartWidth = width - 2 * padding;
        const chartHeight = height - padding - bottomPadding;
        
        // Set up scales - UPDATED for primary layer (SEPI or Pillar)
        const xValues = reportData.data.map(d => d.primaryValue);
        const yValues = reportData.data.map(d => d.statistic);
        
        const xMin = Math.min(...xValues);
        const xMax = Math.max(...xValues);
        const yMin = Math.min(...yValues);
        const yMax = Math.max(...yValues);
        
        // Add some padding to the ranges
        const xRange = xMax - xMin;
        const yRange = yMax - yMin;
        const xPadding = xRange * 0.1;
        const yPadding = yRange * 0.1;
        
        const xMinPadded = xMin - xPadding;
        const xMaxPadded = xMax + xPadding;
        const yMinPadded = yMin - yPadding;
        const yMaxPadded = yMax + yPadding;
        
        // Draw chart background
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(padding, padding, chartWidth, chartHeight);
        
        // Draw grid lines
        ctx.strokeStyle = '#e9ecef';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#666';
        ctx.font = '11px Calibri';
        
        // X-axis grid and labels
        const xGridLines = 5;
        for (let i = 0; i <= xGridLines; i++) {
            const x = padding + (i / xGridLines) * chartWidth;
            const value = xMinPadded + (i / xGridLines) * (xMaxPadded - xMinPadded);
            
            // Grid line
            ctx.beginPath();
            ctx.moveTo(x, padding);
            ctx.lineTo(x, padding + chartHeight);
            ctx.stroke();
            
            // X-axis label
            ctx.textAlign = 'center';
            ctx.fillText(value.toFixed(2), x, padding + chartHeight + 20);
        }
        
        // Y-axis grid and labels
        const yGridLines = 5;
        for (let i = 0; i <= yGridLines; i++) {
            const y = padding + chartHeight - (i / yGridLines) * chartHeight;
            const value = yMinPadded + (i / yGridLines) * (yMaxPadded - yMinPadded);
            
            // Grid line
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + chartWidth, y);
            ctx.stroke();
            
            // Y-axis label
            ctx.textAlign = 'right';
            ctx.fillText(value.toFixed(1), padding - 10, y + 4);
        }
        
        // Draw trend line if correlation is significant
        const correlation = parseFloat(reportData.correlation);
        if (Math.abs(correlation) > 0.3) {
            this.drawTrendLine(ctx, reportData.data, padding, chartHeight, chartWidth, 
                              xMinPadded, xMaxPadded, yMinPadded, yMaxPadded);
        }
        
        // Draw data points
        reportData.data.forEach((point, index) => {
            const x = padding + ((point.primaryValue - xMinPadded) / (xMaxPadded - xMinPadded)) * chartWidth;
            const y = padding + chartHeight - ((point.statistic - yMinPadded) / (yMaxPadded - yMinPadded)) * chartHeight;
            
            // Point with gradient
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, 6);
            gradient.addColorStop(0, '#007bff');
            gradient.addColorStop(1, '#0056b3');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.fill();
            
            // Point outline
            ctx.strokeStyle = '#004085';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Add region labels for first 3 points as example
            if (index < 3) {
                ctx.fillStyle = '#333';
                ctx.font = '9px Calibri';
                ctx.textAlign = 'left';
                ctx.fillText(point.region.substring(0, 8), x + 8, y - 8);
            }
        });
        
        // Draw axes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        
        // Y-axis
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, padding + chartHeight);
        ctx.stroke();
        
        // X-axis  
        ctx.beginPath();
        ctx.moveTo(padding, padding + chartHeight);
        ctx.lineTo(padding + chartWidth, padding + chartHeight);
        ctx.stroke();
        
        // Axis labels - UPDATED for SEPI
        ctx.fillStyle = '#333';
        ctx.font = 'bold 12px Calibri';
        
        // X-axis title
        ctx.textAlign = 'center';
        ctx.fillText('Primary Layer Value', width / 2, height - 15);
        
        // Y-axis title (rotated)
        ctx.save();
        ctx.translate(20, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText(reportData.statAttribute || 'Statistic Value', 0, 0);
        ctx.restore();
        
        // Chart title
        ctx.font = 'bold 14px Calibri';
        ctx.textAlign = 'center';
        ctx.fillText(`Correlation: r = ${reportData.correlation}`, width / 2, 25);
    }

    /**
     * Draw trend line for scatter plot
     */
    drawTrendLine(ctx, data, padding, chartHeight, chartWidth, xMin, xMax, yMin, yMax) {
        if (data.length < 2) return;
        
        // Calculate linear regression - UPDATED for primary layer
        const n = data.length;
        const sumX = data.reduce((sum, d) => sum + d.primaryValue, 0);
        const sumY = data.reduce((sum, d) => sum + d.statistic, 0);
        const sumXY = data.reduce((sum, d) => sum + d.primaryValue * d.statistic, 0);
        const sumX2 = data.reduce((sum, d) => sum + d.primaryValue * d.primaryValue, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        // Draw trend line
        const x1 = xMin;
        const y1 = slope * x1 + intercept;
        const x2 = xMax;
        const y2 = slope * x2 + intercept;
        
        const canvasX1 = padding + ((x1 - xMin) / (xMax - xMin)) * chartWidth;
        const canvasY1 = padding + chartHeight - ((y1 - yMin) / (yMax - yMin)) * chartHeight;
        const canvasX2 = padding + ((x2 - xMin) / (xMax - xMin)) * chartWidth;
        const canvasY2 = padding + chartHeight - ((y2 - yMin) / (yMax - yMin)) * chartHeight;
        
        ctx.strokeStyle = '#dc3545';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(canvasX1, canvasY1);
        ctx.lineTo(canvasX2, canvasY2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    /**
     * Create bar chart for regional comparison
     * UPDATED: Use SEPI instead of vulnerability
     */
    createBarChart(reportData) {
        const canvas = document.getElementById('bar-chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const padding = 60;
        const bottomPadding = 80;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        const chartWidth = width - 2 * padding;
        const chartHeight = height - padding - bottomPadding;
        const barWidth = chartWidth / reportData.data.length;
        const maxValue = Math.max(...reportData.data.map(d => d.primaryValue));
        const minValue = Math.min(...reportData.data.map(d => d.primaryValue));
        
        // Draw chart background
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(padding, padding, chartWidth, chartHeight);
        
        // Draw grid lines and Y-axis labels
        ctx.strokeStyle = '#e9ecef';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#666';
        ctx.font = '11px Calibri';
        
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding + (i / gridLines) * chartHeight;
            const value = maxValue - (i / gridLines) * (maxValue - minValue);
            
            // Grid line
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + chartWidth, y);
            ctx.stroke();
            
            // Y-axis label
            ctx.textAlign = 'right';
            ctx.fillText(value.toFixed(2), padding - 10, y + 4);
        }
        
        // Draw bars
        reportData.data.forEach((item, index) => {
            const barHeight = ((item.primaryValue - minValue) / (maxValue - minValue)) * chartHeight;
            const x = padding + index * barWidth;
            const y = padding + chartHeight - barHeight;
            
            // Bar with gradient
            const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
            gradient.addColorStop(0, '#28a745');
            gradient.addColorStop(1, '#20c997');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x + 4, y, barWidth - 8, barHeight);
            
            // Bar outline
            ctx.strokeStyle = '#1e7e34';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 4, y, barWidth - 8, barHeight);
            
            // Value on top of bar
            ctx.fillStyle = '#333';
            ctx.font = '10px Calibri';
            ctx.textAlign = 'center';
            ctx.fillText(item.primaryValue.toFixed(2), x + barWidth / 2, y - 5);
            
            // Region name at bottom (rotated)
            ctx.fillStyle = '#333';
            ctx.font = '11px Calibri';
            ctx.save();
            ctx.translate(x + barWidth / 2, height - bottomPadding + 40);
            ctx.rotate(-Math.PI / 4);
            ctx.textAlign = 'right';
            ctx.fillText(item.region, 0, 0);
            ctx.restore();
        });
        
        // Draw axes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        
        // Y-axis
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, padding + chartHeight);
        ctx.stroke();
        
        // X-axis
        ctx.beginPath();
        ctx.moveTo(padding, padding + chartHeight);
        ctx.lineTo(padding + chartWidth, padding + chartHeight);
        ctx.stroke();
        
        // Y-axis title (rotated) - UPDATED for primary layer
        ctx.fillStyle = '#333';
        ctx.font = 'bold 12px Calibri';
        ctx.save();
        ctx.translate(20, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('Primary Layer Value', 0, 0);
        ctx.restore();
        
        // X-axis title
        ctx.textAlign = 'center';
        ctx.fillText('Regions', width / 2, height - 15);
        
        // Chart title - UPDATED for primary layer
        ctx.font = 'bold 14px Calibri';
        ctx.fillText('Primary Layer by Region', width / 2, 25);
    }
    
    /**
     * Download report as PDF (placeholder - would need a PDF library)
     */
    async downloadReport() {
        const button = this.container.querySelector('.download-btn');
        const originalText = button.textContent;
        
        try {
            // Show loading state
            button.disabled = true;
            button.textContent = '📄 Generating PDF...';
            
            // Get the report container
            const reportElement = this.container.querySelector('.report-container');
            if (!reportElement) {
                throw new Error('Report container not found');
            }
            
            // Create canvas from the report element (requires html2canvas library)
            if (typeof html2canvas !== 'undefined') {
                const canvas = await html2canvas(reportElement, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: false,
                    backgroundColor: '#ffffff',
                    width: reportElement.scrollWidth,
                    height: reportElement.scrollHeight
                });
                
                // Initialize jsPDF (requires jspdf library)
                if (typeof window.jspdf !== 'undefined') {
                    const { jsPDF } = window.jspdf;
                    const pdf = new jsPDF('p', 'mm', 'a4');
                    
                    // Calculate dimensions
                    const imgWidth = 210; // A4 width in mm
                    const pageHeight = 295; // A4 height in mm
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;
                    let heightLeft = imgHeight;
                    let position = 0;
                    
                    // Convert canvas to image
                    const imgData = canvas.toDataURL('image/png');
                    
                    // Add first page
                    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;
                    
                    // Add additional pages if needed
                    while (heightLeft >= 0) {
                        position = heightLeft - imgHeight;
                        pdf.addPage();
                        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                        heightLeft -= pageHeight;
                    }
                    
                    // Generate filename with timestamp
                    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                    const countrySlug = (this._lastCountryReport?.country || getCurrentCountry() || 'country')
                        .replace(/_/g, '-')
                        .toLowerCase();
                    const filename = `sepi-country-report-${countrySlug}-${timestamp}.pdf`;
                    
                    // Save the PDF
                    pdf.save(filename);
                    
                    console.log('PDF generated successfully:', filename);
                } else {
                    throw new Error('jsPDF library not available');
                }
            } else {
                throw new Error('html2canvas library not available');
            }
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again or ensure required libraries are loaded.');
        } finally {
            // Restore button state
            button.disabled = false;
            button.textContent = originalText;
        }
    }
}

// Create global instance reference for download functionality
window.infoPanelInstance = null;

// Export for module use
export default InfoPanel;