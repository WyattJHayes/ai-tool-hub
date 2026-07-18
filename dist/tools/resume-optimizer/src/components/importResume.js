/**
 * 简历导入组件
 * 提供文件上传、解析、预览和导入功能
 */

import { importUtils } from '../lib/importUtils.js';
import { escapeHtml } from '../lib/utils.js';

class ImportResume {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.currentFile = null;
        this.parsedData = null;
    }

    /**
     * 初始化组件
     */
    init(containerId = 'importResumeContainer') {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            return false;
        }

        this.render();
        this.attachEventListeners();
        this.isActive = true;

        return true;
    }

    /**
     * 渲染组件界面
     */
    render() {
        this.container.innerHTML = `
            <div class="import-resume-container">
                <!-- 标题区域 -->
                <div class="import-header">
                    <h3 class="import-title">
                        <i class="fas fa-file-import text-indigo-400"></i>
                        简历导入
                    </h3>
                    <button class="import-close-btn" id="importCloseBtn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- 上传区域 -->
                <div class="upload-section" id="uploadSection">
                    <div class="upload-zone" id="uploadZone">
                        <div class="upload-icon">
                            <i class="fas fa-cloud-upload-alt text-4xl text-gray-400"></i>
                        </div>
                        <div class="upload-text">
                            <p class="text-lg font-medium">拖放简历文件到此处</p>
                            <p class="text-sm text-gray-400 mt-1">或点击选择文件</p>
                        </div>
                        <input type="file" id="fileInput" class="hidden" accept=".pdf,.docx,.doc,.txt,.html,.htm,.md,.markdown">
                        <p class="text-xs text-gray-500 mt-4">
                            支持格式: PDF, DOCX, TXT, HTML, Markdown (最大10MB)
                        </p>
                    </div>

                    <div class="upload-buttons">
                        <button class="btn-secondary" id="selectFileBtn">
                            <i class="fas fa-folder-open mr-2"></i>
                            选择文件
                        </button>
                        <button class="btn-primary" id="startImportBtn" disabled>
                            <i class="fas fa-upload mr-2"></i>
                            开始导入
                        </button>
                    </div>
                </div>

                <!-- 解析进度区域 -->
                <div class="progress-section hidden" id="progressSection">
                    <div class="progress-header">
                        <h4 class="progress-title">正在解析简历...</h4>
                        <div class="progress-percent" id="progressPercent">0%</div>
                    </div>

                    <div class="progress-bar-container">
                        <div class="progress-bar" id="progressBar"></div>
                    </div>

                    <div class="progress-details">
                        <div class="progress-item">
                            <i class="fas fa-file text-blue-400"></i>
                            <span id="fileName">正在读取文件...</span>
                        </div>
                        <div class="progress-item">
                            <i class="fas fa-cog text-purple-400"></i>
                            <span id="parseStatus">准备解析...</span>
                        </div>
                        <div class="progress-item">
                            <i class="fas fa-check-circle text-green-400"></i>
                            <span id="resultStatus">等待结果...</span>
                        </div>
                    </div>
                </div>

                <!-- 结果预览区域 -->
                <div class="preview-section hidden" id="previewSection">
                    <div class="preview-header">
                        <h4 class="preview-title">
                            <i class="fas fa-check-circle text-green-400"></i>
                            解析完成
                        </h4>
                        <div class="file-info">
                            <span class="file-name" id="previewFileName">resume.pdf</span>
                            <span class="file-type" id="previewFileType">PDF</span>
                        </div>
                    </div>

                    <div class="preview-content">
                        <!-- 个人信息预览 -->
                        <div class="preview-section-item">
                            <h5 class="preview-section-title">
                                <i class="fas fa-user text-indigo-400"></i>
                                个人信息
                            </h5>
                            <div class="preview-data" id="profilePreview">
                                <div class="data-row">
                                    <span class="data-label">姓名:</span>
                                    <span class="data-value" id="previewName">张三</span>
                                </div>
                                <div class="data-row">
                                    <span class="data-label">电话:</span>
                                    <span class="data-value" id="previewPhone">13800138000</span>
                                </div>
                                <div class="data-row">
                                    <span class="data-label">邮箱:</span>
                                    <span class="data-value" id="previewEmail">zhangsan@example.com</span>
                                </div>
                                <div class="data-row">
                                    <span class="data-label">地址:</span>
                                    <span class="data-value" id="previewLocation">北京市</span>
                                </div>
                            </div>
                        </div>

                        <!-- 工作经历预览 -->
                        <div class="preview-section-item">
                            <h5 class="preview-section-title">
                                <i class="fas fa-briefcase text-blue-400"></i>
                                工作经历
                            </h5>
                            <div class="preview-data" id="experiencePreview">
                                <div class="data-item">
                                    <div class="data-item-header">
                                        <span class="data-item-title">高级软件工程师</span>
                                        <span class="data-item-period">2020-至今</span>
                                    </div>
                                    <div class="data-item-company">腾讯科技</div>
                                    <div class="data-item-desc">负责核心系统开发...</div>
                                </div>
                            </div>
                        </div>

                        <!-- 教育经历预览 -->
                        <div class="preview-section-item">
                            <h5 class="preview-section-title">
                                <i class="fas fa-graduation-cap text-green-400"></i>
                                教育经历
                            </h5>
                            <div class="preview-data" id="educationPreview">
                                <div class="data-item">
                                    <div class="data-item-header">
                                        <span class="data-item-title">计算机科学与技术</span>
                                        <span class="data-item-period">2016-2020</span>
                                    </div>
                                    <div class="data-item-school">清华大学</div>
                                    <div class="data-item-degree">学士学位</div>
                                </div>
                            </div>
                        </div>

                        <!-- 技能预览 -->
                        <div class="preview-section-item">
                            <h5 class="preview-section-title">
                                <i class="fas fa-tools text-yellow-400"></i>
                                专业技能
                            </h5>
                            <div class="preview-data" id="skillsPreview">
                                <div class="skill-tags">
                                    <span class="skill-tag">JavaScript</span>
                                    <span class="skill-tag">React</span>
                                    <span class="skill-tag">Node.js</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="preview-actions">
                        <button class="btn-secondary" id="editDataBtn">
                            <i class="fas fa-edit mr-2"></i>
                            编辑数据
                        </button>
                        <button class="btn-primary" id="importDataBtn">
                            <i class="fas fa-check mr-2"></i>
                            确认导入
                        </button>
                    </div>
                </div>

                <!-- 错误提示区域 -->
                <div class="error-section hidden" id="errorSection">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle text-red-400 text-4xl"></i>
                    </div>
                    <div class="error-content">
                        <h4 class="error-title" id="errorTitle">导入失败</h4>
                        <p class="error-message" id="errorMessage">文件解析过程中出现错误</p>
                        <p class="error-suggestion" id="errorSuggestion">请检查文件格式是否正确</p>
                    </div>
                    <div class="error-actions">
                        <button class="btn-secondary" id="retryBtn">
                            <i class="fas fa-redo mr-2"></i>
                            重新尝试
                        </button>
                        <button class="btn-primary" id="closeErrorBtn">
                            <i class="fas fa-times mr-2"></i>
                            关闭
                        </button>
                    </div>
                </div>
            </div>
        `;

        // 添加CSS样式
        this.addStyles();
    }

    /**
     * 添加组件样式
     */
    addStyles() {
        const styleId = 'import-resume-styles';
        if (document.getElementById(styleId)) return;

        const styles = `
            <style id="${styleId}">
                .import-resume-container {
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 20px;
                    max-width: 500px;
                    margin: 0 auto;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                }

                .import-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }

                .import-title {
                    font-size: 18px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .import-close-btn {
                    background: none;
                    border: none;
                    color: #9ca3af;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    transition: all 0.2s;
                }

                .import-close-btn:hover {
                    color: #ffffff;
                    background: rgba(255, 255, 255, 0.1);
                }

                .upload-section {
                    text-align: center;
                }

                .upload-zone {
                    border: 2px dashed rgba(99, 102, 241, 0.3);
                    border-radius: 10px;
                    padding: 40px 20px;
                    margin-bottom: 20px;
                    background: rgba(99, 102, 241, 0.05);
                    transition: all 0.3s;
                    cursor: pointer;
                }

                .upload-zone:hover {
                    border-color: rgba(99, 102, 241, 0.6);
                    background: rgba(99, 102, 241, 0.1);
                }

                .upload-zone.dragover {
                    border-color: #6366f1;
                    background: rgba(99, 102, 241, 0.2);
                }

                .upload-icon {
                    margin-bottom: 16px;
                }

                .upload-text p {
                    margin: 0;
                }

                .upload-buttons {
                    display: flex;
                    gap: 12px;
                    justify-content: center;
                }

                .btn-primary, .btn-secondary {
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-weight: 500;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .btn-primary {
                    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                    color: white;
                }

                .btn-primary:hover:not(:disabled) {
                    opacity: 0.9;
                    transform: translateY(-1px);
                }

                .btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .btn-secondary {
                    background: rgba(255, 255, 255, 0.1);
                    color: #d1d5db;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }

                .btn-secondary:hover {
                    background: rgba(255, 255, 255, 0.2);
                }

                .progress-section, .preview-section, .error-section {
                    animation: fadeIn 0.3s ease-in-out;
                }

                .progress-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }

                .progress-title {
                    font-size: 16px;
                    font-weight: 600;
                }

                .progress-percent {
                    font-size: 14px;
                    color: #6366f1;
                    font-weight: 600;
                }

                .progress-bar-container {
                    height: 6px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                    overflow: hidden;
                    margin-bottom: 20px;
                }

                .progress-bar {
                    height: 100%;
                    background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%);
                    width: 0%;
                    transition: width 0.3s ease;
                    border-radius: 3px;
                }

                .progress-details {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .progress-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 14px;
                }

                .preview-header {
                    margin-bottom: 20px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }

                .preview-title {
                    font-size: 16px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 8px;
                }

                .file-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 13px;
                }

                .file-name {
                    color: #d1d5db;
                }

                .file-type {
                    background: rgba(99, 102, 241, 0.2);
                    color: #6366f1;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                }

                .preview-content {
                    max-height: 400px;
                    overflow-y: auto;
                    padding-right: 8px;
                }

                .preview-section-item {
                    margin-bottom: 20px;
                }

                .preview-section-title {
                    font-size: 14px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 12px;
                    color: #d1d5db;
                }

                .preview-data {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                    padding: 16px;
                }

                .data-row {
                    display: flex;
                    margin-bottom: 8px;
                }

                .data-row:last-child {
                    margin-bottom: 0;
                }

                .data-label {
                    width: 60px;
                    color: #9ca3af;
                    font-size: 13px;
                }

                .data-value {
                    flex: 1;
                    color: #ffffff;
                    font-weight: 500;
                }

                .data-item {
                    margin-bottom: 12px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }

                .data-item:last-child {
                    margin-bottom: 0;
                    padding-bottom: 0;
                    border-bottom: none;
                }

                .data-item-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 4px;
                }

                .data-item-title {
                    font-weight: 600;
                    color: #ffffff;
                }

                .data-item-period {
                    font-size: 12px;
                    color: #9ca3af;
                }

                .data-item-company, .data-item-school {
                    font-size: 13px;
                    color: #d1d5db;
                    margin-bottom: 2px;
                }

                .data-item-degree {
                    font-size: 12px;
                    color: #9ca3af;
                }

                .data-item-desc {
                    font-size: 13px;
                    color: #9ca3af;
                    line-height: 1.4;
                }

                .skill-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .skill-tag {
                    background: rgba(99, 102, 241, 0.2);
                    color: #6366f1;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 500;
                }

                .preview-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 24px;
                }

                .error-section {
                    text-align: center;
                    padding: 30px 20px;
                }

                .error-icon {
                    margin-bottom: 20px;
                }

                .error-content {
                    margin-bottom: 24px;
                }

                .error-title {
                    font-size: 18px;
                    font-weight: 600;
                    margin-bottom: 8px;
                    color: #f87171;
                }

                .error-message {
                    color: #d1d5db;
                    margin-bottom: 8px;
                }

                .error-suggestion {
                    color: #9ca3af;
                    font-size: 14px;
                }

                .error-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: center;
                }

                .hidden {
                    display: none !important;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* 滚动条样式 */
                .preview-content::-webkit-scrollbar {
                    width: 6px;
                }

                .preview-content::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 3px;
                }

                .preview-content::-webkit-scrollbar-thumb {
                    background: rgba(99, 102, 241, 0.5);
                    border-radius: 3px;
                }

                .preview-content::-webkit-scrollbar-thumb:hover {
                    background: rgba(99, 102, 241, 0.7);
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    /**
     * 绑定事件监听器
     */
    attachEventListeners() {
        // 关闭按钮
        document.getElementById('importCloseBtn').addEventListener('click', () => {
            this.close();
        });

        // 文件选择按钮
        document.getElementById('selectFileBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        // 文件输入变化
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files[0]);
        });

        // 开始导入按钮
        document.getElementById('startImportBtn').addEventListener('click', () => {
            this.startImport();
        });

        // 拖拽上传
        const uploadZone = document.getElementById('uploadZone');
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });

        uploadZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');

            if (e.dataTransfer.files.length > 0) {
                this.handleFileSelect(e.dataTransfer.files[0]);
            }
        });

        uploadZone.addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        // 确认导入按钮
        document.getElementById('importDataBtn')?.addEventListener('click', () => {
            this.confirmImport();
        });

        // 编辑数据按钮
        document.getElementById('editDataBtn')?.addEventListener('click', () => {
            this.editData();
        });

        // 重试按钮
        document.getElementById('retryBtn')?.addEventListener('click', () => {
            this.retry();
        });

        // 关闭错误按钮
        document.getElementById('closeErrorBtn')?.addEventListener('click', () => {
            this.showUploadSection();
        });
    }

    /**
     * 处理文件选择
     */
    handleFileSelect(file) {
        if (!file) return;

        this.currentFile = file;

        // 验证文件
        if (!importUtils.isFileSupported(file)) {
            this.showError('不支持的文件格式', `请上传支持的文件格式: ${importUtils.supportedFormats.join(', ')}`);
            return;
        }

        if (!importUtils.isFileSizeValid(file)) {
            this.showError('文件过大', `文件大小超过限制 (最大10MB)`);
            return;
        }

        // 更新UI显示文件名
        const startImportBtn = document.getElementById('startImportBtn');
        startImportBtn.disabled = false;
        startImportBtn.innerHTML = `<i class="fas fa-upload mr-2"></i>导入 ${escapeHtml(file.name)}`;

        // 显示文件信息
        const uploadZone = document.getElementById('uploadZone');
        uploadZone.innerHTML = `
            <div class="upload-icon">
                <i class="fas fa-file text-indigo-400 text-4xl"></i>
            </div>
            <div class="upload-text">
                <p class="text-lg font-medium">${escapeHtml(file.name)}</p>
                <p class="text-sm text-gray-400 mt-1">${(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
        `;
    }

    /**
     * 开始导入
     */
    async startImport() {
        if (!this.currentFile) return;

        // 显示进度界面
        this.showProgressSection();

        try {
            // 更新进度
            this.updateProgress(10, '正在读取文件...');

            // 解析文件
            this.updateProgress(30, '正在解析内容...');
            const result = await importUtils.parseResumeFile(this.currentFile);

            if (result.success) {
                // 检查解析出的数据是否有效
                const data = result.data;
                const hasContent = data.profile && (
                    data.profile.name || data.profile.phone || data.profile.email ||
                    data.profile.location || data.profile.title
                ) || (data.experience && data.experience.length > 0) ||
                   (data.education && data.education.length > 0) ||
                   (data.skills && data.skills.length > 0);

                if (!hasContent) {
                    this.showError('解析失败', '未能从文件中识别出简历内容，请确保文件包含可读的文本信息', '请尝试上传格式更规范的简历文件，或使用复制粘贴方式导入');
                    return;
                }

                this.updateProgress(80, '正在处理数据...');
                this.parsedData = result.data;

                // 显示结果
                setTimeout(() => {
                    this.updateProgress(100, '解析完成');
                    setTimeout(() => {
                        this.showPreviewSection(result);
                    }, 500);
                }, 500);
            } else {
                this.showError('解析失败', result.error, result.suggestion);
            }
        } catch (error) {
            this.showError('导入失败', error.message);
        }
    }

    /**
     * 更新进度
     */
    updateProgress(percent, status) {
        const progressBar = document.getElementById('progressBar');
        const progressPercent = document.getElementById('progressPercent');
        const parseStatus = document.getElementById('parseStatus');

        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
        if (progressPercent) {
            progressPercent.textContent = `${percent}%`;
        }
        if (parseStatus) {
            parseStatus.textContent = status;
        }

        // 更新文件名显示
        if (this.currentFile) {
            const fileName = document.getElementById('fileName');
            if (fileName && percent < 30) {
                fileName.textContent = this.currentFile.name;
            }
        }
    }

    /**
     * 显示上传界面
     */
    showUploadSection() {
        document.getElementById('uploadSection').classList.remove('hidden');
        document.getElementById('progressSection').classList.add('hidden');
        document.getElementById('previewSection').classList.add('hidden');
        document.getElementById('errorSection').classList.add('hidden');
    }

    /**
     * 显示进度界面
     */
    showProgressSection() {
        document.getElementById('uploadSection').classList.add('hidden');
        document.getElementById('progressSection').classList.remove('hidden');
        document.getElementById('previewSection').classList.add('hidden');
        document.getElementById('errorSection').classList.add('hidden');

        // 重置进度
        this.updateProgress(0, '准备解析...');
    }

    /**
     * 显示预览界面
     */
    showPreviewSection(result) {
        document.getElementById('uploadSection').classList.add('hidden');
        document.getElementById('progressSection').classList.add('hidden');
        document.getElementById('previewSection').classList.remove('hidden');
        document.getElementById('errorSection').classList.add('hidden');

        // 更新预览数据
        this.updatePreviewData(result);
    }

    /**
     * 更新预览数据
     */
    updatePreviewData(result) {
        const data = result.data;

        // 文件信息
        document.getElementById('previewFileName').textContent = result.fileName;
        document.getElementById('previewFileType').textContent = result.fileType.toUpperCase();

        // 个人信息
        document.getElementById('previewName').textContent = data.profile.name || '未识别';
        document.getElementById('previewPhone').textContent = data.profile.phone || '未识别';
        document.getElementById('previewEmail').textContent = data.profile.email || '未识别';
        document.getElementById('previewLocation').textContent = data.profile.location || '未识别';

        // 工作经历
        const experiencePreview = document.getElementById('experiencePreview');
        experiencePreview.innerHTML = '';
        if (data.experience && data.experience.length > 0) {
            data.experience.forEach(exp => {
                const dateRange = [exp.startDate, exp.endDate].filter(Boolean).join(' - ') || exp.period || '时间';
                const expHtml = `
                    <div class="data-item">
                        <div class="data-item-header">
                            <span class="data-item-title">${escapeHtml(exp.position || '职位')}</span>
                            <span class="data-item-period">${escapeHtml(dateRange)}</span>
                        </div>
                        <div class="data-item-company">${escapeHtml(exp.company || '公司')}</div>
                        ${exp.description ? `<div class="data-item-desc">${escapeHtml(exp.description)}</div>` : ''}
                    </div>
                `;
                experiencePreview.insertAdjacentHTML('beforeend', expHtml);
            });
        } else {
            experiencePreview.innerHTML = '<div class="text-gray-500 text-sm">未识别到工作经历</div>';
        }

        // 教育经历
        const educationPreview = document.getElementById('educationPreview');
        educationPreview.innerHTML = '';
        if (data.education && data.education.length > 0) {
            data.education.forEach(edu => {
                const dateRange = [edu.startDate, edu.endDate].filter(Boolean).join(' - ') || edu.period || '时间';
                const majorStr = edu.major || edu.field ? ` · ${escapeHtml(edu.major || edu.field)}` : '';
                const eduHtml = `
                    <div class="data-item">
                        <div class="data-item-header">
                            <span class="data-item-title">${escapeHtml(edu.school || '学校')}</span>
                            <span class="data-item-period">${escapeHtml(dateRange)}</span>
                        </div>
                        <div class="data-item-school">${escapeHtml(edu.degree || '')}${majorStr}</div>
                        ${edu.description ? `<div class="data-item-desc">${escapeHtml(edu.description)}</div>` : ''}
                    </div>
                `;
                educationPreview.insertAdjacentHTML('beforeend', eduHtml);
            });
        } else {
            educationPreview.innerHTML = '<div class="text-gray-500 text-sm">未识别到教育经历</div>';
        }

        // 技能
        const skillsPreview = document.getElementById('skillsPreview');
        skillsPreview.innerHTML = '';
        if (data.skills && data.skills.length > 0) {
            const skillTags = document.createElement('div');
            skillTags.className = 'skill-tags';

            data.skills.forEach(skill => {
                const tag = document.createElement('span');
                tag.className = 'skill-tag';
                tag.textContent = skill;
                skillTags.appendChild(tag);
            });

            skillsPreview.appendChild(skillTags);
        } else {
            skillsPreview.innerHTML = '<div class="text-gray-500 text-sm">未识别到技能</div>';
        }
    }

    /**
     * 显示错误
     */
    showError(title, message, suggestion = '') {
        document.getElementById('uploadSection').classList.add('hidden');
        document.getElementById('progressSection').classList.add('hidden');
        document.getElementById('previewSection').classList.add('hidden');
        document.getElementById('errorSection').classList.remove('hidden');

        document.getElementById('errorTitle').textContent = title;
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorSuggestion').textContent = suggestion || '请检查文件格式是否正确，或尝试重新上传';
    }

    /**
     * 确认导入数据
     */
    confirmImport() {
        if (!this.parsedData) return;

        // 触发自定义事件，通知主应用导入数据
        const importEvent = new CustomEvent('resumeImportComplete', {
            detail: this.parsedData
        });
        document.dispatchEvent(importEvent);

        // 显示成功消息
        this.showSuccessMessage();
    }

    /**
     * 编辑数据
     */
    editData() {
        // 这里可以扩展为打开编辑界面
        alert('编辑功能将在后续版本中实现');
    }

    /**
     * 重试
     */
    retry() {
        this.showUploadSection();
        this.currentFile = null;
        this.parsedData = null;

        // 重置UI
        const uploadZone = document.getElementById('uploadZone');
        uploadZone.innerHTML = `
            <div class="upload-icon">
                <i class="fas fa-cloud-upload-alt text-4xl text-gray-400"></i>
            </div>
            <div class="upload-text">
                <p class="text-lg font-medium">拖放简历文件到此处</p>
                <p class="text-sm text-gray-400 mt-1">或点击选择文件</p>
            </div>
        `;

        const startImportBtn = document.getElementById('startImportBtn');
        startImportBtn.disabled = true;
        startImportBtn.innerHTML = `<i class="fas fa-upload mr-2"></i>开始导入`;
    }

    /**
     * 显示成功消息
     */
    showSuccessMessage() {
        // 创建成功提示
        const successMsg = document.createElement('div');
        successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg z-50 animate-fadeIn';
        successMsg.innerHTML = `
            <div class="flex items-center gap-2">
                <i class="fas fa-check-circle"></i>
                <span>简历数据已成功导入！</span>
            </div>
        `;

        document.body.appendChild(successMsg);

        // 3秒后移除
        setTimeout(() => {
            successMsg.classList.add('animate-fadeOut');
            setTimeout(() => {
                if (successMsg.parentNode) {
                    successMsg.parentNode.removeChild(successMsg);
                }
            }, 300);
        }, 3000);

        // 关闭导入界面
        this.close();
    }

    /**
     * 打开导入界面
     */
    open() {
        if (this.container) {
            this.container.classList.remove('hidden');
            this.container.style.display = 'flex';
            this.isActive = true;
        }
    }

    /**
     * 关闭导入界面
     */
    close() {
        if (this.container) {
            this.container.classList.add('hidden');
            this.container.style.display = '';
            this.isActive = false;
        }
    }

    /**
     * 切换显示/隐藏
     */
    toggle() {
        if (this.isActive) {
            this.close();
        } else {
            this.open();
        }
    }
}

// 创建全局实例
const importResume = new ImportResume();

export { importResume, ImportResume };