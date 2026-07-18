/**
 * PDF Generator Module
 * Uses html2pdf.js for client-side PDF generation
 */

import { showNotification } from './utils.js';
import { store } from './store.js';

class PDFGenerator {
    constructor() {
        this.options = {
            margin: 10,
            filename: '简历.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait'
            }
        };
    }

    async generate() {
        const element = document.getElementById('resumePreview');
        if (!element) {
            return;
        }

        const btn = document.getElementById('downloadPdfBtn');
        const originalText = btn ? btn.innerHTML : '';

        try {
            if (btn) {
                btn.innerHTML = '<span class="loading-spinner mr-2"></span>生成中...';
                btn.disabled = true;
            }

            let clone = element.cloneNode(true);
            clone.style.width = '210mm';
            clone.style.minHeight = '297mm';
            clone.style.padding = '20mm';
            clone.style.background = 'white';

            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            document.body.appendChild(clone);

            const worker = html2pdf()
                .set(this.options)
                .from(clone);

            const timestamp = new Date().toISOString().slice(0, 10);
            this.options.filename = `简历_${store.getState().profile.name || '未命名'}_${timestamp}.pdf`;

            await worker.save();

            showNotification('PDF 导出成功！', 'success');
        } catch (error) {
            showNotification('PDF 导出失败，请重试', 'error');
        } finally {
            const clone = document.body.querySelector('[style*="left: -9999px"][style*="210mm"]');
            if (clone && clone.parentNode) {
                clone.parentNode.removeChild(clone);
            }

            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    }

    async generateBlob() {
        const element = document.getElementById('resumePreview');
        if (!element) {
            return null;
        }

        try {
            let clone = element.cloneNode(true);
            clone.style.width = '210mm';
            clone.style.minHeight = '297mm';
            clone.style.padding = '20mm';
            clone.style.background = 'white';
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            document.body.appendChild(clone);

            const worker = html2pdf()
                .set({ ...this.options })
                .from(clone);

            const blob = await worker.outputPdf('blob');

            if (clone.parentNode) {
                clone.parentNode.removeChild(clone);
            }

            return blob;
        } catch (error) {
            const clone = document.body.querySelector('[style*="left: -9999px"][style*="210mm"]');
            if (clone && clone.parentNode) {
                clone.parentNode.removeChild(clone);
            }
            showNotification('PDF 生成失败，请重试', 'error');
            return null;
        }
    }

    preview() {
        const element = document.getElementById('resumePreview');
        if (!element) return;

        const printWindow = window.open('', '_blank', 'noopener,noreferrer');
        if (!printWindow) {
            showNotification('无法打开预览窗口，请允许弹出窗口', 'error');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>简历预览</title>
                <style>
                    body { margin: 0; padding: 20mm; background: white; }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body></body>
            </html>
        `);
        printWindow.document.close();

        const clone = element.cloneNode(true);
        printWindow.document.body.appendChild(clone);
        printWindow.print();
    }
}

// 创建全局实例
const pdfGenerator = new PDFGenerator();

document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="exportPdf"]');
    if (btn) {
        pdfGenerator.generate();
    }
});

export { PDFGenerator, pdfGenerator };
window.pdfGenerator = pdfGenerator;
