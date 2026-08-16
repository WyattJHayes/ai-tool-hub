# 生产 Supabase 执行 003_content_rls.sql 操作指南

> 目的：关闭 VULN-1（公开 anon key 可经 PostgREST 改写 `tools.website_url` 等核心数据）。
> 全部代码、CI、契约测试已就绪，这是唯一的运维动作。
> 预计耗时：**staging 5 分钟 + 生产 5 分钟 + 验证 3 分钟**。

---

## 第 0 步：备份（生产，必做，1 分钟）

Supabase Dashboard → **Database → Backups**，点击最新备份行的 **Download**（或确认每日自动备份时间点在近期）。这是回滚的保底。

---

## 第 1 步：staging 先行（5 分钟）

若有 staging 项目，先在那里完整走一遍第 2、3 步，确认全绿再上生产。没有 staging 就在生产做，但第 0 步备份绝不能省。

---

## 第 2 步：执行迁移（生产 Supabase SQL Editor）

1. Dashboard → **SQL Editor** → **New query**
2. 打开本地文件，**完整复制**内容：
   ```
   next-src/supabase/migrations/003_content_rls.sql
   ```
3. 粘贴进编辑器，点 **Run**
4. 预期输出：`Success. No rows returned`（DDL 语句的正常返回）

### 该迁移做了什么（全部可逆）

| 动作 | 影响 |
|---|---|
| `tools`/`categories`/`scenes` 启用 RLS | anon/authenticated 从"默认全权限"变为"受策略约束" |
| 三条 `for select using (true)` 只读策略 | **前端目录页/评分页的公开读完全不受影响** |
| `revoke insert, update, delete` | 写权限仅剩 service_role（应用服务端写入路径不变） |
| `ratings_delete_own` DELETE 策略 | 新增能力：用户可删除自己的评分（L-3） |
| 两个计数触发器改 `security definer` | 保证 RLS 生效后评分/收藏计数照常更新 |

---

## 第 3 步：验证（3 分钟）

### 3a. SQL Editor 跑契约（应全绿）

新建 query，完整复制粘贴并 Run：

```
next-src/supabase/tests/rls_contracts.sql
```

预期：`Success. No rows returned`。任何 `VULN-1: ...` / `L-3: ...` / `REGRESSION: ...` 报错都代表迁移未正确生效——**停止并回报错误内容**。

### 3b. 线上功能冒烟（浏览器 1 分钟）

- 打开 `https://weihub.cloud/` → 工具目录正常渲染（验证公共读策略）
- 任选工具 → 详情页评分区正常显示聚合分（验证 ratings 读）
- 登录后给任一工具收藏/评分一次 → 计数与平均分正常变化（验证触发器 definer 化）

### 3c. 攻击面复测（可选但推荐，1 分钟）

用真实的 anon key（浏览器 DevTools → Application → LocalStorage，或前端 bundle 里的 `NEXT_PUBLIC_SUPABASE_ANON_KEY`）：

```bash
# 执行前：这条会 200 并真的改掉 website_url（即漏洞本身）
# 执行后：预期 401/403/404（新 RLS 拒绝）
curl -X PATCH "https://<你的项目ref>.supabase.co/rest/v1/tools?id=eq.1" \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"website_url":"https://example.com/pwned"}'
```

确认返回的是 **401/403** 而非 `200 OK`。

---

## 回滚方案（万一需要）

SQL Editor 依次执行（顺序重要）：

```sql
-- 1. 恢复触发器为 invoker（可选，直接删策略也行）
-- 2. 删除新增策略
drop policy if exists tools_public_read on public.tools;
drop policy if exists categories_public_read on public.categories;
drop policy if exists scenes_public_read on public.scenes;
drop policy if exists ratings_delete_own on public.ratings;
-- 3. 关闭 RLS
alter table public.tools disable row level security;
alter table public.categories disable row level security;
alter table public.scenes disable row level security;
```

> 注意：回滚即重新打开 VULN-1 漏洞面，仅在迁移引发功能故障时使用，且应立即排查根因后重新上线。

---

## 常见问题

**Q: 应用需要改代码吗？**
A: 不需要。服务端写入走 service_role（绕过 RLS），前端只读走 anon + 只读策略。CI 已在干净库上验证过完整迁移链与应用兼容。

**Q: 为什么 CI 绿了还要手动执行？**
A: CI 的 `db-contracts` job 跑在**本地临时 Supabase 容器**里，验证的是"迁移正确且可重放"；生产库是独立实例，迁移不会自动同步，必须手动执行（或将来接入 `supabase db push`，见下）。

**Q: 将来能自动化吗？**
A: 可以：`supabase link --project-ref <ref>` + `supabase db push` 可将迁移直接推到远端项目。建议等 1-2 个迁移周期稳定后再接入，当前手动执行 + 本指南最稳。

---

执行完成后告诉我结果（3a 契约是否全绿、3c 攻击复测返回码），我更新审计报告关闭 VULN-1。
