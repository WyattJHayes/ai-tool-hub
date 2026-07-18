/** @constant {number} Maximum number of search history items to store */
const MAX_SEARCH_HISTORY = 10;

/** @constant {number} Time in milliseconds to display toast messages */
const TOAST_DISPLAY_TIME = 2000;

/** @constant {number} Debounce time in milliseconds for search input */
const SEARCH_DEBOUNCE_TIME = 300;

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param {*} text - Text to escape (will be converted to string)
 * @returns {string} Escaped HTML-safe string
 * @example
 * escapeHtml('<script>alert("xss")</script>')
 * // returns: '&lt;script&gt;alert("xss")&lt;/script&gt;'
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Escape HTML attribute special characters
 * @param {*} text - Text to escape for use in HTML attributes
 * @returns {string} Escaped attribute-safe string
 * @example
 * escapeAttr('value"with\'quotes')
 * // returns: 'value&quot;with&#39;quotes'
 */
function escapeAttr(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Setup global keyboard shortcuts
 * Supports:
 * - '/': Focus search input
 * - 'Escape': Clear search, close modals
 * @param {Object} callbacks - Optional callbacks to avoid circular imports
 * @param {Function} [callbacks.onEscape] - Called on Escape key with no args
 */
function setupKeyboardShortcuts(callbacks = {}) {
    document.addEventListener('keydown', (e) => {
        const searchInput = document.getElementById('mainSearch');

        if (e.key === '/' || e.key.toLowerCase() === 's') {
            const active = document.activeElement;
            const isEditing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
            if (searchInput && !isEditing) {
                e.preventDefault();
                searchInput.focus();
            }
        }
        if (e.key === 'Escape') {
            if (typeof callbacks.onEscape === 'function') {
                callbacks.onEscape();
            }
        }
    });
}

/**
 * Setup pull-to-refresh gesture for mobile devices
 * Triggers page reload when user pulls down at the top of the page
 */
function setupPullToRefresh() {
    let startY = 0;
    let refreshing = false;
    
    document.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) startY = e.touches[0].clientY;
    }, { passive: true });
    
    document.addEventListener('touchmove', (e) => {
        if (refreshing || window.scrollY > 0) return;
        const diff = e.touches[0].clientY - startY;
        const pullRefresh = document.getElementById('pullRefresh');
        if (diff > 80 && pullRefresh) {
            pullRefresh.classList.add('visible');
        }
    }, { passive: true });
    
    document.addEventListener('touchend', () => {
        const pullRefresh = document.getElementById('pullRefresh');
        if (pullRefresh && pullRefresh.classList.contains('visible')) {
            refreshing = true;
            showToast('正在刷新数据...');
            setTimeout(() => {
                document.dispatchEvent(new CustomEvent('app:refresh'));
                refreshing = false;
            }, 500);
        }
    });
}

/**
 * Theme configuration with all available themes
 */
let isDarkMode = localStorage.getItem('ai-tool-hub-dark-mode') === 'true';

// Apply theme class immediately to prevent flash
if (isDarkMode) {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
}

/**
 * Toggle between light and dark themes (quick switch)
 * Opens theme modal for full selection
 */
function toggleTheme() {
    isDarkMode = !isDarkMode;
    if (isDarkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('ai-tool-hub-dark-mode', isDarkMode ? 'true' : 'false');
    updateThemeIcon();
    showToast(isDarkMode ? '已切换到深色模式' : '已切换到浅色模式');
}

/**
 * Show the theme selector modal
 */
function showThemeModal() {
    const modal = document.getElementById('themeModal');
    if (modal) {
        modal.classList.add('active');
        updateThemeSelectionUI();
    }
}

/**
 * Close the theme selector modal
 * @param {Event} [event] - Click event (optional)
 */
function closeThemeModal(event) {
    const modal = document.getElementById('themeModal');
    if (!modal) return;
    if (!event || event.target === modal || event.target.closest('.modal-close-btn')) {
        modal.classList.remove('active');
    }
}

/**
 * Set active theme and apply it to the document
 * @param {string} themeName - Theme identifier (default, midnight, lavender, etc.)
 */
function setTheme(mode) {
    if (mode === 'dark') {
        isDarkMode = true;
        document.documentElement.classList.add('dark');
    } else {
        isDarkMode = false;
        document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('ai-tool-hub-theme', mode);
    localStorage.setItem('ai-tool-hub-dark-mode', isDarkMode ? 'true' : 'false');
    updateThemeIcon();
    updateThemeSelectionUI();
    showToast(isDarkMode ? '已切换到深色模式' : '已切换到浅色模式');
    setTimeout(() => {
        closeThemeModal();
    }, 300);
}

/**
 * Update theme icons (sun/moon/palette) based on current theme
 * @param {string} themeName - Current theme name
 */
function updateThemeIcon() {
    const icons = ['themeIcon', 'themeIconNav'];
    const isDark = document.documentElement.classList.contains('dark');
    icons.forEach(iconId => {
        const icon = document.getElementById(iconId);
        if (icon) {
            icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        }
    });
}

/**
 * Update the visual selection state in theme modal
 */
function updateThemeSelectionUI() {
    const isDark = document.documentElement.classList.contains('dark');
    const options = document.querySelectorAll('.theme-option');
    options.forEach(option => {
        const value = option.getAttribute('data-theme-value');
        const matches = (value === 'dark' && isDark) || (value === 'light' && !isDark);
        option.classList.toggle('active', matches);
    });
}

/**
 * Load saved theme on page initialization
 */
function loadSavedTheme() {
    // Check localStorage first, then system preference
    const savedDark = localStorage.getItem('ai-tool-hub-dark-mode');
    if (savedDark !== null) {
        if (savedDark === 'true') {
            document.documentElement.classList.add('dark');
            isDarkMode = true;
        } else {
            document.documentElement.classList.remove('dark');
            isDarkMode = false;
        }
    } else {
        // Follow system preference (guard for test environments)
        if (typeof window.matchMedia === 'function') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                document.documentElement.classList.add('dark');
                isDarkMode = true;
            } else {
                document.documentElement.classList.remove('dark');
                isDarkMode = false;
            }
        } else {
            // No matchMedia available (e.g. test environments) — default light
            document.documentElement.classList.remove('dark');
            isDarkMode = false;
        }
    }
    updateThemeIcon();
}

/**
 * Display a toast notification message
 * @param {string} msg - Message to display in toast
 * Toast automatically disappears after TOAST_DISPLAY_TIME ms
 */
let toastTimeout = null;

function showToast(msg) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    if (!toast || !toastMsg) return;
    
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    
    toastMsg.textContent = msg;
    toast.classList.add('show');
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
        toastTimeout = null;
    }, TOAST_DISPLAY_TIME);
}

/**
 * Load and display announcement bar from localStorage
 * Only shows if announcement exists and user hasn't dismissed it
 */
function loadAnnouncement() {
    const announcement = localStorage.getItem('ai-tool-hub-announcement');
    if (announcement && !localStorage.getItem('ai-tool-hub-announcement-closed')) {
        const textEl = document.getElementById('announcementText');
        const bar = document.getElementById('announcementBar');
        if (textEl) textEl.textContent = announcement;
        if (bar) bar.style.display = 'block';
    }
}

/**
 * Close announcement bar and remember user's choice
 */
function closeAnnouncement() {
    const bar = document.getElementById('announcementBar');
    if (bar) bar.style.display = 'none';
    localStorage.setItem('ai-tool-hub-announcement-closed', 'true');
}

/**
 * Validate URL security - only allow http/https protocols
 * Prevents javascript: protocol injection attacks
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL is safe (http or https)
 */
function isValidUrl(url) {
    if (typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

/**
 * Register Service Worker for PWA support
 * Enables offline caching and improved performance
 */
function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    const isLocalDevHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
    if (isLocalDevHost) {
        if (typeof navigator.serviceWorker.getRegistrations === 'function') {
            navigator.serviceWorker.getRegistrations()
                .then(registrations => registrations.forEach(registration => registration.unregister()))
                .then(() => caches?.keys?.())
                .then(keys => keys && Promise.all(keys.map(key => caches.delete(key))))
                .catch(err => {
                    // eslint-disable-next-line no-console -- service worker cleanup failures need diagnostics
                    console.warn('SW cleanup failed:', err);
                });
            return;
        }
    }

    navigator.serviceWorker.register('sw.js').catch(err => {
        // eslint-disable-next-line no-console -- service worker registration failures need diagnostics
        console.warn('SW registration failed:', err);
    });
}
// Export functions, constants, and utilities
export { 
    setupKeyboardShortcuts, 
    setupPullToRefresh, 
    toggleTheme, 
    showThemeModal,
    closeThemeModal,
    setTheme,
    loadSavedTheme,
    showToast, 
    loadAnnouncement, 
    closeAnnouncement, 
    registerServiceWorker,
    escapeHtml,
    escapeAttr,
    isValidUrl,
    MAX_SEARCH_HISTORY,
    TOAST_DISPLAY_TIME,
    SEARCH_DEBOUNCE_TIME,
};
