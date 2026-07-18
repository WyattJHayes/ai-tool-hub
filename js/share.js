import { showToast } from './utils.js';

function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
        if (window.html2canvas) {
            resolve(window.html2canvas);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.crossOrigin = 'anonymous';
        script.onload = () => resolve(window.html2canvas);
        script.onerror = () => reject(new Error('html2canvas 加载失败'));
        document.head.appendChild(script);
    });
}

/**
 * Display the share modal dialog
 */
function showShareModal() {
    document.getElementById('shareModal').classList.add('active');
}

/**
 * Close the share modal dialog
 * @param {Event} [event] - Click event (optional)
 */
function closeShareModal(event) {
    const modal = document.getElementById('shareModal');
    if (!modal) return;
    if (!event || event.target === modal || event.target.closest('.modal-close-btn, .share-close-btn')) {
        modal.classList.remove('active');
    }
}

/**
 * Share to WeChat (shows prompt to screenshot)
 */
function shareToWeChat() {
    showToast('请截图分享到微信');
}

/**
 * Share to QQ using QQ share API
 */
function shareToQQ() {
    const url = `https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(window.location.href)}&title=AI%20Tool%20Hub`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Copy current page URL to clipboard
 * Uses Clipboard API with fallback error handling
 */
function copyShareLink() {
    navigator.clipboard.writeText(window.location.href)
        .then(() => showToast('链接已复制'))
        .catch(() => {
            showToast('复制链接失败，请手动复制');
        });
}

/**
 * Generate a shareable image of the tool hub card
 * Uses html2canvas library to capture DOM element as image
 * @async
 */
async function generateShareImage() {
    const rawCount = window.__AI_TOOL_HUB_COUNT__;
    const toolCount = (typeof rawCount === 'number') ? rawCount : '80+';

    const shareCard = document.createElement('div');
    shareCard.innerHTML = `
        <div style="width: 375px; padding: 30px; background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%); border-radius: 20px; font-family: Inter, sans-serif; color: white;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
                <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #6366f1, #a855f7); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 28px;">🤖</span>
                </div>
                <div>
                    <div style="font-size: 24px; font-weight: bold; background: linear-gradient(135deg, #6366f1, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">AI Tool Hub</div>
                    <div style="font-size: 14px; color: #9ca3af;">一站式AI工具导航平台</div>
                </div>
            </div>
            <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 16px; padding: 20px; margin-bottom: 20px;">
                <div style="font-size: 20px; font-weight: bold; margin-bottom: 8px;">${toolCount} 优质AI工具</div>
                <div style="font-size: 14px; color: #9ca3af; line-height: 1.6;">涵盖写作、绘画、代码、视频、语音、设计、办公等领域</div>
            </div>
            <div style="display: flex; gap: 8px; margin-bottom: 20px;">
                <span style="padding: 6px 12px; background: rgba(34, 197, 94, 0.2); color: #4ade80; border-radius: 20px; font-size: 12px;">免费访问</span>
                <span style="padding: 6px 12px; background: rgba(99, 102, 241, 0.2); color: #818cf8; border-radius: 20px; font-size: 12px;">新版</span>
            </div>
            <div style="text-align: center; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">扫描二维码访问</div>
                <div style="width: 80px; height: 80px; background: white; margin: 0 auto; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #0a0a0f; font-size: 10px;">扫码访问</div>
            </div>
        </div>
    `;
    shareCard.style.position = 'fixed';
    shareCard.style.left = '-9999px';
    document.body.appendChild(shareCard);
    
    try {
        showToast('正在生成分享图片...');

        const html2canvas = await loadHtml2Canvas();
        const canvas = await html2canvas(shareCard.firstElementChild, {
            backgroundColor: null,
            scale: 2
        });
        
        const link = document.createElement('a');
        link.download = 'AI-Tool-Hub-分享.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        showToast('分享图片已生成');
    } catch (error) {
        showToast(`生成图片失败: ${error.message}`);
    } finally {
        document.body.removeChild(shareCard);
    }
}

// Export functions
export { showShareModal, closeShareModal, shareToWeChat, shareToQQ, copyShareLink, generateShareImage };
