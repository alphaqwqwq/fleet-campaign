# 网页发布 CI/CD 经验手册

- 状态：现行（2026-08-13 从归档恢复，仅保留实测事实）
- 适用范围：fleet-campaign 网页的 CI、Vercel 部署、自定义域名、HTTPS 与多人在线验收。

## 核心原则

1. 每个大模块本地通过后，必须实际投放（Preview → 生产）并多人在线验证才算完成；"本地通过 + 构建成功"不算完成。
2. Vercel `Ready` ≠ 可访问；可访问性由浏览器矩阵 + HTTP 状态 + DOM + 控制台/网络记录 + HTTPS 证书共同证明。
3. 每次真实投放留可追溯证据：commit、PR、Actions URL、Preview/生产 URL、验收时间与结果。
4. 密钥不进任何非安全载体：仓库、文档、提示词、CI 日志、对话、`.env`。

## 标准门禁（本地与 CI 一致）

```text
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
```

PR 与 `main` 推送由 GitHub Actions 执行同一套门禁；本地先跑通，以 Actions URL 为准。任一失败即停止、保留证据，不删除或弱化断言。

## 发布链路（实测）

1. `feature/<slug>` 分支 + PR，只提交该模块允许的文件。
2. GitHub Actions 五项门禁全 `success`，记录 Actions URL 与提交哈希。
3. Vercel Preview：`npm ci` + `npm run build`，产物 `apps/web/dist`；Preview 与提交关联，但不等于生产入口。
4. 自定义域名 / DNS：只管理目标主机记录；幂等脚本 `scripts/Invoke-VercelFleetCnameDns.ps1`（默认 dry-run，`-Apply` 才写，写后 Alidns + `Resolve-DnsName` 双验证）。
5. HTTPS：Vercel 对自定义域名自动签发；验收记录 CN 匹配域名、有效期、`ChainValid`。
6. 多网络验收矩阵（见下节）。
7. 合并 `main` → 生产部署；`main` 保持可构建、可部署、可回滚。
8. 多人在线验证：每次投放后组织多设备/多网络实际访问，收集页面、控制台、网络、证书反馈。
9. 主页入口（`alphaqwq-home`）：走其自己的分支/PR/部署；合并到其 `main` 后必须复验生产域名实际内容，不能只信 PR 检查。

## 多网络验收矩阵

每项记录：时间、网络环境、URL、HTTP 状态、页面/DOM 或截图、控制台、网络请求、证书状态。

| 环境 | 最低要求 |
| --- | --- |
| 执行/开发环境 | `curl -I` + TLS 证书检查（CN/有效期/ChainValid） |
| 用户本机 | 浏览器正常访问，地址栏锁图标，控制台无错误 |
| 独立浏览器/设备 | 至少一个与开发环境不同的浏览器或设备 |
| 不同网络/移动网络 | 关闭 Wi-Fi 用移动数据访问一次 |

无法执行的环境必须标记"未验证"，不得推断成功。

## 实测经验与坑

- **aliyun CLI 3.4.x** 不再接受 `--output json`（该 flag 仅用于表格输出），默认输出即 json；脚本不应再传。
- **PowerShell 5.1 编码陷阱**：UTF-8 无 BOM 的 `.ps1` 含中文注释会被按 ANSI 解码导致执行异常；脚本注释用 ASCII 或存为 UTF-8 带 BOM。
- **默认 `*.vercel.app` 部分网络 TCP 443 超时**，不能据此推断 Vercel 配置根因；自定义域名 CNAME 至 `*.vercel-dns-017.com` 实测 `200 OK`。
- **DNS 写必须幂等 + 可回滚**：dry-run → 审核 → `-Apply` → 写后验证；回滚用同一 `RecordId` 更新回旧值；脚本不删除记录。
- **凭据轮换**：AccessKey 一旦进入对话/日志即视为泄露，停用重建；用最小权限 RAM 用户（`alidns:DescribeDomainRecords / AddDomainRecord / UpdateDomainRecord`）。
- **网络间歇性超时**：`alidns.aliyuncs.com` 偶发解析超时，重试可恢复；不要因一次超时重复写 DNS。
- **Vercel CLI 网络失败先查 `NODE_OPTIONS=--use-system-ca`**：Windows 未设置时持续报 `TypeError: fetch failed`；执行 Vercel 命令前先设置。
- **合并 PR 后生产未更新，先核对 Vercel Production Branch**：可能仍是 `master` 而开发在 `main`，此时 main 推送只产生 Preview；必须用生产域名实际内容（资源哈希/页面 DOM）复验。
- **Vercel Update Project API 不接受 `link` 字段**（`PATCH /v9/projects/{id}` 报 `should NOT have additional property link`）；改 productionBranch 用控制台 UI，或经授权 `POST /v9/projects/{id}/link` 断重连 Git（会重置部分集成状态）。
- **Vercel token（Windows）**：`%APPDATA%\xdg.data\com.vercel.cli\auth.json`；API 用 Bearer 注入，不写仓库/文档。
- **旧项目删除权限边界**：Vercel 项目删除用项目 token（`DELETE /v9/projects/{id}` → 204 → 查询 404 确认）；GitHub 仓库删除需 `delete_repo` scope（`gh auth refresh -h github.com -s delete_repo` 或用户网页操作）。

## Vercel 轮询中继部署与验证（ADR-005）

联机实时层默认走中继（同源 `/api/relay`）。部署与排障清单：

1. **依赖**：Vercel Storage 创建 **Official Redis for Vercel**（免费档），连接项目时勾 Production + Preview、**Custom Prefix 留空**（包只认标准名）。
2. **环境变量**：项目会自动注入 `REDIS_URL`（`redis://...` 形式）。注意**不是** `KV_REST_API_*`——官方 Redis 不提供 REST 变量，`@vercel/kv` 用不了，`api/relay.ts` 用的是 `redis` 包读 `REDIS_URL`。
3. **函数必须自包含**：`api/relay.ts` 已内联中继 handler。跨目录 `../packages/...` 相对导入会让 Vercel 打包器追踪不到 → 部署后一律 `FUNCTION_INVOCATION_FAILED`（HTTP 500 + "A server error has occurred"）。改 handler 逻辑必须同时改 `packages/realtime/src/relay-handler.ts`（保持一致）。
4. **验证 URL**：部署完成后浏览器打开 `https://fleet.alphaqwq.xyz/api/relay?room=12345&op=host-poll`，期望 `{"records":[],"cursor":0}`（HTTP 200）。返回 500 先查 `REDIS_URL` 是否进 Production、函数是否自包含。
5. **部署后强制刷新**：前端 JS 有缓存，改完必须 `Ctrl+Shift+R`（手机清站点数据），否则还在跑旧包。
6. **房间码**：5 位数字（10000–99999），中继按码建房间；房主 `host-open` 会做占据检查（409 `room_occupied`）并清空旧日志，`host-close`/1h TTL 释放码。撞码概率可忽略；真撞了房主显示传输不可用，关闭重建即可。
7. **备选传输**：`?transport=peerjs` 可回退 PeerJS 直连（依赖外部信令，国内不可靠，仅调试用）。

## 回滚与止损

- Git 回滚用 `git revert <commit>`，不重写共享历史；未合并 PR 可关闭。
- DNS 回滚不自动执行：先 dry-run 验证影响，再以同一 `RecordId` 更新回旧值。
- Vercel 回滚优先切换既有成功部署。
- 止损：CI、Vercel 构建、DNS、HTTPS、浏览器或多人在线验收任一失败，停止推进、保留真实证据、请求用户决策；同一诊断问题两次无可信结论时不再重复写入。
