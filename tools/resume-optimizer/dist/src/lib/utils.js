/**
 * 公共工具函数库
 * 提供安全转义、通知显示等通用功能
 * @module utils
 */

/**
 * HTML 实体转义，防止 XSS 攻击
 * @param {*} text - 待转义的文本
 * @returns {string} 转义后的安全字符串
 * @example
 * escapeHtml('<script>alert("XSS")</script>')
 * // => '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
 */
export function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * HTML 属性值转义
 * @param {*} text - 待转义的属性值
 * @returns {string} 转义后的安全字符串
 * @example
 * escapeAttr('value"with"quotes')
 * // => 'value&quot;with&quot;quotes'
 */
export function escapeAttr(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * 显示通知消息（使用 DOM API + textContent 防止 XSS）
 * @param {string} message - 通知消息内容
 * @param {'success'|'error'|'info'} [type='info'] - 通知类型
 * @example
 * showNotification('操作成功', 'success');
 * showNotification('发生错误', 'error');
 */
export function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 fade-in ${
        type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' : 'bg-indigo-500'
    } text-white`;

    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center gap-2';

    const icon = document.createElement('i');
    icon.className = `fas ${
        type === 'success' ? 'fa-check-circle' :
        type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'
    }`;
    wrapper.appendChild(icon);

    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    wrapper.appendChild(textSpan);

    notification.appendChild(wrapper);
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(10px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
