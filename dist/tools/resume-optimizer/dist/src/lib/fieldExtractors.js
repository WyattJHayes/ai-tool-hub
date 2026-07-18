/**
 * 简历字段提取工具
 * 纯函数，不依赖ImportUtils类实例
 */
import CONFIG from './resumeConfig.js';

// ---------------------------------------------------------------------------
// Placeholder detection
// ---------------------------------------------------------------------------

export function isPlaceholderValue(field, value) {
    if (!value || value.trim() === '') return true;
    const v = value.trim().toLowerCase();
    const placeholders = {
        name: ['张三','李四','王五','赵六','钱七','未识别','未知','待填写','用户名','简历中的真实姓名','姓名','name','your name'],
        phone: ['13800138000','13900139000','18888888888','12345678901','10000000000','00000000000','手机号码','电话','phone','tel','联系电话'],
        email: ['zhangsan@example.com','example@email.com','test@test.com','user@example.com','邮箱地址','email','电子邮箱','your email'],
        location: ['北京市','上海市','广州市','所在城市','城市','location','your city']
    };
    if (placeholders[field] && placeholders[field].includes(v)) return true;
    if (field === 'phone' && !/\d/.test(v)) return true;
    if (field === 'email' && !v.includes('@')) return true;
    if (field === 'name' && (v.length < 2 || v.length > 4)) return true;
    return false;
}

// ---------------------------------------------------------------------------
// Basic field extraction
// ---------------------------------------------------------------------------

export function extractPhone(line) {
    const phoneRegex = /1[3-9][\d\s\-]{9,13}/g;
    const matches = line.match(phoneRegex);
    if (!matches) return '';
    const cleaned = matches[0].replace(/[\s\-]/g, '');
    return cleaned.length === 11 ? cleaned : '';
}

export function extractEmail(line) {
    const preprocessed = line.replace(/\s+(@)/g, '$1').replace(/(@)\s+/g, '$1');
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = preprocessed.match(emailRegex);
    return matches ? matches[0].trim() : '';
}

export function extractSchool(line) {
    const schools = CONFIG.commonSchools;
    for (const school of schools) {
        if (line.includes(school)) return school;
    }
    const schoolMatch = line.match(/([\u4e00-\u9fa5]{2,}(?:大学|学院|学校))/);
    if (schoolMatch) return schoolMatch[1];
    return '未知学校';
}

export function extractMajor(line) {
    const majors = CONFIG.commonMajors;
    for (const major of majors) {
        if (line.includes(major)) return major;
    }
    return '';
}

export function extractDegree(line) {
    const degrees = ['博士', '硕士', '学士', '本科', '研究生'];
    for (const degree of degrees) {
        if (line.includes(degree)) return degree;
    }
    return '学士';
}

export function extractCompany(line) {
    const companies = [
        '交通银行', '广发银行', '广发', '招商银行', '建设银行', '工商银行', '农业银行', '中国银行',
        '浦发银行', '民生银行', '兴业银行', '光大银行', '中信银行', '华夏银行', '平安银行',
        '腾讯', '阿里', '百度', '字节', '华为', '美团', '京东', '小米', 'OPPO', 'VIVO', '中兴',
        '阿里巴巴', '腾讯科技', '百度在线', '字节跳动', '美团点评', '神州数码', '联想',
        '谷歌', '微软', '苹果', '亚马逊', 'Facebook', 'Google', 'Microsoft', 'Apple'
    ];
    for (const company of companies) {
        if (line.includes(company)) return company;
    }
    const companyMatch = line.match(/([\u4e00-\u9fa5]{2,}(?:有限)?(?:股份)?(?:公司|集团|银行|科技|网络|软件|数据|信息|数码|技术|互联网|电子商务|通信|电子|半导体|医药|教育|金融|保险|证券|控股|投资))/);
    if (companyMatch) return companyMatch[1];
    return '知名公司';
}

export function extractPosition(line) {
    const positions = [
        '高级测试开发工程师', '资深测试开发工程师', '测试开发工程师',
        '高级自动化测试工程师', '资深自动化测试工程师', '自动化测试工程师',
        '高级性能测试工程师', '资深性能测试工程师', '性能测试工程师',
        '高级功能测试工程师', '资深功能测试工程师', '功能测试工程师',
        '高级安全测试工程师', '资深安全测试工程师', '安全测试工程师',
        '高级前端开发工程师', '资深前端开发工程师', '前端开发工程师',
        '高级后端开发工程师', '资深后端开发工程师', '后端开发工程师',
        '高级全栈开发工程师', '资深全栈开发工程师', '全栈开发工程师',
        '高级软件开发工程师', '资深软件开发工程师', '软件开发工程师',
        '高级测试工程师', '资深测试工程师', '测试工程师',
        '测试组长', '测试经理', '测试总监', '测试主管',
        '高级开发工程师', '资深开发工程师', '开发工程师',
        '开发组长', '开发经理',
        '高级产品经理', '产品经理', '产品专员',
        '高级UI设计师', 'UI设计师', '高级设计师', '设计师',
        '项目经理', '技术经理', '技术总监', '架构师',
        '高级运维工程师', '运维工程师',
        '高级数据分析师', '数据分析师',
        '工程师', '经理', '总监', '主管', '开发', '测试', '产品', '设计',
        '运营', '市场', '销售', '人事', '财务', '会计', '顾问', '专家',
        '组长', '负责人', '分析师', '程序员'
    ];
    for (const position of positions) {
        if (line.includes(position)) return position;
    }
    return '职位';
}

export function extractPeriod(line) {
    const periodPatterns = [
        /(\d{4})\s*年?\s*[至\-~–到]\s*至今/i,
        /(\d{4})[.\-/]\s*(\d{1,2})?\s*[至\-~–到]\s*(\d{4})[.\-/]?\s*(\d{1,2})?/,
        /(\d{4})\s*年\s*(\d{1,2})?\s*月?\s*[至\-~–到]\s*(\d{4})\s*年?\s*(\d{1,2})?\s*月?/,
        /(\d{4})\s*[至\-~–到]\s*(\d{4})/,
        /(\d{4})/
    ];

    for (const pattern of periodPatterns) {
        const match = line.match(pattern);
        if (match) {
            const full = match[0];
            return full
                .replace(/年/g, '.')
                .replace(/月/g, '')
                .replace(/[至~–]/g, '-')
                .replace(/\s+/g, '')
                .replace(/\.-/g, '-');
        }
    }
    return '';
}

export function extractSkills(line) {
    const skills = ['JavaScript', 'React', 'Vue', 'Node.js', 'Python', 'Java', 'Go', 'C++', 'TypeScript', 'HTML', 'CSS'];
    const foundSkills = [];
    for (const skill of skills) {
        if (line.includes(skill)) foundSkills.push(skill);
    }
    return foundSkills;
}

export function isPhoneNumber(text) {
    return /^[+\d\s\-()]{7,}$/.test(text.trim());
}

// ---------------------------------------------------------------------------
// Line-type detection
// ---------------------------------------------------------------------------

export function isExperienceStartLine(line) {
    const trimmed = line.trim();
    return /^(工作经历|工作经验|项目经历|项目经验|实习经历|实习经验|工作履历|从业经历|职业经历)/.test(trimmed) ||
           /^(社会经历|实践经历|工程经历|研发经历|工作背景|工作业绩|主要经历)/.test(trimmed) ||
           /^([\u4e00-\u9fa5]{2,6}[:：]?)$/.test(trimmed) && /经历|经验|履历|背景/.test(trimmed);
}

export function isEducationStartLine(line) {
    const trimmed = line.trim();
    return /^(教育经历|教育背景|教育|学习经历|学历|培训经历|教育情况|求学经历)/.test(trimmed);
}

export function isProjectStartLine(line) {
    const trimmed = line.trim();
    return /^(项目经历|项目经验|项目|项目实践|项目名称|主要项目)/.test(trimmed);
}

export function isPersonalInfoLine(line) {
    const trimmed = line.trim();
    const personalInfoHints = ['个人信息', '基本资料', '基本信息', '个人资料', '个人概况', '个人情况', '基础信息', '联系方式', '联系信息', '个人简介'];
    if (personalInfoHints.includes(trimmed)) return true;
    return false;
}

export function isExperienceLine(line) {
    const trimmed = line.trim();
    const experienceHints = ['工作经历', '工作经验', '项目经历', '项目经验', '实习经历', '工作履历', '职业经历'];
    if (experienceHints.includes(trimmed)) return true;
    return false;
}

// ---------------------------------------------------------------------------
// Error suggestions
// ---------------------------------------------------------------------------

export function getErrorSuggestion(error) {
    const suggestions = {
        '不支持的文件格式': '请上传PDF、DOCX、TXT或HTML格式的文件',
        '文件大小超过限制': '请上传小于10MB的文件',
        '文件读取失败': '请检查文件是否损坏，或尝试重新上传',
        '解析失败': '请尝试上传格式更规范的简历文件',
        '不支持旧版': '请将文件另存为 .docx 格式后再上传',
        '无法从文件中提取文本': '请确保文件不是扫描件或图片格式，可尝试复制粘贴文本内容',
        '未能从文件中识别': '请确保文件包含可读的文本信息，可尝试使用复制粘贴方式导入'
    };

    for (const [key, suggestion] of Object.entries(suggestions)) {
        if (error.includes(key)) return suggestion;
    }

    return '请检查文件格式是否正确，或联系技术支持';
}

export { CONFIG };

// ---------------------------------------------------------------------------
// Education & experience line parsing
// ---------------------------------------------------------------------------

export function parseEducationLine(line) {
    return {
        school: extractSchool(line),
        major: extractMajor(line),
        degree: extractDegree(line),
        period: extractPeriod(line),
        description: line.trim()
    };
}

export function parseExperienceLine(line, prevLine) {
    if (prevLine && /^(测试|开发|高级|资深|初级|中级)$/i.test(prevLine.trim())) {
        line = prevLine.trim() + line;
    }
    return {
        company: extractCompany(line),
        position: extractPosition(line),
        period: extractPeriod(line),
        description: line.trim()
    };
}
