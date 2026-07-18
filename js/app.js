/* global __APP_VERSION__ */

// Import functions
import { showToast, escapeHtml } from './utils.js';
import state, { updateData } from './state.js';
import { renderCategories, renderHotTools, renderStatisticsDashboard, renderTools } from './ui.js';
import { setupCard3DEffect, setupStatsAnimations } from './renderer.js';

function getToolsDataUrl() {
    const baseUrl = import.meta.env?.BASE_URL || './';
    const version = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
    return `${baseUrl}tools.json?v=${encodeURIComponent(version)}`;
}

// Load Tools
async function loadTools() {
    try {
        const response = await fetch(getToolsDataUrl());

        if (!response.ok) {
            throw new Error(`网络请求失败: ${response.status}`);
        }

        const contentType = response.headers?.get?.('content-type') || '';
        if (contentType.includes('text/html')) {
            throw new Error('工具数据响应格式不正确');
        }
        
        const data = await response.json();
        
        if (!data || !Array.isArray(data.tools) || !Array.isArray(data.categories)) {
            throw new Error('工具数据结构不正确');
        }
        
        // Update global tool count for share image

        // Update "上新 N 款" badge — count tools with 'new' tag
        const newToolsCount = data.tools.filter(t => t.tags?.includes('new')).length;
        const newToolsEl = document.getElementById('newToolsCount');
        if (newToolsEl) {
            newToolsEl.textContent = newToolsCount;
            const badge = newToolsEl.closest('.new-tools-badge');
            if (badge) {
                badge.style.display = newToolsCount > 0 ? '' : 'none';
            }
        }
        window.__AI_TOOL_HUB_COUNT__ = data.tools.length;

        // Update global state
        updateData(data.tools, data.categories);
        
        // Render UI using imported functions
        renderCategories();
        renderHotTools();
        renderStatisticsDashboard();
        renderTools(state.tools);
        
        // Setup interactive effects
        setupCard3DEffect();
        setupStatsAnimations();
        
        // Hide loading state
        const loadingState = document.getElementById('loadingState');
        if (loadingState) {
            loadingState.classList.add('hidden');
        }

        // Notify dependent modules that tools are ready
        // Hide skeletons, show real grids
        const hotSkel = document.getElementById('hotSkeleton');
        if (hotSkel) hotSkel.style.display = 'none';
        const hotGrid = document.getElementById('hotToolsGrid');
        if (hotGrid) hotGrid.style.display = '';
        const toolsSkel = document.getElementById('toolsSkeleton');
        if (toolsSkel) toolsSkel.style.display = 'none';
        const toolsGrid = document.getElementById('toolsGrid');
        if (toolsGrid) toolsGrid.style.display = '';
        document.dispatchEvent(new CustomEvent('tools:loaded'));
    } catch (error) {
        showToast(`加载失败: ${error.message}`);
        
        const loadingState = document.getElementById('loadingState');
        if (loadingState) {
            loadingState.innerHTML = `
                <div style="text-align:center;padding:40px;">
                    <p style="font-size:2rem;margin-bottom:16px;color:var(--neon-blue);">⚠️</p>
                    <p style="font-size:18px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">加载失败</p>
                    <p style="color:var(--text-secondary);margin-bottom:16px;">${escapeHtml(error.message)}</p>
                    <button id="retryLoadBtn" style="padding:10px 28px;border:none;border-radius:8px;background:linear-gradient(135deg,var(--neon-blue),var(--neon-purple));color:white;font-size:14px;cursor:pointer;font-weight:500;">重试</button>
                </div>
            `;
            const retryBtn = document.getElementById('retryLoadBtn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => loadTools());
            }
        }
    }
}

// Export functions
export { loadTools };
