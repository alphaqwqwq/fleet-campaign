---
name: fleet-cicd
description: Fleet-campaign 网页发布 CI/CD 全流程：门禁、PR/CI、Vercel 部署与 DNS/HTTPS、多网络验收、回滚止损。Use when 用户要发布/上线/部署网页、推进或检查 feature 的 PR 与 CI、处理 Vercel 或 DNS 问题、执行"发布 Gate"或"多网络验收"。仓库内唯一真源为 docs/reference/PLAYBOOK-CICD.md。
---

# Fleet-campaign CI/CD 发布流程

本 skill 是 `docs/reference/PLAYBOOK-CICD.md` 的可执行速查版；冲突以该文档为准。网页相关操作都按下面步骤走。

## 固定门禁（本地与 CI 一致，任一失败即停）

```text
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
```

PR 与 `main` 推送由 GitHub Actions 跑同一套；本地先跑通，以 Actions URL 为准。失败保留证据（URL + 命令 + 日志摘要），不删除/弱化断言。

## 发布链路（按序）

1. `feature/<slug>` 分支 + PR，只提交本模块允许文件。
2. GitHub Actions 五项门禁全 `success`，记录 Actions URL 与提交哈希。
3. Vercel Preview：确认与提交关联、构建 `Ready`；**Preview ≠ 生产入口**。
4. 自定义域名/DNS（如需改）：幂等脚本 `scripts/Invoke-VercelFleetCnameDns.ps1`——默认 dry-run，`-Apply` 才写，写后 Alidns + `Resolve-DnsName` 双验证；只管理目标主机记录。
5. HTTPS：Vercel 自动签发；验收记 CN 匹配、有效期、`ChainValid`。
6. 多网络验收矩阵（见 PLAYBOOK）：执行环境 curl+TLS、用户本机浏览器、独立设备/浏览器、移动网络；无法执行标"未验证"。
7. CI 绿 + 验收通过 → 合并 `main` → 生产部署 → 用生产域名实际内容复验（不能只信 PR 检查）。
8. 主页入口（alphaqwq-home）走其自己分支/PR/部署，合并后复验生产实际内容。

## 必查的坑（Windows/本项目）

- **Vercel CLI 报 `TypeError: fetch failed` → 先设 `NODE_OPTIONS=--use-system-ca`**。
- **合并后生产未更新 → 先核对 Vercel Production Branch**（可能仍是 master，main 推送只产生 Preview）。
- Vercel Update Project API 不接受 `link` 字段；改 productionBranch 用控制台 UI 或断重连 Git。
- aliyun CLI 3.4.x 不接受 `--output json`（默认即 json）。
- PowerShell 5.1：.ps1 中文注释要 ASCII 或 UTF-8 BOM，否则被按 ANSI 解码。
- DNS 写必须幂等：dry-run → 审核 → Apply → 写后验证；回滚用同一 `RecordId` 更新回旧值，脚本不删记录。
- Vercel token（Windows）：`%APPDATA%\xdg.data\com.vercel.cli\auth.json`；凭据不进仓库/文档/日志。

## 回滚与止损

- Git 回滚 `git revert <commit>`，不重写共享历史；未合并 PR 可关闭。
- DNS 回滚不自动：dry-run 验证后同一 RecordId 更新回旧值。
- Vercel 回滚优先切换既有成功部署。
- 止损：CI / Vercel 构建 / DNS / HTTPS / 浏览器 / 多人在线验收任一失败 → 停、留证据、请用户决策；同一诊断两次无可信结论不再重复写。

## 中继部署与验证（ADR-005）

- 联机默认走同源 `/api/relay`；依赖 Vercel 官方 Redis（`REDIS_URL`，`redis://` 形式），**不是** `KV_REST_API_*`（`@vercel/kv` 不适用）。
- **函数必须自包含**：`api/relay.ts` 已内联 handler；跨目录 `../packages/...` 导入 → Vercel 打包器追踪不到 → `FUNCTION_INVOCATION_FAILED`。改 handler 需同步 `packages/realtime/src/relay-handler.ts`。
- 连接数据库时勾 Production + Preview，Custom Prefix 留空。
- 验证：`https://fleet.alphaqwq.xyz/api/relay?room=12345&op=host-poll` → `{"records":[],"cursor":0}`。
- 部署后前端强制刷新（Ctrl+Shift+R / 手机清缓存）。
- 房间码 5 位数字；中继 host-open 做占据检查 + 清旧日志，host-close/1h TTL 释放。
- **轮询防并发**：慢网络下 poll 可能重叠 → 同一帧重复投递（"一次操作反复播报"）。`relay.ts` 的 `startPollLoop` 有 `inFlight` 守卫；改轮询必须保留守卫并跑慢网络回归测试。
- 备选：`?transport=peerjs`（依赖外部信令，国内不可靠，仅调试）。

## 依据

- 详细矩阵、全部实测坑与证据：`docs/reference/PLAYBOOK-CICD.md`
- 人工决策 Gate（发布 Gate）：`docs/WORKFLOW.md`
