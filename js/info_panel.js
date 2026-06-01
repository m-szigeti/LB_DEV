// info_panel.js - Simplified info panel for layer analysis and reporting

import { WELCOME_TAB_HTML } from './welcome_tab_content.js';
import { OVERALL_VULNERABILITY_INDEX_DESCRIPTION_HTML } from './overall_vulnerability_index_content.js';

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
            onLayoutChange: typeof options.onLayoutChange === 'function' ? options.onLayoutChange : null,
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

    setLayoutChangeHandler(handler) {
        this.options.onLayoutChange = typeof handler === 'function' ? handler : null;
    }

    getMountTarget() {
        if (!this.options.docked) {
            return document.body;
        }

        return document.querySelector(this.options.mountTarget) || document.body;
    }

    appendPanel() {
        const mountTarget = this.getMountTarget();
        if (!mountTarget) {
            return;
        }

        mountTarget.appendChild(this.container);
    }

    notifyLayoutChange() {
        if (typeof this.options.onLayoutChange === 'function') {
            this.options.onLayoutChange({
                visible: this.isVisible,
                minimized: this.isMinimized,
                docked: this.options.docked
            });
        }
    }

    emitVisibilityChange() {
        document.dispatchEvent(new CustomEvent('info-panel-visibility-change', {
            detail: {
                visible: this.isVisible
            }
        }));
    }
    
   /**
     * Create the main panel structure
     */
    createPanel() {
        this.container = document.createElement('div');
        this.container.className = `info-panel-container ${this.options.docked ? 'docked' : 'floating'}`;
        this.container.id = 'info-panel';
        this.container.style.display = 'none';
        this.container.style.setProperty('--info-panel-width', this.options.width);
        this.container.style.setProperty('--info-panel-height', '400px');
        this.container.style.setProperty('--info-panel-max-height', this.options.maxHeight);

        let header = null;
        if (!this.options.docked) {
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

        const content = document.createElement('div');
        content.className = 'info-panel-content';
        content.style.display = this.options.docked ? 'flex' : 'none';
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
                    ${WELCOME_TAB_HTML}
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
                    </div>
                </section>

                <section class="info-panel-tab-panel" data-panel="analysis" role="tabpanel" hidden>
                    <div class="info-panel-section analysis-section">
                        <div class="section-header">
                            <h4>Analysis & Reports</h4>
                        </div>
                        <div class="analysis-selected-charts" id="analysis-selected-charts">
                            <p class="no-results-message">No selected polygon charts yet</p>
                        </div>
                        <div class="analysis-content">
                            <div class="analysis-tool">
                                <h5>Create Summary Report</h5>
                                <p>Generate correlation analysis between social vulnerability and subnational statistics with visualizations</p>
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

        if (header) {
            this.container.appendChild(header);
        }
        this.container.appendChild(content);

        if (!this.options.docked) {
            this.createResizeHandles();
        }

        this.appendPanel();

        if (!this.options.docked) {
            this.updateMinimizeState();
        } else {
            this.isMinimized = false;
            this.updateMinimizeState();
        }

        this.setActiveTab('welcome');
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
                    this.container.style.maxHeight = 'none'; // Remove max-height during manual resize
                } else if (handle.classList.contains('right-handle')) {
                    // Resize width only
                    const newWidth = Math.max(300, startWidth + deltaX);
                    this.container.style.width = newWidth + 'px';
                } else if (handle.classList.contains('bottom-handle')) {
                    // Resize height only
                    const newHeight = Math.max(200, startHeight + deltaY);
                    this.container.style.height = newHeight + 'px';
                    this.container.style.maxHeight = 'none'; // Remove max-height during manual resize
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
    // const minimizeBtn = this.container.querySelector('.minimize-btn');
    // const closeBtn = this.container.querySelector('.close-btn');
    const tabs = this.container.querySelectorAll('.info-panel-tab');

    // minimizeBtn.addEventListener('click', () => {
    //     this.isMinimized = !this.isMinimized;
    //     this.updateMinimizeState();
    // });

    // closeBtn.addEventListener('click', () => this.hide());

    const analysisBtn = this.container.querySelector('.run-analysis-btn');
    if (analysisBtn) {
        analysisBtn.addEventListener('click', () => this.generateSummaryReport());
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => this.setActiveTab(tab.dataset.tab));
    });

    if (!this.options.docked) {
        this.makeDraggable();
        this.makeResizable();
    }
}

    setActiveTab(tabName) {
        const tabs = this.container.querySelectorAll('.info-panel-tab');
        const panels = this.container.querySelectorAll('.info-panel-tab-panel');

        tabs.forEach(tab => {
            const isActive = tab.dataset.tab === tabName;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        panels.forEach(panel => {
            const isActive = panel.dataset.panel === tabName;
            panel.classList.toggle('active', isActive);
            panel.hidden = !isActive;
        });
    }
    /**
     * Make the panel draggable
     */
    makeDraggable() {
        if (this.options.docked) {
            return;
        }

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
        this.emitVisibilityChange();
        this.notifyLayoutChange();
    }
    
    /**
     * Hide the info panel
     */
    hide() {
        this.container.style.display = 'none';
        this.isVisible = false;
        this.emitVisibilityChange();
        this.notifyLayoutChange();
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
        const restoredHeight = this.options.docked ? '100%' : (this.originalHeight || '400px');

        if (this.isMinimized) {
            if (!this.originalHeight && !this.options.docked) {
                this.originalHeight = this.container.style.height || '400px';
            }

            this.container.classList.add('minimized');
            this.container.style.resize = 'none';

            if (this.options.docked) {
                this.container.style.height = 'auto';
                this.container.style.minHeight = '0';
                this.container.style.maxHeight = 'none';
                content.style.display = 'flex';
            } else {
                this.container.style.height = '48px';
                this.container.style.minHeight = '48px';
                this.container.style.maxHeight = '48px';
                content.style.display = 'none';
            }
            if (minimizeBtn) {
                minimizeBtn.textContent = '+';
                minimizeBtn.title = 'Restore';
            }
            if (header) {
                header.style.borderRadius = '12px';
            }
        } else {
            this.container.classList.remove('minimized');
            this.container.style.height = restoredHeight;
            this.container.style.minHeight = this.options.docked ? '0' : '200px';
            this.container.style.maxHeight = 'none';
            this.container.style.resize = this.options.docked ? 'none' : 'both';

            content.style.display = 'flex';
            if (minimizeBtn) {
                minimizeBtn.textContent = '−';
                minimizeBtn.title = 'Minimize';
            }
            if (header) {
                header.style.borderRadius = '12px 12px 0 0';
            }
        }

        if (this.isVisible) {
            this.notifyLayoutChange();
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
            return;
        }
        
        const layersHTML = Array.from(this.activeLayers.values()).map(layer => `
            <div class="layer-item" data-layer-id="${layer.id}">
                <div class="layer-header">
                    <span class="layer-name">${layer.name}</span>
                </div>
                <div class="layer-details">
                    ${this.generateLayerDetails(layer)}
                </div>
                ${this.generateSelectedFeatureDetails(layer)}
                ${this.generateLayerQuickStats(layer)}
            </div>
        `).join('');
        
        layersList.innerHTML = layersHTML;
        this.updateAnalysisSelectedCharts();

        // Render mini charts after canvases exist in the DOM.
        requestAnimationFrame(() => {
            this.renderQuickStatsCharts();
        });
    }
    
    /**
     * Generate details for a specific layer
     * @param {Object} layer - Layer information
     */
    generateLayerDetails(layer) {
        if (layer.id === 'svOverallTensionLayer') {
            return OVERALL_VULNERABILITY_INDEX_DESCRIPTION_HTML;
        }

        if (layer.type === 'sv-vector') {
            const inputMap = {
                svAdmin1Layer: [
                    'Pressure of IDPs',
                    'Number of IDPs per origin Distirct',
                    'Net Human Mobility Balance',
                    'Concentration of displaced Syrians',
                    'Concentration of Palestinians'
                ],
                svAdmin2Layer: [
                    'Unemployment rate',
                    'Nightlight intensity',
                    '332 vulnerability map',
                    'Climate mitigation: renewable energy',
                    'Climate mitigation: reducing vehicle use',
                    'Climate mitigation: using water wisely',
                    'Climate mitigation: solid waste recycling'
                ],
                svAdmin3Layer: [
                    'Communal tension incidents',
                    'Conflict incident intensity and civilian impact',
                    'Fatal Violence Rate',
                    'Perceived safety in moving to work and services',
                    'Safety at night'
                ],
                svAdmin4Layer: [
                    'Damage data (CNRS) - replaceable by triangle if needed',
                    'Service-related tension incidents (Feb 2025-Feb 2026)',
                    'Perceptions on quality of services (water, electricity, waste removal)',
                    'Worry about access to healthcare services',
                    'Worry about access to safe drinking water',
                    'Household situation with regards to water availability and access',
                    "Competition for services believed to be driving tensions (competition over at least one service driving tensions: 'Yes')",
                    'Additional solid waste generation following displacement - mapping (Vahakn)',
                    'Additional electricity demand following displacement - mapping (Vahakn)'
                ]
            };

            const inputs = inputMap[layer.id];
            if (inputs?.length) {
                const items = inputs.map(item => `<li>${item}</li>`).join('');
                return `
                    <div class="layer-inputs-list">
                        <div class="layer-inputs-title">Used inputs:</div>
                        <ul>${items}</ul>
                    </div>
                `;
            }
            return '';
        }
        // Hide generic metadata (type/opacity/features/attribute/color ramp)
        // to keep the Active Layers section cleaner for end users.
        return '';
    }

    generateSelectedFeatureDetails(layer) {
        const selected = layer.selectedFeature;
        if (!selected?.name) {
            return '';
        }

        const selectedValue = selected.attribute && selected.value !== undefined
            ? ` • ${selected.attribute}: ${this.formatSelectedFeatureValue(selected.value)}`
            : '';

        return `
            <div class="selected-feature-summary">
                <strong>${selected.name}</strong>${selectedValue}
            </div>
        `;
    }

    updateAnalysisSelectedCharts() {
        const container = document.getElementById('analysis-selected-charts');
        if (!container) {
            return;
        }

        const blocks = [];

        Array.from(this.activeLayers.values()).forEach(layer => {
            const rankings = this.getLayerRankings(layer);
            if (rankings) {
                blocks.push(this.renderAnalysisLayerRankingsBlock(layer, rankings));
            }
        });

        Array.from(this.activeLayers.values()).forEach(layer => {
            if (!Array.isArray(layer?.selectedFeature?.pillarBreakdown) || !layer.selectedFeature.pillarBreakdown.length) {
                return;
            }
            blocks.push(`
                <div class="analysis-layer-block selected-feature-pillar-chart">
                    <div class="selected-feature-pillar-title">${this.escapeHtml(layer.name)}: ${this.escapeHtml(layer.selectedFeature.name)} — pillar proportions</div>
                    <canvas
                        class="selected-feature-pillar-canvas"
                        id="selected-pillar-chart-${layer.id}"
                        width="340"
                        height="240"
                    ></canvas>
                </div>
            `);
        });

        if (blocks.length === 0) {
            container.innerHTML = '<p class="no-results-message">Enable a map layer to see unit ranking charts here. Click a map unit for pillar breakdown (Overall Vulnerability Index).</p>';
            return;
        }

        container.innerHTML = blocks.join('');
    }

    renderAnalysisLayerRankingsBlock(layer, rankings) {
        const labels = this.getRankingChartLabels(layer, rankings.unitLabel);
        const safeName = this.escapeHtml(layer.name);
        return `
            <div class="analysis-layer-block analysis-layer-rankings" data-layer-id="${this.escapeHtml(layer.id)}">
                <h5 class="analysis-layer-title">${safeName}</h5>
                <p class="analysis-layer-attribute">${this.escapeHtml(rankings.attributeLabel)}</p>
                <div class="ranking-chart-block">
                    <div class="quick-stats-header">${labels.lowTitle}</div>
                    ${this.renderRankingBarChartHtml(rankings.lowest, 'vulnerable')}
                    <p class="ranking-chart-footnote">${labels.lowFootnote}</p>
                </div>
                <div class="ranking-chart-block">
                    <div class="quick-stats-header">${labels.highTitle}</div>
                    ${this.renderRankingBarChartHtml(rankings.highest, 'resilient')}
                    <p class="ranking-chart-footnote">${labels.highFootnote}</p>
                </div>
            </div>
        `;
    }

    getRankingChartLabels(layer, unitLabel) {
        if (layer.id === 'svOverallTensionLayer') {
            return {
                lowTitle: `Highest vulnerability — bottom 20 ${unitLabel}`,
                highTitle: `Lowest vulnerability — top 20 ${unitLabel}`,
                lowFootnote: 'Lower scores indicate higher vulnerability.',
                highFootnote: 'Higher scores indicate lower vulnerability.'
            };
        }
        return {
            lowTitle: `Lowest values — bottom 20 ${unitLabel}`,
            highTitle: `Highest values — top 20 ${unitLabel}`,
            lowFootnote: 'Yellow end of the map scale = lower values.',
            highFootnote: 'Red end of the map scale = higher values.'
        };
    }

    formatSelectedFeatureValue(value) {
        if (typeof value === 'number') {
            return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(3);
        }
        return String(value);
    }

    /**
     * Generate quick stats markup for a layer.
     * Uses a pie chart for the school escalation layer and histograms for numeric layers.
     * @param {Object} layer - Layer information
     * @returns {string} HTML markup
     */
    generateLayerQuickStats(layer) {
        const stats = this.getQuickStatsForLayer(layer);
        if (!stats) {
            return '';
        }

        // Hide distribution histogram in the sidebar for now,
        // while keeping quick-stats logic available in the tool.
        if (stats.chartType === 'histogram') {
            return '';
        }

        const statsSummary = stats.summary.map(item => `
            <div class="quick-stat-chip">
                <span class="quick-stat-label">${item.label}</span>
                <span class="quick-stat-value">${item.value}</span>
            </div>
        `).join('');

        return `
            <div class="layer-quick-stats">
                <div class="quick-stats-header">${stats.title}</div>
                <div class="quick-stats-summary">${statsSummary}</div>
                <canvas
                    class="quick-stats-canvas"
                    id="quick-chart-${layer.id}"
                    width="340"
                    height="190"
                    data-chart-type="${stats.chartType}"
                ></canvas>
            </div>
        `;
    }

    /**
     * Compute quick stats config for a layer.
     * @param {Object} layer - Layer information
     * @returns {Object|null}
     */
    getQuickStatsForLayer(layer) {
        if (!layer?.layer || typeof layer.layer.eachLayer !== 'function') {
            return null;
        }

        // Dedicated chart for school escalation status.
        if (layer.id === 'escalationLayer') {
            const counts = { open: 0, full: 0, other: 0 };
            layer.layer.eachLayer(featureLayer => {
                const status = String(featureLayer.feature?.properties?.status || '').toLowerCase();
                if (status === 'open') {
                    counts.open += 1;
                } else if (status === 'full') {
                    counts.full += 1;
                } else if (status) {
                    counts.other += 1;
                }
            });

            const total = counts.open + counts.full + counts.other;
            if (total === 0) {
                return null;
            }

            return {
                chartType: 'pie',
                title: 'Status Breakdown',
                summary: [
                    { label: 'Open', value: counts.open },
                    { label: 'Full', value: counts.full },
                    ...(counts.other ? [{ label: 'Other', value: counts.other }] : [])
                ],
                chartData: {
                    labels: ['Open', 'Full', ...(counts.other ? ['Other'] : [])],
                    values: [counts.open, counts.full, ...(counts.other ? [counts.other] : [])],
                    colors: ['#2ecc71', '#bdc3c7', '#95a5a6']
                }
            };
        }

        // Dedicated chart for road access status.
        if (layer.id === 'roadStatusLayer') {
            const counts = {
                notPassable: 0,
                restricted: 0,
                passable: 0,
                other: 0
            };

            layer.layer.eachLayer(featureLayer => {
                const rawStatus =
                    featureLayer.feature?.properties?.['Current status'] ??
                    featureLayer.feature?.properties?.['Current Status'] ??
                    '';
                const status = String(rawStatus).trim().toLowerCase();

                if (!status) return;
                if (status === 'not passable') {
                    counts.notPassable += 1;
                } else if (status === 'passable with restrictions/damaged') {
                    counts.restricted += 1;
                } else if (status === 'passable/undamaged') {
                    counts.passable += 1;
                } else {
                    counts.other += 1;
                }
            });

            const total = counts.notPassable + counts.restricted + counts.passable + counts.other;
            if (total === 0) {
                return null;
            }

            return {
                chartType: 'pie',
                title: 'Road Status Breakdown',
                summary: [
                    { label: 'Not Passable', value: counts.notPassable },
                    { label: 'Passable w/ restrictions', value: counts.restricted },
                    { label: 'Passable/Undamaged', value: counts.passable },
                    ...(counts.other ? [{ label: 'Other', value: counts.other }] : [])
                ],
                chartData: {
                    labels: [
                        'Not Passable',
                        'Passable with restrictions/Damaged',
                        'Passable/Undamaged',
                        ...(counts.other ? ['Other'] : [])
                    ],
                    values: [
                        counts.notPassable,
                        counts.restricted,
                        counts.passable,
                        ...(counts.other ? [counts.other] : [])
                    ],
                    colors: [
                        '#b30000',
                        '#f39c12',
                        '#2ecc71',
                        ...(counts.other ? ['#7f8c8d'] : [])
                    ]
                }
            };
        }

        const attribute = layer.selectedAttribute || this.inferNumericLayerAttribute(layer);
        if (!attribute) {
            return null;
        }

        const values = this.extractNumericValues(layer.layer, attribute);
        if (values.length === 0) {
            return null;
        }

        const min = Math.min(...values);
        const max = Math.max(...values);
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;

        return {
            chartType: 'histogram',
            title: `Distribution: ${attribute}`,
            summary: [
                { label: 'N', value: values.length },
                { label: 'Min', value: this.formatQuickStatNumber(min) },
                { label: 'Mean', value: this.formatQuickStatNumber(mean) },
                { label: 'Max', value: this.formatQuickStatNumber(max) }
            ],
            chartData: {
                attribute,
                values
            }
        };
    }

    inferNumericLayerAttribute(layer) {
        if (layer.selectedAttribute && layer.selectedAttribute !== 'status') {
            return layer.selectedAttribute;
        }

        const rawFeatures = layer.layer?.layerData?.raw?.features;
        if (!rawFeatures?.length) {
            return null;
        }

        const sampleProperties = rawFeatures[0].properties || {};
        const excluded = new Set([
            'fid', 'id', 'GID_0', 'GID_1', 'GID_2', 'GID_3',
            'NAME_1', 'NAME_2', 'NAME_3', 'name',
            'lat_calc', 'long_calc'
        ]);

        for (const [key, value] of Object.entries(sampleProperties)) {
            if (excluded.has(key)) {
                continue;
            }
            if (typeof value === 'number' && !Number.isNaN(value)) {
                return key;
            }
        }

        return null;
    }

    extractNumericValues(leafletLayer, attribute) {
        const values = [];
        leafletLayer.eachLayer(featureLayer => {
            const rawValue = featureLayer.feature?.properties?.[attribute];
            const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);
            if (!Number.isNaN(numericValue) && Number.isFinite(numericValue)) {
                values.push(numericValue);
            }
        });
        return values;
    }

    formatQuickStatNumber(value) {
        if (!Number.isFinite(value)) {
            return 'NA';
        }
        if (Math.abs(value) >= 100 || Number.isInteger(value)) {
            return Math.round(value).toLocaleString();
        }
        return value.toFixed(2);
    }

    renderQuickStatsCharts() {
        Array.from(this.activeLayers.values()).forEach(layer => {
            const stats = this.getQuickStatsForLayer(layer);
            if (!stats) {
                return;
            }

            if (stats.chartType === 'ranking-dual-bar') {
                return;
            }

            const canvas = document.getElementById(`quick-chart-${layer.id}`);
            if (!canvas) {
                return;
            }

            if (stats.chartType === 'pie') {
                this.drawQuickPieChart(canvas, stats.chartData);
            } else if (stats.chartType === 'histogram') {
                this.drawQuickHistogram(canvas, stats.chartData);
            }
        });

        this.renderSelectedPillarCharts();
    }

    isExcludedFromRankings(name) {
        const normalized = String(name || '').trim().toLowerCase();
        const excluded = new Set(['conflict', 'litige', 'chebaa farms']);
        return excluded.has(normalized);
    }

    getRankableLeafletLayer(layer) {
        const leafletLayer = layer?.layer;
        if (!leafletLayer) {
            return null;
        }
        if (leafletLayer._svDisplacementMarkerLayer) {
            return leafletLayer._svDisplacementMarkerLayer;
        }
        if (leafletLayer._svSectarianMarkerLayer) {
            return leafletLayer._svSectarianMarkerLayer;
        }
        return leafletLayer;
    }

    resolveRankingAttribute(layer) {
        if (['escalationLayer', 'roadStatusLayer'].includes(layer.id)) {
            return null;
        }
        const attribute = layer.selectedAttribute || this.inferNumericLayerAttribute(layer);
        if (!attribute || attribute === 'status') {
            return null;
        }
        return attribute;
    }

    formatRankingScore(score) {
        if (!Number.isFinite(score)) {
            return '—';
        }
        if (Math.abs(score) < 1 && score !== 0) {
            return score.toFixed(3);
        }
        if (Number.isInteger(score) || Math.abs(score) >= 100) {
            return Math.round(score).toLocaleString();
        }
        return score.toFixed(2);
    }

    escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    renderRankingBarChartHtml(items, variant) {
        if (!items?.length) {
            return '<p class="ranking-chart-empty">No ranked units available.</p>';
        }

        const maxScore = Math.max(...items.map(item => item.score), 0.001);
        const rows = items.map((item, index) => {
            const widthPct = Math.max(2, (item.score / maxScore) * 100);
            const safeName = this.escapeHtml(item.name);
            const safeScore = this.escapeHtml(this.formatRankingScore(item.score));
            return `
                <div class="ranking-bar-row" role="listitem">
                    <span class="ranking-bar-rank" aria-hidden="true">${index + 1}</span>
                    <span class="ranking-bar-label" title="${safeName}">${safeName}</span>
                    <div class="ranking-bar-track" aria-hidden="true">
                        <div class="ranking-bar-fill ranking-bar-fill--${variant}" style="width: ${widthPct.toFixed(1)}%"></div>
                    </div>
                    <span class="ranking-bar-value">${safeScore}</span>
                </div>
            `;
        }).join('');

        return `<div class="ranking-bar-chart ranking-bar-chart--${variant}" role="list">${rows}</div>`;
    }

    getLayerRankings(layer) {
        const attribute = this.resolveRankingAttribute(layer);
        if (!attribute) {
            return null;
        }

        const rankableLayer = this.getRankableLeafletLayer(layer);
        const entries = this.extractRankedUnits(rankableLayer, attribute)
            .filter(entry => !this.isExcludedFromRankings(entry.name));
        if (entries.length < 2) {
            return null;
        }

        const sorted = [...entries].sort((a, b) => a.score - b.score);
        const unitLabel = this.inferAdminUnitLabel(rankableLayer);
        const count = Math.min(20, sorted.length);

        return {
            attribute,
            attributeLabel: this.formatRankingAttributeLabel(attribute),
            unitLabel,
            lowest: sorted.slice(0, count),
            highest: sorted.slice(-count).reverse()
        };
    }

    formatRankingAttributeLabel(attribute) {
        return String(attribute)
            .replace(/_/g, ' ')
            .replace(/\b\w/g, letter => letter.toUpperCase());
    }

    extractRankedUnits(leafletLayer, attribute) {
        const entries = [];
        if (!leafletLayer || typeof leafletLayer.eachLayer !== 'function') {
            return entries;
        }

        leafletLayer.eachLayer(featureLayer => {
            const properties = featureLayer.feature?.properties;
            if (!properties) {
                return;
            }
            const score = this.parseNumericProperty(properties[attribute]);
            if (score === null) {
                return;
            }
            const name = this.getAdminUnitName(properties);
            if (!name) {
                return;
            }
            entries.push({ name, score });
        });

        return entries;
    }

    parseNumericProperty(rawValue) {
        const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);
        if (!Number.isFinite(numericValue)) {
            return null;
        }
        return numericValue;
    }

    getAdminUnitName(properties) {
        const nameKeys = ['ADM3_NAME', 'ADM2_NAME', 'ADM1_NAME', 'NAME_3', 'NAME_2', 'NAME_1', 'name', 'NAME'];
        for (const key of nameKeys) {
            const value = properties[key];
            if (value !== undefined && value !== null && String(value).trim() !== '') {
                return String(value).trim();
            }
        }
        const code = properties.CODE || properties.CODE_NEW || properties.CODE_2;
        return code !== undefined && code !== null ? String(code).trim() : '';
    }

    inferAdminUnitLabel(leafletLayer) {
        let sampleProperties = null;
        leafletLayer?.eachLayer?.(featureLayer => {
            if (!sampleProperties && featureLayer.feature?.properties) {
                sampleProperties = featureLayer.feature.properties;
            }
        });
        if (!sampleProperties) {
            return 'units';
        }
        if (sampleProperties.ADM3_NAME !== undefined) {
            return 'cadastres';
        }
        if (sampleProperties.ADM2_NAME !== undefined) {
            return 'districts';
        }
        if (sampleProperties.ADM1_NAME !== undefined) {
            return 'governorates';
        }
        return 'units';
    }

    renderSelectedPillarCharts() {
        Array.from(this.activeLayers.values()).forEach(layer => {
            const selected = layer.selectedFeature;
            if (!selected?.pillarBreakdown?.length) {
                return;
            }

            const canvas = document.getElementById(`selected-pillar-chart-${layer.id}`);
            if (!canvas) {
                return;
            }

            this.drawSelectedPillarBarChart(canvas, selected.pillarBreakdown);
        });
    }

    drawQuickPieChart(canvas, chartData) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        const total = chartData.values.reduce((sum, value) => sum + value, 0);
        if (!total) {
            return;
        }

        const legendWidth = 130;
        const pieAreaWidth = Math.max(120, width - legendWidth - 24);
        const cx = Math.max(56, Math.min(pieAreaWidth / 2 + 12, width * 0.45));
        const cy = height / 2;
        const radius = Math.max(40, Math.min(height * 0.35, pieAreaWidth * 0.34));
        let startAngle = -Math.PI / 2;

        chartData.values.forEach((value, index) => {
            const sliceAngle = (value / total) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = chartData.colors[index];
            ctx.fill();
            startAngle += sliceAngle;
        });

        ctx.font = '12px Arial';
        ctx.fillStyle = '#495057';
        const legendX = Math.min(width - legendWidth + 6, cx + radius + 20);
        const legendStartY = Math.max(24, (height - chartData.labels.length * 24) / 2 + 10);
        chartData.labels.forEach((label, index) => {
            const y = legendStartY + index * 24;
            ctx.fillStyle = chartData.colors[index];
            ctx.fillRect(legendX, y - 10, 13, 13);
            ctx.fillStyle = '#495057';
            ctx.fillText(`${label}: ${chartData.values[index]}`, legendX + 20, y + 1);
        });
    }

    drawQuickHistogram(canvas, chartData) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        const values = chartData.values;
        if (!values.length) {
            return;
        }

        const paddingLeft = 34;
        const paddingRight = 14;
        const paddingTop = 16;
        const paddingBottom = 24;
        const chartWidth = width - paddingLeft - paddingRight;
        const chartHeight = height - paddingTop - paddingBottom;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const binCount = Math.min(6, Math.max(4, Math.ceil(Math.sqrt(values.length))));
        const range = max - min || 1;
        const binSize = range / binCount;
        const bins = new Array(binCount).fill(0);

        values.forEach(value => {
            const index = Math.min(binCount - 1, Math.floor((value - min) / binSize));
            bins[index] += 1;
        });

        const maxBin = Math.max(...bins) || 1;
        const barWidth = chartWidth / binCount;

        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(paddingLeft, paddingTop, chartWidth, chartHeight);

        // Y-axis grid and labels for frequency (improves readability on small charts)
        const yTickCount = 4;
        ctx.strokeStyle = '#e9ecef';
        ctx.fillStyle = '#6c757d';
        ctx.font = '9px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= yTickCount; i++) {
            const ratio = i / yTickCount;
            const tickValue = Math.round(maxBin - ratio * maxBin);
            const y = paddingTop + ratio * chartHeight;

            ctx.beginPath();
            ctx.moveTo(paddingLeft, y);
            ctx.lineTo(paddingLeft + chartWidth, y);
            ctx.stroke();
            ctx.fillText(String(tickValue), paddingLeft - 6, y);
        }

        bins.forEach((count, index) => {
            const barHeight = (count / maxBin) * (chartHeight - 12);
            const x = paddingLeft + index * barWidth + 4;
            const y = paddingTop + chartHeight - barHeight;

            ctx.fillStyle = '#4c78a8';
            ctx.fillRect(x, y, barWidth - 8, barHeight);
        });

        ctx.strokeStyle = '#adb5bd';
        ctx.beginPath();
        ctx.moveTo(paddingLeft, paddingTop);
        ctx.lineTo(paddingLeft, paddingTop + chartHeight);
        ctx.lineTo(paddingLeft + chartWidth, paddingTop + chartHeight);
        ctx.stroke();

        // X-axis tick labels (value scale)
        ctx.fillStyle = '#6c757d';
        ctx.font = '9px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const xTickCount = 4;
        for (let i = 0; i <= xTickCount; i++) {
            const ratio = i / xTickCount;
            const tickValue = min + ratio * (max - min);
            const x = paddingLeft + ratio * chartWidth;
            ctx.fillText(this.formatQuickStatNumber(tickValue), x, height - paddingBottom + 8);
        }
    }

    drawSelectedPillarBarChart(canvas, pillarBreakdown) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        const paddingLeft = 36;
        const paddingRight = 10;
        const paddingTop = 14;
        const paddingBottom = 34;
        const chartWidth = width - paddingLeft - paddingRight;
        const chartHeight = height - paddingTop - paddingBottom;

        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(paddingLeft, paddingTop, chartWidth, chartHeight);

        // Y-axis grid for proportions.
        ctx.strokeStyle = '#e9ecef';
        ctx.fillStyle = '#6c757d';
        ctx.font = '9px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const yTicks = [0, 0.25, 0.5, 0.75, 1];
        yTicks.forEach(tick => {
            const y = paddingTop + chartHeight - tick * chartHeight;
            ctx.beginPath();
            ctx.moveTo(paddingLeft, y);
            ctx.lineTo(paddingLeft + chartWidth, y);
            ctx.stroke();
            ctx.fillText(`${Math.round(tick * 100)}%`, paddingLeft - 6, y);
        });

        const barSlot = chartWidth / pillarBreakdown.length;
        pillarBreakdown.forEach((pillar, index) => {
            const barWidth = Math.max(20, barSlot - 12);
            const x = paddingLeft + index * barSlot + (barSlot - barWidth) / 2;
            const barHeight = pillar.proportion * chartHeight;
            const y = paddingTop + chartHeight - barHeight;

            ctx.fillStyle = pillar.color;
            ctx.fillRect(x, y, barWidth, barHeight);

            ctx.strokeStyle = '#1f2937';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(x, y, barWidth, barHeight);

            ctx.fillStyle = '#374151';
            ctx.font = '9px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`${Math.round(pillar.proportion * 100)}%`, x + barWidth / 2, y - 2);

            ctx.textBaseline = 'top';
            ctx.fillText(pillar.label, x + barWidth / 2, height - paddingBottom + 8);
        });

        ctx.strokeStyle = '#adb5bd';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(paddingLeft, paddingTop);
        ctx.lineTo(paddingLeft, paddingTop + chartHeight);
        ctx.lineTo(paddingLeft + chartWidth, paddingTop + chartHeight);
        ctx.stroke();
    }
    
    /**
     * Generate summary report with correlations and visualizations
     */
    async generateSummaryReport() {
        const button = this.container.querySelector('.run-analysis-btn');
        const resultsContent = this.container.querySelector('.results-content');
        
        // Show loading state
        button.disabled = true;
        button.textContent = 'Generating...';
        resultsContent.innerHTML = `
            <div class="analysis-loading">
                <div class="loading-spinner"></div>
                <p>Analyzing layer correlations...</p>
            </div>
        `;
        
        try {
            // Simulate analysis processing
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const svLayers = Array.from(this.activeLayers.values()).filter(l => 
    l.type === 'sv-vector' || l.name.toLowerCase().includes('vulnerability')
);
const statLayers = Array.from(this.activeLayers.values()).filter(l => 
    l.type === 'vector' && !l.name.toLowerCase().includes('vulnerability')
);

console.log('Social-Vulnerability Layers found:', svLayers);
console.log('Stat Layers found:', statLayers);
            
            if (svLayers.length === 0 || statLayers.length === 0) {
                this.showNoDataMessage(resultsContent);
                return;
            }
            
            // Generate the report
            const reportData = this.generateCorrelationData(svLayers, statLayers);
            const reportHTML = this.createReportHTML(reportData);
            
            resultsContent.innerHTML = reportHTML;
            
            // Create charts after HTML is rendered
            setTimeout(() => {
                this.createCharts(reportData);
            }, 100);
            
        } catch (error) {
            console.error('Error generating report:', error);
            resultsContent.innerHTML = `
                <div class="analysis-error">
                    <h5>Report Generation Error</h5>
                    <p>Failed to generate correlation report: ${error.message}</p>
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
                    <li>At least one Social Vulnerability layer active</li>
                    <li>At least one Subnational Statistics layer with an attribute selected</li>
                </ul>
                <p>Please activate the required layers and try again.</p>
            </div>
        `;
    }
    
    /**
 * Generate correlation data between layers using REAL data
 */
generateCorrelationData(svLayers, statLayers) {
    const svLayer = svLayers[0];
    const statLayer = statLayers[0];
    
    console.log('Analyzing real data from layers:', {
        svLayer: svLayer.name,
        statLayer: statLayer.name,
        statAttribute: statLayer.selectedAttribute
    });
    
    // Extract real data from the layers
    const data = this.extractRealLayerData(svLayer, statLayer);
    
    if (data.length === 0) {
        throw new Error('No matching regional data found between layers');
    }
    
    // Calculate actual correlation coefficient
    const svValues = data.map(d => d.vulnerability);
    const statValues = data.map(d => d.statistic);
    const correlation = this.calculateCorrelation(svValues, statValues);
    
    console.log('Real correlation calculated:', {
        correlation: correlation.toFixed(3),
        dataPoints: data.length,
        svRange: [Math.min(...svValues), Math.max(...svValues)],
        statRange: [Math.min(...statValues), Math.max(...statValues)]
    });
    
    return {
        data,
        correlation: correlation.toFixed(3),
        svLayer: svLayer.name,
        statLayer: statLayer.name,
        statAttribute: statLayer.selectedAttribute,
        timestamp: new Date().toLocaleString()
    };
}

/**
 * Extract real data from the actual layers
 */
extractRealLayerData(svLayer, statLayer) {
    const data = [];
    
    // Get the actual Leaflet layer objects
    const svLeafletLayer = svLayer.layer;
    const statLeafletLayer = statLayer.layer;
    
    if (!svLeafletLayer || !statLeafletLayer) {
        console.error('Could not access layer data');
        return data;
    }
    
    // Create maps for quick lookup
    const svData = new Map();
    const statData = new Map();
    
    // Extract Social-Vulnerability data
    const svAttribute = svLayer.selectedAttribute;
    svLeafletLayer.eachLayer(function(layer) {
        if (layer.feature && layer.feature.properties) {
            const props = layer.feature.properties;
            const regionName = this.getRegionName(props);
            const svValue =
                props[svAttribute] ??
                props['Social-Vulnerability'] ??
                props["capacityNightlight Intensity (mean)"] ??
                props["age_13_18Nightlight Intensity (mean)"] ??
                props['age_13_18Nightlight Intensity (mean)'] ??
                props.peace_composite_score ??
                props.sv ??
                props.vulnerability;
            console.log('svValue:', svValue)
            if (regionName && svValue !== undefined && svValue !== null) {
                svData.set(regionName, parseFloat(svValue));
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
        svRegions: Array.from(svData.keys()),
        statRegions: Array.from(statData.keys()),
        svSample: Array.from(svData.entries()).slice(0, 3),
        statSample: Array.from(statData.entries()).slice(0, 3)
    });
    
    // Match regions and create final dataset
    svData.forEach((svValue, regionName) => {
        if (statData.has(regionName)) {
            const statValue = statData.get(regionName);
            
            // Only include if both values are valid numbers
            if (!isNaN(svValue) && !isNaN(statValue)) {
                data.push({
                    region: regionName,
                    vulnerability: svValue,
                    statistic: statValue,
                    population: this.getPopulationEstimate(regionName) // Optional population data
                });
            }
        }
    });
    
    return data;
}

/**
 * Get region name from feature properties
 */
getRegionName(properties) {
    // Try different possible name fields in order of preference
    const nameFields = [
        'NAME_1', 'NAME_2', 'NAME_3',
        'name', 'Name', 'AREA_NAME',
        'ADM1_NAME', 'ADM2_NAME', 'ADM3_NAME',
        'Cercle/District', 'District', 'Commune'
    ];
    
    for (const field of nameFields) {
        if (properties[field] && typeof properties[field] === 'string') {
            return properties[field].trim();
        }
    }
    
    return null;
}

/**
 * Get population estimate for a region (mock data for now)
 */
getPopulationEstimate(regionName) {
    // This could be enhanced to use real population data from your layers
    // For now, return a reasonable estimate
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
        'Ménaka': 62180
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
     * Create the HTML structure for the report
     */
    /**
 * Create the HTML structure for the report with interpretation
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
                        <label>Social Vulnerability Layer:</label>
                        <span>${reportData.svLayer}</span>
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
                        <p><strong>Policy Implications:</strong></p>
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
                                <th>Vulnerability Score</th>
                                <th>${reportData.statAttribute}</th>
                                <th>Population</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportData.data.map(row => `
                                <tr>
                                    <td>${row.region}</td>
                                    <td>${row.vulnerability.toFixed(3)}</td>
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
    
    // Create summary
    let summary = `
        <div class="correlation-summary ${isPositive ? 'positive' : 'negative'}">
            <p><strong>${attribute} and Social Vulnerability are ${direction} correlated (r = ${correlationStr})</strong></p>
            <p>This indicates a <strong>${strengthDesc}</strong> between these two variables.</p>
        </div>
    `;
    
    // Generate detailed bullets
    const bullets = [
        `As social vulnerability increases, ${attribute} tends to ${relationshipType}`,
        `The correlation coefficient of ${correlationStr} indicates a ${strength} ${direction} relationship`,
        `This relationship explains approximately ${Math.round(correlation * correlation * 100)}% of the variance between the variables`
    ];
    
    // Add context-specific bullets based on attribute type
    if (attributeInfo.isHealthIndicator) {
        if (isPositive) {
            bullets.push(`Higher vulnerability regions tend to have worse ${attributeInfo.displayName} outcomes`);
        } else {
            bullets.push(`Higher vulnerability regions tend to have better ${attributeInfo.displayName} outcomes (unexpected - may warrant further investigation)`);
        }
    } else if (attributeInfo.isEconomicIndicator) {
        if (isPositive) {
            bullets.push(`Regions with higher vulnerability show higher ${attributeInfo.displayName}`);
        } else {
            bullets.push(`Regions with higher vulnerability show lower ${attributeInfo.displayName}`);
        }
    }
    
    // Generate policy implications
    let implications;
    if (absCorr >= 0.6) {
        if (attributeInfo.isHealthIndicator && isPositive) {
            implications = `The strong positive correlation suggests that interventions targeting social vulnerability reduction could significantly improve ${attributeInfo.displayName} outcomes. Priority should be given to the most vulnerable regions for maximum impact.`;
        } else if (attributeInfo.isEconomicIndicator && isPositive) {
            implications = `The strong correlation indicates that ${attributeInfo.displayName} could serve as a reliable indicator of social vulnerability. Resources should be allocated proportionally to vulnerability levels.`;
        } else {
            implications = `The strong ${direction} correlation suggests that these variables are closely linked and should be considered together in policy planning and resource allocation decisions.`;
        }
    } else if (absCorr >= 0.3) {
        implications = `The moderate correlation suggests some relationship between these variables, but other factors also play important roles. A multi-faceted approach addressing various determinants would be most effective.`;
    } else {
        implications = `The weak correlation suggests these variables are largely independent. Different intervention strategies may be needed for each, and vulnerability reduction may not directly impact ${attributeInfo.displayName}.`;
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
    
    // Set up scales
    const xValues = reportData.data.map(d => d.vulnerability);
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
        const x = padding + ((point.vulnerability - xMinPadded) / (xMaxPadded - xMinPadded)) * chartWidth;
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
        
        // Add region labels for outliers or on hover (simplified version)
        if (index < 3) { // Show labels for first 3 points as example
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
    
    // Axis labels
    ctx.fillStyle = '#333';
    ctx.font = 'bold 12px Calibri';
    
    // X-axis title
    ctx.textAlign = 'center';
    ctx.fillText('Vulnerability Score', width / 2, height - 15);
    
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
    
    // Calculate linear regression
    const n = data.length;
    const sumX = data.reduce((sum, d) => sum + d.vulnerability, 0);
    const sumY = data.reduce((sum, d) => sum + d.statistic, 0);
    const sumXY = data.reduce((sum, d) => sum + d.vulnerability * d.statistic, 0);
    const sumX2 = data.reduce((sum, d) => sum + d.vulnerability * d.vulnerability, 0);
    
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


createBarChart(reportData) {
    const canvas = document.getElementById('bar-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = 60; // Increased padding for labels
    const bottomPadding = 80; // Extra space for region names
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    const chartWidth = width - 2 * padding;
    const chartHeight = height - padding - bottomPadding;
    const barWidth = chartWidth / reportData.data.length;
    const maxValue = Math.max(...reportData.data.map(d => d.vulnerability));
    const minValue = Math.min(...reportData.data.map(d => d.vulnerability));
    
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
        const barHeight = ((item.vulnerability - minValue) / (maxValue - minValue)) * chartHeight;
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
        ctx.fillText(item.vulnerability.toFixed(2), x + barWidth / 2, y - 5);
        
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
    
    // Y-axis title (rotated)
    ctx.fillStyle = '#333';
    ctx.font = 'bold 12px Calibri';
    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Vulnerability Score', 0, 0);
    ctx.restore();
    
    // X-axis title
    ctx.textAlign = 'center';
    ctx.fillText('Regions', width / 2, height - 15);
    
    // Chart title
    ctx.font = 'bold 14px Calibri';
    ctx.fillText('Social Vulnerability by Region', width / 2, 25);
}
    
    /**
     * Download report as PDF (placeholder - would need a PDF library)
     */
/**
 * Download report as PDF using jsPDF and html2canvas
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
        
        // Create canvas from the report element
        const canvas = await html2canvas(reportElement, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            width: reportElement.scrollWidth,
            height: reportElement.scrollHeight
        });
        
        // Initialize jsPDF
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
        const filename = `correlation-report-${timestamp}.pdf`;
        
        // Save the PDF
        pdf.save(filename);
        
        console.log('PDF generated successfully:', filename);
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Failed to generate PDF. Please try again.');
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