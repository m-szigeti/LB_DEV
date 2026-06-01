// welcome_popup.js - Welcome popup for DSVI Social Vulnerability tool

export class WelcomePopup {
    constructor(forceShow = false) {
        this.isVisible = false;
        this.container = null;
        this.hasBeenShown = forceShow ? false : this.checkIfShown();
        
        if (!this.hasBeenShown || forceShow) {
            this.init();
        }
    }
    
    /**
     * Check if welcome popup has been shown before
     */
    checkIfShown() {
        // Show once per session
        return sessionStorage.getItem('dsviWelcomeShown') === 'true';
    }
    
    /**
     * Mark welcome popup as shown
     */
    markAsShown() {
        sessionStorage.setItem('dsviWelcomeShown', 'true');
    }
    
    /**
     * Initialize the welcome popup
     */
    init() {
        this.createPopup();
        this.show();
    }
    
    /**
     * Create the welcome popup DOM structure
     */
    createPopup() {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'welcome-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            z-index: 3000;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(2px);
        `;
        
        // Create popup container
        this.container = document.createElement('div');
        this.container.className = 'welcome-popup';
        this.container.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            width: 90%;
            max-width: 750px;
            max-height: 85vh;
            overflow-y: auto;
            font-family: Calibri, sans-serif;
            animation: welcomeSlideIn 0.5s ease-out;
        `;
        
        // Create header
        const header = document.createElement('div');
        header.style.cssText = `
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 25px;
            border-radius: 12px 12px 0 0;
            position: relative;
        `;
        
        header.innerHTML = `
            <h2 style="margin: 0; font-size: 26px; text-align: center; font-weight: 600;">
                Welcome to the DSVI Social Vulnerability Tool
            </h2>
            <p style="margin: 10px 0 0 0; text-align: center; font-size: 16px; opacity: 0.9;">
                Interactive mapping for comprehensive social vulnerability analysis across Lebanon
            </p>
            <button class="welcome-close-btn" style="
                position: absolute;
                top: 20px;
                right: 25px;
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 20px;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            ">×</button>
        `;
        
        // Create content
        const content = document.createElement('div');
        content.style.cssText = `
            padding: 30px;
            line-height: 1.6;
        `;
        
        content.innerHTML = `
            <div style="text-align: center; margin-bottom: 25px;">
                <div style="font-size: 52px; margin-bottom: 15px;">🗺️</div>
                <p style="font-size: 16px; color: #555; margin: 0; max-width: 600px; margin: 0 auto;">
                    Explore high-resolution social vulnerability maps powered by AI/ML analysis of 
                    demographic surveys, satellite imagery, and expert knowledge
                </p>
            </div>
            
            <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 10px; padding: 25px; margin-bottom: 25px; border-left: 5px solid #28a745;">
                <h3 style="margin: 0 0 15px 0; color: #28a745; font-size: 20px; display: flex; align-items: center;">
                    <span style="margin-right: 10px;">🎯</span> What is Social Vulnerability?
                </h3>
                <p style="margin: 0; color: #333; font-size: 15px;">
                    Social Vulnerability measures how susceptible communities are to harm from social, economic, and environmental stressors. 
                    Our tool integrates <strong>Demographic and Health Survey (DHS) data</strong> with <strong>satellite imagery</strong> and 
                    <strong>expert knowledge</strong> to create comprehensive vulnerability assessments across Lebanon.
                </p>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px;">
                <div style="background: #e7f3ff; padding: 18px; border-radius: 10px; border-left: 4px solid #007bff;">
                    <h4 style="margin: 0 0 10px 0; color: #007bff; font-size: 16px; display: flex; align-items: center;">
                        <span style="margin-right: 8px;">📊</span> Explore Vulnerability
                    </h4>
                    <p style="margin: 0; font-size: 14px; color: #333;">
                        View social vulnerability at Admin Level 1, 2, or 3. Click regions to see detailed vulnerability scores and contributing factors.
                    </p>
                </div>
                <div style="background: #f0f9ff; padding: 18px; border-radius: 10px; border-left: 4px solid #0ea5e9;">
                    <h4 style="margin: 0 0 10px 0; color: #0ea5e9; font-size: 16px; display: flex; align-items: center;">
                        <span style="margin-right: 8px;">🔍</span> Analyze Drivers
                    </h4>
                    <p style="margin: 0; font-size: 14px; color: #333;">
                        Overlay high-resolution maps showing key vulnerability drivers like poverty, education access, and infrastructure.
                    </p>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px;">
                <div style="background: #f0fdf4; padding: 18px; border-radius: 10px; border-left: 4px solid #22c55e;">
                    <h4 style="margin: 0 0 10px 0; color: #22c55e; font-size: 16px; display: flex; align-items: center;">
                        <span style="margin-right: 8px;">🛠️</span> Interactive Tools
                    </h4>
                    <p style="margin: 0; font-size: 14px; color: #333;">
                        Adjust layer opacity, change color schemes, and compare different vulnerability indicators side by side.
                    </p>
                </div>
                <div style="background: #fef7ff; padding: 18px; border-radius: 10px; border-left: 4px solid #a855f7;">
                    <h4 style="margin: 0 0 10px 0; color: #a855f7; font-size: 16px; display: flex; align-items: center;">
                        <span style="margin-right: 8px;">📈</span> AI-Powered Insights
                    </h4>
                    <p style="margin: 0; font-size: 14px; color: #333;">
                        Machine learning models predict vulnerability for areas without survey data, creating comprehensive coverage.
                    </p>
                </div>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                <h4 style="margin: 0 0 10px 0; color: #856404; font-size: 16px; display: flex; align-items: center;">
                    <span style="margin-right: 8px;">💡</span> Quick Start Tips
                </h4>
                <ul style="margin: 0; padding-left: 20px; color: #856404; font-size: 14px;">
                    <li>Start with the <strong>Social Vulnerability</strong> dropdown (already open) to explore Admin Level 1 data</li>
                    <li>Click on any region to see detailed vulnerability information</li>
                    <li>Use the <strong>High Resolution Maps</strong> to overlay additional context data</li>
                    <li>Adjust layer opacity to compare multiple indicators simultaneously</li>
                </ul>
            </div>
            
            <div style="text-align: center;">
                <button class="welcome-start-btn" style="
                    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                    color: white;
                    border: none;
                    padding: 15px 40px;
                    border-radius: 30px;
                    font-size: 18px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                    box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
                    margin-right: 15px;
                ">
                    Start Exploring →
                </button>
                <button class="welcome-info-btn" style="
                    background: transparent;
                    color: #6c757d;
                    border: 2px solid #6c757d;
                    padding: 15px 30px;
                    border-radius: 30px;
                    font-size: 16px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s;
                ">
                    Learn More
                </button>
            </div>
        `;
        
        // Assemble popup
        this.container.appendChild(header);
        this.container.appendChild(content);
        overlay.appendChild(this.container);
        
        // Add to page
        document.body.appendChild(overlay);
        this.overlay = overlay;
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Close button
        const closeBtn = this.container.querySelector('.welcome-close-btn');
        closeBtn.addEventListener('click', () => this.hide());
        
        // Start button
        const startBtn = this.container.querySelector('.welcome-start-btn');
        startBtn.addEventListener('click', () => this.hide());
        
        // Info button
        const infoBtn = this.container.querySelector('.welcome-info-btn');
        infoBtn.addEventListener('click', () => {
            window.open('html/more.html', '_blank');
        });
        
        // Hover effects for buttons
        const startButton = this.container.querySelector('.welcome-start-btn');
        const infoButton = this.container.querySelector('.welcome-info-btn');
        const closeButton = this.container.querySelector('.welcome-close-btn');
        
        // Start button hover
        startButton.addEventListener('mouseover', () => {
            startButton.style.transform = 'translateY(-2px)';
            startButton.style.boxShadow = '0 6px 20px rgba(40, 167, 69, 0.4)';
        });
        startButton.addEventListener('mouseout', () => {
            startButton.style.transform = 'translateY(0)';
            startButton.style.boxShadow = '0 4px 15px rgba(40, 167, 69, 0.3)';
        });
        
        // Info button hover
        infoButton.addEventListener('mouseover', () => {
            infoButton.style.background = '#6c757d';
            infoButton.style.color = 'white';
            infoButton.style.transform = 'translateY(-2px)';
        });
        infoButton.addEventListener('mouseout', () => {
            infoButton.style.background = 'transparent';
            infoButton.style.color = '#6c757d';
            infoButton.style.transform = 'translateY(0)';
        });
        
        // Close button hover
        closeButton.addEventListener('mouseover', () => {
            closeButton.style.background = 'rgba(255, 255, 255, 0.3)';
            closeButton.style.transform = 'scale(1.1)';
        });
        closeButton.addEventListener('mouseout', () => {
            closeButton.style.background = 'rgba(255, 255, 255, 0.2)';
            closeButton.style.transform = 'scale(1)';
        });
        
        // Close on overlay click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }
    
    /**
     * Show the welcome popup
     */
    show() {
        if (this.overlay) {
            this.overlay.style.display = 'flex';
            this.isVisible = true;
            
            // Add animation styles
            if (!document.querySelector('#welcome-styles')) {
                const styles = document.createElement('style');
                styles.id = 'welcome-styles';
                styles.textContent = `
                    @keyframes welcomeSlideIn {
                        from {
                            opacity: 0;
                            transform: scale(0.85) translateY(30px);
                        }
                        to {
                            opacity: 1;
                            transform: scale(1) translateY(0);
                        }
                    }
                    
                    @keyframes welcomeSlideOut {
                        from {
                            opacity: 1;
                            transform: scale(1) translateY(0);
                        }
                        to {
                            opacity: 0;
                            transform: scale(0.85) translateY(-30px);
                        }
                    }
                `;
                document.head.appendChild(styles);
            }
        }
    }
    
    /**
     * Hide the welcome popup
     */
    hide() {
        if (this.container && this.isVisible) {
            // Add exit animation
            this.container.style.animation = 'welcomeSlideOut 0.4s ease-in';
            
            setTimeout(() => {
                if (this.overlay && this.overlay.parentNode) {
                    this.overlay.parentNode.removeChild(this.overlay);
                }
                this.isVisible = false;
                this.markAsShown();
            }, 400);
        }
    }
    
    /**
     * Force show the popup (for testing or help)
     */
    forceShow() {
        if (!this.container) {
            this.createPopup();
        }
        this.show();
    }
}