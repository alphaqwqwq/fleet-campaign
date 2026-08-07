# 网页发布 CI/CD 全流程经验手册

- 目的：为后续 Plan/Exec/Review 对话提供可直接调用的网页发布执行经验与验收底线。以本项目实际验证过的事实为准，不描述未验证的设想。
- 适用范围：本仓库（`fleet-campaign`）网页的持续集成、持续部署、自定义域名、HTTPS 与多人在线验收。
- 相关文档：[工作流](WORKFLOW.md)、[项目文件管理方案](PROJECT-STRUCTURE.md)、[PLAN-001 程序与发布自动化基础](../04-plans/PLAN-001-ROOM-PERSISTENCE-FOUNDATION.md)、[EXEC-001-02 发布诊断基线](../05-execs/PLAN-001/EXEC-001-02-RELEASE-DIAGNOSTICS.md)、[EXEC-001-03 DNS/Vercel 自动化](../05-execs/PLAN-001/EXEC-001-03-DNS-VERCEL-AUTOMATION.md)。

## 核心原则

1. **每个大阶段必须实际投放并多人在线验证**：每一个大阶段（feature）在本地验证完成后，都必须实际投放到网页（Preview → 生产），并完成多人在线验证后才能进入下一阶段或标记完成；不得停留在"本地通过 + 构建成功"即算完成。
2. **自动化构建状态 ≠ 网页可访问性**：Vercel `Ready` 只证明构建与部署完成，不证明用户能访问；可访问性必须由浏览器矩阵、HTTP 状态、页面/DOM、控制台/网络记录与 HTTPS 证书共同证明。
3. **每个真实投放留可追溯证据**：提交哈希、PR、Actions URL、Vercel Preview/生产 URL、验收时间与结果必须写入对应 Exec 结果记录。
4. **密钥不进任何非安全载体**：AccessKey、Vercel/GitHub Token、Cookie、验证码不得写入仓库、文档、提示词、CI 日志、对话或 `.env`。

## 标准门禁（本地与 CI 必须一致）

```text
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
```

- PR 与 `main` 推送都由 GitHub Actions 执行同一套门禁；本地先跑通，CI 结果以 Actions URL 为准。
- 任一失败即停止推进，保留 Actions URL、失败命令与日志摘要；不得删除或弱化断言换取通过。

## 发布链路（各步实测经验）

1. **feature 分支 + PR**：分支名 `feature/exec-<计划>-<序号>-<短名>`；只提交该 Exec 允许文件；PR 不开合并。
2. **GitHub Actions**：确认同一提交的五项门禁全部 `success`，记录 Actions URL 与提交哈希。
3. **Vercel 构建**：`npm ci` + `npm run build`，产物 `apps/web/dist`；确认 Preview 与提交关联、构建状态与产物目录；Preview 不等于生产入口。
4. **自定义域名 / DNS（EXEC-001-03 已验证流程）**：
   - Vercel 项目手动添加域名，读取它要求的精确记录类型与值；若要求多条/A/TXT 而非单条 CNAME，停止并回 Plan 裁决。
   - 只管理目标主机记录（本仓库为 `alphaqwq.xyz` 下 `fleet` 的默认线路 CNAME），目标值由执行时传入，不在脚本硬编码。
   - 幂等脚本契约：默认 dry-run（只读查询 + 输出计划，退出码 `2` 表示需变更）；显式 `-Apply` 才写；冲突（非 CNAME、非默认线路、多条）即终止且不删除记录；值/TTL 已符合时不写；写后重查 Alidns + `Resolve-DnsName` 验证。
   - 本仓库脚本：`scripts/Invoke-VercelFleetCnameDns.ps1`（以 `powershell.exe -File` 或 `pwsh -File` 运行）。
5. **HTTPS 证书**：Vercel 对自定义域名自动签发（本项目为 Let's Encrypt）；验收时记录证书主机名（CN 必须匹配域名）、有效期、信任链（`ChainValid`）与浏览器安全状态。
6. **多网络验收矩阵**（见下节）。
7. **合并 `main` → 生产部署**：只允许已通过门禁与验收的提交；记录生产部署状态与 URL；`main` 保持可构建、可部署、可回滚。
8. **多人在线验证**：每次大阶段投放后，组织多人/多网络实际访问，收集页面、控制台、网络与证书反馈，写入 Exec。

## 多网络验收矩阵

每项记录：时间、网络环境、URL、HTTP 状态、页面/DOM 或截图、控制台、网络请求、证书状态。

| 环境 | 最低要求 | 说明 |
| --- | --- | --- |
| 执行/开发环境 | HTTP 状态 + 证书 | `curl -I` 与 TLS 证书检查（CN/有效期/ChainValid） |
| 用户本机 | 浏览器正常访问 | 地址栏锁图标、页面渲染、控制台无错误 |
| 独立浏览器环境 | 换设备或换浏览器 | 至少一个与开发环境不同的浏览器/设备 |
| 不同网络/移动网络 | 手机流量等 | 关闭 Wi-Fi 用移动数据访问一次 |

无法执行的环境必须标记"未验证"，不得推断成功。

## 本项目实测经验与坑（引用证据）

- **aliyun CLI 3.4.x 的 `--output` 语法已变**：不再接受 `--output json`（该 flag 仅用于 `--output cols=` 表格输出），默认输出格式即为 json（configure 提示 "Only support json"）。调用脚本中不应再传 `--output json`。
- **Windows PowerShell 5.1 的编码陷阱**：UTF-8 无 BOM 的 `.ps1` 文件中含中文注释会被按 ANSI 解码，导致脚本执行异常（表现为外部命令 `$LASTEXITCODE` 取不到值、行为时好时坏）。脚本注释一律使用 ASCII，或文件保存为 UTF-8 带 BOM。
- **默认 `*.vercel.app` 在部分网络路径 TCP 443 超时**（EXEC-001-02 基线）：不能据此推断 Vercel 配置根因；自定义域名经 DNS CNAME 指向 `*.vercel-dns-017.com` 后在相同环境实测返回 `200 OK`（EXEC-001-03）。
- **DNS 写入必须幂等 + 可回滚**：dry-run → 用户审核 → `-Apply` → 写后验证；回滚用同一 `RecordId` 以 `-Apply -Target <旧值>` 更新回旧值；删除记录必须回 Plan 裁决，脚本不删除。
- **凭据轮换**：AccessKey 一旦进入对话/日志即视为泄露，必须停用并重建，再用专用 RAM 用户（非主账号）重新配置 CLI；最小权限只授 `alidns:DescribeDomainRecords`、`AddDomainRecord`、`UpdateDomainRecord`。
- **网络间歇性超时**：调用 `alidns.aliyuncs.com` 偶发 DNS 解析超时，重试可恢复；不要因一次超时重复写 DNS。

## 回滚与止损

- Git 回滚使用 `git revert <commit>`，不重写共享历史；未合并 PR 可关闭。
- DNS 回滚不自动执行：先 dry-run 验证影响，再以同一 `RecordId` 更新回旧值。
- Vercel 回滚优先切换既有成功部署。
- 止损：CI、Vercel 构建、DNS、HTTPS、浏览器或多人在线验收任一失败，停止推进、保留真实证据、请求用户决策；同一诊断问题两次无可信结论时，不再重复写入。
