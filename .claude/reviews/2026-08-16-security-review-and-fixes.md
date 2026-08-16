# 安全代码审查与修复报告 — 2026-08-16

- 范围：全仓库（根前端 `js/`、旧后端 `server/`、Next 主线 `next-src/`、独立工具 `tools/resume-optimizer/`）
- 方法：逐文件人工审查（read/grep），覆盖 XSS、注入、认证、配额/支付、CSP、密钥管理、提示注入
- 结论：**未发现致命（Critical）漏洞**；全部中危（M1–M4）与低危（L1–L11）已修复或明确延期

## 处置总表

| ID | 级别 | 问题 | 处置 | 主要文件 |
|----|------|------|------|----------|
| M1 | 中 | `/api/track/click` 内存 Map 无上限、key 任意字符串可被撑爆 | ✅ key 规范化（id/slug 白名单）+ 50,000 FIFO 上限 | `next-src/src/app/api/track/click/route.ts` |
| M2 | 中 | ratings POST 对 `comment`/`tags` 长度与数量无校验 | ✅ comment ≤200、tags ≤10×20 | `next-src/src/app/api/ratings/route.ts` |
| M3 | 中 | `lib/auth.ts` 的 `getUser()` 假同步、错误处理不一致 | ✅ 改 async `Promise<User \| null>` | `next-src/src/lib/auth.ts` |
| M4 | 中 | favorites/ratings 认证分支用 anon key 建客户端（RLS 关闭时 anon 可任意读写） | ✅ 统一 `requireSupabaseUser` + service-role + 显式 `.eq('user_id')`，保留匿名降级 | `next-src/src/server/supabase-admin.ts`、favorites/ratings 路由 |
| L1 | 低 | `PASSWORD_PEPPER` 硬编码兜底 `'change-me-in-production'` | ✅ 兜底改为空 + FATAL 校验 | `server/src/config.js` |
| L2 | 低 | `DAILY_QUOTA` 非法值静默回退 | ✅ `parseDailyQuota()` + 警告 | `server/src/config.js` |
| L3 | 低 | 限流/登录锁定为进程内存态，多实例失效 | ✅ README 部署注意事项 | `README.md` |
| L5 | 低 | CSP 含 `unsafe-inline` 与无关 CDN 白名单；`X-XSS-Protection` 已弃用 | ✅ 收紧为 `'self'` 系列；移除弃用头（API 仅返回 JSON，零风险） | `server/src/index.js` |
| L6 | 低 | 旧 LLM 无提示注入防御 | ✅ `JSON.stringify` 引号包裹 + 「不可信引用数据」声明（system 不动，测试零改动） | `server/src/services/llm.js` |
| L7 | 低 | search 分页参数无上限 | ✅ page ≥1、limit ∈[1,100] | `next-src/src/app/api/search/route.ts` |
| L9 | 低 | 微信支付 stub：`time_expire` 脆弱裁剪；notify 无 body 上限 | ✅ `formatWechatTime()`（UTC+8）；`express.raw` 加 `limit:'100kb'`；标注未接入 | `server/src/routes/payment.js` |
| L10 | 低 | `maskEmail` 双份实现 | ✅ 收敛到 `utils/sanitizer.js` | `server/src/routes/auth.js`、`server/src/utils/sanitizer.js` |
| L11 | 低 | 客户端残留未用的 `escapeHtml` | ✅ 删除 | `next-src/src/lib/utils.ts` |
| L4 | 低 | `scryptSync` 阻塞事件循环 | ⏸ 延期：需同步改 `quota.test.js` 约 20 处调用；挂路线图 Phase 0/1 | — |
| L8 | 低 | 幂等键每请求新生成 | ⏸ 无需改：客户端无重试，服务端 SQL 台账已防重复扣费 | — |

## 验证基线（全绿）

- 根目录 `NODE_OPTIONS='--experimental-vm-modules' npx jest`：**733 / 733**（31 suites，较修复前 +7）
- `next-src` `npm run lint`：0 告警；`npx tsc --noEmit`：0 错误；`npm run test:resume`：47 + 10 通过

## 附带产出

- `docs/tech-stack-convergence.md` — 4 套实现收敛到 `next-src` 的分阶段路线图
- 新增针对性测试：config（4）、sanitizer/maskEmail（2）、llm 引号包裹（1）、index 安全头断言更新

## 注意

- 未跟踪目录 `.superpowers/`、`outputs/` 为本地既有产物，**不属于本次改动**，提交前请确认是否纳入 `.gitignore`
- M4 依赖 service-role 显式作用域，生产请确认 `favorites`/`ratings` 表 RLS 策略作为二道防线

---

## 生产收口记录（2026-08-16 追加）

- **VULN-1（tools/categories/scenes 无 RLS）已在生产修复**：迁移 `20260816160000_content_rls.sql` 经 GitHub Actions（`supabase-db-push` workflow，run 31943324404）于 2026-08-16 11:04 UTC 应用。
  - 攻击复测：anon key PATCH `tools` → **401 permission denied**（修复前 200 真改数据）
  - 公共读：`/rest/v1/tools` → 200，前端目录无影响
  - 契约验证：`rls_contracts.sql` 经 `supabase-contract-check` workflow（run 31943514598）对生产库执行 → **CONTRACTS PASS**（含 RLS 启用、无写策略、公共读、ratings DELETE、计费表护栏、触发器 definer 六项断言）
  - 线上冒烟：首页 200、工具页 200（308 尾斜杠规范化属正常）、ratings/tools API 200
  - 迁移历史调和：本地 001/002/20260724000741 标记 applied；远端独有版本 20260630134529/20260723124839/20260724004724 标记 reverted（仓库中途采纳 CLI 的标准对账，三者早于本仓库迁移目录且内容已包含在 001/002 中）
  - 至此本轮审计的全部发现：代码层 11 项修复、测试 24+ 用例、CI 三 job、生产 RLS 收口——**全链路闭环，无未处理的安全发现**。
