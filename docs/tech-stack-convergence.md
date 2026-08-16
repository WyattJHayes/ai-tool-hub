# 技术栈收敛路线图

> 状态：规划草案（不动代码）。目标是把当前 4 套并行实现收敛到以 `next-src` 为唯一主线，消除重复逻辑、统一安全模型、降低维护成本。

## 1. 现状盘点

| 实现 | 路径 | 角色 | 状态 |
|---|---|---|---|
| vanilla JS 前端 | `js/`、`css/`、`index.html`、`sw.js` | 旧版单页站（工具目录/搜索/分享/研究面板 + PWA） | 遗留，已被 Next 版取代 |
| Express 后端 | `server/` | 简历优化 API（DeepSeek LLM、JWT 认证、文件型配额、支付宝/微信 stub） | 遗留，功能与 `next-src` 简历垂直重复 |
| Next.js 全栈 | `next-src/` | 主应用（Supabase Auth、收藏/评分/搜索/对比/场景 + 简历优化垂直） | **主线** |
| 独立简历工具 | `tools/resume-optimizer/` | 静态简历优化工具（部署到 GitHub Pages） | 与 `next-src` 简历页功能重叠 |

## 2. 重复逻辑清单（本次审查确认）

| 能力 | 重复位置 |
|---|---|
| LLM 调用 / 提示词 / 输入过滤 | `server/src/services/llm.js` vs `next-src/src/server/resume/ai.ts` |
| 配额 / 结算 | `server/src/services/quota.js`（文件型 JSON） vs `next-src/src/server/resume/{quota,settlement}.ts`（Supabase SQL 台账） |
| 认证 | `server/src/middleware/auth.js`（JWT） vs `next-src/src/server/supabase-admin.ts`（Supabase JWT） |
| 邮箱脱敏 | `server/src/utils/sanitizer.js` vs（原）`server/src/routes/auth.js`（已合并） |
| 简历解析/PDF/DOCX | `tools/resume-optimizer/src/lib/*` vs `next-src/src/features/resume/{importer,pdf}.ts` |
| 点击/收藏/评分降级 | `next-src` 各 API 路由内的内存 Map 降级逻辑 |

## 3. 收敛原则

1. **主线唯一**：新功能只进 `next-src`；旧实现只做安全修复与下线，不做功能增强。
2. **先对齐安全模型**：认证统一到 service-role + 显式作用域（本次 M4 已对齐 favorites/ratings）；配额统一到 SQL 台账（`next-src` 已就绪）。
3. **数据迁移先行**：~~`server/data/quota.json` 的存量用户/订单/配额需在关闭 `server/` 前迁移到 Supabase~~ **已核实（2026-08-16）无需迁移**：本地 `server/data/quota.json` 仅 32 字节，0 用户 / 0 订单 / 0 付费会员。唯一前置动作是停服前在生产机上确认该运行时副本同样为空（`server/data/` 不入 git，生产机各有一份）。
4. **保留回滚窗口**：每阶段通过 feature flag / 域名切换保留回退能力。

## 4. 分阶段路线图

### Phase 0 — 冻结旧版（已完成大部分）
- [x] 旧版 LLM 输入加「引号包裹 + 不可信声明」（L6）
- [x] 旧版 CSP 收紧、移除 `unsafe-inline` 与弃用头（L5）
- [x] 旧版支付 stub 清理 + 通知接口 body 限制（L9）
- [x] 旧版限流/登录锁定标注单实例假设（L3，已写入 README）

### Phase 1 — 数据与支付迁移（已核实可跳过）
> 2026-08-16 核实：`server/data/quota.json` 为空（0 用户/0 订单/0 付费会员），**无数据可迁**。原本计划的迁移脚本不需要写；直接进入 Phase 2/3。

- [x] ~~设计 `quota.json → Supabase` 迁移脚本~~（无数据，跳过）
- [ ] 停服前在生产机确认 `server/data/quota.json` 为空（唯一保留动作，10 秒）
- [ ] 支付宝/微信支付接入决策：统一走 `next-src` 的 xddpay 边界，还是继续用 `server/` 直到支付迁移完成
- [ ] 微信统一支付实现或明确砍掉（当前 `server/` 为 501 stub）

### Phase 2 — 静态简历工具收编
- [ ] 确认 `tools/resume-optimizer` 的独立价值（是否仍有 GitHub Pages 独立流量）
- [ ] 若保留：把内联 `<script>` / `onclick` 迁出，从而去掉 CSP 的 `'unsafe-inline'`（更正 2026-08-16：该站**已有** meta CSP 且含 base-uri/form-action/upgrade-insecure-requests；剩余工作是迁内联处理器去 `'unsafe-inline'`，并在浏览器实测后评估能否去 `'unsafe-eval'`——html2pdf 旧版 bundle 疑似依赖）
- [ ] 若收编：将独有功能（模板、AI 代写、职位匹配）迁入 `next-src/src/app/resume`

### Phase 3 — 旧版下线
- [ ] 域名/入口切到 `next-src`，`js/` + `sw.js` 停止构建
- [ ] 关闭 `server/` 实例（前置：生产机 `quota.json` 确认为空，见 Phase 1）
- [ ] 删除 `js/`、`server/`、`tools/resume-optimizer` 中已收编的部分，更新 CI 与部署脚本

## 5. 关联的延期项

| 延期项 | 归属阶段 |
|---|---|
| L4（`server/src/services/quota.js` 的 `scryptSync` → 异步 scrypt） | **不修**：已核实 0 用户 = 0 并发登录，阻塞无从谈起；随 `server/` 一起废弃 |
| L8（幂等键复用） | 引入客户端自动重试时再做（`next-src` 服务端台账已防重复扣费） |
| 收藏/评分内存降级的 Map 上限 | 已在 M1 处理 click；favorites/ratings 的匿名 Map 保留但需在 Phase 2 复查容量 |

## 6. 风险与回滚

- **数据丢失**：~~Phase 1 迁移前必须双写/快照 `quota.json`~~ 已核实无存量数据；停服前在生产机确认 `quota.json` 为空并留一份快照即可。
- **认证中断**：`server/` JWT 与 `next-src` Supabase JWT 不互通，切换期间需要过渡登录方案（如短期的双端 token 兼容层）。
- **SEO/缓存**：`js/` 的静态首页若仍有自然流量，需在 `next-src` 做好 301 重定向与 `sw.js` 的清理，避免旧缓存白屏。
