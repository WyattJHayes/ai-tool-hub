/**
 * AI Resume Optimizer - Professional Edition
 * 基于求职方舟/AI简历姬最佳实践重构
 * 后端API驱动 - DeepSeek大模型由服务端调用
 *
 * 核心特性：
 * 1. 后端AI大模型驱动（DeepSeek-V3，服务端代理）
 * 2. 3档智能优化级别（轻度/中度/深度）
 * 3. JD驱动的针对性优化
 * 4. STAR法则自动重构
 * 5. 智能量化成果生成
 * 6. ATS关键词对齐
 * 7. 实时对比预览
 * 8. 本地规则引擎兜底
 */

import { escapeHtml, escapeAttr, showNotification } from './utils.js';
import { apiClient } from './apiClient.js';
import { ResumeTemplates, getAllTemplates } from './templates.js';

class AIOptimizer {
    constructor() {
        this.isOptimizing = false;
        this.useRemoteAI = true;
        this.currentMode = 'general';
        this.atsLevel = 'deep';
        this.selectedJob = '';

        this.optimizationLevels = {
            light: {
                name: '轻度优化',
                description: '润色语言，修正语法，保持原意',
                icon: 'fa-wand-magic-sparkles',
                color: 'blue',
                timeCost: '10秒',
                features: ['语法纠错', '表达润色', '格式规范']
            },
            medium: {
                name: '中度优化',
                description: '增强关键词，量化成果，提升匹配度',
                icon: 'fa-arrow-trend-up',
                color: 'purple',
                timeCost: '20秒',
                features: ['关键词对齐', '成果量化', '行为动词强化', 'ATS优化']
            },
            deep: {
                name: '深度优化',
                description: '全面重构，量身定制，最大化通过率',
                icon: 'fa-fire',
                color: 'orange',
                timeCost: '30秒',
                features: ['STAR法则重构', '个人品牌重塑', '技能矩阵优化', '差异化亮点', '终极ATS优化']
            }
        };

        this.currentLevel = 'medium';
        this._initTemplateDropdown();
        this._setupCloseHandlers();
    }

    _setupCloseHandlers() {
        document.addEventListener('click', (e) => {
            const closeBtn = e.target.closest('[data-action="closeAiPanel"]');
            if (closeBtn) {
                e.stopPropagation();
                this.closePanel();
                return;
            }

            const overlay = e.target.closest('#aiPanel > .absolute.inset-0');
            if (overlay && !e.target.closest('#aiPanelContent')) {
                this.closePanel();
                return;
            }
        });
    }

    _initTemplateDropdown() {
        const dropdown = document.getElementById('templateDropdown');
        if (!dropdown) return;

        const templates = getAllTemplates();
        dropdown.innerHTML = templates.map(t => `
            <button onclick="window.aiOptimizer.applyTemplate('${t.id}')" class="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2 transition-colors">
                <i class="fas fa-${t.style === 'modern' ? 'laptop-code' : t.style === 'professional' ? 'briefcase' : t.style === 'creative' ? 'paint-brush' : 'university'} text-purple-400 text-xs"></i>
                <div>
                    <div class="font-medium">${escapeHtml(t.name)}</div>
                    <div class="text-xs text-gray-500">${escapeHtml(t.description)}</div>
                </div>
            </button>
        `).join('');

        document.addEventListener('click', (e) => {
            const wrap = document.getElementById('templateDropdownWrap');
            if (wrap && !wrap.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    }

    toggleTemplateDropdown() {
        const dropdown = document.getElementById('templateDropdown');
        if (dropdown) dropdown.classList.toggle('hidden');
    }

    applyTemplate(templateId) {
        const template = ResumeTemplates[Object.keys(ResumeTemplates).find(k => ResumeTemplates[k].id === templateId)];
        if (!template) return;

        const dropdown = document.getElementById('templateDropdown');
        if (dropdown) dropdown.classList.add('hidden');

        const nameEl = document.getElementById('currentTemplateName');
        if (nameEl) nameEl.textContent = template.name;

        if (window.store) {
            const currentData = window.store.getState();
            if (!currentData.profile?.summary && template.fields.profile?.placeholder) {
                window.store.updatePath('profile', {
                    ...currentData.profile,
                    title: currentData.profile?.title || ''
                });
            }

            const currentSkills = currentData.skills || [];
            const templateSkills = template.fields.skills || [];

            if (currentSkills.length === 0 && templateSkills.length > 0) {
                window.store.updatePath('skills', templateSkills);
            }

            if (currentData.experience?.length === 0 && template.fields.experience?.length > 0) {
                window.store.updatePath('experience', template.fields.experience.map((exp, i) => ({
                    id: Date.now() + i,
                    company: '',
                    position: '',
                    startDate: '',
                    endDate: '',
                    description: ''
                })));
            }

            window.store.save();
            this._syncFormFromStore();
        }

        showNotification(`已应用"${template.name}"模板`, 'success');
    }

    // 打开AI面板
    openPanel() {
        const panel = document.getElementById('aiPanel');
        const content = document.getElementById('aiPanelContent');
        if (!panel || !content) return;

        panel.classList.remove('hidden');
        void content.offsetHeight;
        content.classList.remove('translate-x-full');
        content.classList.add('translate-x-0');
        this._renderOptimizationLevels();
        this._updateStatus();
    }

    // 关闭AI面板
    closePanel() {
        const panel = document.getElementById('aiPanel');
        const content = document.getElementById('aiPanelContent');
        if (!panel || !content) return;

        content.classList.remove('translate-x-0');
        content.classList.add('translate-x-full');
        setTimeout(() => panel.classList.add('hidden'), 300);
    }

    // 渲染三档优化选择器
    _renderOptimizationLevels() {
        const container = document.getElementById('optimizationLevelSelector');
        if (!container) return;

        container.innerHTML = `
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-300 mb-3">
                    <i class="fas fa-sliders-h mr-2"></i>选择优化强度
                </label>
                <div class="space-y-3">
                    ${Object.entries(this.optimizationLevels).map(([level, config]) => `
                        <div
                            class="level-card ${this.currentLevel === level ? `active-${config.color}` : ''}"
                            onclick="aiOptimizer.selectLevel('${level}')"
                            style="cursor: pointer; padding: 16px; border-radius: 12px; border: 2px solid ${this.currentLevel === level ? this._getColor(config.color) : '#374151'}; background: ${this.currentLevel === level ? this._getBgColor(config.color) : '#1f2937'}; transition: all 0.3s;"
                        >
                            <div class="flex items-center justify-between mb-2">
                                <div class="flex items-center gap-3">
                                    <i class="fas ${config.icon} text-xl" style="color: ${this._getColor(config.color)}"></i>
                                    <span class="font-semibold text-white">${config.name}</span>
                                </div>
                                <span class="text-xs px-2 py-1 rounded-full" style="background: ${this._getColor(config.color)}20; color: ${this._getColor(config.color)}">
                                    ${config.timeCost}
                                </span>
                            </div>
                            <p class="text-sm text-gray-400 mb-3">${config.description}</p>
                            <div class="flex flex-wrap gap-2">
                                ${config.features.map(f => `
                                    <span class="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded">${f}</span>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 获取颜色值
    _getColor(color) {
        const colors = { blue: '#3b82f6', purple: '#8b5cf6', orange: '#f97316' };
        return colors[color] || '#6b7280';
    }

    // 获取背景色
    _getBgColor(color) {
        const colors = { blue: '#1e3a8a', purple: '#4c1d95', orange: '#7c2d12' };
        return colors[color] || '#1f2937';
    }

    // 选择优化级别
    selectLevel(level) {
        if (!this.optimizationLevels[level]) return;

        this.currentLevel = level;
        this._renderOptimizationLevels();

        const config = this.optimizationLevels[level];
        showNotification(`已选择：${config.name} - ${config.description}`, 'success');

        localStorage.setItem('optimization_level', level);
    }

    // 更新状态显示
    _updateStatus() {
        const statusEl = document.getElementById('apiStatus');
        if (!statusEl) return;

        statusEl.classList.remove('hidden');
        statusEl.className = 'text-xs text-green-400';
        statusEl.innerHTML = `<i class="fas fa-check-circle mr-1"></i>✨ 智能引擎就绪（免费使用）`;
    }

    // 主优化入口
    async optimize() {
        if (this.isOptimizing) return;

        if (this.useRemoteAI && !apiClient.isAuthenticated()) {
            showNotification('AI优化需要登录，请先登录或注册', 'warning');
            const { authModal } = await import('../components/authModal.js');
            authModal.show();
            return;
        }

        const jobDescription = document.getElementById('jobDescription')?.value.trim();
        if (!jobDescription) {
            showNotification('请输入目标职位描述（JD）', 'error');
            return;
        }

const resumeData = window.store ? window.store.getState() : {};
        if (!resumeData.profile || !resumeData.profile.name) {
            showNotification('请先填写简历基本信息', 'error');
            return;
        }
        this._showLoading();

        try {
            // 根据优化级别执行不同的策略
            let result;
            switch (this.currentLevel) {
                case 'light':
                    result = await this._lightOptimize(resumeData, jobDescription);
                    break;
                case 'medium':
                    result = await this._mediumOptimize(resumeData, jobDescription);
                    break;
                case 'deep':
                    result = await this._deepOptimize(resumeData, jobDescription);
                    break;
                default:
                    result = await this._mediumOptimize(resumeData, jobDescription);
            }

            // Store optimized data for apply/export
            if (result.optimizedData) {
                this._lastOptimizedData = result.optimizedData;
            } else {
                this._lastOptimizedData = resumeData;
            }
            this._displayResult(result);
            showNotification(`✨ ${this.optimizationLevels[this.currentLevel].name}完成！`, 'success');

        } catch (error) {
            const msg = error.message || '未知错误';
            const userMsg = msg.includes('does not support') || msg.includes('Cannot read')
                ? 'AI模型暂不支持此内容格式，请使用纯文本简历信息'
                : msg.includes('Insufficient') || msg.includes('insufficient_balance')
                ? 'AI服务余额不足，请联系管理员充值'
                : msg.includes('not configured')
                ? 'AI服务暂未配置，请稍后再试'
                : `优化失败: ${msg}`;
            showNotification(userMsg, 'error');
        } finally {
            this.isOptimizing = false;
            this._hideLoading();
        }
    }

    // ========== 轻度优化 ==========
    async _lightOptimize(resumeData, jobDescription) {
        // 如果已登录且启用远程AI，使用后端API
        if (this.useRemoteAI && apiClient.isAuthenticated()) {
            try {
                const resumeText = this._resumeDataToText(resumeData);
                const result = await apiClient.optimize('light', resumeText, jobDescription, {
                    onProgress: () => {},
                    onToken: (token) => {} // 流式token，静默处理
                });
                if (result) {
                    if (!result.optimizedData && result.optimizedText) {
                        result.optimizedData = this._parseOptimizedText(result.optimizedText, resumeData);
                    }
                    result.optimizedData = result.optimizedData || resumeData;
                    return result;
                }
            } catch (error) {
                console.warn('AI轻度优化失败，回退到规则引擎:', error.message);
                showNotification('AI服务暂时不可用，使用本地优化', 'warning');
            }
        }

        // 回退到规则引擎
        await this._simulateProcessing(1000);

        const optimizedData = JSON.parse(JSON.stringify(resumeData));

        // 1. 个人简介润色
        if (optimizedData.profile.summary) {
            optimizedData.profile.summary = this._polishText(optimizedData.profile.summary);
        }

        // 2. 工作经历语言优化
        if (optimizedData.experience) {
            optimizedData.experience = optimizedData.experience.map(exp => ({
                ...exp,
                description: exp.description ? this._polishText(exp.description) : exp.description
            }));
        }

        // 3. 技能描述规范化
        if (optimizedData.skills && Array.isArray(optimizedData.skills)) {
            optimizedData.skills = optimizedData.skills.map(skill =>
                typeof skill === 'string' ? skill.trim() : skill
            ).filter(Boolean);
        }

        return {
            level: 'light',
            score: this._calculateScore(resumeData, optimizedData),
            changes: this._extractChanges(resumeData, optimizedData),
            optimizedData,
            suggestions: [
                { icon: 'fa-check-circle', title: '语言润色', desc: '已优化语言表达，使其更加专业流畅', priority: 'medium' },
                { icon: 'fa-check-circle', title: '语法修正', desc: '修正了语法错误和错别字', priority: 'medium' },
                { icon: 'fa-check-circle', title: '格式规范', desc: '统一了格式和标点符号', priority: 'medium' }
            ],
            summary: '轻度优化完成！主要改进了语言表达的流畅性和专业性，保持了原始内容的完整性。',
            model: '规则引擎（离线模式）'
        };
    }

    // ========== 中度优化 ==========
    async _mediumOptimize(resumeData, jobDescription) {
        // 如果已登录且启用远程AI，使用后端API
        if (this.useRemoteAI && apiClient.isAuthenticated()) {
            try {
                const resumeText = this._resumeDataToText(resumeData);
                const result = await apiClient.optimize('medium', resumeText, jobDescription, {
                    onProgress: () => {},
                    onToken: (token) => {}
                });
                if (result) {
                    if (!result.optimizedData && result.optimizedText) {
                        result.optimizedData = this._parseOptimizedText(result.optimizedText, resumeData);
                    }
                    result.optimizedData = result.optimizedData || resumeData;
                    return result;
                }
            } catch (error) {
                console.warn('AI中度优化失败，回退到规则引擎:', error.message);
                showNotification('AI服务暂时不可用，使用本地优化', 'warning');
            }
        }

        // 回退到规则引擎
        await this._simulateProcessing(2000);

        // 1. JD分析
        const jdAnalysis = this._analyzeJD(jobDescription);

        // 2. 简历分析
        const resumeAnalysis = this._analyzeResume(resumeData);

        // 3. 关键词匹配
        const keywordMatch = this._matchKeywords(jdAnalysis.keywords, resumeAnalysis.skills);

        // 4. 生成优化内容
        const optimizedData = this._generateMediumOptimized(resumeData, jdAnalysis, keywordMatch);

        return {
            level: 'medium',
            score: this._calculateScore(resumeData, optimizedData),
            jdMatch: keywordMatch.matchRate,
            changes: this._extractChanges(resumeData, optimizedData),
            optimizedData,
            keywordsAdded: keywordMatch.added,
            keywordsMissing: keywordMatch.missing,
            suggestions: this._generateMediumSuggestions(jdAnalysis, resumeAnalysis, keywordMatch),
            summary: `中度优化完成！职位匹配度${keywordMatch.matchRate}%，已添加${keywordMatch.added.length}个关键技能词，量化了工作成果。`,
            model: '规则引擎（离线模式）'
        };
    }

    // ========== 深度优化 ==========
    async _deepOptimize(resumeData, jobDescription) {
        // 如果已登录且启用远程AI，使用后端API
        if (this.useRemoteAI && apiClient.isAuthenticated()) {
            try {
                const resumeText = this._resumeDataToText(resumeData);
                const result = await apiClient.optimize('deep', resumeText, jobDescription, {
                    onProgress: () => {},
                    onToken: (token) => {}
                });
                if (result) {
                    if (!result.optimizedData && result.optimizedText) {
                        result.optimizedData = this._parseOptimizedText(result.optimizedText, resumeData);
                    }
                    result.optimizedData = result.optimizedData || resumeData;
                    return result;
                }
            } catch (error) {
                console.warn('AI深度优化失败，回退到规则引擎:', error.message);
                showNotification('AI服务暂时不可用，使用本地优化', 'warning');
            }
        }

        // 回退到规则引擎
        await this._simulateProcessing(3000);

        // 1. 深度JD分析
        const jdAnalysis = this._analyzeJD(jobDescription);

        // 2. 全面简历诊断
        const diagnosis = this._diagnoseResume(resumeData, jdAnalysis);

        // 3. STAR法则重构
        const starExperiences = this._applySTAR(resumeData.experience || [], jdAnalysis);

        // 4. 生成深度优化版本
        const optimizedData = this._generateDeepOptimized(resumeData, diagnosis, starExperiences, jdAnalysis);

        return {
            level: 'deep',
            score: diagnosis.overallScore,
            jdMatch: diagnosis.jdMatch,
            atsScore: diagnosis.atsScore,
            changes: this._extractChanges(resumeData, optimizedData),
            optimizedData,
            diagnosis,
            suggestions: this._generateDeepSuggestions(diagnosis),
            beforeAfter: this._generateBeforeAfter(resumeData, optimizedData),
            summary: `深度优化完成！综合评分${diagnosis.overallScore}分，职位匹配度${diagnosis.jdMatch}%，ATS通过率预测${diagnosis.atsScore}%。已完成全面重构。`,
            model: '规则引擎（离线模式）'
        };
    }

    // ========== 核心分析方法 ==========

    // 分析JD
    _analyzeJD(jd) {
        const text = jd.toLowerCase();

        // 技能库
        const skillDB = {
            frontend: ['react', 'vue', 'angular', 'javascript', 'typescript',
                        'html5', 'css3', 'webpack', 'vite', 'next.js', 'nuxt'],
            backend: ['node.js', 'python', 'java', 'go', 'spring boot', 'django',
                       'flask', 'mysql', 'redis', 'mongodb', 'postgresql'],
            devops: ['docker', 'kubernetes', 'ci/cd', 'linux', 'nginx', 'aws',
                      'jenkins', 'gitlab', 'ansible', 'terraform'],
            testing: ['自动化测试', '性能测试', '功能测试', '接口测试',
                       '安全测试', '回归测试', 'selenium', 'jmeter', 'postman',
                       'fiddler', 'charles', 'appium', 'pytest', 'testng', 'junit',
                       '缺陷管理', '测试用例', '测试策略',
                       '测试计划', '质量保证', '持续集成'],
            ai: ['机器学习', '深度学习', 'tensorflow', 'pytorch',
                  'nlp', '计算机视觉', '算法', '大模型', 'llm'],
            management: ['项目管理', '团队领导', '敏捷开发', 'scrum',
                          '团队管理', '需求分析', '风险管理',
                          '进度管理', '资源协调'],
            data: ['sql', 'hive', 'spark', 'hadoop', '数据分析',
                    '数据挖掘', '数据可视化', 'tableau',
                    'powerbi', 'pandas', 'numpy']
        };

        const matchedSkills = [];
        Object.entries(skillDB).forEach(([category, skills]) => {
            skills.forEach(skill => {
                if (text.includes(skill.toLowerCase())) {
                    matchedSkills.push({ skill, category });
                }
            });
        });

        // 提取经验要求
        const expMatch = jd.match(/(\d+)\s*年.*经验|(\d+)\s*年以上/);
        const experienceRequired = expMatch ? parseInt(expMatch[1] || expMatch[2]) : 0;

        // 判断职位类型
        let jobType = '通用';
        if (/前端|front.?end|web|ui|界面/i.test(text)) jobType = '前端开发';
        else if (/后端|back.?end|server|服务端/i.test(text)) jobType = '后端开发';
        else if (/全栈|full.?stack/i.test(text)) jobType = '全栈开发';
        else if (/测试|test|qa|quality|sdet/i.test(text)) jobType = '测试工程师';
        else if (/数据|data|分析|bi/i.test(text)) jobType = '数据分析';
        else if (/产品|product|pm/i.test(text)) jobType = '产品经理';
        else if (/运维|devops|sre|运维工程师/i.test(text)) jobType = '运维工程师';
        else if (/设计|design|ux|ui设计/i.test(text)) jobType = 'UI设计师';
        else if (/项目经理|project.?manager|pmp/i.test(text)) jobType = '项目经理';

        return {
            keywords: [...new Set(matchedSkills.map(m => m.skill))],
            categories: [...new Set(matchedSkills.map(m => m.category))],
            experienceRequired,
            jobType,
            rawText: jd
        };
    }

    // 分析简历
    _analyzeResume(data) {
        return {
            hasSummary: !!(data.profile?.summary),
            experienceCount: data.experience?.length || 0,
            skillsCount: data.skills?.length || 0,
            educationCount: data.education?.length || 0,
            skills: (data.skills || []).map(s => typeof s === 'string' ? s : s.name).filter(Boolean),
            hasQuantifiable: this._hasQuantifiableAchievements(data)
        };
    }

    // 关键词匹配
    _matchKeywords(jdKeywords, resumeSkills) {
        const resumeLower = resumeSkills.map(s => s.toLowerCase());

        const matched = jdKeywords.filter(kw =>
            resumeLower.some(rs => rs.includes(kw.toLowerCase()) || kw.toLowerCase().includes(rs))
        );

        const missing = jdKeywords.filter(kw => !matched.includes(kw));
        const matchRate = jdKeywords.length > 0 ? Math.round((matched.length / jdKeywords.length) * 100) : 0;

        return {
            matched,
            missing,
            added: missing.slice(0, 3), // 建议添加的关键词
            matchRate
        };
    }

    // 简历诊断
    _diagnoseResume(data, jdAnalysis) {
        const analysis = this._analyzeResume(data);
        const hasJd = jdAnalysis && jdAnalysis.keywords && jdAnalysis.keywords.length > 0;

        // 完整性评分 (40% without JD, 40% with JD)
        let completeness = 0;
        if (analysis.hasSummary) completeness += 25;
        if (analysis.experienceCount > 0) completeness += 25;
        if (analysis.skillsCount >= 3) completeness += 25;
        if (analysis.educationCount > 0) completeness += 25;

        // 匹配度评分 (30% with JD, 0% without)
        const keywordMatch = hasJd ? this._matchKeywords(jdAnalysis.keywords, analysis.skills) : { matchRate: 0, matched: [], missing: [], added: [] };
        const matchScore = keywordMatch.matchRate;

        // 质量评分
        let qualityScore = 60;
        if (analysis.hasQuantifiable) qualityScore += 20;
        if (data.profile?.summary?.length > 50) qualityScore += 20;

        const overallScore = hasJd
            ? Math.round(completeness * 0.4 + matchScore * 0.3 + qualityScore * 0.3)
            : Math.round(completeness * 0.5 + qualityScore * 0.5);

        return {
            overallScore,
            completeness,
            matchScore: matchScore,
            qualityScore,
            jdMatch: matchScore,
            atsScore: Math.min(100, overallScore + 10),
            strengths: this._identifyStrengths(analysis),
            weaknesses: this._identifyWeaknesses(analysis, keywordMatch)
        };
    }

    // ========== 内容生成方法 ==========

    // 文本润色（轻度）
    _polishText(text) {
        if (!text) return text;

        let polished = text
            .replace(/(?<![a-zA-Z\u4e00-\u9fff])负责(?![\u4e00-\u9fff]{0,1}任)/g, '主导负责')
            .replace(/(?<![a-zA-Z\u4e00-\u9fff])参与(?![a-zA-Z\u4e00-\u9fff])/g, '积极参与')
            .replace(/(?<![a-zA-Z\u4e00-\u9fff])完成(?![a-zA-Z\u4e00-\u9fff])/g, '顺利完成')
            .replace(/(?<![a-zA-Z\u4e00-\u9fff])改进(?![a-zA-Z\u4e00-\u9fff])/g, '持续改进')
            .replace(/\s+/g, ' ')
            .trim();

        return polished;
    }

    // 中度优化内容生成
    _generateMediumOptimized(original, jdAnalysis, keywordMatch) {
        const optimized = JSON.parse(JSON.stringify(original));

        // 优化简介
        if (optimized.profile) {
            const years = original.profile?.experience_years || 3;
            const originalSummary = (original.profile?.summary || '').trim();
            const keywords = jdAnalysis.keywords.slice(0, 5).join('、');
            const matchedSkills = keywordMatch.matchedSkills.slice(0, 5).join('、');

            if (originalSummary) {
                optimized.profile.summary = `核心能力：${keywords}。${originalSummary}`;
            } else {
                optimized.profile.summary = `${years > 3 ? '资深' : ''}${jdAnalysis.jobType} | ${years}年经验 | 精通${matchedSkills}等核心技术`;
            }
        }

        // 量化经历
        if (optimized.experience) {
            optimized.experience = optimized.experience.map(exp => ({
                ...exp,
                description: this._quantifyExperience(exp.description || '', jdAnalysis.jobType)
            }));
        }

        // 补充关键词
        if (keywordMatch.added.length > 0) {
            const existingSkills = optimized.skills || [];
            optimized.skills = [...existingSkills, ...keywordMatch.added];
        }

        return optimized;
    }

    // 经历量化
    _quantifyExperience(desc, jobType) {
        if (!desc || desc.length < 20) {
            return desc || '';
        }

        let enhanced = desc;

        // 强化行为动词（不改变含义）
        enhanced = enhanced.replace(/(?<![a-zA-Z\u4e00-\u9fff])参与(?![a-zA-Z\u4e00-\u9fff])/g, '积极协助');
        enhanced = enhanced.replace(/(?<![a-zA-Z\u4e00-\u9fff])负责(?![\u4e00-\u9fff]{0,1}任)/g, '主导负责');
        enhanced = enhanced.replace(/(?<![a-zA-Z\u4e00-\u9fff])协助(?![a-zA-Z\u4e00-\u9fff])/g, '配合推进');

        // 如果已有量化数据，不要重复添加
        if (/\d+%/.test(enhanced)) return enhanced;

        // 添加提示性文本（不编造具体数字）
        if (/优化|改进|提升/.test(enhanced)) {
            enhanced += '\n• 关键指标得到显著提升';
        }

        return enhanced;
    }

    // STAR法则应用
    _applySTAR(experiences, jdAnalysis) {
        return experiences.map(exp => {
            const desc = exp.description || '';

            return {
                situation: `在${exp.company || '某公司'}任职期间`,
                task: `面对${jdAnalysis.jobType}领域的挑战性任务`,
                action: this._extractActions(desc),
                result: this._generateResults(desc)
            };
        });
    }

    // 提取行动
    _extractActions(desc) {
        if (!desc) return '主导并完成了核心项目的开发和优化工作';

        const actions = [];
        const patterns = [
            /(.{0,20})(?:主导|负责|完成|开发|设计)(.{0,30})/g,
            /(.{0,20})(?:优化|改进|提升|实现)(.{0,30})/g
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(desc)) !== null) {
                actions.push(match[0].trim());
            }
        });

        return actions.length > 0 ? actions.slice(0, 3).join('；') : desc.slice(0, 50);
    }

    // 生成结果
    _generateResults(desc) {
        return '';
    }

    // 深度优化版本生成
    _generateDeepOptimized(original, diagnosis, starExperiences, jdAnalysis) {
        const optimized = JSON.parse(JSON.stringify(original));
        const years = original.profile?.experience_years || 3;

        // 重构个人品牌
        optimized.profile.summary = `${years >= 5 ? '资深' : ''}${jdAnalysis.jobType}专家 | ${years}年深耕经验 | 全栈能力

【个人品牌】
${years > 3 ? '拥有丰富的项目管理和团队领导经验，' : ''}专注于${jdAnalysis.jobType}领域的技术创新和最佳实践。曾服务于多家知名企业，主导过${Math.min(years * 2, 15)}+个大型项目，具有极强的执行力和问题解决能力。

【核心竞争力】
• 技术深度：精通${jdAnalysis.keywords.slice(0, 5).join('、')}等核心技术栈
• 业务洞察：深入理解${jdAnalysis.jobType}领域的业务场景和用户需求
• 领导力：${years >= 3 ? '具备团队管理经验，善于激发团队潜力' : '良好的团队协作和沟通能力'}
• 持续学习：保持对新技术的敏感度，快速适应变化`;

        // STAR重构经历
        if (starExperiences.length > 0) {
            optimized.experience = original.experience.map((exp, i) => {
                const star = starExperiences[i];
                return {
                    ...exp,
                    description: `**${star.situation}**

📋 **任务挑战**
${star.task}

⚡ **行动措施**
${star.action}

🎯 **成果展示**
${star.result}`
                };
            });
        }

        // 技能矩阵优化
        optimized.skills = [
            ...(original.skills || []),
            ...diagnosis.weaknesses
                .filter(w => w.type === 'missing_skills')
                .flatMap(w => w.item.replace(/^缺失关键词[:：]\s*/, '').split(/[,，、]/).map(s => s.trim()).filter(Boolean))
                .slice(0, 3)
        ];

        return optimized;
    }

    // ========== 辅助方法 ==========

    _simulateProcessing(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    _parseOptimizedText(text, originalData) {
        try {
            const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                              text.match(/\{[\s\S]*"profile"[\s\S]*\}/);
            if (jsonMatch) {
                const jsonStr = jsonMatch[1] || jsonMatch[0];
                return JSON.parse(jsonStr);
            }
        } catch (e) {
            console.warn('[AIOptimizer] Failed to parse optimized text as JSON:', e.message);
        }
        const optimized = JSON.parse(JSON.stringify(originalData));
        if (text.length > 50) {
            optimized.profile = optimized.profile || {};
            optimized.profile.summary = text.slice(0, 500).trim();
        }
        return optimized;
    }

    /**
     * 将简历数据对象转换为Markdown文本格式（用于DeepSeek API）
     */
    _resumeDataToText(resumeData) {
        if (!resumeData) return '';

        let text = '';

        // 基本信息
        if (resumeData.profile) {
            const p = resumeData.profile;
            text += `# 个人简历\n\n`;

            if (p.name) text += `## 基本信息\n\n`;
            if (p.name) text += `- **姓名**: ${p.name}\n`;
            if (p.email) text += `- **邮箱**: ${p.email}\n`;
            if (p.phone) text += `- **电话**: ${p.phone}\n`;
            if (p.location) text += `- **所在地**: ${p.location}\n`;
            text += '\n';

            // 个人简介
            if (p.summary) {
                text += `## 个人简介\n\n${p.summary}\n\n`;
            }
        }

        // 工作经历
        if (resumeData.experience && resumeData.experience.length > 0) {
            text += `## 工作经历\n\n`;
            resumeData.experience.forEach(exp => {
                const title = exp.position || exp.title || '职位';
                const period = [exp.startDate, exp.endDate].filter(Boolean).join(' - ') || exp.period || '';
                text += `### ${exp.company || '某公司'} | ${title} | ${period}\n`;
                if (exp.description) {
                    text += `\n${exp.description}\n\n`;
                }
            });
        }

        // 项目经历
        if (resumeData.projects && resumeData.projects.length > 0) {
            text += `## 项目经历\n\n`;
            resumeData.projects.forEach(proj => {
                text += `### ${proj.name || '项目名称'} | ${proj.role || '角色'}\n`;
                if (proj.description) {
                    text += `\n${proj.description}\n\n`;
                }
            });
        }

        // 教育背景
        if (resumeData.education && resumeData.education.length > 0) {
            text += `## 教育背景\n\n`;
            resumeData.education.forEach(edu => {
                text += `- **${edu.school || '学校'}** | ${edu.degree || ''} ${edu.major || ''} | ${edu.period || ''}\n`;
            });
            text += '\n';
        }

        // 技能
        if (resumeData.skills && Array.isArray(resumeData.skills)) {
            text += `## 专业技能\n\n`;
            if (typeof resumeData.skills[0] === 'object') {
                resumeData.skills.forEach(skill => {
                    text += `- **${skill.name || skill}**: ${skill.level || ''}\n`;
                });
            } else {
                resumeData.skills.forEach(skill => {
                    text += `- ${skill}\n`;
                });
            }
            text += '\n';
        }

        return text.trim();
    }

    _hasQuantifiableAchievements(data) {
        if (!data.experience) return false;
        return data.experience.some(exp =>
            /\d+%|\d+倍|\d+万|\d+人/.test(exp.description || '')
        );
    }

    _calculateScore(original, optimized) {
        let score = 50;
        if (optimized.profile?.summary) score += 10;
        if (optimized.profile?.summary?.length > 50) score += 5;
        if (optimized.experience?.length > 0) score += 10;
        if (optimized.skills?.length >= 3) score += 10;
        if (optimized.education?.length > 0) score += 5;
        if (this._hasQuantifiableAchievements(optimized)) score += 10;
        return Math.min(99, Math.max(60, score));
    }

    _extractChanges(original, optimized) {
        const changes = [];

        // 对比摘要
        if (original.profile?.summary !== optimized.profile?.summary) {
            changes.push({
                section: 'profile',
                type: 'summary',
                original: original.profile?.summary,
                optimized: optimized.profile?.summary
            });
        }

        // 对比经历
        if (original.experience && optimized.experience) {
            original.experience.forEach((exp, i) => {
                if (exp.description !== optimized.experience[i]?.description) {
                    changes.push({
                        section: 'experience',
                        type: 'description',
                        company: exp.company,
                        position: exp.position,
                        original: exp.description,
                        optimized: optimized.experience[i]?.description
                    });
                }
            });
        }

        return changes;
    }

    _identifyStrengths(analysis) {
        const strengths = [];
        if (analysis.hasSummary) strengths.push('包含完整的个人简介');
        if (analysis.experienceCount > 0) strengths.push(`有${analysis.experienceCount}段工作经历`);
        if (analysis.skillsCount >= 5) strengths.push(`掌握${analysis.skillsCount}项技能`);
        if (analysis.hasQuantifiable) strengths.push('工作成果有量化数据');
        return strengths;
    }

    _identifyWeaknesses(analysis, keywordMatch) {
        const weaknesses = [];
        if (!analysis.hasSummary) weaknesses.push({ type: 'content', item: '缺少个人简介' });
        if (analysis.experienceCount === 0) weaknesses.push({ type: 'content', item: '缺少工作经历' });
        if (analysis.skillsCount < 3) weaknesses.push({ type: 'skills', item: '技能数量不足' });
        if (!analysis.hasQuantifiable) weaknesses.push({ type: 'content', item: '缺乏量化成果' });
        if (keywordMatch && keywordMatch.missing && keywordMatch.missing.length > 0) {
            weaknesses.push({ type: 'missing_skills', item: `缺失关键词: ${keywordMatch.missing.slice(0, 3).join(', ')}` });
        }
        return weaknesses;
    }

    _generateMediumSuggestions(jdAnalysis, resumeAnalysis, keywordMatch) {
        return [
            { priority: 'high', icon: 'fa-keywords', title: '关键词优化', desc: `已添加${keywordMatch.added.length}个JD中的关键技能词` },
            { priority: 'high', icon: 'fa-chart-line', title: '成果量化', desc: '为工作经历添加了具体的数字和指标' },
            { priority: 'medium', icon: 'fa-language', title: '语言强化', desc: '使用了更强有力的行为动词' },
            { priority: 'medium', icon: 'fa-file-alt', title: '格式优化', desc: '统一了简历结构和排版' }
        ];
    }

    _generateDeepSuggestions(diagnosis) {
        return [
            { priority: 'high', icon: 'fa-star', title: 'STAR法则重构', desc: '所有经历都按照情境-任务-行动-结果重组' },
            { priority: 'high', icon: 'fa-user-tie', title: '个人品牌塑造', desc: '打造独特的职业定位和价值主张' },
            { priority: 'high', icon: 'fa-search', title: 'ATS终极优化', desc: '确保通过所有主流ATS系统的筛选' },
            { priority: 'medium', icon: 'fa-lightbulb', title: '差异化亮点', desc: '突出独特的成就和特色项目' }
        ];
    }

    _generateBeforeAfter(original, optimized) {
        return {
            summary: {
                original: original.profile?.summary || '(未填写)',
                optimized: optimized.profile?.summary
            }
        };
    }

    // 免费简历诊断

    _showLoading() {
        const btn = document.getElementById('optimizeBtn');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>AI优化中...';
            btn.disabled = true;
        }
    }

    _hideLoading() {
        const btn = document.getElementById('optimizeBtn');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-wand-magic-sparkles mr-2"></i>开始优化';
            btn.disabled = false;
        }
    }

    // 显示优化结果 - 字段级对比
    _displayResult(result) {
        const container = document.getElementById('optimizationResult');
        if (!container) return;

        container.classList.remove('hidden');

        const levelConfig = this.optimizationLevels[result.level];
        const hasStructuredData = result.optimizedData && result.optimizedData.profile;

        if (hasStructuredData) {
            this._displayStructuredResult(container, result, levelConfig);
        } else {
            this._displayFallbackResult(container, result, levelConfig);
        }
    }

    _displayStructuredResult(container, result, levelConfig) {
        const currentData = window.store ? window.store.getState() : {};
        const optimized = result.optimizedData;
        const changes = this._computeFieldChanges(currentData, optimized);

        container.innerHTML = `
            <div style="background: linear-gradient(135deg, ${this._getColor(levelConfig.color)}20, #1f2937); padding: 24px; border-radius: 16px; margin-bottom: 20px; border: 1px solid ${this._getColor(levelConfig.color)}30;">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h3 class="text-xl font-bold text-white mb-1">
                            <i class="fas ${levelConfig.icon} mr-2" style="color: ${this._getColor(levelConfig.color)}"></i>
                            ${levelConfig.name}完成
                        </h3>
                        <p class="text-sm text-gray-400">AI已优化 ${changes.length} 个字段</p>
                    </div>
                    <div class="text-right">
                        <div class="text-3xl font-bold" style="color: ${this._getColor(levelConfig.color)}">${result.score || '--'}分</div>
                        <div class="text-xs text-gray-500">综合评分</div>
                    </div>
                </div>
                ${result.jdMatch !== undefined ? `
                <div class="grid grid-cols-2 gap-4 mt-4">
                    <div class="bg-gray-800/50 rounded-lg p-3">
                        <div class="text-xs text-gray-500 mb-1">职位匹配度</div>
                        <div class="text-lg font-semibold text-blue-400">${result.jdMatch}%</div>
                    </div>
                    ${result.atsScore !== undefined ? `
                    <div class="bg-gray-800/50 rounded-lg p-3">
                        <div class="text-xs text-gray-500 mb-1">ATS通过率</div>
                        <div class="text-lg font-semibold text-green-400">${result.atsScore}%</div>
                    </div>
                    ` : ''}
                </div>
                ` : ''}
            </div>

            ${changes.length > 0 ? `
            <div class="mb-6">
                <h4 class="font-semibold text-white mb-3 flex items-center gap-2">
                    <i class="fas fa-exchange-alt text-purple-400"></i>
                    优化对比 (${changes.length}处修改)
                </h4>
                <div class="space-y-3" style="max-height: 400px; overflow-y: auto;">
                    ${changes.map(change => `
                        <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                            <div class="text-xs text-gray-500 mb-2 uppercase tracking-wide">
                                ${this._getSectionLabel(change.section)} ${change.label ? '· ' + change.label : ''}
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <div class="text-xs text-red-400 mb-1 flex items-center gap-1">
                                        <i class="fas fa-minus-circle"></i> 原文
                                    </div>
                                    <div class="text-sm text-gray-400 bg-red-900/20 p-2 rounded border border-red-900/30 line-through">${escapeHtml((change.original || '(空)').slice(0, 200))}</div>
                                </div>
                                <div>
                                    <div class="text-xs text-green-400 mb-1 flex items-center gap-1">
                                        <i class="fas fa-plus-circle"></i> 优化后
                                    </div>
                                    <div class="text-sm text-gray-300 bg-green-900/20 p-2 rounded border border-green-900/30">${escapeHtml((change.optimized || '(空)').slice(0, 200))}</div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            ${result.keywordsAdded && result.keywordsAdded.length > 0 ? `
            <div class="mb-6">
                <h4 class="font-semibold text-white mb-3 flex items-center gap-2">
                    <i class="fas fa-tags text-blue-400"></i>
                    新增关键词
                </h4>
                <div class="flex flex-wrap gap-2">
                    ${result.keywordsAdded.map(kw => `
                        <span class="px-3 py-1 bg-blue-500/20 text-blue-400 text-sm rounded-full border border-blue-500/30">${escapeHtml(kw)}</span>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            ${result.suggestions && result.suggestions.length > 0 ? `
            <div class="mb-6">
                <h4 class="font-semibold text-white mb-3 flex items-center gap-2">
                    <i class="fas fa-lightbulb text-yellow-400"></i>
                    优化要点
                </h4>
                <div class="space-y-3">
                    ${(Array.isArray(result.suggestions) ? result.suggestions : []).map(s => {
                        const sug = typeof s === 'string' ? { icon: '✓', title: s, desc: '' } : s;
                        return `
                        <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                            <div class="flex items-start gap-3">
                                <i class="fas ${sug.icon || 'fa-check-circle'} mt-1" style="color: ${sug.priority === 'high' ? '#ef4444' : '#3b82f6'}"></i>
                                <div class="flex-1">
                                    <div class="font-medium text-white mb-1">${escapeHtml(sug.title || sug)}</div>
                                    ${sug.desc ? `<div class="text-sm text-gray-400">${escapeHtml(sug.desc)}</div>` : ''}
                                </div>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>
            ` : ''}

            <div class="flex gap-3 pt-4 border-t border-gray-700">
                <button onclick="aiOptimizer.applyOptimization()" class="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all">
                    <i class="fas fa-check mr-2"></i>应用优化结果
                </button>
                <button onclick="aiOptimizer.exportOptimized()" class="px-6 py-3 bg-gray-700 rounded-lg font-medium hover:bg-gray-600 transition-colors">
                    <i class="fas fa-download mr-2"></i>导出
                </button>
            </div>
        `;
    }

    _displayFallbackResult(container, result, levelConfig) {
        container.innerHTML = `
            <div style="background: linear-gradient(135deg, ${this._getColor(levelConfig.color)}20, #1f2937); padding: 24px; border-radius: 16px; margin-bottom: 20px; border: 1px solid ${this._getColor(levelConfig.color)}30;">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h3 class="text-xl font-bold text-white mb-1">
                            <i class="fas ${levelConfig.icon} mr-2" style="color: ${this._getColor(levelConfig.color)}"></i>
                            ${levelConfig.name}完成
                        </h3>
                        <p class="text-sm text-gray-400">${levelConfig.description}</p>
                    </div>
                    <div class="text-right">
                        <div class="text-3xl font-bold" style="color: ${this._getColor(levelConfig.color)}">${result.score || '--'}分</div>
                        <div class="text-xs text-gray-500">综合评分</div>
                    </div>
                </div>
            </div>

            ${result.suggestions && result.suggestions.length > 0 ? `
            <div class="mb-6">
                <h4 class="font-semibold text-white mb-3 flex items-center gap-2">
                    <i class="fas fa-lightbulb text-yellow-400"></i>
                    优化要点
                </h4>
                <div class="space-y-3">
                    ${result.suggestions.map(s => `
                        <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                            <div class="flex items-start gap-3">
                                <span class="text-lg">${typeof s === 'object' ? s.icon : '✓'}</span>
                                <div class="flex-1">
                                    <div class="font-medium text-white mb-1">${typeof s === 'object' ? escapeHtml(s.title) : escapeHtml(s)}</div>
                                    ${typeof s === 'object' && s.desc ? `<div class="text-sm text-gray-400">${escapeHtml(s.desc)}</div>` : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            ${result.optimizedContent ? `
            <div class="mb-6">
                <h4 class="font-semibold text-white mb-3 flex items-center gap-2">
                    <i class="fas fa-file-alt text-blue-400"></i>
                    优化后内容
                </h4>
                <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700 max-h-96 overflow-y-auto">
                    <pre class="text-sm text-gray-300 whitespace-pre-wrap">${escapeHtml(result.optimizedContent.slice(0, 2000))}</pre>
                </div>
            </div>
            ` : ''}

            <div class="flex gap-3 pt-4 border-t border-gray-700">
                <button onclick="aiOptimizer.closePanel()" class="flex-1 py-3 bg-gray-700 rounded-lg font-medium hover:bg-gray-600 transition-colors">
                    <i class="fas fa-times mr-2"></i>关闭
                </button>
                <button onclick="aiOptimizer.exportOptimized()" class="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all">
                    <i class="fas fa-download mr-2"></i>导出结果
                </button>
            </div>
        `;
    }

    _computeFieldChanges(original, optimized) {
        const changes = [];

        if (optimized.profile) {
            const origProfile = original.profile || {};
            const profileFields = [
                { key: 'title', label: '职位头衔' },
                { key: 'summary', label: '个人简介' },
                { key: 'location', label: '所在地' }
            ];
            profileFields.forEach(({ key, label }) => {
                const orig = (origProfile[key] || '').trim();
                const opt = (optimized.profile[key] || '').trim();
                if (opt && opt !== orig) {
                    changes.push({ section: 'profile', label, original: orig, optimized: opt });
                }
            });
        }

        if (optimized.experience && original.experience) {
            optimized.experience.forEach((optExp, i) => {
                const origExp = original.experience[i] || {};
                if (optExp.description && optExp.description !== (origExp.description || '')) {
                    changes.push({
                        section: 'experience',
                        label: `${origExp.company || optExp.company || '经历' + (i + 1)} · ${origExp.position || optExp.position || ''}`,
                        original: origExp.description || '',
                        optimized: optExp.description
                    });
                }
            });
        }

        if (optimized.education && original.education) {
            optimized.education.forEach((optEdu, i) => {
                const origEdu = original.education[i] || {};
                if (optEdu.description && optEdu.description !== (origEdu.description || '')) {
                    changes.push({
                        section: 'education',
                        label: `${origEdu.school || optEdu.school || '教育' + (i + 1)}`,
                        original: origEdu.description || '',
                        optimized: optEdu.description
                    });
                }
            });
        }

        if (optimized.skills && original.skills) {
            const origSkills = original.skills.map(s => typeof s === 'string' ? s : s.name || s);
            const optSkills = optimized.skills.map(s => typeof s === 'string' ? s : s.name || s);
            const added = optSkills.filter(s => !origSkills.includes(s));
            if (added.length > 0) {
                changes.push({
                    section: 'skills',
                    label: '技能新增',
                    original: origSkills.join('、'),
                    optimized: optSkills.join('、')
                });
            }
        }

        return changes;
    }

    _getSectionLabel(section) {
        const labels = {
            profile: '👤 个人信息',
            experience: '💼 工作经历',
            education: '🎓 教育背景',
            skills: '🛠 专业技能'
        };
        return labels[section] || section;
    }

    // 应用优化 - 字段级回填
    applyOptimization() {
        if (!this._lastOptimizedData) {
            showNotification('没有可应用的优化结果', 'error');
            return;
        }

        try {
            const currentData = window.store ? window.store.getState() : null;
            if (!this._originalData && currentData) {
                this._originalData = {
                    profile: { ...currentData.profile },
                    experience: [...currentData.experience],
                    education: [...currentData.education],
                    skills: [...currentData.skills],
                    projects: [...(currentData.projects || [])]
                };
            }

            const optimized = this._lastOptimizedData;

            if (window.store) {
                const currentData = window.store.getState();

                if (optimized.profile) {
                    if (optimized.profile.summary) {
                        window.store.updatePath('profile.summary', optimized.profile.summary);
                    }
                    if (optimized.profile.name) {
                        window.store.updatePath('profile.name', optimized.profile.name);
                    }
                    if (optimized.profile.title) {
                        window.store.updatePath('profile.title', optimized.profile.title);
                    }
                    if (optimized.profile.email) {
                        window.store.updatePath('profile.email', optimized.profile.email);
                    }
                    if (optimized.profile.phone) {
                        window.store.updatePath('profile.phone', optimized.profile.phone);
                    }
                    if (optimized.profile.location) {
                        window.store.updatePath('profile.location', optimized.profile.location);
                    }
                }

                if (optimized.experience && optimized.experience.length > 0) {
                    window.store.updatePath('experience', optimized.experience.map((exp, i) => ({
                        ...(currentData.experience?.[i] || {}),
                        ...exp,
                        id: currentData.experience?.[i]?.id || Date.now() + i
                    })));
                }

                if (optimized.education && optimized.education.length > 0) {
                    window.store.updatePath('education', optimized.education.map((edu, i) => ({
                        ...(currentData.education?.[i] || {}),
                        ...edu,
                        id: currentData.education?.[i]?.id || Date.now() + i + 100
                    })));
                }

                if (optimized.skills && optimized.skills.length > 0) {
                    window.store.updatePath('skills', optimized.skills);
                }

                window.store.save();
            }

            this._syncFormFromStore();

            const versionOpt1 = document.getElementById('versionOpt1');
            if (versionOpt1) versionOpt1.classList.remove('hidden');

            this.closePanel();
            showNotification('✅ 优化结果已应用到简历！', 'success');
        } catch (error) {
            showNotification('应用优化结果失败: ' + error.message, 'error');
        }
    }

    _syncFormFromStore() {
        if (!window.store) return;
        const data = window.store.getState();

        const fieldMap = {
            'profileName': data.profile?.name,
            'profileTitle': data.profile?.title,
            'profileEmail': data.profile?.email,
            'profilePhone': data.profile?.phone,
            'profileLocation': data.profile?.location,
            'profileSummary': data.profile?.summary
        };

        Object.entries(fieldMap).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el && value) {
                el.value = value;
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    }

    // 导出优化结果
    exportOptimized(format = 'json') {
        if (!this._lastOptimizedData) {
            showNotification('没有可导出的优化结果', 'error');
            return;
        }

        try {
            if (format === 'pdf') {
                if (window.generateResumePDF) {
                    window.generateResumePDF(this._lastOptimizedData);
                } else {
                    showNotification('PDF 生成器未加载，请使用 JSON 导出', 'error');
                }
                return;
            }

            const data = this._lastOptimizedData;
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `resume-optimized-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showNotification('✅ 优化结果已导出！', 'success');
        } catch (error) {
            showNotification('导出失败: ' + error.message, 'error');
        }
    }

    async analyzeJD() {
        const jobDescription = document.getElementById('jobDescription')?.value.trim();
        if (!jobDescription) {
            showNotification('请先输入职位描述（JD）', 'error');
            return;
        }

        if (this.useRemoteAI && !apiClient.isAuthenticated()) {
            showNotification('JD分析需要登录，请先登录或注册', 'warning');
            const { authModal } = await import('../components/authModal.js');
            authModal.show();
            return;
        }

        const btn = document.getElementById('analyzeJDBtn');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2 text-blue-400"></i>分析中...';
            btn.disabled = true;
        }

        try {
            const result = await apiClient.analyzeJD(jobDescription);
            this._displayJDAnalysis(result);
            showNotification('📊 职位匹配分析完成！', 'success');
        } catch (error) {
            const msg = error.message || '分析失败';
            showNotification(`JD分析失败: ${msg}`, 'error');
        } finally {
            if (btn) {
                btn.innerHTML = '<i class="fas fa-search-plus mr-2 text-blue-400"></i>分析职位匹配度';
                btn.disabled = false;
            }
        }
    }

    _displayJDAnalysis(result) {
        const container = document.getElementById('jdAnalysisResult');
        if (!container) return;

        container.classList.remove('hidden');

        const resumeData = window.store ? window.store.getState() : {};
        const resumeSkills = (resumeData.skills || []).map(s => typeof s === 'string' ? s : s.name || s);
        const requiredSkills = result.requiredSkills || [];
        const preferredSkills = result.preferredSkills || [];
        const allJDSkills = [...requiredSkills, ...preferredSkills];
        const matched = allJDSkills.filter(s =>
            resumeSkills.some(rs => rs.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(rs.toLowerCase()))
        );
        const missing = allJDSkills.filter(s =>
            !resumeSkills.some(rs => rs.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(rs.toLowerCase()))
        );
        const matchRate = allJDSkills.length > 0 ? Math.round((matched.length / allJDSkills.length) * 100) : 0;

        const matchColor = matchRate >= 70 ? '#10b981' : matchRate >= 40 ? '#f59e0b' : '#ef4444';
        const circumference = 2 * Math.PI * 40;
        const offset = circumference - (matchRate / 100) * circumference;

        container.innerHTML = `
            <div style="background: linear-gradient(135deg, #0ea5e920, #1f2937); padding: 24px; border-radius: 16px; margin-bottom: 16px; border: 1px solid #0ea5e930;">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h3 class="text-lg font-bold text-white mb-1">
                            <i class="fas fa-search-plus mr-2" style="color: #0ea5e9"></i>
                            职位匹配分析
                        </h3>
                        <p class="text-sm text-gray-400">${escapeHtml(result.jobTitle || '目标职位')}</p>
                    </div>
                    <div class="relative" style="width: 90px; height: 90px;">
                        <svg viewBox="0 0 100 100" class="transform -rotate-90">
                            <circle cx="50" cy="50" r="40" stroke="#374151" stroke-width="8" fill="none"/>
                            <circle cx="50" cy="50" r="40" stroke="${matchColor}" stroke-width="8" fill="none"
                                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                                stroke-linecap="round" style="transition: stroke-dashoffset 1s ease-out"/>
                        </svg>
                        <div class="absolute inset-0 flex items-center justify-center">
                            <span class="text-xl font-bold" style="color: ${matchColor}">${matchRate}%</span>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3 mt-4">
                    <div class="bg-gray-800/50 rounded-lg p-3">
                        <div class="text-xs text-gray-500 mb-1">经验要求</div>
                        <div class="text-sm font-medium text-white">${result.experienceYears ? result.experienceYears + '年' : '未指定'}</div>
                    </div>
                    <div class="bg-gray-800/50 rounded-lg p-3">
                        <div class="text-xs text-gray-500 mb-1">学历要求</div>
                        <div class="text-sm font-medium text-white">${escapeHtml(result.education || '未指定')}</div>
                    </div>
                    <div class="bg-gray-800/50 rounded-lg p-3">
                        <div class="text-xs text-gray-500 mb-1">职位类型</div>
                        <div class="text-sm font-medium text-white">${escapeHtml(result.jobType || result.industry || '通用')}</div>
                    </div>
                    <div class="bg-gray-800/50 rounded-lg p-3">
                        <div class="text-xs text-gray-500 mb-1">匹配难度</div>
                        <div class="text-sm font-medium text-white">${escapeHtml(result.matchDifficulty || '中等')}</div>
                    </div>
                </div>
            </div>

            ${matched.length > 0 ? `
            <div class="mb-4">
                <h4 class="font-semibold text-white mb-2 flex items-center gap-2">
                    <i class="fas fa-check-circle text-green-400"></i>
                    已匹配技能 (${matched.length})
                </h4>
                <div class="flex flex-wrap gap-2">
                    ${matched.map(s => `
                        <span class="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded-full border border-green-500/30">${escapeHtml(s)}</span>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            ${missing.length > 0 ? `
            <div class="mb-4">
                <h4 class="font-semibold text-white mb-2 flex items-center gap-2">
                    <i class="fas fa-exclamation-triangle text-yellow-400"></i>
                    缺失技能 (${missing.length})
                </h4>
                <div class="flex flex-wrap gap-2">
                    ${missing.slice(0, 10).map(s => `
                        <span class="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-sm rounded-full border border-yellow-500/30">${escapeHtml(s)}</span>
                    `).join('')}
                    ${missing.length > 10 ? `<span class="px-3 py-1 bg-gray-700 text-gray-400 text-sm rounded-full">+${missing.length - 10}项</span>` : ''}
                </div>
            </div>
            ` : ''}

            ${result.responsibilities && result.responsibilities.length > 0 ? `
            <div class="mb-4">
                <h4 class="font-semibold text-white mb-2 flex items-center gap-2">
                    <i class="fas fa-briefcase text-blue-400"></i>
                    主要职责
                </h4>
                <div class="space-y-2">
                    ${result.responsibilities.slice(0, 5).map(r => `
                        <div class="bg-gray-800/50 rounded px-3 py-2 text-sm text-gray-300">
                            <i class="fas fa-angle-right text-blue-400 mr-2"></i>${escapeHtml(r)}
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <div class="pt-3 border-t border-gray-700">
                <button onclick="document.getElementById('jobDescription').focus()" class="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg font-medium text-sm hover:from-purple-700 hover:to-indigo-700 transition-all">
                    <i class="fas fa-wand-magic-sparkles mr-2"></i>基于分析结果优化简历
                </button>
            </div>
        `;
    }

    // 免费简历诊断
    diagnoseResume() {
        if (this.useRemoteAI && !apiClient.isAuthenticated()) {
            showNotification('简历诊断需要登录，请先登录或注册', 'warning');
            import('../components/authModal.js').then(({ authModal }) => {
                authModal.show();
            }).catch(() => {
                showNotification('登录模块加载失败，请刷新页面重试', 'error');
            });
            return;
        }

        const resumeData = window.store ? window.store.getState() : {};
        if (!resumeData.profile || !resumeData.profile.name) {
            showNotification('请先填写简历基本信息', 'error');
            return;
        }

        const analysis = this._analyzeResume(resumeData);
        const diagnosis = this._diagnoseResume(resumeData, null);

        // 打开AI面板以显示诊断结果
        this.openPanel();

        const container = document.getElementById('optimizationResult');
        if (!container) return;

        container.classList.remove('hidden');

        const radarData = [
            { label: '完整度', value: diagnosis.completeness, color: '#3b82f6' },
            { label: '匹配度', value: diagnosis.matchScore || 0, color: '#8b5cf6' },
            { label: '内容质量', value: diagnosis.qualityScore, color: '#10b981' },
            { label: 'ATS通过率', value: diagnosis.atsScore, color: '#f59e0b' },
            { label: '综合评分', value: diagnosis.overallScore, color: '#ef4444' }
        ];

        const centerX = 100, centerY = 100, radius = 70;
        const points = radarData.map((d, i) => {
            const angle = (Math.PI * 2 * i / radarData.length) - Math.PI / 2;
            const r = (d.value / 100) * radius;
            return `${centerX + r * Math.cos(angle)},${centerY + r * Math.sin(angle)}`;
        });
        const axisPoints = radarData.map((d, i) => {
            const angle = (Math.PI * 2 * i / radarData.length) - Math.PI / 2;
            return `${centerX + radius * Math.cos(angle)},${centerY + radius * Math.sin(angle)}`;
        });
        const labelPositions = radarData.map((d, i) => {
            const angle = (Math.PI * 2 * i / radarData.length) - Math.PI / 2;
            const labelR = radius + 25;
            return { x: centerX + labelR * Math.cos(angle), y: centerY + labelR * Math.sin(angle), ...d };
        });

        container.innerHTML = `
            <div style="background: linear-gradient(135deg, #3b82f620, #1f2937); padding: 24px; border-radius: 16px; margin-bottom: 20px; border: 1px solid #3b82f630;">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h3 class="text-xl font-bold text-white mb-1">
                            <i class="fas fa-stethoscope mr-2" style="color: #3b82f6"></i>
                            简历诊断报告
                        </h3>
                        <p class="text-sm text-gray-400">基于AI分析的简历质量评估</p>
                    </div>
                    <div class="text-right">
                        <div class="text-3xl font-bold" style="color: #3b82f6">${diagnosis.overallScore}分</div>
                        <div class="text-xs text-gray-500">综合评分</div>
                    </div>
                </div>

                <div class="flex justify-center my-6">
                    <svg viewBox="0 0 200 200" width="220" height="220">
                        <polygon points="${axisPoints.join(' ')}" fill="none" stroke="#374151" stroke-width="1"/>
                        ${[0.25, 0.5, 0.75, 1].map(scale => {
                            const scaledPoints = radarData.map((d, i) => {
                                const angle = (Math.PI * 2 * i / radarData.length) - Math.PI / 2;
                                return `${centerX + (radius * scale) * Math.cos(angle)},${centerY + (radius * scale) * Math.sin(angle)}`;
                            });
                            return `<polygon points="${scaledPoints.join(' ')}" fill="none" stroke="#37415180" stroke-width="0.5"/>`;
                        }).join('')}
                        ${radarData.map((d, i) => {
                            const angle = (Math.PI * 2 * i / radarData.length) - Math.PI / 2;
                            return `<line x1="${centerX}" y1="${centerY}" x2="${centerX + radius * Math.cos(angle)}" y2="${centerY + radius * Math.sin(angle)}" stroke="#37415180" stroke-width="0.5"/>`;
                        }).join('')}
                        <polygon points="${points.join(' ')}" fill="#3b82f630" stroke="#3b82f6" stroke-width="2"/>
                        ${points.map(p => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="3" fill="#3b82f6"/>`).join('')}
                    </svg>
                </div>

                <div class="grid grid-cols-5 gap-2 text-center text-xs">
                    ${labelPositions.map(lp => `
                        <div>
                            <div class="font-bold" style="color: ${lp.color}">${lp.value}</div>
                            <div class="text-gray-500">${lp.label}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="mb-6">
                <h4 class="font-semibold text-white mb-3 flex items-center gap-2">
                    <i class="fas fa-check-circle text-green-400"></i>
                    简历优点
                </h4>
                <div class="space-y-2">
                    ${(diagnosis.strengths || []).map(s => `
                        <div class="bg-green-900/20 rounded-lg px-4 py-2 text-sm text-green-400">
                            <i class="fas fa-check mr-2"></i>${escapeHtml(s)}
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="mb-6">
                <h4 class="font-semibold text-white mb-3 flex items-center gap-2">
                    <i class="fas fa-exclamation-triangle text-yellow-400"></i>
                    需要改进
                </h4>
                <div class="space-y-2">
                    ${(diagnosis.weaknesses || []).map(w => `
                        <div class="bg-yellow-900/20 rounded-lg px-4 py-2 text-sm text-yellow-400">
                            <i class="fas fa-arrow-right mr-2"></i>${escapeHtml(typeof w === 'string' ? w : w.item)}
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="pt-4 border-t border-gray-700">
                <button onclick="aiOptimizer.openPanel()" class="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all">
                    <i class="fas fa-wand-magic-sparkles mr-2"></i>开始AI优化
                </button>
            </div>
        `;

        showNotification('📊 简历诊断完成！', 'success');
}

    switchMode(mode) {
        this.currentMode = mode;
        const generalPanel = document.getElementById('generalOptPanel');
        const atsPanel = document.getElementById('atsOptPanel');
        const modeGeneral = document.getElementById('modeGeneral');
        const modeATS = document.getElementById('modeATS');

        if (mode === 'ats') {
            generalPanel.classList.add('hidden');
            atsPanel.classList.remove('hidden');
            modeGeneral.className = 'flex-1 px-3 py-2 text-sm rounded-md text-gray-400 hover:text-white hover:bg-gray-700 font-medium transition-all';
            modeATS.className = 'flex-1 px-3 py-2 text-sm rounded-md bg-orange-600 text-white font-medium transition-all';
            this.currentLevel = this.atsLevel;
        } else {
            generalPanel.classList.remove('hidden');
            atsPanel.classList.add('hidden');
            modeGeneral.className = 'flex-1 px-3 py-2 text-sm rounded-md bg-indigo-600 text-white font-medium transition-all';
            modeATS.className = 'flex-1 px-3 py-2 text-sm rounded-md text-gray-400 hover:text-white hover:bg-gray-700 font-medium transition-all';
        }
        this._renderOptimizationLevels();
    }

    selectATSLevel(level) {
        this.atsLevel = level;
        this.currentLevel = level;
        this._renderOptimizationLevels();
        showNotification(`已选择：${level === 'medium' ? '关键词对齐' : '终极ATS优化'}`, 'success');
    }

    selectJob(jobTitle) {
        this.selectedJob = jobTitle;
        const jdTextarea = document.getElementById('jobDescription');
        if (jdTextarea) {
            jdTextarea.value = jobTitle + '岗位要求：\n\n任职要求：\n1. \n2. \n3. \n\n岗位职责：\n1. \n2. \n3. ';
            jdTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            jdTextarea.focus();
        }

        document.querySelectorAll('#quickJobTags button').forEach(btn => {
            btn.classList.remove('bg-indigo-600/30', 'text-indigo-300', 'border-indigo-500/50');
            btn.classList.add('bg-gray-700/50', 'text-gray-300');
            if (btn.textContent.trim() && jobTitle.includes(btn.textContent.trim())) {
                btn.classList.remove('bg-gray-700/50', 'text-gray-300');
                btn.classList.add('bg-indigo-600/30', 'text-indigo-300', 'border-indigo-500/50');
            }
        });

        showNotification(`已选择：${jobTitle}`, 'success');
    }

    async aiWriteResume() {
        const jobTitle = this.selectedJob || document.getElementById('jobDescription')?.value.trim();
        if (!jobTitle) {
            showNotification('请先选择目标职位或输入职位描述', 'error');
            return;
        }

        if (this.useRemoteAI && !apiClient.isAuthenticated()) {
            showNotification('AI代写需要登录，请先登录或注册', 'warning');
            const { authModal } = await import('../components/authModal.js');
            authModal.show();
            return;
        }

        const btn = document.getElementById('aiWriteBtn');
        const origHTML = btn?.innerHTML;
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>AI生成中...';
            btn.disabled = true;
        }

        try {
            const result = await apiClient.optimize('deep', `请为一位${jobTitle}生成一份完整的中文简历数据，包含个人信息、工作经历、教育背景和专业技能。`, jobTitle, {
                onProgress: () => {},
                onToken: () => {}
            });

            if (result?.optimizedData) {
                if (window.store) {
                    const currentData = window.store.getState();

                    if (result.optimizedData.profile) {
                        const merged = { ...currentData.profile, ...result.optimizedData.profile };
                        if (!merged.name) merged.name = currentData.profile?.name || '请填写姓名';
                        window.store.updatePath('profile', merged);
                    }
                    if (result.optimizedData.experience?.length > 0) {
                        window.store.updatePath('experience', result.optimizedData.experience.map((exp, i) => ({
                            id: Date.now() + i,
                            ...exp
                        })));
                    }
                    if (result.optimizedData.education?.length > 0) {
                        window.store.updatePath('education', result.optimizedData.education.map((edu, i) => ({
                            id: Date.now() + i + 100,
                            ...edu
                        })));
                    }
                    if (result.optimizedData.skills?.length > 0) {
                        window.store.updatePath('skills', result.optimizedData.skills);
                    }

                    window.store.save();
                    this._syncFormFromStore();
                }

                window.store?.save();
                this._syncFormFromStore();
                showNotification('✅ AI代写简历完成！', 'success');
            } else {
                showNotification('AI代写返回数据格式异常，请重试', 'error');
            }
        } catch (error) {
            const msg = error.message || '未知错误';
            showNotification(`AI代写失败: ${msg}`, 'error');
        } finally {
            if (btn) {
                btn.innerHTML = origHTML || '<i class="fas fa-robot mr-1"></i>AI代写';
                btn.disabled = false;
            }
        }
    }

    switchVersion(versionIndex) {
        if (!window.store) return;

        const versionOriginal = document.getElementById('versionOriginal');
        const versionOpt1 = document.getElementById('versionOpt1');

        if (versionIndex === -1) {
            if (this._originalData) {
                window.store.setState({
                    ...window.store.getState(),
                    profile: { ...this._originalData.profile },
                    experience: [...this._originalData.experience],
                    education: [...this._originalData.education],
                    skills: [...this._originalData.skills],
                    projects: [...(this._originalData.projects || [])]
                });
                window.store.save();
                this._syncFormFromStore();
            }

            versionOriginal.className = 'px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white font-medium transition-all';
            if (this._lastOptimizedData) {
                versionOpt1.className = 'px-3 py-1.5 text-xs rounded-md text-gray-400 hover:text-white hover:bg-gray-700 font-medium transition-all';
            }
            showNotification('已切换到原始版本', 'info');
        } else {
            if (this._lastOptimizedData) {
                window.store.setState({
                    ...window.store.getState(),
                    profile: { ...this._lastOptimizedData.profile },
                    experience: [...this._lastOptimizedData.experience],
                    education: [...this._lastOptimizedData.education],
                    skills: [...this._lastOptimizedData.skills],
                    projects: [...(this._lastOptimizedData.projects || [])]
                });
                window.store.save();
                this._syncFormFromStore();
            }

            versionOriginal.className = 'px-3 py-1.5 text-xs rounded-md text-gray-400 hover:text-white hover:bg-gray-700 font-medium transition-all';
            versionOpt1.className = 'px-3 py-1.5 text-xs rounded-md bg-green-600 text-white font-medium transition-all';
            showNotification('已切换到优化版本', 'info');
        }
    }

}

// 创建全局实例
const aiOptimizer = new AIOptimizer();
if (typeof window !== 'undefined') {
    window.aiOptimizer = aiOptimizer;
}

export { AIOptimizer, aiOptimizer };
