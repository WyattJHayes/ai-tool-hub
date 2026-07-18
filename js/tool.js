// Import state and functions
import state, { toggleFavorite, recordToolClick, getToolClickCount, setToolRating, getToolRating, PLATFORM_ICONS } from './state.js';
import { renderTools } from './ui.js';
import { showToast, isValidUrl, escapeHtml, escapeAttr } from './utils.js';
import { generateTagsHtml, generateStatusBadgeHtml, RATING_LABELS } from './renderer.js';

/**
 * Open tool URL in new tab with security validation
 * @param {number} id - Tool ID
 * @param {string} url - Tool URL to open
 * @param {Event} event - Click event object
 */
function openTool(id, url, event) {
    event.stopPropagation();

    if (url.startsWith('#')) {
        recordToolClick(id);
        if (url === '#research' && typeof window.showResearchPage === 'function') {
            window.showResearchPage();
        }
        return;
    }

    if (!isValidUrl(url)) {
        showToast('无效的工具链接');
        return;
    }

    recordToolClick(id);
    window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Toggle tool favorite status (delegates to state module)
 * @param {number} id - Tool ID to toggle
 * @param {Event} event - Click event object
 */
function handleToggleFavorite(id, event) {
    event.stopPropagation();
    const isNowFavorite = toggleFavorite(id);

    if (isNowFavorite) {
        showToast('已收藏');
    } else {
        showToast('已取消收藏');
    }

    renderTools(state.tools);

    const modal = document.getElementById('toolDetailModal');
    if (modal && modal.classList.contains('active')) {
        const favBtn = modal.querySelector('.detail-favorite-btn');
        if (favBtn) {
            favBtn.classList.toggle('active', isNowFavorite);
            favBtn.innerHTML = `<i class="fas fa-star"></i> ${isNowFavorite ? '已收藏' : '收藏'}`;
        }
    }
}

/**
 * Show tool detail modal with comprehensive information.
 * Uses event delegation on the modal container so listeners
 * are registered once (at module init) instead of each open.
 * @param {number} id - Tool ID to show details for
 */
function showToolDetail(id) {
    const tool = state.tools.find(t => t.id === id);
    if (!tool) return;

    recordToolClick(id);

    const categoryName = state.categories.find(c => c.id === tool.category)?.name || '';
    const favorite = state.favorites.includes(tool.id);
    const clickCount = getToolClickCount(tool.id);
    const tagsHtml = generateTagsHtml(tool);

    const platformBadges = tool.platform?.map(p =>
        `<span class="platform-badge"><i class="fas ${PLATFORM_ICONS[p] || 'fa-cog'}"></i> ${escapeHtml(p)}</span>`
    ).join('') || '';

    const difficultyLabels = { beginner: '入门级', intermediate: '进阶级', advanced: '高级' };
    const difficultyDisplay = tool.difficulty ? difficultyLabels[tool.difficulty] : '';
    const statusBadge = generateStatusBadgeHtml(tool.status);

    const relatedTools = state.tools
        .filter(t => t.category === tool.category && t.id !== tool.id)
        .slice(0, 3);
    const relatedToolsHtml = relatedTools.map(t => `
        <div class="related-tool-item" data-tool-id="${t.id}">
            <i class="fas ${escapeAttr(t.icon)}"></i>
            <span>${escapeHtml(t.name)}</span>
        </div>
    `).join('');

    const modal = document.getElementById('toolDetailModal');
    if (!modal) return;

    // Store current tool id on modal for delegation handlers
    modal.dataset.currentToolId = tool.id;
    modal.dataset.currentToolUrl = tool.url;

    const safeSetText = (selector, text) => {
        const el = modal.querySelector(selector);
        if (el) el.textContent = text;
    };
    const safeSetHTML = (selector, html) => {
        const el = modal.querySelector(selector);
        if (el) el.innerHTML = html;
    };
    const safeSetHref = (selector, href) => {
        const el = modal.querySelector(selector);
        if (el) el.href = href;
    };

    safeSetHTML('.detail-header-icon', `<i class="fas ${escapeAttr(tool.icon)}"></i>`);
    safeSetText('.detail-title', tool.name);
    safeSetText('.detail-desc', tool.desc);
    safeSetText('.detail-category', categoryName);
    safeSetHTML('.detail-tags', tagsHtml + statusBadge);
    safeSetHTML('.detail-platform', platformBadges);
    safeSetText('.detail-difficulty', difficultyDisplay);
    safeSetText('.detail-update-time', tool.updateTime || '未知');
    safeSetHref('.detail-open-btn', tool.url);
    safeSetText('.detail-click-count', clickCount);

    // Update favorite btn (no listener — handled by delegation)
    const favBtn = modal.querySelector('.detail-favorite-btn');
    if (favBtn) {
        favBtn.classList.toggle('active', favorite);
        favBtn.innerHTML = `<i class="fas fa-star"></i> ${favorite ? '已收藏' : '收藏'}`;
    }

    const starRating = modal.querySelector('#toolStarRating');
    const ratingText = modal.querySelector('#ratingText');
    if (starRating && ratingText) {
        starRating.dataset.toolId = tool.id;
        const currentRating = getToolRating(tool.id);
        updateStarDisplay(starRating, currentRating);
        ratingText.textContent = currentRating > 0 ? (RATING_LABELS[currentRating] || `${currentRating}星`) : '点击评分';
    }

    const relatedList = modal.querySelector('.related-tools-list');
    if (relatedList) {
        relatedList.innerHTML = relatedToolsHtml || '<p class="text-muted">暂无相关工具</p>';
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * Close tool detail modal
 */
function closeToolDetail() {
    const modal = document.getElementById('toolDetailModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) backdrop.remove();
}

/**
 * Rate a tool (v4.4.0)
 * @param {number} rating - Rating value (1-5)
 */
function rateTool(rating) {
    const starRating = document.querySelector('#toolStarRating');
    if (!starRating) return;

    const toolId = parseInt(starRating.dataset.toolId);
    if (!toolId) return;

    setToolRating(toolId, rating);
    updateStarDisplay(starRating, rating);

    const ratingText = document.querySelector('#ratingText');
    if (ratingText) {
        ratingText.textContent = RATING_LABELS[rating] || `${rating}星`;
    }

    showToast(`已评分 ${rating} 星 ⭐`);
}

/**
 * Update star rating display (v4.4.0)
 * @param {HTMLElement} container - Star rating container element
 * @param {number} rating - Current rating value (1-5)
 */
function updateStarDisplay(container, rating) {
    if (!container) return;
    const stars = container.querySelectorAll('.star-btn');
    stars.forEach((star, index) => {
        star.classList.toggle('active', index < rating);
    });
}

// ── Module init: attach event delegation on modal once ────────────────────
function setupModalDelegation() {
    const modal = document.getElementById('toolDetailModal');
    if (!modal) return;

    modal.addEventListener('click', (e) => {
        const target = e.target.closest('.detail-favorite-btn, .detail-open-btn, .modal-close-btn');
        if (!target) return;

        if (target.classList.contains('detail-favorite-btn')) {
            const toolId = parseInt(modal.dataset.currentToolId);
            if (toolId) handleToggleFavorite(toolId, e);
            return;
        }

        if (target.classList.contains('detail-open-btn')) {
            const toolId = parseInt(modal.dataset.currentToolId);
            if (toolId) openTool(toolId, modal.dataset.currentToolUrl, e);
            return;
        }

        if (target.classList.contains('modal-close-btn')) {
            e.stopPropagation();
            closeToolDetail();
        }
    });
}

// Safe to call before DOM ready — listener attaches when element exists.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupModalDelegation);
} else {
    setupModalDelegation();
}

export { openTool, handleToggleFavorite as toggleFavorite, showToolDetail, closeToolDetail, rateTool };
