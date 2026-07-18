/**
 * Resume Templates Library
 * 提供多种行业简历模板
 */

const ResumeTemplates = {
    // 技术开发类模板
    techDeveloper: {
        id: 'tech_developer',
        name: '技术开发',
        description: '适用于软件开发、工程师等技术岗位',
        style: 'modern',
        fields: {
            profile: {
                title: '个人简介',
                placeholder: '具备5年以上全栈开发经验，精通React、Node.js、Python等技术栈...'
            },
            experience: [
                {
                    company: '示例科技公司',
                    position: '高级软件工程师',
                    period: '2022.01 - 至今',
                    description: '负责核心产品的架构设计和开发，优化系统性能...'
                }
            ],
            education: {
                school: '示例大学',
                degree: '计算机科学硕士',
                period: '2016-2020'
            },
            skills: ['JavaScript', 'React', 'Node.js', 'Python', 'Docker', 'AWS']
        }
    },

    // 产品经理类模板
    productManager: {
        id: 'product_manager',
        name: '产品经理',
        description: '适用于产品管理、产品运营等岗位',
        style: 'professional',
        fields: {
            profile: {
                title: '个人简介',
                placeholder: '具备3年以上产品管理经验，擅长需求分析、产品规划和团队协作...'
            },
            experience: [
                {
                    company: '示例互联网公司',
                    position: '产品经理',
                    period: '2021.05 - 至今',
                    description: '负责用户增长产品的规划和迭代，实现月活提升30%...'
                }
            ],
            education: {
                school: '示例商学院',
                degree: '工商管理硕士',
                period: '2017-2021'
            },
            skills: ['产品规划', '用户研究', '数据分析', '项目管理', '团队协作']
        }
    },

    // 市场营销类模板
    marketing: {
        id: 'marketing',
        name: '市场营销',
        description: '适用于市场推广、品牌运营、数字营销等岗位',
        style: 'creative',
        fields: {
            profile: {
                title: '个人简介',
                placeholder: '具备4年以上市场营销经验，擅长品牌策划、数字营销和内容创作...'
            },
            experience: [
                {
                    company: '示例营销机构',
                    position: '市场经理',
                    period: '2020.08 - 至今',
                    description: '策划并执行多个品牌营销活动，实现品牌曝光增长200%...'
                }
            ],
            education: {
                school: '示例传媒大学',
                degree: '市场营销学士',
                period: '2016-2020'
            },
            skills: ['品牌策划', '社交媒体营销', '内容创作', '数据分析', '活动策划']
        }
    },

    // 金融分析类模板
    financeAnalyst: {
        id: 'finance_analyst',
        name: '金融分析',
        description: '适用于金融分析、投资研究、财务等岗位',
        style: 'traditional',
        fields: {
            profile: {
                title: '个人简介',
                placeholder: '具备3年以上金融分析经验，擅长财务建模、数据分析和风险评估...'
            },
            experience: [
                {
                    company: '示例投资公司',
                    position: '金融分析师',
                    period: '2021.03 - 至今',
                    description: '负责行业研究和公司分析，撰写投资报告，支持投资决策...'
                }
            ],
            education: {
                school: '示例财经大学',
                degree: '金融学硕士',
                period: '2017-2021'
            },
            skills: ['财务分析', '数据分析', '财务建模', '风险评估', 'Excel高级应用']
        }
    },

    // 设计创意类模板
    designer: {
        id: 'designer',
        name: '设计创意',
        description: '适用于UI/UX设计、平面设计、创意设计等岗位',
        style: 'creative',
        fields: {
            profile: {
                title: '个人简介',
                placeholder: '具备5年以上UI/UX设计经验，擅长用户研究和界面设计...'
            },
            experience: [
                {
                    company: '示例设计工作室',
                    position: '资深UI设计师',
                    period: '2019.06 - 至今',
                    description: '负责多个产品的用户体验设计和视觉设计，提升用户满意度...'
                }
            ],
            education: {
                school: '示例艺术学院',
                degree: '视觉传达设计学士',
                period: '2015-2019'
            },
            skills: ['UI设计', 'UX研究', 'Figma', 'Adobe Creative Suite', '原型设计']
        }
    }
};

/**
 * 获取所有模板列表
 */
function getAllTemplates() {
    return Object.values(ResumeTemplates);
}

/**
 * 根据ID获取模板
 */
function getTemplateById(templateId) {
    return ResumeTemplates[templateId] || ResumeTemplates.techDeveloper;
}

/**
 * 应用模板到简历数据
 */
function applyTemplate(templateId, currentData = {}) {
    const template = getTemplateById(templateId);

    return {
        ...currentData,
        template: templateId,
        profile: {
            ...currentData.profile,
            title: template.fields.profile.title,
            placeholder: template.fields.profile.placeholder
        },
        experience: currentData.experience || template.fields.experience,
        education: currentData.education || template.fields.education,
        skills: currentData.skills || template.fields.skills
    };
}

export { ResumeTemplates, getAllTemplates, getTemplateById, applyTemplate };