const STORAGE_KEY = 'lb-theme';

export function isDarkTheme() {
    return document.documentElement.classList.contains('theme-dark');
}

function syncThemeButtons(dark) {
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
        btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
        btn.setAttribute('aria-label', dark ? 'Switch to bright mode' : 'Switch to dark mode');
        btn.title = dark ? 'Bright mode' : 'Dark mode';
        const label = btn.querySelector('.theme-mode-label');
        if (label) label.textContent = dark ? 'Bright' : 'Dark';
    });
}

export function applyTheme(mode, { notify = true } = {}) {
    const dark = mode === 'dark';
    const changed = isDarkTheme() !== dark;
    document.documentElement.classList.toggle('theme-dark', dark);
    try {
        localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
    } catch (e) {
        /* private mode */
    }
    syncThemeButtons(dark);
    if (notify && changed) {
        window.dispatchEvent(new CustomEvent('lb-theme-change', { detail: { dark } }));
    }
}

export function initThemeToggle() {
    let stored = 'light';
    try {
        stored = localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
    } catch (e) {
        stored = 'light';
    }
    applyTheme(stored, { notify: false });
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
        if (btn.dataset.themeBound === '1') return;
        btn.dataset.themeBound = '1';
        btn.addEventListener('click', () => {
            applyTheme(isDarkTheme() ? 'light' : 'dark');
        });
    });
}

function bootThemeToggle() {
    initThemeToggle();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootThemeToggle);
} else {
    bootThemeToggle();
}
