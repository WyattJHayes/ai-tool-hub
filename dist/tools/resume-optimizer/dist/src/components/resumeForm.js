/**
 * Resume Form Component
 * Handles all form inputs for resume editing
 */

import { escapeHtml, escapeAttr } from '../lib/utils.js';
import { store } from '../lib/store.js';

class ResumeForm {
    constructor() {
        this.container = document.getElementById('resumeForm');
        this.render();
        this.attachListeners();
    }

    render() {
        this.container.innerHTML = `
            <!-- Profile Section -->
            <div class="form-section">
                <h3 class="form-section-title">
                    <i class="fas fa-user"></i>
                    个人信息
                </h3>
                <div class="form-group">
                    <label class="form-label">姓名 *</label>
                    <input type="text" class="form-input" id="profileName" placeholder="请输入姓名">
                </div>
                <div class="form-group">
                    <label class="form-label">职位头衔</label>
                    <input type="text" class="form-input" id="profileTitle" placeholder="如：高级前端工程师">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">邮箱</label>
                        <input type="email" class="form-input" id="profileEmail" placeholder="example@email.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label">电话</label>
                        <input type="tel" class="form-input" id="profilePhone" placeholder="138-xxxx-xxxx">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">所在地</label>
                    <input type="text" class="form-input" id="profileLocation" placeholder="如：北京">
                </div>
                <div class="form-group">
                    <label class="form-label">个人简介</label>
                    <textarea class="form-textarea" id="profileSummary" rows="4" placeholder="简要介绍自己的专业背景和核心优势..."></textarea>
                </div>
            </div>

            <!-- Experience Section -->
            <div class="form-section">
                <h3 class="form-section-title">
                    <i class="fas fa-briefcase"></i>
                    工作经历
                </h3>
                <div id="experienceList"></div>
                <button onclick="resumeForm.addExperience()" class="btn-add">
                    <i class="fas fa-plus"></i>
                    添加工作经历
                </button>
            </div>

            <!-- Education Section -->
            <div class="form-section">
                <h3 class="form-section-title">
                    <i class="fas fa-graduation-cap"></i>
                    教育背景
                </h3>
                <div id="educationList"></div>
                <button onclick="resumeForm.addEducation()" class="btn-add">
                    <i class="fas fa-plus"></i>
                    添加教育背景
                </button>
            </div>

            <!-- Skills Section -->
            <div class="form-section">
                <h3 class="form-section-title">
                    <i class="fas fa-tools"></i>
                    技能专长
                </h3>
                <div class="form-group">
                    <label class="form-label">技能标签（用逗号分隔）</label>
                    <textarea class="form-textarea" id="skillsInput" rows="3" placeholder="如：JavaScript, React, Vue.js, Node.js..."></textarea>
                </div>
                <div id="skillsTags" class="skills-list mt-2"></div>
            </div>
        `;

        this.loadFromStore();
    }

    attachListeners() {
        // Profile inputs
        const profileInputs = ['profileName', 'profileTitle', 'profileEmail', 'profilePhone', 'profileLocation', 'profileSummary'];
        profileInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', (e) => {
                    const field = id.replace('profile', '').toLowerCase();
                    store.updatePath(`profile.${field}`, e.target.value);
                });
            }
        });

        // Skills input
        const skillsInput = document.getElementById('skillsInput');
        if (skillsInput) {
            skillsInput.addEventListener('input', (e) => {
                const skills = e.target.value.split(/[,，]/).map(s => s.trim()).filter(s => s);
                store.updatePath('skills', skills);
                this.renderSkillsTags(skills);
            });
        }
    }

    loadFromStore() {
        const state = store.getState();

        // 加载 profile（添加空值检查）
        const nameInput = document.getElementById('profileName');
        const titleInput = document.getElementById('profileTitle');
        const emailInput = document.getElementById('profileEmail');
        const phoneInput = document.getElementById('profilePhone');
        const locationInput = document.getElementById('profileLocation');
        const summaryInput = document.getElementById('profileSummary');

        if (nameInput) nameInput.value = state.profile.name || '';
        if (titleInput) titleInput.value = state.profile.title || '';
        if (emailInput) emailInput.value = state.profile.email || '';
        if (phoneInput) phoneInput.value = state.profile.phone || '';
        if (locationInput) locationInput.value = state.profile.location || '';
        if (summaryInput) summaryInput.value = state.profile.summary || '';

        // 加载经历
        this.renderExperienceList(state.experience);

        // 加载教育
        this.renderEducationList(state.education);

        // 加载技能
        const skillsInput = document.getElementById('skillsInput');
        if (skillsInput) skillsInput.value = state.skills.join(', ');
        this.renderSkillsTags(state.skills);
    }

    addExperience(data = {}) {
        store.addArrayItem('experience', {
            company: data.company || '',
            position: data.position || '',
            startDate: data.startDate || '',
            endDate: data.endDate || '',
            description: data.description || ''
        });
        this.renderExperienceList(store.getState().experience);
    }

    renderExperienceList(experiences) {
        const container = document.getElementById('experienceList');
        if (!container) return;
        container.innerHTML = experiences.map((exp, index) => `
            <div class="p-4 bg-gray-900/50 rounded-lg mb-3 border border-gray-700">
                <div class="flex justify-between items-start mb-3">
                    <span class="text-sm font-medium text-gray-400">工作经历 #${index + 1}</span>
                    <button onclick="resumeForm.removeExperience(${exp.id})" class="btn-delete">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <input type="text" class="form-input" placeholder="公司名称"
                           value="${escapeAttr(exp.company)}" onchange="resumeForm.updateExperience(${exp.id}, 'company', this.value)">
                    <input type="text" class="form-input" placeholder="职位"
                           value="${escapeAttr(exp.position)}" onchange="resumeForm.updateExperience(${exp.id}, 'position', this.value)">
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <input type="text" class="form-input" placeholder="开始时间（如：2020.01）"
                           value="${escapeAttr(exp.startDate)}" onchange="resumeForm.updateExperience(${exp.id}, 'startDate', this.value)">
                    <input type="text" class="form-input" placeholder="结束时间（如：2023.12 或 至今）"
                           value="${escapeAttr(exp.endDate)}" onchange="resumeForm.updateExperience(${exp.id}, 'endDate', this.value)">
                </div>
                <textarea class="form-textarea" rows="3" placeholder="工作描述..."
                          onchange="resumeForm.updateExperience(${exp.id}, 'description', this.value)">${escapeHtml(exp.description)}</textarea>
            </div>
        `).join('');
    }

    removeExperience(id) {
        store.removeArrayItem('experience', id);
        this.renderExperienceList(store.getState().experience);
    }

    updateExperience(id, field, value) {
        store.updateArrayItem('experience', id, { [field]: value });
    }

    addEducation(data = {}) {
        store.addArrayItem('education', {
            school: data.school || '',
            degree: data.degree || '',
            field: data.field || data.major || '',
            graduationDate: data.graduationDate || data.period || '',
            description: data.description || ''
        });
        this.renderEducationList(store.getState().education);
    }

    renderEducationList(education) {
        const container = document.getElementById('educationList');
        if (!container) return;
        container.innerHTML = education.map((edu, index) => `
            <div class="p-4 bg-gray-900/50 rounded-lg mb-3 border border-gray-700">
                <div class="flex justify-between items-start mb-3">
                    <span class="text-sm font-medium text-gray-400">教育背景 #${index + 1}</span>
                    <button onclick="resumeForm.removeEducation(${edu.id})" class="btn-delete">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <input type="text" class="form-input" placeholder="学校名称"
                           value="${escapeAttr(edu.school)}" onchange="resumeForm.updateEducation(${edu.id}, 'school', this.value)">
                    <input type="text" class="form-input" placeholder="毕业时间"
                           value="${escapeAttr(edu.graduationDate)}" onchange="resumeForm.updateEducation(${edu.id}, 'graduationDate', this.value)">
                </div>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <input type="text" class="form-input" placeholder="学位（如：本科）"
                           value="${escapeAttr(edu.degree)}" onchange="resumeForm.updateEducation(${edu.id}, 'degree', this.value)">
                    <input type="text" class="form-input" placeholder="专业"
                           value="${escapeAttr(edu.field)}" onchange="resumeForm.updateEducation(${edu.id}, 'field', this.value)">
                </div>
                ${edu.description ? `<p class="text-xs text-gray-500 mt-1">${escapeHtml(edu.description)}</p>` : ''}
            </div>
        `).join('');
    }

    removeEducation(id) {
        store.removeArrayItem('education', id);
        this.renderEducationList(store.getState().education);
    }

    updateEducation(id, field, value) {
        store.updateArrayItem('education', id, { [field]: value });
    }

    renderSkillsTags(skills) {
        const container = document.getElementById('skillsTags');
        if (!container) return;
        container.innerHTML = skills.map(skill => `
            <span class="skill-tag">${escapeHtml(skill)}</span>
        `).join('');
    }
}

// 创建全局实例
const resumeForm = new ResumeForm();
if (typeof window !== 'undefined') {
    window.resumeForm = resumeForm;
}
