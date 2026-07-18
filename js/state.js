/**
 * Global State Management Module
 * Centralized state to avoid circular dependencies between modules
 */

/**
 * 安全解析 localStorage 中的 JSON 数据
 * @param {string} key - localStorage 键名
 * @param {*} defaultValue - 解析失败时的默认值
 * @returns {*} 解析后的值或默认值
 */
function safeJsonParse(key, defaultValue) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : defaultValue;
    } catch {
        localStorage.removeItem(key);
        return defaultValue;
    }
}

const STATE_VERSION = 2;
const STATE_VERSION_KEY = 'ai-tool-hub-state-version';

function migrateState() {
    const storedVersion = parseInt(localStorage.getItem(STATE_VERSION_KEY)) || 0;
    if (storedVersion < STATE_VERSION) {
        if (storedVersion < 1) {
            const oldFavorites = safeJsonParse('ai-tool-hub-favorites', []);
            if (!Array.isArray(oldFavorites)) {
                localStorage.setItem('ai-tool-hub-favorites', '[]');
            }
            const oldRatings = safeJsonParse('ai-tool-hub-ratings', {});
            if (typeof oldRatings !== 'object' || Array.isArray(oldRatings)) {
                localStorage.setItem('ai-tool-hub-ratings', '{}');
            }
        }
        if (storedVersion < 2) {
            const oldStats = safeJsonParse('ai-tool-hub-click-stats', {});
            const cleaned = {};
            for (const [k, v] of Object.entries(oldStats)) {
                if (typeof v === 'number' && v >= 0) cleaned[k] = v;
            }
            localStorage.setItem('ai-tool-hub-click-stats', JSON.stringify(cleaned));
        }
        localStorage.setItem(STATE_VERSION_KEY, String(STATE_VERSION));
    }
}

migrateState();

// Private timeout references (not part of state data)
let _clickSaveTimeout = null;
let _ratingSaveTimeout = null;

// Global Application State
const state = {
    tools: [],           // All tools data from tools.json
    categories: [],      // Category definitions
    currentCategory: 'all', // Currently selected category filter
    currentSort: 'default', // Current sort method
    advancedFilters: {    // Advanced filter state (price, origin, status)
        price: [],
        origin: [],
        status: []
    },
    searchHistory: safeJsonParse('ai-tool-hub-search-history', []),
    favorites: safeJsonParse('ai-tool-hub-favorites', []),
    clickStats: safeJsonParse('ai-tool-hub-click-stats', {}),  // Tool click statistics {toolId: count}
    ratings: safeJsonParse('ai-tool-hub-ratings', {})          // User ratings {toolId: rating (1-5)}
};

/**
 * Update the global tools and categories data
 * @param {Array} tools - Array of tool objects
 * @param {Array} categories - Array of category objects
 */
function updateData(tools, categories) {
    state.tools = tools;
    state.categories = categories;
}

/**
 * Get current tools data (optionally filtered by category)
 * @param {string} [category] - Optional category ID to filter by
 * @returns {Array} Filtered or all tools
 */
function getTools(category) {
    if (!category || category === 'all') {
        return state.tools;
    }
    return state.tools.filter(t => t.category === category);
}

/**
 * Get category name by ID
 * @param {string} categoryId - Category ID
 * @returns {string} Category name or empty string
 */
function getCategoryName(categoryId) {
    const cat = state.categories.find(c => c.id === categoryId);
    return cat ? cat.name : '';
}

/**
 * Check if a tool is in favorites
 * @param {number} toolId - Tool ID to check
 * @returns {boolean} True if favorited
 */
function isFavorite(toolId) {
    return state.favorites.includes(toolId);
}

/**
 * Toggle favorite status for a tool
 * @param {number} toolId - Tool ID to toggle
 * @returns {boolean} New favorite status
 */
function toggleFavorite(toolId) {
    const index = state.favorites.indexOf(toolId);
    if (index > -1) {
        state.favorites.splice(index, 1);
    } else {
        state.favorites.push(toolId);
    }
    
    // Save to localStorage immediately for critical user action
    checkStorageQuota();
    localStorage.setItem('ai-tool-hub-favorites', JSON.stringify(state.favorites));
    
    return state.favorites.includes(toolId);
}

/**
 * Add search term to history
 * @param {string} term - Search term to add
 */
function addToSearchHistory(term) {
    if (term && !state.searchHistory.includes(term)) {
        state.searchHistory.unshift(term);
        if (state.searchHistory.length > 10) {
            state.searchHistory.splice(10);
        }
        checkStorageQuota();
        localStorage.setItem('ai-tool-hub-search-history', JSON.stringify(state.searchHistory));
    }
}

/**
 * Record a tool click for statistics
 * @param {number} toolId - Tool ID that was clicked
 */
function recordToolClick(toolId) {
    if (!state.clickStats[toolId]) {
        state.clickStats[toolId] = 0;
    }
    state.clickStats[toolId]++;

    // Debounce save to localStorage (save every 5 clicks or use setTimeout)
    checkStorageQuota();
    if (state.clickStats[toolId] % 5 === 0) {
        localStorage.setItem('ai-tool-hub-click-stats', JSON.stringify(state.clickStats));
    } else {
        // Use debounced save for better performance
        clearTimeout(_clickSaveTimeout);
        _clickSaveTimeout = setTimeout(() => {
            localStorage.setItem('ai-tool-hub-click-stats', JSON.stringify(state.clickStats));
        }, 2000);
    }

    if (typeof window !== 'undefined' && !window.__clickStatsUnloadRegistered) {
        window.__clickStatsUnloadRegistered = true;
        window.addEventListener('beforeunload', () => {
            localStorage.setItem('ai-tool-hub-click-stats', JSON.stringify(state.clickStats));
        });
    }
}

/**
 * Get click count for a specific tool
 * @param {number} toolId - Tool ID
 * @returns {number} Click count
 */
function getToolClickCount(toolId) {
    return state.clickStats[toolId] || 0;
}

/**
 * Get tools sorted by popularity (most clicked first)
 * @returns {Array} Tools sorted by click count descending
 */
function getPopularTools() {
    return [...state.tools].sort((a, b) => {
        return (state.clickStats[b.id] || 0) - (state.clickStats[a.id] || 0);
    });
}

/**
 * Set user rating for a tool (v4.4.0)
 * @param {number} toolId - Tool ID to rate
 * @param {number} rating - Rating value (1-5)
 * @returns {number} The rating that was set
 */
function setToolRating(toolId, rating) {
    // Validate rating is between 1 and 5
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        rating = Math.max(1, Math.min(5, Math.round(rating)));
    }

    state.ratings[toolId] = rating;

    // Debounce save to localStorage
    checkStorageQuota();
    clearTimeout(_ratingSaveTimeout);
    _ratingSaveTimeout = setTimeout(() => {
        localStorage.setItem('ai-tool-hub-ratings', JSON.stringify(state.ratings));
    }, 500);

    return rating;
}

/**
 * Get user rating for a specific tool (v4.4.0)
 * @param {number} toolId - Tool ID
 * @returns {number} Rating (1-5) or 0 if not rated
 */
function getToolRating(toolId) {
    return state.ratings[toolId] || 0;
}

/**
 * Get average rating across all rated tools (v4.4.0)
 * @returns {number} Average rating (1-5) or 0 if no ratings
 */
function getAverageRating() {
    const values = Object.values(state.ratings);
    if (values.length === 0) return 0;

    const sum = values.reduce((acc, val) => acc + val, 0);
    return Math.round((sum / values.length) * 10) / 10;
}

/**
 * Get total number of rated tools (v4.4.0)
 * @returns {number} Count of tools with ratings
 */
function getRatedToolsCount() {
    return Object.keys(state.ratings).length;
}

/**
 * Export user data (favorites, ratings, stats) as JSON (v4.4.0)
 * @returns {string} JSON string of all user data
 */
function exportUserData() {
    const userData = {
        version: '2.0',
        exportDate: new Date().toISOString(),
        favorites: state.favorites,
        ratings: state.ratings,
        clickStats: state.clickStats,
        searchHistory: state.searchHistory
    };

    return JSON.stringify(userData, null, 2);
}

/**
 * Import user data from JSON string (v4.4.0)
 * @param {string} jsonString - JSON string to import
 * @returns {Object} Import result with success status and message
 */
function importUserData(jsonString) {
    try {
        const data = JSON.parse(jsonString);

        // Validate structure
        if (!data.version || !Array.isArray(data.favorites)) {
            throw new Error('无效的数据格式');
        }

        // Merge favorites (validate each item is a number)
        checkStorageQuota();
        if (Array.isArray(data.favorites)) {
            const validFavorites = data.favorites.filter(id => typeof id === 'number');
            state.favorites = [...new Set([...state.favorites, ...validFavorites])];
            localStorage.setItem('ai-tool-hub-favorites', JSON.stringify(state.favorites));
        }

        if (data.ratings && typeof data.ratings === 'object') {
            const validRatings = {};
            for (const [key, value] of Object.entries(data.ratings)) {
                if (typeof value === 'number' && value >= 1 && value <= 5) {
                    validRatings[key] = value;
                }
            }
            state.ratings = { ...state.ratings, ...validRatings };
            localStorage.setItem('ai-tool-hub-ratings', JSON.stringify(state.ratings));
        }

        if (data.clickStats && typeof data.clickStats === 'object') {
            const validStats = {};
            for (const [key, value] of Object.entries(data.clickStats)) {
                if (typeof value === 'number' && value >= 0) {
                    validStats[key] = value;
                }
            }
            // Merge with Math.max to avoid overwriting higher local click counts
            const merged = { ...state.clickStats };
            for (const [key, value] of Object.entries(validStats)) {
                merged[key] = Math.max(merged[key] || 0, value);
            }
            state.clickStats = merged;
            localStorage.setItem('ai-tool-hub-click-stats', JSON.stringify(state.clickStats));
        }

        return {
            success: true,
            message: `成功导入数据：${data.favorites.length} 个收藏，${Object.keys(data.ratings || {}).length} 个评分`
        };
    } catch (error) {
        return {
            success: false,
            message: `导入失败：${error.message}`
        };
    }
}

/**
 * 检查 localStorage 配额使用情况
 * 估算所有键的总大小，若超过 4MB（典型 5MB 限制的 80%）则自动清理搜索历史
 * @returns {boolean} true 表示存储空间正常，false 表示接近满载
 */
export function checkStorageQuota() {
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        // 每个字符占 2 字节（UTF-16），加上键名本身的长度
        totalSize += (key.length + value.length) * 2;
    }

    const FOUR_MB = 4 * 1024 * 1024;
    if (totalSize > FOUR_MB) {
        // eslint-disable-next-line no-console -- storage cleanup should remain observable in production
        console.warn(`[StorageQuota] localStorage 使用量约 ${(totalSize / 1024 / 1024).toFixed(2)}MB，已超过 4MB 阈值，正在清理搜索历史...`);
        localStorage.removeItem('ai-tool-hub-search-history');
        state.searchHistory = [];
        return false;
    }
    return true;
}

/**
 * Platform icon mapping for consistent icon display across modules
 */
export const PLATFORM_ICONS = {
    web: 'fa-globe',
    local: 'fa-server',
    mobile: 'fa-mobile-alt',
    desktop: 'fa-desktop'
};

// Export state object and management functions
export default state;
export {
    updateData,
    getTools,
    getCategoryName,
    isFavorite,
    toggleFavorite,
    addToSearchHistory,
    recordToolClick,
    getToolClickCount,
    getPopularTools,
    setToolRating,
    getToolRating,
    getAverageRating,
    getRatedToolsCount,
    exportUserData,
    importUserData,
    migrateState,
    safeJsonParse
};
