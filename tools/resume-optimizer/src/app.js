/**
 * AI Resume Optimizer - Main Application
 * Entry point for the resume optimizer tool
 */

import { showNotification } from './lib/utils.js';
import { apiClient } from './lib/apiClient.js';

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {

    setupErrorHandling();
    setupKeyboardShortcuts();
    setupAutoSaveIndicator();
    showWelcomeMessage();

    // 初始化简历导入功能
    setupResumeImport();

    // 初始化优化级别选择器
    initOptimizationLevelSelector();

    // 初始化认证UI
    initAuthUI();
});

// 初始化认证UI
async function initAuthUI() {
    try {
        const { authModal } = await import('./components/authModal.js');
        authModal.updateUI();

        // 监听认证状态变化
        window.addEventListener('auth-change', () => {
            authModal.updateUI();
        });
    } catch (error) {
    }
}

// 键盘快捷键
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + S 保存
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            store.save();
            showNotification('已保存到本地', 'success');
        }

        // Ctrl/Cmd + P 预览 PDF
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            pdfGenerator.preview();
        }

        // Esc 关闭 AI 面板
        if (e.key === 'Escape') {
            aiOptimizer.closePanel();
        }
    });
}

// 自动保存指示器
function setupAutoSaveIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'autoSaveIndicator';
    indicator.className = 'fixed bottom-4 left-4 px-3 py-1.5 bg-gray-800 text-gray-400 text-xs rounded-lg opacity-0 transition-opacity';
    indicator.innerHTML = '<i class="fas fa-check-circle text-green-500 mr-1"></i> 已自动保存';
    document.body.appendChild(indicator);

    let saveTimeout;
    store.subscribe(() => {
        indicator.style.opacity = '1';
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            indicator.style.opacity = '0';
        }, 2000);
    });
}

// 欢迎消息
function showWelcomeMessage() {
    const hasVisited = localStorage.getItem('resumeOptimizerVisited');
    if (!hasVisited) {
        setTimeout(() => {
            showNotification('欢迎使用 AI 简历优化工具！填写左侧表单，右侧实时预览', 'info');
            localStorage.setItem('resumeOptimizerVisited', 'true');
        }, 1000);
    }
}

// 简历导入功能
let importInitialized = false;

function setupResumeImport() {
    if (importInitialized) return;
    let attempts = 0;
    const maxAttempts = 30;
    const checkAndSetup = () => {
        const importBtn = document.getElementById('importResumeBtn');
        if (!importBtn) {
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(checkAndSetup, 100);
            }
            return;
        }

        importBtn.addEventListener('click', () => {
            openResumeImport();
        });
        importInitialized = true;
    };
    checkAndSetup();
}

// 打开简历导入界面
let importListenerAdded = false;

function openResumeImport() {
    // 动态导入模块
    import('./components/importResume.js')
        .then(({ importResume }) => {
            // 初始化组件
            importResume.init('importResumeContainer');
            importResume.open();

            // 只添加一次监听器
            if (!importListenerAdded) {
                document.addEventListener('resumeImportComplete', handleResumeImportComplete);
                importListenerAdded = true;
            }
        })
        .catch(error => {
            showNotification('简历导入功能加载失败，请刷新页面重试', 'error');
        });
}

// 处理简历导入完成事件
function handleResumeImportComplete(event) {
    const importedData = event.detail;


    // 更新简历表单数据
    updateResumeFormWithImportedData(importedData);

    // 显示成功消息
    showNotification('简历数据已成功导入！', 'success');
}

// 初始化优化级别选择器（借鉴求职方舟3档优化）
function initOptimizationLevelSelector() {
    // 等待AI优化器初始化完成，最多重试30次（3秒）
    let attempts = 0;
    const maxAttempts = 30;
    const checkAndInit = () => {
        attempts++;
        if (window.aiOptimizer && aiOptimizer._renderOptimizationLevels) {
            const savedLevel = localStorage.getItem('optimization_level') || 'medium';
            aiOptimizer.currentLevel = savedLevel;
            aiOptimizer._renderOptimizationLevels();
        } else if (attempts < maxAttempts) {
            setTimeout(checkAndInit, 100);
        }
    };

    checkAndInit();
}

// 使用导入数据更新简历表单
function updateResumeFormWithImportedData(data) {
    if (!window.resumeForm || !window.store) {
        return;
    }

    try {
        // 更新个人资料
        if (data.profile) {
            const profileFields = {
                profileName: data.profile.name,
                profileTitle: data.profile.title || '求职者',
                profileEmail: data.profile.email,
                profilePhone: data.profile.phone,
                profileLocation: data.profile.location,
                profileSummary: data.profile.summary
            };

            // 更新表单字段
            Object.entries(profileFields).forEach(([fieldId, value]) => {
                const field = document.getElementById(fieldId);
                if (field && value) {
                    field.value = value;
                    // 触发输入事件以更新状态
                    field.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
        }

        // 更新工作经历
        if (data.experience && data.experience.length > 0) {
            // 清空现有经历
            const experienceContainer = document.querySelector('[data-section="experience"]');
            if (experienceContainer) {
                experienceContainer.innerHTML = '';
            }

            // 添加新经历
            data.experience.forEach((exp, index) => {
                addExperienceItem(exp);
            });
        }

        // 更新教育经历
        if (data.education && data.education.length > 0) {
            // 清空现有教育经历
            const educationContainer = document.querySelector('[data-section="education"]');
            if (educationContainer) {
                educationContainer.innerHTML = '';
            }

            // 添加新教育经历
            data.education.forEach((edu, index) => {
                addEducationItem(edu);
            });
        }

        // 更新技能
        if (data.skills && data.skills.length > 0) {
            const skillsInput = document.getElementById('skillsInput');
            if (skillsInput) {
                skillsInput.value = data.skills.join(', ');
                skillsInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        // 触发保存
        setTimeout(() => {
            if (window.store && typeof window.store.save === 'function') {
                window.store.save();
            }
        }, 100);

    } catch (error) {
        showNotification('导入数据更新表单时出错', 'error');
    }
}

// 添加工作经历项
function addExperienceItem(experience) {
    if (!window.resumeForm || typeof window.resumeForm.addExperience !== 'function') {
        return;
    }

    try {
        // Helper: parse date string to normalized format
        const parseDate = (dateStr) => {
            if (!dateStr || dateStr.trim() === '') return '';
            let d = dateStr.trim();
            // "至今" or "现在" → keep as is
            if (d === '至今' || d === '现在' || d.toLowerCase() === 'present') return d;
            // "2020年03月" → "2020.03"
            d = d.replace(/年/g, '.').replace(/月/g, '');
            // "2020.3" → "2020.03"
            const m = d.match(/^(\d{4})[.\-/](\d{1,2})$/);
            if (m) return `${m[1]}.${m[2].padStart(2, '0')}`;
            return d;
        };

        // Extract startDate/endDate from various formats
        let startDate = parseDate(experience.startDate);
        let endDate = parseDate(experience.endDate);

        // If startDate/endDate are empty, try parsing from period
        if (!startDate && !endDate && experience.period) {
            const p = experience.period;
            // Try splitting on ' - ', '-', '至', '到'
            const parts = p.split(/\s*[-–—至到]\s*/);
            if (parts.length >= 2) {
                startDate = parseDate(parts[0]);
                endDate = parseDate(parts.slice(1).join('-')); // handle "2020.03 - 2023.12 - 备注"
            } else if (parts.length === 1) {
                startDate = parseDate(parts[0]);
                endDate = '至今';
            }
        }

        const expData = {
            company: experience.company || '',
            position: experience.position || experience.title || '',
            startDate: startDate,
            endDate: endDate || '至今',
            description: experience.description || ''
        };

        window.resumeForm.addExperience(expData);
    } catch (error) {
    }
}

// 添加教育经历项
function addEducationItem(education) {
    if (!window.resumeForm || typeof window.resumeForm.addEducation !== 'function') {
        return;
    }

    try {
        // Helper: parse date string to normalized format
        const parseDate = (dateStr) => {
            if (!dateStr || dateStr.trim() === '') return '';
            let d = dateStr.trim();
            d = d.replace(/年/g, '.').replace(/月/g, '');
            const m = d.match(/^(\d{4})[.\-/](\d{1,2})$/);
            if (m) return `${m[1]}.${m[2].padStart(2, '0')}`;
            return d;
        };

        // Determine graduationDate: prefer endDate, then parse from period
        let graduationDate = '';
        if (education.endDate) {
            graduationDate = parseDate(education.endDate);
        } else if (education.period) {
            const parts = education.period.split(/\s*[-–—至到]\s*/);
            graduationDate = parts.length >= 2 ? parseDate(parts[parts.length - 1]) : parseDate(parts[0]);
        } else if (education.graduationDate) {
            graduationDate = parseDate(education.graduationDate);
        }

        const eduData = {
            school: education.school || '',
            degree: education.degree || '',
            major: education.major || education.field || '',
            graduationDate: graduationDate,
            description: education.description || ''
        };

        window.resumeForm.addEducation(eduData);
    } catch (error) {
    }
}

// 设置错误处理
function setupErrorHandling() {
    window.addEventListener('unhandledrejection', event => {
        showNotification('操作出现错误，请稍后重试', 'error');
    });

    window.addEventListener('error', event => {
        if (event.message && event.message.includes('chrome-extension')) {
            return;
        }
        showNotification('页面出现错误，请刷新重试', 'error');
    });
}
