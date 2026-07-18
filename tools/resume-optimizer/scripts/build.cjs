#!/usr/bin/env node
/**
 * AI 简历优化工具 - 轻量级构建脚本
 * 用途：压缩代码、优化资源、准备部署
 * 特点：零依赖，仅使用 Node.js 内置模块
 */

const fs = require('fs');
const path = require('path');

// 配置
const config = {
    srcDir: path.join(__dirname, '../'),
    distDir: path.join(__dirname, '../dist'),
    files: {
        html: ['index.html'],
        js: [
            'src/app.js',
            'src/lib/utils.js',
            'src/lib/apiClient.js',
            'src/lib/store.js',
            'src/lib/pdfGenerator.js',
            'src/lib/templates.js',
            'src/lib/shareUtils.js',
            'src/lib/aiOptimizer.js',
            'src/lib/resumeConfig.js',
            'src/lib/fieldExtractors.js',
            'src/lib/textExtractors.js',
            'src/lib/importUtils.js',
            'src/components/resumeForm.js',
            'src/components/resumePreview.js',
            'src/components/importResume.js',
            'src/components/authModal.js'
        ],
        css: ['src/styles/main.css', 'src/styles/tailwind.min.css']
    }
};

// 日志工具
const log = {
    info: (msg) => console.log(`\x1b[34mℹ️  ${msg}\x1b[0m`),
    success: (msg) => console.log(`\x1b[32m✅ ${msg}\x1b[0m`),
    warn: (msg) => console.log(`\x1b[33m⚠️  ${msg}\x1b[0m`),
    error: (msg) => console.log(`\x1b[31m❌ ${msg}\x1b[0m`)
};

// 构建步骤
class Builder {
    constructor() {
        this.startTime = Date.now();
        this.stats = {
            filesProcessed: 0,
            totalSize: 0,
            savedSize: 0
        };
    }

    // 1. 清理 dist 目录
    clean() {
        log.info('清理 dist 目录...');
        
        if (fs.existsSync(config.distDir)) {
            fs.rmSync(config.distDir, { recursive: true });
        }
        
        fs.mkdirSync(config.distDir, { recursive: true });
        fs.mkdirSync(path.join(config.distDir, 'src/lib'), { recursive: true });
        fs.mkdirSync(path.join(config.distDir, 'src/components'), { recursive: true });
        fs.mkdirSync(path.join(config.distDir, 'src/styles'), { recursive: true });
        
        log.success('dist 目录已清理');
    }

    // JavaScript needs a parser-aware minifier. Preserve source when the
    // standalone tool is built without a bundler so URLs and regexes remain valid.
    minifyJS(code) {
        return code;
    }

    // 3. 压缩 CSS
    minifyCSS(code) {
        // 简单的 CSS 压缩
        return code
            // 移除注释
            .replace(/\/\*[\s\S]*?\*\//g, '')
            // 移除多余空白
            .replace(/\s+/g, ' ')
            // 移除行首行尾空白
            .replace(/^\s+|\s+$/gm, '')
            // 移除 { } ; : , 周围的空格
            .replace(/\s*([{};:,])\s*/g, '$1');
    }

    // 4. 压缩 HTML
    minifyHTML(code) {
        // 简单的 HTML 压缩
        return code
            // 移除注释
            .replace(/<!--[\s\S]*?-->/g, '')
            // 移除多余空白
            .replace(/\s+/g, ' ')
            // 移除标签之间的空白
            .replace(/>\s+</g, '><')
            // 移除行首行尾空白
            .replace(/^\s+|\s+$/gm, '');
    }

    // 5. 处理文件
    processFiles() {
        log.info('处理文件...');
        
        // 处理 HTML 文件
        config.files.html.forEach(file => {
            const srcPath = path.join(config.srcDir, file);
            const distPath = path.join(config.distDir, file);
            
            if (fs.existsSync(srcPath)) {
                const code = fs.readFileSync(srcPath, 'utf-8');
                const originalSize = code.length;
                const minified = this.minifyHTML(code);
                const newSize = minified.length;
                
                fs.writeFileSync(distPath, minified);
                
                this.stats.filesProcessed++;
                this.stats.totalSize += originalSize;
                this.stats.savedSize += (originalSize - newSize);
                
                log.success(`${file}: ${(originalSize/1024).toFixed(2)}KB → ${(newSize/1024).toFixed(2)}KB (节省 ${((originalSize-newSize)/originalSize*100).toFixed(1)}%)`);
            }
        });

        // 处理 JS 文件
        config.files.js.forEach(file => {
            const srcPath = path.join(config.srcDir, file);
            const distPath = path.join(config.distDir, file);
            
            if (fs.existsSync(srcPath)) {
                const code = fs.readFileSync(srcPath, 'utf-8');
                const originalSize = code.length;
                const minified = this.minifyJS(code);
                const newSize = minified.length;
                
                fs.writeFileSync(distPath, minified);
                
                this.stats.filesProcessed++;
                this.stats.totalSize += originalSize;
                this.stats.savedSize += (originalSize - newSize);
                
                log.success(`${file}: ${(originalSize/1024).toFixed(2)}KB → ${(newSize/1024).toFixed(2)}KB (节省 ${((originalSize-newSize)/originalSize*100).toFixed(1)}%)`);
            }
        });

        // 处理 CSS 文件
        config.files.css.forEach(file => {
            const srcPath = path.join(config.srcDir, file);
            const distPath = path.join(config.distDir, file);
            
            if (fs.existsSync(srcPath)) {
                const code = fs.readFileSync(srcPath, 'utf-8');
                const originalSize = code.length;
                const minified = this.minifyCSS(code);
                const newSize = minified.length;
                
                fs.writeFileSync(distPath, minified);
                
                this.stats.filesProcessed++;
                this.stats.totalSize += originalSize;
                this.stats.savedSize += (originalSize - newSize);
                
                log.success(`${file}: ${(originalSize/1024).toFixed(2)}KB → ${(newSize/1024).toFixed(2)}KB (节省 ${((originalSize-newSize)/originalSize*100).toFixed(1)}%)`);
            }
        });
    }

    // 6. 复制资源文件
    copyAssets() {
        log.info('复制资源文件...');
        
        // 复制 manifest.json
        const manifestSrc = path.join(config.srcDir, 'manifest.json');
        const manifestDist = path.join(config.distDir, 'manifest.json');
        if (fs.existsSync(manifestSrc)) {
            fs.copyFileSync(manifestSrc, manifestDist);
            log.success('manifest.json 已复制');
        }

        // 复制 robots.txt
        const robotsSrc = path.join(config.srcDir, 'robots.txt');
        const robotsDist = path.join(config.distDir, 'robots.txt');
        if (fs.existsSync(robotsSrc)) {
            fs.copyFileSync(robotsSrc, robotsDist);
            log.success('robots.txt 已复制');
        }

        // 复制 sitemap.xml
        const sitemapSrc = path.join(config.srcDir, 'sitemap.xml');
        const sitemapDist = path.join(config.distDir, 'sitemap.xml');
        if (fs.existsSync(sitemapSrc)) {
            fs.copyFileSync(sitemapSrc, sitemapDist);
            log.success('sitemap.xml 已复制');
        }
    }

    // 7. 生成构建报告
    generateReport() {
        const endTime = Date.now();
        const duration = ((endTime - this.startTime) / 1000).toFixed(2);
        
        console.log('\n' + '='.repeat(50));
        log.success('构建完成！');
        console.log('='.repeat(50));
        console.log(`\n📊 构建统计:`);
        console.log(`   文件处理数: ${this.stats.filesProcessed}`);
        console.log(`   原始大小: ${(this.stats.totalSize / 1024).toFixed(2)}KB`);
        console.log(`   节省大小: ${(this.stats.savedSize / 1024).toFixed(2)}KB`);
        console.log(`   压缩率: ${(this.stats.savedSize / this.stats.totalSize * 100).toFixed(1)}%`);
        console.log(`   构建时间: ${duration}s`);
        console.log(`\n📂 输出目录: ${config.distDir}`);
        console.log('\n💡 提示: 使用 `node scripts/deploy.js` 部署到生产环境');
        console.log('='.repeat(50) + '\n');
    }

    // 运行构建
    run() {
        console.log('\n🚀 开始构建 AI 简历优化工具...\n');
        
        this.clean();
        this.processFiles();
        this.copyAssets();
        this.generateReport();
    }
}

// 执行构建
const builder = new Builder();
builder.run();
