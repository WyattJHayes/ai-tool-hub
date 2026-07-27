// Import state from centralized state module (no circular dependency!)
import state, { addToSearchHistory } from './state.js';
import { escapeHtml, escapeAttr, SEARCH_DEBOUNCE_TIME, showToast } from './utils.js';

let currentSearchTerm = '';

/**
 * Filter/Sort functions
 */
function filterCategory(category) {
    state.currentCategory = category;
    localStorage.setItem('ai-tool-hub-filter-category', category);

    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.category === category) btn.classList.add('active');
    });

    // Update breadcrumb
    updateBreadcrumb(category);

    // Apply current sort and filter
    applyFiltersAndSort();
}

function setCurrentSort(sortBy) {
    state.currentSort = sortBy;
}

// Advanced Filters State (v4.3.0)
function sortTools(tools, sortBy) {

    const sorted = [...tools];
    switch (sortBy) {
    case 'name-asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    case 'name-desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name, 'zh-CN'));
    case 'hot':
        return sorted.sort((a, b) => {
            if (a.status === 'hot' && b.status !== 'hot') return -1;
            if (b.status === 'hot' && a.status !== 'hot') return 1;
            return 0;
        });
    case 'free-first':
        return sorted.sort((a, b) => {
            const aFree = a.tags?.includes('free') ? 0 : 1;
            const bFree = b.tags?.includes('free') ? 0 : 1;
            return aFree - bFree;
        });
    case 'domestic':
        return sorted.sort((a, b) => {
            const aDomestic = a.toolTags?.includes('国产') ? 0 : 1;
            const bDomestic = b.toolTags?.includes('国产') ? 0 : 1;
            return aDomestic - bDomestic;
        });
    default:
        return tools;
    }
}

function applyAdvancedFilters(tools) {
    let filtered = [...tools];

    // Apply price filter
    if (state.advancedFilters.price.length > 0) {
        filtered = filtered.filter(tool =>
            state.advancedFilters.price.some(price =>
                tool.tags?.includes(price)
            )
        );
    }

    // Apply origin filter
    if (state.advancedFilters.origin.length > 0) {
        filtered = filtered.filter(tool =>
            state.advancedFilters.origin.some(origin =>
                tool.toolTags?.includes(origin)
            )
        );
    }

    // Apply status filter
    if (state.advancedFilters.status.length > 0) {
        filtered = filtered.filter(tool =>
            state.advancedFilters.status.some(status =>
                tool.status === status
            )
        );
    }

    return filtered;
}

function applyFiltersAndSort() {
    let filtered = state.currentCategory === 'all'
        ? [...state.tools]
        : state.tools.filter(t => t.category === state.currentCategory);

    // Apply search if active
    const searchTerm = document.getElementById('mainSearch')?.value.toLowerCase() || '';
    if (searchTerm) {
        filtered = filtered.filter(tool =>
            tool.name.toLowerCase().includes(searchTerm) ||
            tool.desc.toLowerCase().includes(searchTerm)
        );
    }

    // Apply advanced filters
    filtered = applyAdvancedFilters(filtered);

    // Apply sorting
    filtered = sortTools(filtered, state.currentSort);

    renderTools(filtered);
}

/**
 * Load saved filter preferences from localStorage
 */
function loadSavedFilters() {
    const savedCategory = localStorage.getItem('ai-tool-hub-filter-category');
    if (!savedCategory || savedCategory === 'all') return;
    
    // If tools are already loaded, apply filter immediately.
    // Otherwise wait for the tools:loaded event from app.js.
    if (state.tools.length > 0) {
        filterCategory(savedCategory);
        return;
    }
    
    document.addEventListener('tools:loaded', function onReady() {
        document.removeEventListener('tools:loaded', onReady);
        filterCategory(savedCategory);
    }, { once: true });
}

/**
 * Show search history dropdown
 */
function showSearchHistory() {
    const container = document.getElementById('searchHistory');
    if (!container) return;

    if (state.searchHistory.length === 0) {
        container.innerHTML = '<div class="search-history-empty"><i class="fas fa-clock"></i> 暂无搜索历史</div>';
        container.classList.add('show');
        return;
    }

    container.innerHTML = `
        <div class="search-history-header">
            <span>搜索历史</span>
            <button class="search-history-clear-all" data-action="clear-search-history">清空</button>
        </div>
    ` + state.searchHistory.slice(0, 8).map(term => `
        <div class="search-suggestion-item" tabindex="0" role="option" data-search-text="${escapeAttr(term)}">
            <div class="search-suggestion-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(-10deg)">
                    <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L13 11h7v7l-2.26-2.26"/>
                </svg>
            </div>
            <div class="search-suggestion-content">
                <div class="search-suggestion-title">${escapeHtml(term)}</div>
            </div>
            <button class="search-history-delete" data-delete-history="${escapeAttr(term)}" aria-label="删除搜索历史">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
        </div>
    `).join('');

    container.classList.add('show');
}

/**
 * Setup search functionality with debounced input handling (v4.4.0 Enhanced)
 */
function syncStickySearchValue(value) {
    const stickyInput = document.getElementById('stickySearchInput');
    if (stickyInput && stickyInput.value !== value) stickyInput.value = value;
}

function setupSearch() {
    const searchInput = document.getElementById('mainSearch');
    if (!searchInput) return;

    let searchDebounceTimeout = null;
    currentSearchTerm = searchInput.value.trim().toLowerCase();

    // Reuse existing #searchSuggestions from HTML, or create one if missing
    let suggestionsContainer = document.getElementById('searchSuggestions');
    if (!suggestionsContainer) {
        suggestionsContainer = document.createElement('div');
        suggestionsContainer.id = 'searchSuggestions';
        searchInput.parentNode.appendChild(suggestionsContainer);
    }
    if (!suggestionsContainer.classList.contains('search-dropdown')) {
        suggestionsContainer.classList.add('search-dropdown');
    }

    // Search history container also needs consistent class
    const searchHistoryContainer = document.getElementById('searchHistory');
    if (searchHistoryContainer && !searchHistoryContainer.classList.contains('search-dropdown')) {
        searchHistoryContainer.classList.remove('search-history');
        searchHistoryContainer.classList.add('search-dropdown');
    }

    // Search results counter element (v4.4.0)
    let resultsCounter = document.querySelector('.results-counter');
    if (!resultsCounter) {
        resultsCounter = document.createElement('div');
        resultsCounter.className = 'results-counter hidden';
        resultsCounter.innerHTML = '<span class="count-number">0</span> 个工具匹配';
        const toolsGrid = document.getElementById('toolsGrid');
        if (toolsGrid && toolsGrid.parentNode) {
            toolsGrid.parentNode.insertBefore(resultsCounter, toolsGrid);
        }
    }

    // Track last searched term to avoid recording intermediate states
    let lastRecordedSearch = '';

    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            searchInput.value = '';
            currentSearchTerm = '';
            syncStickySearchValue('');
            clearSearchBtn.classList.add('hidden');
            hideSearchSuggestions(suggestionsContainer);
            if (searchHistoryContainer) searchHistoryContainer.classList.remove('show');
            applyFiltersAndSort();
            updateResultsCounter('');
            searchInput.focus();
        });
    }

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.trim().toLowerCase();
        currentSearchTerm = term;
        syncStickySearchValue(e.target.value);
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        if (clearSearchBtn) clearSearchBtn.classList.toggle('hidden', !term);

        // Show/hide suggestions (v4.4.0)
        if (term.length >= 1 && term.length < 50) {
            showSearchSuggestions(term, suggestionsContainer);
        } else {
            hideSearchSuggestions(suggestionsContainer);
        }

        // Clear previous debounce timer
        if (searchDebounceTimeout) {
            clearTimeout(searchDebounceTimeout);
        }

        // Debounced search execution
        searchDebounceTimeout = setTimeout(() => {
            applyFiltersAndSort();

            // Update results counter (v4.4.0)
            updateResultsCounter(term);
        }, SEARCH_DEBOUNCE_TIME);
    });

    // Record search history only on Enter key (submitted search)
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && currentSearchTerm && currentSearchTerm !== lastRecordedSearch) {
            addToSearchHistory(currentSearchTerm);
            lastRecordedSearch = currentSearchTerm;
        }
    });

    // Handle click on suggestion items (direct binding to container for reliability)
    suggestionsContainer.addEventListener('click', function handleSuggestionClick(e) {
        const item = e.target.closest('.search-suggestion-item');
        if (item) {
            e.stopPropagation();
            const toolId = item.dataset.toolId;
            if (toolId) {
                hideSearchSuggestions(suggestionsContainer);
                if (searchHistoryContainer) searchHistoryContainer.classList.remove('show');
                searchInput.blur();
                if (typeof window.showToolDetail === 'function') {
                    window.showToolDetail(parseInt(toolId));
                }
                return;
            }

            const searchText = item.dataset.searchText;
            if (searchText) {
                hideSearchSuggestions(suggestionsContainer);
                if (searchHistoryContainer) searchHistoryContainer.classList.remove('show');
                searchInput.value = searchText;
                currentSearchTerm = searchText.toLowerCase();
                syncStickySearchValue(searchText);
                addToSearchHistory(currentSearchTerm);
                lastRecordedSearch = currentSearchTerm;

                if (clearSearchBtn) clearSearchBtn.classList.toggle('hidden', !currentSearchTerm);

                if (searchDebounceTimeout) {
                    clearTimeout(searchDebounceTimeout);
                }
                searchDebounceTimeout = setTimeout(() => {
                    applyFiltersAndSort();
                    updateResultsCounter(currentSearchTerm);
                }, SEARCH_DEBOUNCE_TIME);

                searchInput.blur();
            }
        }
    });

    // Command/Ctrl + K Shortcut (v5.1.0 Modern Command Bar Style)
    document.addEventListener('keydown', function handleCmdK(e) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('mainSearch');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }
    });

    // Escape key to clear and blur search
    document.addEventListener('keydown', function handleEscapeSearch(e) {
        if (e.key === 'Escape') {
            const searchInput = document.getElementById('mainSearch');
            if (searchInput && document.activeElement === searchInput) {
                searchInput.value = '';
                currentSearchTerm = '';
                syncStickySearchValue('');
                searchInput.blur();
                hideSearchSuggestions(suggestionsContainer);
                if (searchHistoryContainer) searchHistoryContainer.classList.remove('show');
                const clearSearchBtn = document.getElementById('clearSearchBtn');
                if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
                applyFiltersAndSort();
            }
        }
    });

    // Handle click on search history items (event delegation)
    const historyContainer = document.getElementById('searchHistory');
    if (historyContainer) {
        historyContainer.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.search-history-delete');
            if (deleteBtn) {
                e.stopPropagation();
                const term = deleteBtn.dataset.deleteHistory;
                if (term) {
                    state.searchHistory = state.searchHistory.filter(h => h !== term);
                    localStorage.setItem('ai-tool-hub-search-history', JSON.stringify(state.searchHistory));
                    showSearchHistory();
                }
                return;
            }
            const clearAllBtn = e.target.closest('.search-history-clear-all');
            if (clearAllBtn) {
                e.stopPropagation();
                state.searchHistory = [];
                localStorage.setItem('ai-tool-hub-search-history', JSON.stringify(state.searchHistory));
                historyContainer.classList.remove('show');
                return;
            }
            const item = e.target.closest('.search-suggestion-item');
            if (item) {
                const searchText = item.dataset.searchText;
                if (searchText) {
                    setSearch(searchText);
                    historyContainer.classList.remove('show');
                }
            }
        });
    }

    // Hide suggestions and history when clicking outside the actual search wrapper
    const searchWrapper = searchInput.closest('.hero-search-wrapper, .search-container');
    document.addEventListener('click', (e) => {
        const clickedInsideSearch = searchWrapper?.contains(e.target)
            || suggestionsContainer.contains(e.target)
            || searchHistoryContainer?.contains(e.target);
        if (!clickedInsideSearch) {
            hideSearchSuggestions(suggestionsContainer);
            if (searchHistoryContainer) searchHistoryContainer.classList.remove('show');
        }
    });

    searchInput.addEventListener('focus', () => {
        // Show search history or suggestions
        if (state.searchHistory.length > 0 && !currentSearchTerm) {
            showSearchHistory();
        } else if (currentSearchTerm) {
            showSearchSuggestions(currentSearchTerm, suggestionsContainer);
        }
    });
}

/**
 * Show search suggestions based on input (v4.4.0)
 * @param {string} term - Search term
 * @param {HTMLElement} container - Suggestions container element
 */
function showSearchSuggestions(term, container) {
    if (!container || !term) return;

    // Generate suggestions from tool names and descriptions
    const suggestions = new Set();

    state.tools.forEach(tool => {
        // Match in name
        if (tool.name.toLowerCase().includes(term)) {
            suggestions.add({ text: tool.name, type: 'name', icon: tool.icon, id: tool.id });
        }
        // Match in description
        if (tool.desc.toLowerCase().includes(term)) {
            suggestions.add({ text: tool.name, type: 'desc', icon: tool.icon, id: tool.id });
        }
        // Match in tags
        if (tool.toolTags?.some(tag => tag.toLowerCase().includes(term))) {
            suggestions.add({ text: term, type: 'tag', icon: 'fa-tag' });
        }
    });

    // Limit to top 6 suggestions
    const topSuggestions = Array.from(suggestions).slice(0, 6);

    if (topSuggestions.length === 0) {
        hideSearchSuggestions(container);
        return;
    }

    container.innerHTML = topSuggestions.map(s => {
        const toolDetail = typeof s.id === 'number' ? state.tools.find(t => t.id === s.id) : null;
        const firstLetter = s.text && s.text.length > 0 ? s.text.charAt(0).toUpperCase() : '?';
        return `
        <div class="search-suggestion-item" tabindex="0" role="option" data-search-text="${escapeAttr(s.text)}" ${typeof s.id === 'number' ? `data-tool-id="${s.id}"` : ''}>
            <div class="search-suggestion-icon">${firstLetter}</div>
            <div class="search-suggestion-content">
                <div class="search-suggestion-title">${highlightText(escapeHtml(s.text), term)}</div>
                <div class="search-suggestion-subtitle">${toolDetail ? escapeHtml(toolDetail.desc).substring(0, 42) + '...' : (s.type === 'name' ? '按工具名称搜索' : s.type === 'desc' ? '按描述搜索' : '按标签搜索')}</div>
            </div>
            <span class="search-suggestion-badge">${s.type === 'name' ? '名称' : s.type === 'desc' ? '描述' : '标签'}</span>
        </div>
    `;}).join('');

    container.classList.add('show');
}

/**
 * Hide search suggestions (v4.4.0)
 * @param {HTMLElement} container - Suggestions container element
 */
function hideSearchSuggestions(container) {
    if (container) {
        container.classList.remove('show');
        setTimeout(() => { if (!container.classList.contains('show')) container.innerHTML = ''; }, 300);
    }
}

/**
 * Highlight matching text in string (v4.4.0)
 * @param {string} text - Original text
 * @param {string} searchTerm - Term to highlight
 * @returns {string} HTML with highlighted matches
 */
function highlightText(text, searchTerm) {
    if (!searchTerm || !text) return text;
    const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

/**
 * Escape special regex characters (v4.4.0)
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Update search results counter display (v4.4.0)
 * @param {string} searchTerm - Current search term
 */
function updateResultsCounter(searchTerm) {
    const counter = document.querySelector('.results-counter');
    if (!counter) return;

    const countNumber = counter.querySelector('.count-number');

    if (searchTerm) {
        // Count visible tools (this will be updated after renderTools completes)
        const toolsGrid = document.getElementById('toolsGrid');
        const visibleCount = toolsGrid?.children?.length || 0;

        if (countNumber) countNumber.textContent = visibleCount;
        counter.classList.remove('hidden');
    } else {
        counter.classList.add('hidden');
    }
}

/**
 * Set search input value and trigger search
 * @param {string} term - Search term to set
 */
function setSearch(term) {
    const searchInput = document.getElementById('mainSearch');
    if (!searchInput) return;
    searchInput.value = term;
    currentSearchTerm = term.trim().toLowerCase();
    const stickyInput = document.getElementById('stickySearchInput');
    if (stickyInput) stickyInput.value = term;
    const searchHistoryEl = document.getElementById('searchHistory');
    if (searchHistoryEl) searchHistoryEl.classList.remove('show');
    const suggestionsEl = document.getElementById('searchSuggestions');
    if (suggestionsEl) {
        suggestionsEl.classList.remove('show');
    }

    applyFiltersAndSort();
    updateResultsCounter(term);
}

/**
 * Clear search input and reset tool display
 */
function clearSearch() {
    const searchInput = document.getElementById('mainSearch');
    if (!searchInput) return;
    searchInput.value = '';
    currentSearchTerm = '';
    const stickyInput = document.getElementById('stickySearchInput');
    if (stickyInput) stickyInput.value = '';
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
    const searchHistoryEl = document.getElementById('searchHistory');
    if (searchHistoryEl) searchHistoryEl.classList.remove('show');
    const suggestionsEl = document.getElementById('searchSuggestions');
    if (suggestionsEl) suggestionsEl.classList.remove('show');
    applyFiltersAndSort();
    updateResultsCounter('');
}

/**
 * Toggle advanced filters panel visibility (v4.3.0)
 */
function toggleAdvancedFilters() {
    const container = document.querySelector('.advanced-filters');
    if (container) {
        container.classList.toggle('expanded');
    }
}

/**
 * Toggle a specific advanced filter option (v4.3.0)
 * @param {string} category - Filter category (price, origin, status)
 * @param {string} value - Filter value
 * @param {boolean} checked - Whether the filter is checked
 */
function toggleAdvancedFilter(category, value, checked) {
    // Guard against unknown categories
    if (!state.advancedFilters[category]) return;
    if (checked) {
        if (!state.advancedFilters[category].includes(value)) {
            state.advancedFilters[category].push(value);
        }
    } else {
        state.advancedFilters[category] = state.advancedFilters[category].filter(v => v !== value);
    }

    // Apply filters immediately
    applyFiltersAndSort();

    // Show toast with active filter count
    const totalActive = state.advancedFilters.price.length + state.advancedFilters.origin.length + state.advancedFilters.status.length;
    if (totalActive > 0) {
        showToast(`已启用 ${totalActive} 个筛选条件`);
    }
}

/**
 * Clear all advanced filters and reset display (v4.3.0)
 */
function clearAllFilters() {
    state.advancedFilters.price = [];
    state.advancedFilters.origin = [];
    state.advancedFilters.status = [];

    // Uncheck all checkboxes
    document.querySelectorAll('.advanced-filters input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    // Re-apply filters
    applyFiltersAndSort();

    showToast('已清除所有筛选条件');
}

/**
 * Update filter breadcrumb (v6.3)
 */
function updateBreadcrumb(category) {
    var container = document.getElementById('breadcrumbBar');
    if (!container) return;
    if (category === 'all') {
        container.style.display = 'none';
        return;
    }
    var cat = state.categories.find(function(c) { return c.id === category; });
    if (!cat) return;
    container.innerHTML = '<i class="fas fa-filter" style="font-size:11px;"></i> 当前筛选：<span class="breadcrumb-tag">' + (cat.icon ? '<i class="fas ' + cat.icon + '"></i> ' : '') + cat.name + ' <button class="breadcrumb-clear" data-action="filter-category" data-category="all" aria-label="清除筛选"><i class="fas fa-times"></i></button></span>';
    container.style.display = 'flex';
}

/**
 * Sync sticky search with main search (v6.3)
 */
function setupStickySearch() {
    const mainInput = document.getElementById('mainSearch');
    const stickyInput = document.getElementById('stickySearchInput');
    if (!mainInput || !stickyInput) return;

    const syncFromMain = () => {
        if (stickyInput.value !== mainInput.value) stickyInput.value = mainInput.value;
    };

    stickyInput.value = mainInput.value;
    mainInput.addEventListener('input', syncFromMain);
    stickyInput.addEventListener('input', () => {
        if (mainInput.value === stickyInput.value) return;
        mainInput.value = stickyInput.value;
        mainInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const clearBtn = document.getElementById('stickySearchClear');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            stickyInput.value = '';
            mainInput.value = '';
            mainInput.dispatchEvent(new Event('input', { bubbles: true }));
            stickyInput.focus();
        });
    }

    // Show sticky search on scroll past hero
    const heroSection = document.getElementById('heroSection');
    if (!heroSection) return;
    const stickyBar = document.getElementById('stickySearch');
    if (!stickyBar) return;

    window.addEventListener('scroll', () => {
        const heroBottom = heroSection.offsetTop + heroSection.offsetHeight;
        const shouldShow = window.scrollY > heroBottom - 80;
        stickyBar.style.display = shouldShow ? 'block' : 'none';
        if (shouldShow && document.activeElement === mainInput) {
            stickyInput.focus();
        }
    }, { passive: true });
}


// Export functions
// Import renderTools for local use (filter functions call renderTools internally)
import { renderTools } from './renderer.js';

// Re-export render functions from dedicated module
export { createToolCard, renderCategories, renderHotTools, renderStatisticsDashboard, renderTools } from './renderer.js';

// Filter, sort, and search functions (defined below)
export { filterCategory, loadSavedFilters, setSearch, clearSearch, setupSearch, sortTools, setCurrentSort, applyAdvancedFilters, applyFiltersAndSort, toggleAdvancedFilters, toggleAdvancedFilter, clearAllFilters, highlightText, escapeRegex, updateBreadcrumb, setupStickySearch };
