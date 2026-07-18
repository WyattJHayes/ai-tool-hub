/**
 * 社交分享工具库
 * 提供简历分享到社交媒体和生成分享链接的功能
 */

import { pdfGenerator } from './pdfGenerator.js';
import { store } from './store.js';
import { showNotification } from './utils.js';

class ShareUtils {
    constructor() {
        this.baseUrl = 'https://ai-tool-hub.github.io/tools/resume-optimizer/';
        this.shareData = null;
    }

    // 初始化分享数据
    initShareData(resumeData) {
        this.shareData = {
            title: '我的AI优化简历',
            description: this.generateShareDescription(resumeData),
            url: this.baseUrl,
            image: this.generateShareImage(resumeData)
        };
    }

    // 生成分享描述
    generateShareDescription(resumeData) {
        const name = resumeData.profile?.name || '匿名用户';
        const title = resumeData.profile?.title || '求职者';
        const skills = resumeData.skills?.slice(0, 3).join('、') || '专业技能';

        return `${name} 使用AI简历优化工具创建的${title}简历，擅长${skills}。快来优化你的简历吧！`;
    }

    // 生成分享图片（占位符）
    generateShareImage(resumeData) {
        // 实际应用中，这里可以生成简历缩略图或使用默认图片
        return 'https://ai-tool-hub.github.io/assets/resume-share-default.png';
    }

    // 分享到LinkedIn
    shareToLinkedIn() {
        if (!this.shareData) {
            this.initShareData(store.getState());
        }

        const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(this.shareData.url)}&title=${encodeURIComponent(this.shareData.title)}&summary=${encodeURIComponent(this.shareData.description)}`;

        this.openShareWindow(linkedinUrl, 'LinkedIn分享', 600, 400);
        this.logShareEvent('linkedin');
    }

    // 分享到微信
    shareToWechat() {
        if (!this.shareData) {
            this.initShareData(store.getState());
        }

        // 在微信中，显示提示让用户手动分享
        this.showWechatShareGuide();
        this.logShareEvent('wechat');
    }

    // 显示微信分享引导
    showWechatShareGuide() {
        const guide = document.createElement('div');
        guide.id = 'wechatShareGuide';
        guide.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4';
        guide.innerHTML = `
            <div class="bg-gray-800 rounded-xl max-w-sm w-full p-6 border border-gray-700">
                <div class="text-center mb-4">
                    <i class="fab fa-weixin text-4xl text-green-400 mb-2"></i>
                    <h3 class="text-lg font-bold">微信分享</h3>
                </div>
                <div class="space-y-3">
                    <p class="text-gray-300 text-sm">1. 点击右上角"•••"菜单</p>
                    <p class="text-gray-300 text-sm">2. 选择"发送给朋友"或"分享到朋友圈"</p>
                    <p class="text-gray-300 text-sm">3. 选择要分享的好友或群聊</p>
                </div>
                <div class="flex gap-3 mt-6">
                    <button onclick="document.getElementById('wechatShareGuide').remove()" class="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors">
                        知道了
                    </button>
                    <button onclick="copyShareLink()" class="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors">
                        复制链接
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(guide);
    }

    // 分享到Twitter
    shareToTwitter() {
        if (!this.shareData) {
            this.initShareData(store.getState());
        }

        const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(this.shareData.url)}&text=${encodeURIComponent(this.shareData.description)}&hashtags=AI简历优化,求职工具`;

        this.openShareWindow(twitterUrl, 'Twitter分享', 600, 400);
        this.logShareEvent('twitter');
    }

    // 复制分享链接
    copyShareLink() {
        if (!this.shareData) {
            this.initShareData(store.getState());
        }

        const shareText = `${this.shareData.title}\n${this.shareData.description}\n\n${this.shareData.url}`;

        navigator.clipboard.writeText(shareText)
            .then(() => {
                showNotification('分享链接已复制到剪贴板', 'success');
                this.logShareEvent('copy_link');
            })
            .catch(err => {
                showNotification('复制失败，请手动复制链接', 'error');
            });
    }

    sharePDF() {
        pdfGenerator.generateBlob().then(pdfBlob => {
            if (!pdfBlob) {
                showNotification('PDF生成失败，请重试', 'error');
                return;
            }
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `AI优化简历_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showNotification('PDF已生成，可以分享给他人', 'success');
            this.logShareEvent('pdf_download');
        }).catch(error => {
            showNotification('PDF生成失败，请重试', 'error');
        });
    }

    // 生成简历二维码
    generateQRCode() {
        // 简单实现，实际可以使用QR库
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(this.shareData.url)}`;
        return qrUrl;
    }

    // 打开分享窗口
    openShareWindow(url, title, width = 600, height = 400) {
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;

        window.open(url, title, `width=${width},height=${height},top=${top},left=${left},toolbar=0,location=0,menubar=0,resizable=1,scrollbars=1`);
    }

    // 记录分享事件
    logShareEvent(platform) {
        const shareLog = JSON.parse(localStorage.getItem('shareLogs') || '[]');
        shareLog.push({
            platform,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('shareLogs', JSON.stringify(shareLog.slice(-50)));
    }

    // 获取分享统计数据
    getShareStats() {
        const shareLog = JSON.parse(localStorage.getItem('shareLogs') || '[]');
        const stats = {};

        shareLog.forEach(log => {
            stats[log.platform] = (stats[log.platform] || 0) + 1;
        });

        return {
            totalShares: shareLog.length,
            platformStats: stats,
            lastShare: shareLog[shareLog.length - 1]
        };
    }
}

// 创建全局实例
const shareUtils = new ShareUtils();

// 导出全局函数
window.shareToLinkedIn = () => shareUtils.shareToLinkedIn();
window.shareToWechat = () => shareUtils.shareToWechat();
window.shareToTwitter = () => shareUtils.shareToTwitter();
window.copyShareLink = () => shareUtils.copyShareLink();
window.sharePDF = () => shareUtils.sharePDF();

export { shareUtils, ShareUtils };
