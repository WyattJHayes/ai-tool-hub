# weihub.cloud · v4 Figma 设计规格

> 本文件由 UI 评审结论（详见同目录 `BUGS_AND_IMPROVEMENTS.md`）直接驱动，用于在 Figma 中落地 v4 桌面端设计稿。

**目标 Figma 文件**：[weihub.cloud v4 redesign](https://www.figma.com/design/7HJEozIDrv4n8UdERMisji)
**文件 key**：`7HJEozIDrv4n8UdERMisji`
**画布**：Desktop 1440 × 内容高度（HUG），最大内容宽度 1200
**设计库**：Figma Simple Design System（已自动订阅）

---

## 0. v4 与当前版本的核心差异（设计意图）

| 当前问题 | v4 应对 |
|---|---|
| 蓝紫单色统治整体调性 | 深中性灰当主表面色，霓虹只用于状态/分类小色块 |
| 三层背景动画（网格 + 光晕 + 粒子）抢眼且耗性能 | 单一微妙效果：仅保留极淡网格（≤3% 不透明度），其余下线，并尊重 `prefers-reduced-motion` |
| Hero 文字堆叠、搜索条很小 | 搜索前置为 Hero 第一焦点，⌘K 提示前移并放大；右侧加 1 张工具卡预览做视觉锚 |
| 数据概览对游客显示全 0 空态 | 游客默认显示「全站热门数据」（总工具数、本周热门 Top1、分类分布等） |
| 热门推荐只有 6 张 | 扩到 8–12 张，4 列网格 |
| 卡内嵌卡（hero-stat-divider / stat-card 在 stats-grid 内嵌套） | 严格遵守「卡片不嵌套」：分隔用 1px 描边或间距，不再用 framed sub-card |
| 工具站却用了营销站 hero | 改为工具站调性：信息密度优先、搜索为入口、左侧文案右侧实物缩略图 |

---

## 1. 设计 Token

### 1.1 调色板（v4/Color，Dark only）

| Token | Hex / RGBA | 用途 |
|---|---|---|
| `bg/base` | `#0F1014` | 页面底色（替代当前 `#0f0c29→#302b63→#24243e` 蓝紫渐变） |
| `bg/surface` | `#1C1F23` | 卡片底 |
| `bg/surface-2` | `#282A30` | 顶栏 / 抬升表面 |
| `bg/overlay` | `#32343A` | Hover、Pill 选中底 |
| `border/subtle` | `rgba(255,255,255,0.06)` | 默认描边 |
| `border/strong` | `rgba(255,255,255,0.12)` | Hover/聚焦描边 |
| `text/primary` | `rgba(255,255,255,0.92)` | 主文 |
| `text/secondary` | `rgba(255,255,255,0.66)` | 副文 |
| `text/tertiary` | `rgba(255,255,255,0.44)` | 辅助/说明 |
| `text/quaternary` | `rgba(255,255,255,0.26)` | 占位符 |
| `accent/blue` | `#00D4FF` | **仅** 搜索聚焦光晕、链接、⌘K 键帽描边 |
| `accent/purple` | `#A855F7` | **仅** VIP / Premium 标签 |
| `accent/green` | `#2EED88` | **仅** 免费 / 上新 / 成功状态 |
| `accent/orange` | `#FF9428` | **仅** 热门 / Trending 标签 |
| `accent/red` | `#FF5858` | **仅** 退出 / 错误 |

**调色原则**：大块底色一律用 `bg/*` 中性灰；霓虹色合计视觉占比 ≤ 8%。

### 1.2 间距与圆角（v4/Size，Float）

```
space/04 = 4    space/08 = 8    space/12 = 12   space/16 = 16
space/20 = 20   space/24 = 24   space/32 = 32   space/40 = 40
space/48 = 48   space/64 = 64

radius/04 = 4   radius/08 = 8   radius/12 = 12  radius/16 = 16  radius/24 = 24
nav-height = 64     page-max = 1200    section-padding-y = 48
```

### 1.3 字体

- Display/H1：`Space Grotesk 700, 56/64, -2%`
- H2：`Inter 700, 28/36, -1%`
- H3：`Inter 600, 18/26`
- Body：`Inter 400, 14/22`
- Label/Tag：`Inter 500, 12/18, +4%`
- KBD：`JetBrains Mono 500, 12/18`
- 中文跟随系统 PingFang SC fallback

---

## 2. 已识别的 SDS 组件 key（可直接 importComponentSetByKeyAsync）

| 用途 | 组件 | Key |
|---|---|---|
| 主按钮 / 次按钮 | `Button` | `cc8b558dc7d9684011b6b99ce8e6509399bc836b` |
| 顶栏图标按钮（分享、主题） | `Icon Button` | `e098805c9e6db6bfa6a87de61a8324a545d42501` |
| 工具卡 | `Card` | `a5bde480886231526d7dd890df3779dc15b52423` |
| 工具网格（带图标） | `Card Grid Icon` | `618041c057b7b9b525fa74cdb3a4c21c1e0e5c60` |
| 数据概览卡 | `Stats Card` | `7b01e43596110132560308669a4d91d2af023e23` |
| 分类标签（输出型） | `Tag` | `0fcd16616b41884b21451ffa4a2fc98a03093b49` |
| 分类筛选（可切换） | `Tag Toggle` | `aa708ea694a7f3d928fc7311848243d5aef8c3e6` |
| 主搜索条 | `Search` | `715a105916909fcad1d649ed31db27dc26375edd` |

> 顶栏（Navbar）、Tooltip、用户菜单、Footer 需要手工搭建，工具站定制度高。

---

## 3. Section 顺序与构建计划（每个 section 一笔 `use_figma` 调用）

| # | Section | wrapper 内顺序 | 关键改进点 |
|---|---|---|---|
| 1 | Navbar | 0 | 高度 64，底色 `bg/surface-2`，底部 1px `border/subtle`；logo + 上新 N 款小徽章 + 深度研究/提示词文字按钮 + 图标按钮(分享/主题) + 用户头像；图标按钮全部带 tooltip |
| 2 | Hero | 1 | 左侧 7 列：Badge(上新) → H1「找到适合你的 AI 工具」→ 副文 → 大搜索条(60h, 内嵌 ⌘K 键帽 + 焦点蓝光晕) → 三个数据点（工具数 / 分类数 / 上新频率）；右侧 5 列：3 张错落的工具卡缩略图（不是嵌套卡，而是浮在 bg 上的 Card 实例） |
| 3 | Categories + Sort + Filter | 2 | 分类用 `Tag Toggle` 横排（默认选中「全部」），下方 sort bar（默认/热门/免费/国产/A-Z），右侧筛选按钮；不再用 `category-bars` 子卡 |
| 4 | Hot Tools 网格 | 3 | 标题 + 「查看全部」链接 → 4 列 × 2 行 = 8 张 `Card Grid Icon` 实例；卡片：图标 + 名称 + 1 行简介 + 价格 Tag + 来源 Tag；**禁止嵌套卡** |
| 5 | 数据概览（游客友好版） | 4 | 顶部一行 4 个 `Stats Card`（工具总数 / 本周点击 / 收录分类 / 上新频率）；下方两列：左 = 分类分布条形图（用 1px stroke 描边的矩形条，无卡框）；右 = 本周 Top 5 工具列表（行式，非卡片） |
| 6 | All Tools | 5 | 标题 + 排序说明 → 3 列网格、单卡更紧凑（仅图标+名+1 标签）；卡片更窄以提高首屏密度 |
| 7 | Footer | 6 | 4 列：品牌简介 / 工具分类 / 资源 / 联系；底栏 © + 备案号 + 主题切换 |

---

## 4. 单 section 详细规格

### 4.1 Navbar（64h）

背景 `bg/surface-2 (#282A30)`、底部 1px `border/subtle`、padding 0 24px。
水平布局：`[logo] [gap24] [上新徽章] [flex-grow] [深度研究] [gap12] [提示词] [gap16] [分享] [主题] [gap12] [用户菜单]`。

- logo：24×24 圆角6 图标 + "AI Tool Hub" 18/700 白色
- 上新徽章：bg `rgba(46,237,136,0.12)`、文字 `accent/green` 12/500、圆角 999、内边距 6/10
- 文字按钮：透明背景、hover `bg/overlay`、14/500 `text/secondary`
- 图标按钮：36×36 圆角 8、hover `bg/overlay`
- 用户菜单：36×36 头像 + "游客" 14 `text/secondary` + 下拉箭头 10px

### 4.2 Hero（约 540h）

不再使用 `.hero-bg-grid` 网格背景；用 `bg/base` 即可。

**左侧 7/12 列**（gap 24 竖排）：

- 上新 Badge：圆角 999、`accent/green` 文字 + 12% 绿底，含 sparkles 图标
- H1：Space Grotesk 700 56/64，「找到适合你的 AI 工具」（承诺式文案，替代「发现最佳 AI 工具」）
- 副文：14/22 `text/secondary`，「84 款精选工具 · 10 大分类 · 每周持续上新，按需筛选直达」
- 大搜索条：
  - 80h（比当前 48 大幅放大）
  - `bg/surface` 底，1px `border/subtle`，hover/focus `border-strong`
  - 内部：`[search 图标 20px text/tertiary] [input 16/24 placeholder text/quaternary] [⌘K 键帽 28×28 圆角6 bg/overlay 文字 text/secondary + accent/blue 描边]`
  - focus 状态加 8px `accent/blue` 0.15 透明光晕（唯一允许的霓虹大色块）
- 数据点行（14px `text/secondary`）：`[accent/blue 数字]84 工具 · [accent/purple 数字]10 分类 · [accent/green 数字]本周 +3 上新`，三个分隔点用 · 而非竖线（避免 hero-stat-divider 嵌套卡）

**右侧 5/12 列**：3 张错落分布的 Card 缩略图（演示工具多样性）：

- 卡 1（写作类）：右上，旋转 -3deg
- 卡 2（绘画类）：右中，旋转 2deg，部分遮住卡 1
- 卡 3（视频类）：右下，旋转 -1deg
- 每张卡 220×140，`bg/surface` + 1px `border/subtle`，圆角 12，内含工具图标 + 名称 + 1 行简介

### 4.3 Categories + Sort + Filter

**分类（Tag Toggle 一行）**：

```
[全部(84)] [AI写作(12)] [AI绘画(8)] [AI代码(11)] [AI视频(9)] [AI语音(8)] [AI设计(7)] [AI办公(11)] [AI音乐(6)] [AI Agent(6)] [AI搜索(6)]
```

- 选中态：`bg/overlay` + `accent/blue` 文字 + 1px `accent/blue` 描边
- 默认态：`bg/surface` + `text/secondary`
- 圆角 8、padding 8/14

**排序条**（在分类下方 gap 16）：`[默认] [热门] [免费] [国产] [A-Z]  ···  [筛选 图标按钮]`

- 选中态：`bg/surface-2` + `text/primary` 14/600
- 默认态：`text/secondary` 14/500
- 按钮高 32、padding 0/12

### 4.4 Hot Tools（4 列 × 2 行 = 8 张）

section header：H2「热门推荐」+ 右侧文字链接「查看全部 →」。网格：grid 4 列、gap 20。

**单卡**（240w × 200h，`bg/surface`，1px `border/subtle`，radius 12，padding 20）：

- 顶部：`[图标 40×40 radius8 bg/overlay 居中 accent/blue]` 右上角 `Tag(accent/orange "热")`
- 中部 gap 8：工具名 16/600 `text/primary` + 1 行简介 13/20 `text/tertiary`（最多 2 行 ellipsis）
- 底部 gap 8：`[Tag 免费 accent/green] [Tag 国产 text/secondary]`
- 整卡 hover：`border-strong` + `translateY(-2px)` + shadow

**8 个示例**（来自 next-src 实际工具）：

1. ChatGPT（橙「热」+ Tag 海外）
2. Claude（绿「免费」+ Tag 海外）
3. DeepSeek（绿「免费」+ Tag 国产）
4. Cursor（紫「Premium」+ Tag 海外）
5. Midjourney（橙「热」+ Tag 海外）
6. 即梦 AI（绿「免费」+ Tag 国产）
7. Suno（绿「免费」+ Tag 海外）
8. 飞书妙记（绿「免费」+ Tag 国产）

### 4.5 数据概览（游客友好版）

section header：H2「平台数据」+ 副文「全站热门，无需登录」（取代当前空态）。

**顶部一行 4 列**（gap 16）Stats Card：

- `84` AI 工具
- `10` 分类
- `24.6K` 本周点击
- `+3` 本周上新

每张 Stats Card：`bg/surface`、radius 12、padding 24、数字 32/700 `accent/blue`、标签 14 `text/secondary`。

**下方两列 grid**（gap 24，6:5）：

- 左卡（无框，仅 1px `border/subtle` 顶部分隔）：标题「分类分布」。10 行水平条形图，每行：`[分类名 14] [条 bar bg/overlay 圆角4，填充 accent/blue 比例] [数字 12 text/tertiary]`
- 右侧列表（行式，无卡框）：标题「本周 Top 5」。5 行：`[排名 18/700 accent/orange] [工具图标 28×28] [工具名 14/600] [点击数 12 text/tertiary 右对齐]`。行间分隔：1px `border/subtle`

### 4.6 All Tools（更紧凑）

section header：H2「全部工具」+ 副文「84 款 · 按字母排序」。

- 网格：3 列、gap 16
- 单卡（约 380w × 96h，更扁平的横向卡）：
  - 左：图标 48×48 radius 8
  - 右：`[名称 15/600] [1 行简介 13/20 text/tertiary] [底栏：价格 Tag + 来源 Tag + 访问数 12 text/tertiary]`
  - padding 16、`bg/surface`、1px `border/subtle`、radius 12
- 显示前 9 个工具，底部居中「加载更多」文字按钮

### 4.7 Footer

`bg/surface-2`、padding 64 顶部 / 24 底部。

**4 列 grid**（gap 48）：

- 列 1：logo + 一句话「AI 工具导航，让好工具被看见」+ 社交图标（GitHub / 微博 / Twitter）
- 列 2 标题「工具」：写作 / 绘画 / 视频 / 代码 / 办公
- 列 3 标题「资源」：上新 / 排行榜 / 文章 / 提交工具
- 列 4 标题「关于」：关于我们 / 联系 / 隐私 / 条款

**底栏**（border-top 1px `border/subtle`）：`© 2026 weihub.cloud  ·  ICP 备案号  ·  [主题切换] [语言]`

---

## 5. 执行 Checklist（额度恢复后可直接照跑）

- [x] Step 1：Figma 文件 `7HJEozIDrv4n8UdERMisji` 已建好
- [x] Step 2：SDS 组件 key 已识别（见本文 §2）
- [ ] Step 2 变量已落地：需要执行「use_figma call #1」建立 `v4/Color`、`v4/Size` collection（脚本由 Codex 续跑时按 §1 自动生成）
- [ ] Step 3 wrapper：1440 宽 VERTICAL auto-layout，bg 绑 `bg/base`
- [ ] Step 4 section ×7：按 §4 顺序，每 section 一笔 `use_figma`，逐节 `await node.screenshot()` 校验
- [ ] Step 5 全局校验：`get_screenshot` 全画板，核对：① ⌘K 提示是否前移可见 ② 大块色面是否中性灰 ③ 卡内无嵌套卡 ④ 游客态数据概览非空 ⑤ 热门卡是否 8 张
- [ ] Step 6（可选）：与当前线上截图并排做对比图，记录改进项

---

## 6. 已知 Blocker

**当前进度被 Figma Starter 计划 MCP 调用配额拦住**：在 setup token + wrapper 这一笔 `use_figma` 调用时返回：

> `You've reached the Figma MCP tool call limit on the Starter plan. Upgrade your plan for more tool calls.`

升级入口：https://www.figma.com/files/team/1644333721857682740/all-projects?upgrade=mcp_rate_limit_paywall

**等待额度恢复后**，把本文件交给 Codex 续跑即可自动从 §5 checklist 第 3 步开始往下执行（前两步已沉淀在本文件 + 文件已建好）。
