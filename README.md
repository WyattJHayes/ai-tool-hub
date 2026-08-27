# 🤖 AI Tool Hub — Next.js 全栈版

<p align="center">
  <strong>83款精选AI工具 · 10大领域 · Next.js 14 全栈应用</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-7.0.0-blue.svg" alt="Version" />
  <img src="https://img.shields.io/badge/framework-Next.js_14-black.svg" alt="Framework" />
  <img src="https://img.shields.io/badge/tools-83-brightgreen.svg" alt="Tools" />
  <img src="https://img.shields.io/badge/categories-10-orange.svg" alt="Categories" />
  <img src="https://img.shields.io/badge/auth-Supabase-green.svg" alt="Auth" />
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License" />
</p>

---

## 🌐 在线预览

**🔗 [https://weihub.cloud/](https://weihub.cloud/)**

---

## ✨ v7.0 全栈重构亮点

从纯前端静态站升级为 **Next.js 14 全栈应用**，新增用户系统、数据持久化、工具对比、详情页等核心功能。

| 能力 | 旧版 (vanilla JS) | v7.0 (Next.js) |
|------|--------------------|----------------|
| 框架 | HTML + Vite | Next.js 14 App Router + TypeScript |
| 状态管理 | 全局变量 | Zustand (3 stores) |
| 样式 | 手写 CSS | Tailwind CSS + CSS Variables |
| 路由 | 单页 | 多页面 (首页/详情/对比/场景/排行榜/用户) |
| 后端 | 无 | Next.js API Routes (5个) |
| 数据库 | 无 | Supabase (PostgreSQL + Auth) |
| 认证 | 无 | Supabase Auth (邮箱注册/登录) |
| 收藏 | localStorage | 云端 + 本地双写，登录自动同步 |
| 评分 | 无 | 5星 + 标签 + 短评，聚合展示 |
| 搜索 | 前端过滤 | 服务端搜索 API + facets + 高亮 |
| 工具对比 | 无 | 横向表格对比 2-4 款工具 |
| 详情页 | 无 | `/tools/:id` 独立详情页 |
| 场景导航 | 无 | 8 个场景入口 + 工具映射 |
| 定价数据 | 无 | 每个工具含完整定价信息 |
| 埋点 | 无 | 7 种用户行为追踪事件 |

---

## 🏗️ 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Next.js** | 14.2 | App Router, SSR, API Routes |
| **React** | 18 | UI 组件 |
| **TypeScript** | 5 | 类型安全 |
| **Tailwind CSS** | 3.4 | 样式系统 |
| **Zustand** | 5.0 | 状态管理 (3 stores) |
| **Supabase** | 2.107 | Auth + PostgreSQL + RLS |
| **Lucide React** | 1.17 | 图标库 |
| **@sentry/nextjs** | 10.x | 错误追踪 (可选) |

---

## 📁 项目结构

```
next-src/
├── src/
│   ├── app/                      # Next.js App Router 页面
│   │   ├── layout.tsx            # 根布局 (Navbar + Footer + AuthProvider + ErrorBoundary)
│   │   ├── page.tsx              # 首页 (热门推荐 + 场景入口 + 分类浏览)
│   │   ├── globals.css           # 全局样式 + CSS Variables
│   │   ├── compare/page.tsx      # 工具对比页 (2-4 款横向比较)
│   │   ├── leaderboard/page.tsx  # 排行榜 (点击/热门/最新)
│   │   ├── scenes/
│   │   │   ├── page.tsx          # 场景列表 (8 个场景)
│   │   │   └── [slug]/page.tsx   # 场景详情 (工具列表)
│   │   ├── tools/
│   │   │   ├── page.tsx          # 工具浏览 (搜索 + 筛选 + 排序)
│   │   │   └── [slug]/page.tsx   # 工具详情 (信息 + 定价 + 评分 + 推荐)
│   │   ├── user/page.tsx         # 用户中心 (收藏 + 评分 + 推荐)
│   │   └── api/                  # API Routes
│   │       ├── tools/route.ts    # GET 工具数据
│   │       ├── track/click/route.ts  # POST 点击埋点
│   │       ├── favorites/route.ts    # GET/POST 收藏 (Supabase + 内存降级)
│   │       ├── ratings/route.ts      # GET/POST 评分 (Supabase + 内存降级)
│   │       └── search/route.ts       # GET 搜索 + facets
│   ├── components/
│   │   ├── auth/                 # AuthModal, AuthProvider
│   │   ├── common/               # ErrorBoundary
│   │   ├── compare/              # CompareBar (底部浮动)
│   │   ├── hero/                 # HeroSection
│   │   ├── layout/               # Navbar, Footer, BottomNav, PageShell
│   │   ├── ratings/              # RatingWidget (5星 + 标签 + 短评)
│   │   ├── scenes/               # SceneCard
│   │   └── tools/                # ToolCard, ToolGrid, CategoryFilter, SortBar
│   ├── stores/
│   │   ├── useToolStore.ts       # 工具数据 + 筛选 + 排序
│   │   ├── useUserStore.ts       # 收藏 + 评分 + 登录状态 (persist)
│   │   └── useCompareStore.ts    # 对比栏状态
│   ├── lib/
│   │   ├── api.ts                # API 客户端 (trackClick, toggleFavorite, submitRating, search)
│   │   ├── auth.ts               # 认证工具 (云端迁移/同步)
│   │   ├── supabase.ts           # Supabase 客户端
│   │   ├── tools-data.ts         # 工具数据工具函数
│   │   └── utils.ts              # cn() 工具函数
│   └── types/tool.ts             # TypeScript 类型定义
├── public/data/
│   ├── tools.json                # 84 个工具数据 (含定价/多分类/亮点)
│   └── scenes.json               # 8 个场景数据
├── supabase/
│   └── migrations/
│       └── 001_initial.sql       # 数据库 Schema (9 表 + RLS + 触发器)
├── scripts/
│   └── import-tools.ts           # tools.json → Supabase 导入脚本
└── package.json
```

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd next-src
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

`.env.local` 内容：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

> 不配置 Supabase 也能运行，所有 API 自动降级为内存模式。

### 3. 启动开发服务器

```bash
npm run dev
# → http://localhost:3000
```

### 4. (可选) 初始化 Supabase 数据库

在 [Supabase SQL Editor](https://supabase.com/dashboard) 中执行 `supabase/migrations/001_initial.sql`，然后导入数据：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
npx tsx scripts/import-tools.ts
```

### 5. 生产构建

```bash
npm run build
npm start
```

> **⚠️ 单实例部署假设**：应用内限流（`src/server/resume/rateLimit.ts`）以及旧版后端（`server/src/middleware/rateLimit.js`、登录锁定 `server/src/routes/auth.js`）的计数状态均保存在**进程内存**中，重启即清零、多实例间不共享。当前生产按单容器部署；若横向扩容，需将这些状态迁移到 Redis 等共享存储，否则限流/登录锁定在多实例间会失效。

---

## 📖 页面路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 首页 | 热门推荐 + 场景入口 + 全部工具 |
| `/tools` | 工具浏览 | 搜索 + 分类筛选 + 6 种排序 |
| `/tools/:id` | 工具详情 | 基本信息 + 定价表 + 评分 + 推荐替代 |
| `/compare` | 工具对比 | 横向表格对比 2-4 款工具 |
| `/scenes` | 场景列表 | 8 个场景入口 (PPT/代码/视频/设计/...) |
| `/scenes/:slug` | 场景详情 | 场景下的工具列表 |
| `/leaderboard` | 排行榜 | 点击/热门/最新 三栏排行 |
| `/user` | 用户中心 | 收藏 + 评分记录 + 个性化推荐 |

---

## 🔌 API Routes

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/tools` | 获取全部工具 + 分类数据 |
| `GET` | `/api/search?q=chat&category=writing` | 搜索工具 (含 facets) |
| `POST` | `/api/track/click` | 点击埋点 |
| `GET/POST` | `/api/favorites` | 收藏 CRUD (需 Auth) |
| `GET/POST` | `/api/ratings` | 评分 CRUD (需 Auth) |

所有 API 支持 Supabase 云端 + 内存降级双模式。

---

## 🗄️ 数据库设计

```
tools          ← 工具主表 (INTEGER PK, 83 条数据)
├── categories ← 分类表 (10 个领域)
├── scenes     ← 场景表 (8 个场景)
├── scene_tools ← 场景-工具关联
├── favorites  ← 收藏表 (RLS: 用户只能读写自己的)
├── ratings    ← 评分表 (含标签 + 短评, 触发器自动更新 avg_rating)
├── click_logs ← 点击日志
└── profiles   ← 用户档案 (注册时自动创建)

触发器:
- 评分变更 → 自动更新 tools.avg_rating / tools.rating_count
- 收藏变更 → 自动更新 tools.favorite_count
- 新用户注册 → 自动创建 profile
```

---

## 🧩 核心组件

| 组件 | 说明 |
|------|------|
| `ToolCard` | 3D 倾斜效果 + 收藏 + 对比勾选 + 价格标签 |
| `ToolGrid` | 响应式网格 + 骨架屏 + 空状态 |
| `SearchBar` | 300ms 防抖 + ⌘K 快捷键 + 搜索历史 |
| `CompareBar` | 底部浮动对比栏 (选择 ≥2 工具后出现) |
| `RatingWidget` | 5 星 + 10 个预设标签 + 50 字短评 |
| `AuthModal` | 注册/登录模态框 (Supabase Auth) |
| `AuthProvider` | 全局认证状态监听 + 云端数据同步 |
| `SceneCard` | 场景入口卡片 (渐变背景 + hover 动效) |
| `CategoryFilter` | 分类筛选药丸按钮 |
| `SortBar` | 6 种排序选项 |
| `BottomNav` | 移动端底部导航 (首页/工具/排行/我的) |

---

## 📊 数据规模

- **83 款精选 AI 工具**，覆盖 10 大领域
- 每个工具包含：多分类标签、完整定价数据、功能亮点、难度评级
- 8 个场景入口，每个场景映射相关工具
- 工具来源：国产 + 海外，免费 + VIP

---

## 🛡️ 安全设计

- **Row Level Security (RLS)**: 收藏/评分/用户表启用行级安全，用户只能访问自己的数据
- **XSS 防护**: React 自动转义 + URL 白名单验证
- **Supabase Auth**: JWT 认证，API Routes 校验 Bearer token
- **ErrorBoundary**: 前端错误边界，防止白屏
- **Sentry 集成**: 生产环境错误追踪 (需配置 `NEXT_PUBLIC_SENTRY_DSN`)

---

## 📈 更新日志

### v7.0.0 (2026-06-04) — Next.js 全栈重构

**架构升级**
- 从 vanilla JS/Vite 迁移到 Next.js 14 App Router + TypeScript
- Zustand 状态管理 (useToolStore, useUserStore, useCompareStore)
- Tailwind CSS + CSS Variables 主题系统
- 完整 TypeScript 类型定义

**新增页面**
- `/tools/:id` — 工具详情页 (信息 + 定价 + 评分 + 推荐)
- `/compare` — 工具对比页 (横向表格 2-4 款)
- `/scenes` + `/scenes/:slug` — 场景导航
- `/leaderboard` — 排行榜 (点击/热门/最新)
- `/user` — 用户中心 (收藏 + 评分 + 个性化推荐)

**后端能力**
- Supabase PostgreSQL (9 表 + RLS + 触发器)
- Supabase Auth (邮箱注册/登录)
- 5 个 API Routes (工具/搜索/收藏/评分/埋点)
- 内存降级模式 (不配置数据库也能运行)

**数据增强**
- 84 个工具全部添加 pricing 定价数据
- 多分类支持 (categories 数组)
- 8 个场景数据 + toolIds 映射
- 零值统计隐藏

**用户行为追踪**
- 7 种埋点事件 (tool_click, search_query, filter_apply, compare_open, tool_favorite, scene_click, rating_submit)

---

### v6.1.0 (2026-06-03) — 安全增强 + 测试套件

- CORS OPTIONS 预检修复
- CSP meta 标签
- 145+ 综合测试项
- Harness Starter 集成

<details>
<summary>历史版本</summary>

### v4.2.0 (2026-04-19) — 15 款热门 AI 工具
- Gemini, DeepSeek, Grok, Claude Code, Trae, Flux Pro 等新工具
- DeepSeek 大模型集成

### v4.0.0 (2026-04-05) — UI 大改版
- 现代白卡设计 + 7 套主题系统
- 60+ 微交互动画
- ES6 模块化重构

### v3.0.0 (2026-04-01) — 架构重构
- Vite 构建工具链
- ES6 模块化

</details>

---

## 🤝 贡献指南

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```bash
git checkout -b feature/amazing-feature
git commit -m 'feat: 添加新功能'
git push origin feature/amazing-feature
# → 开启 Pull Request
```

---

## 📄 许可证

MIT License — Copyright (c) 2026 a895411690

---

<div align="center">

**⭐ 如果这个项目对您有帮助，请给一个 Star！⭐**

Made with ❤️ by [a895411690](https://github.com/a895411690)

*最后更新: 2026-06-04 | 版本: v7.0.0*

**Next.js 14 · TypeScript · Supabase · 83款AI工具 · 全栈应用**

</div>
