/**
 * share.js 测试文件
 * Tests shareToWeChat, shareToQQ, copyShareLink
 */
import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// We need to mock showToast before importing share.js
// Since showToast is imported from utils.js, we mock the module
jest.unstable_mockModule('../../js/utils.js', () => ({
    showToast: jest.fn()
}));

const { showToast } = await import('../../js/utils.js');
const { shareToWeChat, shareToQQ, copyShareLink, showShareModal, closeShareModal } = await import('../../js/share.js');

beforeEach(() => {
    jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// shareToWeChat
// ---------------------------------------------------------------------------

describe('shareToWeChat', () => {
    test('should show toast with WeChat message', () => {
        shareToWeChat();
        expect(showToast).toHaveBeenCalledWith('请截图分享到微信');
    });
});

// ---------------------------------------------------------------------------
// shareToQQ
// ---------------------------------------------------------------------------

describe('shareToQQ', () => {
    beforeEach(() => {
        // window.location.href is set by jsdom
        window.open = jest.fn();
    });

    test('should open QQ share URL with current page URL', () => {
        window.history.replaceState({}, '', '/');
        
        shareToQQ();

        expect(window.open).toHaveBeenCalledWith(
            expect.stringContaining('connect.qq.com/widget/shareqq/index.html'),
            '_blank',
            'noopener,noreferrer'
        );
        expect(window.open).toHaveBeenCalledWith(
            expect.stringContaining(encodeURIComponent('https://weihub.cloud/')),
            '_blank',
            'noopener,noreferrer'
        );
    });
});

// ---------------------------------------------------------------------------
// copyShareLink
// ---------------------------------------------------------------------------

describe('copyShareLink', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/tools');
    });

    test('should copy current URL to clipboard on success', async () => {
        const writeTextMock = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: writeTextMock },
            writable: true,
            configurable: true
        });

        await copyShareLink();

        // Give the promise chain time to resolve
        await new Promise(r => setTimeout(r, 10));

        expect(writeTextMock).toHaveBeenCalledWith('https://weihub.cloud/tools');
        expect(showToast).toHaveBeenCalledWith('链接已复制');
    });

    test('should show error toast on clipboard failure', async () => {
        const writeTextMock = jest.fn().mockRejectedValue(new Error('Permission denied'));
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: writeTextMock },
            writable: true,
            configurable: true
        });

        // copyShareLink uses .catch() which catches the rejection
        await copyShareLink();

        await new Promise(r => setTimeout(r, 10));

        expect(showToast).toHaveBeenCalledWith('复制链接失败，请手动复制');
    });
});

// ---------------------------------------------------------------------------
// showShareModal / closeShareModal
// ---------------------------------------------------------------------------

describe('share modal DOM', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="shareModal" class="modal">
                <div class="share-close-btn">X</div>
            </div>
        `;
    });

    test('showShareModal should add active class', () => {
        showShareModal();
        const modal = document.getElementById('shareModal');
        expect(modal.classList.contains('active')).toBe(true);
    });

    test('closeShareModal without event should remove active class', () => {
        const modal = document.getElementById('shareModal');
        modal.classList.add('active');
        closeShareModal();
        expect(modal.classList.contains('active')).toBe(false);
    });

    test('closeShareModal should close when clicking modal backdrop', () => {
        const modal = document.getElementById('shareModal');
        modal.classList.add('active');
        
        // Simulate clicking the modal backdrop
        closeShareModal({ target: modal });
        expect(modal.classList.contains('active')).toBe(false);
    });

    test('closeShareModal should close when clicking close button', () => {
        const modal = document.getElementById('shareModal');
        modal.classList.add('active');

        // Simulate clicking the close button inside the modal
        const closeBtn = modal.querySelector('.share-close-btn');
        closeShareModal({ target: closeBtn });
        // The function checks event.target.closest('.share-close-btn')
        // Since closeBtn IS the .share-close-btn, this should close
        expect(modal.classList.contains('active')).toBe(false);
    });

    test('closeShareModal should NOT close when clicking modal interior (not backdrop, not close-btn)', () => {
        const modal = document.getElementById('shareModal');
        modal.classList.add('active');

        // Simulate clicking some inner content
        const innerContent = document.createElement('div');
        innerContent.className = 'share-content';
        modal.appendChild(innerContent);
        
        closeShareModal({ target: innerContent });
        // click on inner content (not modal backdrop, not .share-close-btn) → should NOT close
        expect(modal.classList.contains('active')).toBe(true);
    });

    test('closeShareModal should do nothing if modal is missing', () => {
        document.body.innerHTML = '';
        // Should not throw
        closeShareModal({ target: document.body });
    });
});



// ---------------------------------------------------------------------------
// generateShareImage
// ---------------------------------------------------------------------------

describe('generateShareImage', () => {
    let generateShareImage;
    let mockCanvas;

    beforeAll(async () => {
        const shareModule = await import('../../js/share.js');
        generateShareImage = shareModule.generateShareImage;
    });

    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
        showToast.mockClear();

        // Mock html2canvas so loadHtml2Canvas takes the fast path
        mockCanvas = {
            toDataURL: jest.fn(() => 'data:image/png;base64,fake')
        };
        window.html2canvas = jest.fn().mockResolvedValue(mockCanvas);

        // Spy on createElement just for anchor download verification
        // Use the original reference wrapped to avoid recursion
        const origCreateElement = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation((tag) => {
            if (tag === 'a') {
                const el = origCreateElement(tag);
                jest.spyOn(el, 'click').mockImplementation(jest.fn());
                return el;
            }
            return origCreateElement(tag);
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        window.html2canvas = undefined;
    });

    test('should show generating toast', async () => {
        await generateShareImage();
        expect(showToast).toHaveBeenCalledWith('正在生成分享图片...');
    });

    test('should render card and trigger download on success', async () => {
        await generateShareImage();

        expect(window.html2canvas).toHaveBeenCalledTimes(1);
        expect(showToast).toHaveBeenCalledWith('分享图片已生成');
    });

    test('should call html2canvas with correct options', async () => {
        await generateShareImage();

        const [, options] = window.html2canvas.mock.calls[0];
        expect(options.scale).toBe(2);
        expect(options.backgroundColor).toBeNull();
    });

    test('should show error toast on html2canvas failure', async () => {
        window.html2canvas = jest.fn().mockRejectedValue(new Error('Rendering failed'));

        await generateShareImage();

        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Rendering failed'));
    });

    test('should clean up share card from DOM after generation', async () => {
        await generateShareImage();

        // The share card (offscreen div) should be removed
        const offscreenDivs = document.body.querySelectorAll('div[style*="-9999"]');
        expect(offscreenDivs.length).toBe(0);
    });

    test('should use custom tool count from global variable', async () => {
        window.__AI_TOOL_HUB_COUNT__ = '200+';
        await generateShareImage();
        expect(window.html2canvas).toHaveBeenCalled();
    });
});
