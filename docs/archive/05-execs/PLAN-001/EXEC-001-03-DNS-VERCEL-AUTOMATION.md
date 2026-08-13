# EXEC-001-03：本机 Alidns 与 Vercel CNAME 自动化

- Plan：[PLAN-001：程序与发布自动化基础](../../04-plans/PLAN-001-ROOM-PERSISTENCE-FOUNDATION.md)
- 状态：Verified（DNS 自动化与多环境验收完成；执行步骤 7 的 feature 分支提交/PR/CI/Preview 与删除 fleet-room、主页入口更新按用户指示移交后续 Exec 承接，本 Exec 未标记 Pushed/Merged）
- 分支：`feature/exec-001-03-dns-vercel-automation`（尚未创建/提交）
- 依赖：[EXEC-001-02：CI/CD 诊断与部署反馈基线](EXEC-001-02-RELEASE-DIAGNOSTICS.md)
- 影响域：本机 DNS 自动化 / Vercel 自定义域名 / HTTPS 验证

## 当前事实与已裁决输入

- 目标正式入口为 `fleet.alphaqwq.xyz`；根域为 `alphaqwq.xyz`，本次唯一允许变更的主机记录为 `fleet`。
- 用户确认 DNS 托管记录真源为阿里云 DNS（Alidns），并负责创建专用 RAM 用户、完成本机 `aliyun` CLI 登录/凭据配置，以及审核和执行 DNS 写入。
- 用户尚未在 Vercel 添加 `fleet.alphaqwq.xyz`，因此 Vercel 所需记录类型和值尚未产生；不得预设 `cname.vercel-dns.com` 或其他目标值。
- EXEC-001-02 已记录执行环境与独立浏览器对默认 Vercel 域名的 TCP 443 超时基线；该基线不能确认根因，自定义域名不是该故障的替代结论。
- 当前 DNS 自动化仅在本机执行，不进入 GitHub Actions、Vercel 构建、仓库环境文件或浏览器客户端。

## 必读材料

- [工作流](../../00-governance/WORKFLOW.md)
- [项目文件管理方案](../../00-governance/PROJECT-STRUCTURE.md)
- [PLAN-001：程序与发布自动化基础](../../04-plans/PLAN-001-ROOM-PERSISTENCE-FOUNDATION.md)
- [EXEC-001-02：CI/CD 诊断与部署反馈基线](EXEC-001-02-RELEASE-DIAGNOSTICS.md)
- [阿里云 DNS API 快速入门](https://help.aliyun.com/zh/dns/quick-start-1)
- [阿里云 AddDomainRecord 权限说明](https://help.aliyun.com/en/dns/api-alidns-2015-01-09-adddomainrecord)

## 目标

1. 在用户本机安装并验证 Alibaba Cloud CLI（`aliyun`），由用户完成本地凭据配置，不接触或记录凭据内容。
2. 在 Vercel 手动添加 `fleet.alphaqwq.xyz` 后，读取其显示的精确 DNS 记录类型和值，仅在它要求 CNAME 时使用受限 PowerShell 脚本管理 `alphaqwq.xyz` 的 `fleet` CNAME。
3. 实现默认 dry-run、显式 `-Apply` 才写入的幂等流程：查询现有记录、检测冲突、比较目标值、仅新增或更新唯一目标 CNAME、再解析验证。
4. 记录 DNS 变更前后状态、Vercel 域名验证与 HTTPS 证书状态，并完成用户本机、独立浏览器和不同网络/移动网络的网页验收。

## 非目标

- 不修改 GitHub Actions、Vercel 构建配置、网页代码、依赖、环境变量、Secrets、`alphaqwq-home` 或旧 `fleet-room`。
- 不将阿里云 AccessKey、Vercel Token、GitHub Token、Cookie、会话信息或验证码写入仓库、文档、提示词、CI 日志、浏览器、`.env` 或脚本参数。
- 不使用主账号 AccessKey，不使用 GitHub Actions 写 DNS，不实现 DDNS，不修改 `fleet` 之外的记录。
- 不支持或自动处理 Vercel 要求的 A、TXT 或其他非 CNAME 记录；遇到此类要求必须停止并回到 Plan 裁决脚本范围。
- 不合并 PR、不更新主页入口、不把 Vercel `Ready` 或 DNS 解析成功误记为 HTTPS 或跨网络网页验收成功。

## 允许文件

- `scripts/Invoke-VercelFleetCnameDns.ps1`：仅管理 `alphaqwq.xyz` 下 `fleet` 的默认线路 CNAME，默认 dry-run，显式 apply 才调用写 API。
- `docs/05-execs/PLAN-001/EXEC-001-03-DNS-VERCEL-AUTOMATION.md`：记录无密钥的执行证据、结果与回滚步骤。
- `docs/08-prompts/development/EXEC.md` 与 `docs/08-prompts/README.md`：通用 Exec 对话入口；目标边界仍以本文档为准。

## 前置条件

1. 用户在 Vercel 项目中添加 `fleet.alphaqwq.xyz`，并提供 Vercel 显示的精确记录类型和值。
2. Vercel 要求必须为单条 CNAME；若要求 A、TXT、多个记录或域名验证记录，本 Exec 停止并请求 Plan 裁决。
3. 用户创建专用 RAM 用户而非主账号 AccessKey，并以最小权限授予 `alidns:DescribeDomainRecords`、`alidns:AddDomainRecord` 与 `alidns:UpdateDomainRecord` 对 `alphaqwq.xyz` 的访问；用户在本机安全配置 `aliyun` CLI，凭据不进入本仓库。
4. 用户确认其有权修改 `alphaqwq.xyz` 的 `fleet` 记录，并指定 DNS 变更责任人和回滚责任人为用户本人。
5. 在用户完成上述前置条件、EXEC-001-02 的依赖结论被确认且本 Exec 文档完整前，保持 `Draft`，不得安装、登录、写 DNS 或将状态改为 `In Progress`。

## 幂等脚本契约

- 固定记录范围：`DomainName=alphaqwq.xyz`、`RR=fleet`、`Type=CNAME`、`Line=default`；目标值仅由执行时 `-Target` 参数传入，不在脚本中硬编码。
- 默认只读：未传入 `-Apply` 时，脚本只调用 `DescribeDomainRecords`、输出计划结果并以非零退出码表示需要变更；不调用写 API。
- 冲突安全：若 `fleet` 已有任何非 CNAME 记录、不是默认线路的 CNAME，或存在多个默认线路 CNAME，脚本终止且不写入。不得删除冲突记录。
- 幂等性：唯一默认线路 CNAME 的值和 TTL 已符合目标时，脚本不写入并以成功退出；值或 TTL 不符合时仅以已查询的 `RecordId` 调用 `UpdateDomainRecord`；不存在 CNAME 时才调用 `AddDomainRecord`。
- 写后验证：写入后重新查询 Alidns 记录，并通过 `Resolve-DnsName fleet.alphaqwq.xyz -Type CNAME` 验证可见解析结果。DNS 传播或递归解析延迟时记录未验证，不自动重试写入。
- 输出安全：脚本输出仅含记录主机名、类型、目标值、TTL、RecordId、动作与验证结果；不得调用 `aliyun configure list`，不得输出 CLI 配置、凭据或原始环境变量。

## 执行步骤与验收

1. 用户手动安装 Alibaba Cloud CLI，并在本机执行 `aliyun version`；用户自行完成凭据配置和 RAM 最小权限验证。结果记录仅写 CLI 版本、配置是否可调用和失败错误码，不写凭据。
2. 用户在 Vercel 添加 `fleet.alphaqwq.xyz`，从 Vercel 界面读取精确记录要求。若不是 CNAME，停止。
3. 在对应 feature 分支执行脚本 dry-run：`pwsh -File scripts/Invoke-VercelFleetCnameDns.ps1 -Target <Vercel要求的值>`；确认输出只涉及 `fleet`，并记录现有记录、预期动作与退出码。
4. 用户审核 dry-run 后显式执行 `-Apply`；脚本只允许新增或更新唯一目标 CNAME。记录变更前后值、TTL、RecordId、动作和验证结果。
5. 在 Vercel 等待域名验证和 HTTPS 证书状态；记录域名状态、证书主机名、有效期、信任链和浏览器安全状态。
6. 在用户本机、独立浏览器和至少一个不同网络/移动网络访问 `https://fleet.alphaqwq.xyz`；每项记录时间、网络环境、HTTP 状态、页面/DOM 或截图、控制台、网络请求与证书状态。
7. 在目标分支运行 `npm ci`、`npm run typecheck`、`npm run lint`、`npm run test`、`npm run build`，提交允许文件并推送 PR；记录提交、Actions、Vercel Preview 与生产部署事实。未通过所有验收不得合并或更新主页入口。

## 止损与升级

- Vercel 未提供精确 CNAME、记录冲突、RAM 权限不足、CLI 配置失败、DNS 解析失败、HTTPS 证书失败、浏览器验收失败或任何 CI 失败时，停止后续写操作，记录真实证据，不合并、不更新主页入口、不宣布发布完成。
- 发现需要非 CNAME、多个记录、删除记录、主账号凭据、CI 注入密钥、修改 DNS 托管模型或 Vercel 项目认证边界时，停止并回到 Plan；认证边界变更先新增 ADR。
- 同一诊断问题两次仍无可信结论时，不重复 DNS 写入；保留结果并请求用户决策。

## 提交与回滚

- 仅在干净的 `feature/exec-001-03-dns-vercel-automation` 分支修改允许文件。提交前执行固定 CI 门禁，推送后等待对应 PR 的 Actions 与 Vercel Preview。
- DNS 回滚不自动执行。用户先 dry-run 以旧 CNAME 值验证影响，再以 `-Apply -Target <旧值>` 使用同一 `RecordId` 更新回旧值；若本 Exec 新增了记录，必须先回到 Plan 获得删除记录的明确裁决，脚本不删除记录。
- Git 回滚使用 `git revert <commit>`，不得重写共享历史；生产 Vercel 别名、主页入口与 PR 合并由后续 EXEC-001-04 在获准范围内处理。

## 结果记录

- Vercel 记录要求：2026-08-07 用户已添加 `fleet.alphaqwq.xyz`，Vercel 要求 **单条 CNAME**：主机记录 `fleet` → `6ef0018a32a8f1a0.vercel-dns-017.com`。符合前置条件 2，无 A/TXT/多条记录要求。
- 阿里云 CLI 安装与版本：已安装并验证。用户手动安装至 `C:\Users\51907\aliyun-cli\aliyun.exe`（用户 PATH 已含该目录），2026-08-07 `aliyun version` 返回 `3.4.11`（≥3.3.0 受支持版本）。
- 脚本与解释器现状：`scripts/Invoke-VercelFleetCnameDns.ps1` 经 `Parser.ParseFile` 语法校验通过（`PARSE_OK`）。已修复两个兼容性问题并验证：(1) aliyun CLI 3.4.x 的 `--output json` 已废弃（`--output` 仅接受 `cols=` 表格格式），脚本改为依赖默认 json 输出；(2) 文件为 UTF-8 无 BOM，其中文注释在 Windows PowerShell 5.1（按 ANSI 解码）下导致脚本执行异常，注释已改为 ASCII 英文。修复后以占位目标 `placeholder.invalid` 冒烟 dry-run 成功：输出 `Action=Add / DomainName=alphaqwq.xyz / RR=fleet / Type=CNAME / Value=placeholder.invalid / TTL=600 / Apply=False`，退出码 `2`（表示需变更，未调用写 API）。执行环境未安装 `pwsh`（PowerShell 7），实测以 `powershell.exe -File` 运行；正式执行时记录所用解释器。
- RAM 最小权限验证：通过。2026-08-07 只读调用 `alidns DescribeDomainRecords --DomainName alphaqwq.xyz` 成功（dry-run 前后多次），证明当前凭据具备 `alidns:DescribeDomainRecords` 权限且 CLI 配置可调用；用户确认当前凭据为 `fleet` 专用 RAM 用户（非主账号），旧泄露 key 已停用/删除。
- 记录基线（2026-08-07 只读查询）：`alphaqwq.xyz` 现有 4 条记录——`tb` CNAME→`eae1be462a38303b.vercel-dns-017.com`（TTL 600）、`coach` CNAME→`3cd6e73619c098bb.vercel-dns-017.com`（TTL 600）、`www` CNAME→`alphaqwq.xyz`（TTL 600）、`@` A→`216.198.79.1`（TTL 600）。**无 `fleet` 记录**，脚本预期走新增（Add）路径。
- 安全事件与凭据现状：用户在对话中粘贴了 AccessKey ID/Secret，已按安全流程要求轮换；用户确认已停用/删除泄露 key、以 `fleet` 专用 RAM 用户重新 `aliyun configure`，且当前 default profile 使用的为新 key（身份为用户确认的专用 RAM 用户，非主账号）。
- 网络：冒烟 dry-run 中一次调用出现 `alidns.aliyuncs.com` DNS 解析超时（`dial tcp: lookup ... i/o timeout`，退出码 1），重试可恢复；记录为执行环境间歇性网络问题，不改变脚本逻辑结论。
- Dry-run（正式）：2026-08-07 以 `-Target 6ef0018a32a8f1a0.vercel-dns-017.com` 执行成功。输出 `Action=Add / DomainName=alphaqwq.xyz / RR=fleet / Type=CNAME / Value=6ef0018a32a8f1a0.vercel-dns-017.com / TTL=600 / RecordId=(空) / Apply=False`，退出码 `2`（需变更）。仅涉及 `fleet`，未检测到冲突，未调用写 API。
- DNS apply：2026-08-07 用户确认（新 key 为 `fleet` 专用 RAM 用户、旧泄露 key 已停用/删除、批准执行且变更/回滚责任人为用户本人）后执行 `-Apply` 成功：`Action=Add / DomainName=alphaqwq.xyz / RR=fleet / Type=CNAME / Value=6ef0018a32a8f1a0.vercel-dns-017.com / TTL=600`，`RecordId=2085726099383959552`，退出码 `0`。
- Alidns 写后查询与公共 DNS 解析：`AlidnsVerified=True`（写后重查 Alidns 返回唯一目标 CNAME，值/TTL 匹配）；`PublicDnsVerified=True`（`Resolve-DnsName fleet.alphaqwq.xyz -Type CNAME` 返回目标值 `6ef0018a32a8f1a0.vercel-dns-017.com`）。
- Vercel 域名验证与 HTTPS：2026-08-07 执行环境 `curl -I https://fleet.alphaqwq.xyz` 返回 `HTTP/1.1 200 OK`（`Server: Vercel`、`Content-Type: text/html; charset=utf-8`、`Content-Length: 403`、`Strict-Transport-Security: max-age=63072000`、`X-Vercel-Id: sin1::mwjls-1786110865529-bb7b8809ed64`），无重定向。TLS 证书：`Subject: CN=fleet.alphaqwq.xyz`，`Issuer: CN=YR1, O=Let's Encrypt, C=US`，有效期 2026-08-07 20:55:41 至 2026-11-05 20:55:40，`ChainValid=True`。DNS 链路：`fleet.alphaqwq.xyz` CNAME→`6ef0018a32a8f1a0.vercel-dns-017.com` → A `216.198.79.1`/`64.29.17.1`。
- 用户本机验收：2026-08-07 用户确认通过（浏览器访问 `https://fleet.alphaqwq.xyz` 正常）。
- 独立浏览器验收：2026-08-07 用户确认通过（按用户反馈口径）。
- 不同网络/移动网络验收：2026-08-07 用户确认通过（按用户反馈口径）。
- 本地 CI 门禁、提交、PR、Actions 与 Preview：未执行。按用户指示，本 Exec 的 DNS/HTTPS 目标已完成并通过验收；feature 分支提交、固定门禁、PR 与 Preview（执行步骤 7）与后续删除/主页入口工作由用户在 Plan 对话中规划新 Exec 承接。
- 阻塞、回滚与后续责任：无阻塞。DNS 回滚不自动执行——用户先 dry-run 以旧值验证影响，再 `-Apply -Target <旧值>` 以同一 `RecordId=2085726099383959552` 更新回旧值；若需删除本 Exec 新增的记录，必须回到 Plan 获得明确裁决（脚本不删除记录）。Git 回滚使用 `git revert`，不重写共享历史。
- 边界移交（非本 Exec 范围）：删除 GitHub/Vercel 上的旧 `fleet-room` 项目、修改 home 按钮链接与信息使其指向 `fleet.alphaqwq.xyz`，均属于文档"非目标"（`alphaqwq-home`/旧 `fleet-room`）与"提交与回滚"中 EXEC-001-04 的处理范围，本 Exec 未执行、不合并 PR、不更新主页入口；由用户在 Plan 对话中规划新 Exec。
- 前置条件检查（2026-08-07）：全部前置已完成——Vercel 已添加 `fleet.alphaqwq.xyz` 且要求为单条 CNAME（1/2 完成）、`fleet` 专用 RAM 用户 key 已配置且旧泄露 key 已停用/删除（3 完成）、变更/回滚责任人为用户本人（4 完成）。DNS apply 已在用户批准下执行并完成双验证。
