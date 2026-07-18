/**
 * 简历文本提取工具
 * 支持PDF、DOCX、HTML、Markdown格式的文本提取与净化
 */
import CONFIG from './resumeConfig.js';

/**
 * HTML内容净化 - 移除危险标签和属性，防止XSS攻击
 */
export function sanitizeHtml(html) {
    if (!html || typeof html !== 'string') {
        return '';
    }

    const ALLOWED_TAGS = new Set([
        'p', 'br', 'b', 'strong', 'i', 'em', 'u', 'span', 'div',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
        'a', 'hr', 'blockquote', 'pre', 'code'
    ]);

    const ALLOWED_ATTRS = new Set(['href', 'target', 'rel', 'class']);

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);

        const toRemove = [];
        let node;
        while ((node = walker.nextNode())) {
            if (!ALLOWED_TAGS.has(node.tagName.toLowerCase())) {
                toRemove.push(node);
            } else {
                for (const attr of [...node.attributes]) {
                    if (!ALLOWED_ATTRS.has(attr.name.toLowerCase())) {
                        node.removeAttribute(attr.name);
                    }
                    if (attr.value && /^\s*(javascript|data|vbscript):/i.test(attr.value.trim())) {
                        node.removeAttribute(attr.name);
                    }
                }
            }
        }

        for (const el of toRemove) {
            const parent = el.parentNode;
            if (parent) {
                while (el.firstChild) {
                    parent.insertBefore(el.firstChild, el);
                }
                parent.removeChild(el);
            }
        }

        const aTags = doc.body.querySelectorAll('a');
        aTags.forEach(a => {
            a.setAttribute('rel', 'noopener noreferrer');
            a.setAttribute('target', '_blank');
        });

        return doc.body.innerHTML;
    } catch {
        const tempDiv = document.createElement('div');
        tempDiv.textContent = html;
        return tempDiv.innerHTML;
    }
}

/**
 * 从HTML提取文本（先净化再提取）
 */
export function extractTextFromHTML(html) {
    const sanitizedHtml = sanitizeHtml(html);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = sanitizedHtml;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    tempDiv.remove();
    return text;
}

/**
 * 从Markdown提取文本（移除标记保留纯文本）
 */
export function extractTextFromMarkdown(markdown) {
    let text = markdown
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/_(.*?)_/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/^>\s+/gm, '')
        .replace(/^[\*\-\+]\s+/gm, '')
        .replace(/^\d+\.\s+/gm, '')
        .replace(/^[-*_]{3,}$/gm, '')
        .replace(/\n{3,}/g, '\n\n');
    return text.trim();
}

/**
 * 从PDF提取文本（使用pdf.js库）
 */
export async function extractTextFromPDF(arrayBuffer) {
    try {
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.js库未加载');
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = CONFIG.pdfJsWorkerUrl;

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfDocument = await loadingTask.promise;
        let text = '';

        for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
            const page = await pdfDocument.getPage(pageNum);
            const content = await page.getTextContent();
            const pageText = reconstructPDFFromItems(content.items);
            text += pageText + '\n';
        }

        return text;
    } catch {
        return '';
    }
}

/**
 * 从PDF文本项重建文本行
 */
export function reconstructPDFFromItems(items) {
    if (!items || items.length === 0) return '';

    const filtered = items.filter(item => item.str && item.str.trim().length > 0);
    if (filtered.length === 0) return '';

    filtered.sort((a, b) => {
        const ay = Math.round(a.transform[5]);
        const by = Math.round(b.transform[5]);
        if (Math.abs(ay - by) > 3) return by - ay;
        return a.transform[4] - b.transform[4];
    });

    const lines = [];
    let currentLine = [];
    let lastY = null;
    const LINE_THRESHOLD = 5;

    for (const item of filtered) {
        const y = Math.round(item.transform[5]);
        if (lastY === null || Math.abs(y - lastY) > LINE_THRESHOLD) {
            if (currentLine.length > 0) {
                lines.push(currentLine.map(i => i.str).join(''));
            }
            currentLine = [item];
        } else {
            if (currentLine.length > 0) {
                const prevItem = currentLine[currentLine.length - 1];
                const gap = item.transform[4] - (prevItem.transform[4] + prevItem.width);
                if (gap > 8) {
                    currentLine.push({ str: ' ', transform: item.transform, width: 0 });
                }
            }
            currentLine.push(item);
        }
        lastY = y;
    }
    if (currentLine.length > 0) {
        lines.push(currentLine.map(i => i.str).join(''));
    }

    return lines.join('\n');
}

/**
 * 从DOCX提取文本（使用mammoth.js库）
 */
export async function extractTextFromDOCX(content) {
    try {
        if (typeof mammoth !== 'undefined') {
            const result = await mammoth.extractRawText({ arrayBuffer: content });
            return result.value;
        } else {
            throw new Error('mammoth.js库未加载');
        }
    } catch {
        return '';
    }
}

export { CONFIG };
