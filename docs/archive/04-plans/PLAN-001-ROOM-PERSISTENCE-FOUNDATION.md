# PLAN-001：程序与发布自动化基础

- 状态：Approved
- 责任边界：建立正式开源工程、GitHub/Vercel 持续交付与 DNS/Vercel 发布自动化，验证可访问的静态网页发布链路；不实现游戏骨架、联机状态或叙事功能。

## 必读材料

- [工作流](../00-governance/WORKFLOW.md)：Plan、Exec、Review 的职责、状态事实与止损规则。
- [项目文件管理方案](../00-governance/PROJECT-STRUCTURE.md)：仓库边界、分支、回滚与 CI 最小门禁。
- [文档索引](../README.md)：文档优先级与可发现性约束。
- [EXEC-001-01：正式仓库与工程基线](../05-execs/PLAN-001/EXEC-001-01-REPOSITORY-BASELINE.md)：已发生工程、CI、PR 与 Vercel 部署事实。

## 依赖与责任边界

- GitHub 是源码、feature 分支、PR、Actions 门禁和提交历史的记录真源。
- Vercel 是构建配置、Preview/Production 部署状态和域名映射的记录真源；其 `Ready` 状态不替代浏览器可访问性验收。
- `alphaqwq.xyz` 的 DNS 记录真源已确认是 Alidns；`fleet.alphaqwq.xyz` 的唯一目标记录为默认线路 CNAME `fleet → 6ef0018a32a8f1a0.vercel-dns-017.com`，TTL 为 600。DNS 写入仅由用户审核的本机 `aliyun` CLI 与专用 RAM 用户执行。
- `alphaqwq-home` 的链接配置不属于本计划当前可写范围；只有 EXEC-001-04 通过全部发布门槛后，才能在独立发布工作单元中更新。
- 任何需要将 DNS 凭据、Vercel Token 或 GitHub Token 写入 CI 的方案，均属于未裁决的认证边界变更，必须先新增 ADR 并取得用户授权。

## 当前可验证基线

- 正式工程目录为 `D:\workspace\deckgame\fleet-campaign`，公开仓库为 `alphaqwqwq/fleet-campaign`。
- EXEC-001-01 已建立 npm workspace、React/TypeScript/Vite、基础测试、GitHub Actions 和 Vercel 构建配置；状态为 `Pushed`，其 PR #1 仍为 Open。
- Vercel 构建状态为 `Ready`，默认 URL 为 `https://fleet-campaign.vercel.app`；用户本机、执行环境和独立浏览器无法访问默认 `*.vercel.app` 域名，真实网页可访问性未验证/失败。
- GitHub CLI、Vercel CLI 与 `NODE_OPTIONS=--use-system-ca` 已配置；Alibaba Cloud CLI 3.4.11 已在用户本机配置为专用 RAM 用户，脚本已完成 `fleet` CNAME 的 dry-run、apply、Alidns 写后查询和公共 DNS 解析验证。
- `https://fleet.alphaqwq.xyz` 已返回 Vercel 的 HTTP 200，并具有有效的 Let's Encrypt HTTPS 证书；用户已确认本机、独立浏览器和移动网络访问通过。EXEC-001-03 为 `Verified`，但尚无本 Exec 分支、提交、PR、Actions 或 Preview 事实。

## 目标

交付一条可追溯、可回滚、可验收的发布基础链路：GitHub feature 分支与 PR 触发 CI，合并 `main` 后触发 Vercel 生产部署；DNS 记录以安全、可审计的方式与 Vercel 自定义域名同步；用户可以通过经过 HTTPS 与多网络验证的正式入口访问基础网页。

## 非目标

- 不实现游戏领域状态、任务、规则引擎、联机房间、PeerJS、持久化、LLM、旁白或游戏内容。
- 不实现常驻后端、账号系统、云存档、房主迁移、防作弊、多地区部署、赛季更新或运营平台。
- 不读取、记录或提交密码、Token、DNS API Key、Cookie、动态验证码、原始参考资料或真实用户数据。

## 发布裁决与不变量

- `main` 始终可构建、可部署、可回滚；未通过 CI 或未完成本计划验收的 feature 分支不得作为正式入口。
- Vercel `Ready` 只证明构建和部署完成，不证明用户能访问；正式可访问性必须由浏览器网络矩阵、页面响应、控制台/网络记录和 HTTPS 证书共同证明。
- 先诊断默认 `*.vercel.app` 不可访问的网络/DNS/TLS 边界，再决定是否接入自定义域名；不得把自定义域名当作未诊断故障的遮盖物。
- DNS 注册商、DNS 托管商、Vercel 域名映射和 `alphaqwq-home` 链接各自只有一个记录真源；每次变更必须记录生效记录、验证方式、回滚步骤和责任人。
- DNS 自动化只能使用用户已授权的机制；密钥只保存在用户选择的机密存储/本地安全环境，不能写进仓库、文档、提示词、CI 输出或浏览器客户端。
- 回滚优先顺序为 `git revert`、Vercel 既有成功部署别名切换、撤销/恢复 DNS 记录；不得重写共享 `main` 历史。

## 发布链路裁决

- PR 提交必须先通过 `npm ci`、`npm run typecheck`、`npm run lint`、`npm run test` 和 `npm run build`；失败时保留 Actions URL、失败命令和日志摘要，不得以删除或弱化断言通过门禁。
- `main` 的生产部署只能来自已合并且通过同一门禁的提交。Preview 仅用于变更验证，不能作为正式入口或绕过合并流程。
- EXEC-001-02 只收集默认入口不可访问时的 DNS 解析、TLS 握手、HTTP 响应、浏览器控制台与网络请求证据。诊断完成前禁止写 DNS，禁止将自定义域名标记为修复方案。
- 自定义域名接入的前置裁决为：目标域名或子域名、注册商、DNS 托管商、DNS 记录真源、变更责任人、授权机制、最小权限范围与回滚责任人均已确认。任一项缺失时，EXEC-001-03 保持 Draft。
- DNS 自动化若获批准，必须采用可重复执行的声明式输入；每次执行先读取现状，仅更新目标记录，重复执行不得产生额外记录或无关变更，并记录变更前后记录值与生效验证结果。密钥仅由用户选定的机密存储或本地安全环境注入。
- HTTPS 验收必须在正式入口返回有效页面后进行；证书主机名、有效期、信任链和浏览器安全状态均须记录。证书签发、DNS 传播或网络访问任一失败时，不更新主页入口。
- 用户已裁决旧 `fleet-room` 不保留或归档，改为在正式入口和主页导航验收通过后直接删除 GitHub 仓库及 Vercel 项目。删除属于不可逆外部清理，不适用 `git revert`；删除前必须从 GitHub 与 Vercel 记录真源确认准确项目标识、所有权、关联域名、部署别名、环境变量与日志保留影响，并由用户对目标清单作最终确认。任一项不明确时停止删除。

## 验收标准

- 最新 PR 提交的 GitHub Actions 已成功，`npm ci`、typecheck、lint、test、build 有可追溯证据。
- Vercel Preview 和 `main` 生产部署的触发关系、构建根目录、环境变量边界和回滚方式已记录并演练。
- 已确认 DNS 注册与托管责任、可用子域名、变更方式和权限边界；若用户选择自动化，已验证最小权限、幂等更新和无密钥泄露。
- 自定义域名或经诊断确认的默认入口可在用户本机、独立浏览器环境和至少一个不同网络/移动网络访问。
- HTTPS 证书有效；浏览器验收记录 HTTP 状态、页面/DOM 或截图、控制台、网络请求和证书状态。
- `alphaqwq-home` 的正式入口更新、旧 `fleet-room` 的处置策略必须在独立发布 Exec 中完成；主页/Git 变更须可回滚，直接删除旧外部项目须在删除前完成用户最终确认并明确其不可逆风险。

## 证据与结果记录

- 每个 Exec 在其自身结果记录中填写实际分支、提交哈希、PR URL、Actions URL、Vercel 部署 URL、执行命令及结果；计划文档只汇总已验证的稳定事实。
- 浏览器验收分别记录用户本机、独立浏览器和不同网络/移动网络的测试时间、入口 URL、HTTP 状态、页面/DOM 或截图、控制台、网络请求与证书状态；无法执行的环境必须标记为未验证，不得推断成功。
- DNS 变更记录目标域名、记录类型、主机名、目标值、TTL、变更责任人、记录真源、验证方式和具体回滚操作；不得记录任何密钥、会话信息或验证码。
- 生产回滚演练至少证明一个可用路径：对已合并变更使用 `git revert`，或切换至 Vercel 既有成功部署，再按记录恢复 DNS。演练结果与实际生产变更分开记录。

## 止损与升级

- 域名所有权、DNS 权限、记录冲突、默认域名故障根因或目标入口无法确认时，停止 DNS/部署写操作，只记录诊断证据并请求用户决策。
- 需要改变 Vercel 托管模型、认证边界、公开资料策略或将密钥用于 CI 时，先新增 ADR。
- GitHub CI、Vercel 构建、DNS 验证、HTTPS 证书或浏览器验收任一失败时，不合并 PR、不更新主页入口、不宣布发布完成。
- 任何游戏功能需求一律移交后续 PLAN-002，不得在本计划的 Exec 中实现。

## Exec 拆分

1. `EXEC-001-01-REPOSITORY-BASELINE`：创建独立仓库、workspace、基础页面、GitHub Actions、文档迁移与 Vercel 构建配置。
2. `EXEC-001-02-RELEASE-DIAGNOSTICS`：确认最新 PR CI，收集默认域名失败的 DNS/TLS/网络证据，建立发布验收基线；不改 DNS。
3. `EXEC-001-03-DNS-VERCEL-AUTOMATION`：在用户确认域名、托管方式和授权后，配置/自动化 DNS 与 Vercel 域名映射，验证 HTTPS、幂等和回滚。
4. `EXEC-001-04-PUBLIC-ENTRY-RELEASE`：承接 EXEC-001-03 未完成的分支、固定门禁、提交、推送、PR、Actions 与 Preview；合并通过的变更，独立更新主页入口，完成多网络发布验收，并在用户最终确认准确外部目标后直接删除旧 `fleet-room` GitHub/Vercel 项目。

### Exec 顺序与准入

- EXEC-001-01 已处于 `Pushed`：其现有结果记录表明 main 与 feature 的 CI 成功，PR #1 保持 Open，默认 Vercel URL 为 `Ready` 但可访问性未验证；这不是生产发布完成事实。
- EXEC-001-02 依赖 EXEC-001-01。完成条件是形成可复现的失败或成功访问基线，并明确默认入口故障位于本机、DNS、TLS、网络路径或 Vercel 配置中的已验证边界；不得修改 DNS、主页入口或游戏代码。
- EXEC-001-03 依赖 EXEC-001-02 以及用户对域名、DNS 托管、授权与自动化方式的明确裁决。完成条件是自定义域名映射、最小权限自动化（如获批准）、幂等验证、DNS 传播、HTTPS 和回滚记录全部通过。
- EXEC-001-04 依赖 EXEC-001-02，若使用自定义域名还依赖 EXEC-001-03。完成条件是 PR 合并后的 main 生产部署、正式入口多网络验收、`alphaqwq-home` 更新及旧 `fleet-room` 直接删除均已实际完成。Git/DNS 回滚按既定策略执行；旧项目删除不具备 `git revert` 回滚，必须在删除前完成目标清单确认和正式入口/主页入口验收。
- 每个后续 Exec 必须先在 `docs/05-execs/PLAN-001/` 创建目标文档，写明允许/禁止文件范围、依赖、自动化验证、人工验收、提交与回滚步骤；未完成这些内容不得由 `Draft` 进入 `In Progress`。

## PLAN-002 前置条件

只有 PLAN-001 达到已确认生产入口、可访问性验收、发布回滚记录和 PR/main 基线稳定后，才能创建 PLAN-002，开始游戏骨架、联机和初步内容的规划。PLAN-002 的具体 Exec 由其 Plan 对话创建，不得提前生成。
