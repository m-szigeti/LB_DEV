/**
 * Lock main tool UI while computing or in sandbox preview mode.
 */

import { isSandboxComputing, isSandboxActive, isSandboxLocked } from './composite_sandbox_state.js';

const BODY_COMPUTING = 'composite-weight-computing';
const BODY_SANDBOX = 'composite-weight-sandbox-mode';

const SIDEBAR_SELECTOR = '#sidebar';
const SANDBOX_PANEL_SELECTOR = '#compositeSandboxPanel';
const MAP_WORKSPACE_SELECTOR = '.map-panel';

export function isCompositeSandboxLocked() {
    return isSandboxLocked();
}

export function syncSandboxBodyClasses() {
    document.body.classList.toggle(BODY_COMPUTING, isSandboxComputing());
    document.body.classList.toggle(BODY_SANDBOX, isSandboxActive());
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('composite-sidebar-locked', isSandboxLocked());
    }
    const analysisSidebar = document.getElementById('analysis-sidebar');
    if (analysisSidebar) {
        analysisSidebar.classList.toggle('composite-sidebar-locked', isSandboxLocked());
    }
}

export function installSandboxGuard() {
    if (document.body.dataset.compositeSandboxGuard === 'true') return;
    document.body.dataset.compositeSandboxGuard = 'true';

    document.addEventListener(
        'click',
        event => {
            if (!isSandboxLocked()) return;
            if (isSandboxComputing()) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            if (!isSandboxActive()) return;

            const target = event.target;
            if (!(target instanceof Element)) return;

            const allowed =
                target.closest(SANDBOX_PANEL_SELECTOR) ||
                target.closest(MAP_WORKSPACE_SELECTOR) ||
                target.closest('#map');
            if (!allowed) {
                event.preventDefault();
                event.stopPropagation();
            }
        },
        true
    );

    document.addEventListener(
        'change',
        event => {
            if (!isSandboxLocked()) return;
            if (isSandboxComputing()) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (!target.closest(SANDBOX_PANEL_SELECTOR)) {
                event.preventDefault();
                event.stopPropagation();
            }
        },
        true
    );
}

export function blockIfSandboxLocked() {
    return isSandboxLocked();
}
