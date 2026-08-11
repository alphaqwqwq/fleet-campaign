# EXEC-001-02：CI/CD 诊断与部署反馈基线

- Plan：[PLAN-001：程序与发布自动化基础](../../04-plans/PLAN-001-ROOM-PERSISTENCE-FOUNDATION.md)
- 状态：Draft
- 分支：`feature/exec-001-02-release-diagnostics`
- 依赖：[EXEC-001-01：正式仓库与工程基线](EXEC-001-01-REPOSITORY-BASELINE.md)
- 影响域：CI/CD 诊断 / Vercel Preview 反馈 / 发布验收证据

## 当前事实

- EXEC-001-01 已处于 `Pushed`；PR #1 保持 Open，main 与 feature 分支已有成功的 GitHub Actions 记录。
- GitHub Actions 对 Pull Request 和 `main` 推送依次执行 `npm ci`、`npm run typecheck`、`npm run lint`、`npm run test` 与 `npm run build`。
- Vercel 使用 `npm ci`、`npm run build` 与 `apps/web/dist` 构建；默认部署 `https://fleet-campaign.vercel.app` 的状态为 `Ready`，但用户本机、执行环境和独立浏览器均未能证明默认 `*.vercel.app` 域名可访问。
- 当前没有已裁决的自定义域名、DNS 托管责任、DNS 授权、CI 密钥注入方案或可更新的主页入口。

## 必读材料

- [工作流](../../00-governance/WORKFLOW.md)
- [项目文件管理方案](../../00-governance/PROJECT-STRUCTURE.md)
- [PLAN-001：程序与发布自动化基础](../../04-plans/PLAN-001-ROOM-PERSISTENCE-FOUNDATION.md)
- [EXEC-001-01：正式仓库与工程基线](EXEC-001-01-REPOSITORY-BASELINE.md)
- [CI 工作流](../../../.github/workflows/ci.yml)
- [Vercel 构建配置](../../../vercel.json)

## 目标

1. 以一次真实 feature 分支提交验证 GitHub PR CI 与 Vercel Preview 的完整反馈闭环。
2. 对该次提交记录可追溯的提交哈希、PR、Actions、Vercel Preview、构建日志摘要和网页验收结果。
3. 对默认 `*.vercel.app` 入口采集 DNS 解析、TLS、HTTP、浏览器控制台和网络请求证据，明确已验证的可访问性边界或失败边界。
4. 建立后续每次真实提交的反馈判定标准：GitHub Actions 结果与 Vercel Preview 部署状态/URL 是自动化反馈；网页内容实际变化仅能由允许修改网页文件的后续 Exec 交付并经浏览器验证。

## 非目标

- 不修改 `apps/web/**`、`packages/**`、`.github/workflows/**`、`vercel.json`、依赖、构建脚本或任何游戏功能。
- 不修改 DNS、Vercel 域名映射、Vercel 托管模型、环境变量、Secrets、`alphaqwq-home` 或旧 `fleet-room`。
- 不合并 PR、不向 `main` 写入、不将 Preview 作为正式入口、不宣布生产发布完成。
- 不将构建状态、Preview URL 或 Vercel `Ready` 误记为默认域名可访问或网页内容已更新。
- 不读取、输出、记录或提交密码、Token、DNS API Key、Cookie、动态验证码、`.vercel/` 本地链接元数据、原始参考资料或真实用户数据。

## 允许范围

- 允许创建和修改本 Exec 文档，用于记录真实提交、诊断命令、脱敏结果摘要、URL、截图/DOM 说明、结论与回滚信息。
- 允许创建和修改与本 Exec 一一对应的开发短提示词及提示词索引。
- 允许在本 Exec feature 分支提交上述文档改动，以触发真实 PR CI 与 Vercel Preview；提交内容不得改变已部署网页的业务或展示内容。
- 允许只读查询 GitHub PR/Actions、Vercel 部署元数据、DNS/TLS/HTTP 响应与浏览器控制台和网络请求。

## 真实提交反馈闭环

1. 从 `main` 当前基线创建 `feature/exec-001-02-release-diagnostics`；若 PR #1 尚未合并，不得把其 feature 分支作为 main 的替代品或正式入口。
2. 提交仅包含本 Exec 文档与必要的提示词索引改动，推送后创建或更新该 feature 分支自己的 PR；会话入口使用通用 Exec 模板。
3. 确认该提交关联的 GitHub Actions 完整执行五项固定门禁；记录 Actions URL、提交哈希、各命令结果与失败日志摘要。
4. 确认 Vercel 为同一提交产生 Preview 部署；记录部署 URL、提交关联、构建状态、构建命令和产物目录。
5. 在可用环境打开 Preview URL，记录 HTTP 状态、页面/DOM 或截图、控制台和网络请求。若不能访问，记录失败事实和环境，不得推断成功。
6. 将“自动化反馈已产生”与“在线网页内容已实际变化”分开记录：本 Exec 仅验证前者和既有页面可访问性；后者留给获准修改网页且完成正式发布门槛的后续 Exec。

## 诊断步骤与验收

### 自动化验证

- 本地运行 `npm ci`、`npm run typecheck`、`npm run lint`、`npm run test`、`npm run build`，与 CI 固定门禁逐项对应。
- 对真实提交确认 GitHub Actions 状态为成功；如果任一步失败，保留命令、Actions URL 和日志摘要，停止推进。
- 对同一提交确认 Vercel Preview 的构建状态和提交关联；构建失败时记录部署 URL 和日志摘要，停止推进。
- 确认 Preview 不需要新增密钥、环境变量或 DNS 写操作；若发现需要，停止并回到 Plan/ADR。

### 人工验收

- 分别在用户本机、独立浏览器环境和至少一个不同网络/移动网络尝试访问 Preview 与默认入口；每项记录时间、网络环境、URL、HTTP 状态、页面/DOM 或截图、控制台、网络请求和证书状态。
- 对默认入口执行并记录 DNS 解析、TLS 握手和 HTTP 请求。只根据实际观察定位失败层；不能确认根因时结论为“边界未确认”。
- 验收通过不等于可合并或正式发布：只有本 Exec 的真实提交 CI 和 Preview 构建成功、且诊断证据完整时，才可标记 `Verified`。默认入口访问失败仍必须如实记录，并阻止后续主页入口更新。

## 止损与升级

- CI、Vercel 构建、DNS、TLS、HTTP 或浏览器验收任一失败时，停止扩展，不合并 PR、不更新主页入口、不宣布发布完成。
- 遇到域名所有权、DNS 权限、记录冲突、外部权限、Vercel 托管模型、认证边界或密钥注入需求时，停止所有写操作并请求 Plan 裁决；需要认证边界变更时先新增 ADR。
- 发现网页内容变更、DNS 写入、Vercel 域名映射、PR 合并或 main 推送需求时，停止；它们分别属于后续获批准的 Exec，不能以验证 CI/CD 为由扩大本 Exec。
- 同一诊断问题两次后仍无可信结论时，记录已有证据并停止，不以猜测替代结论。

## 提交与回滚

- 提交前必须完成本地固定门禁；提交消息使用 `docs(exec-001-02): record release diagnostics baseline` 或等价的范围化描述。
- 推送后仅更新本 feature 分支的 PR；不得合并。若文档记录有误，使用新的修正提交；不得重写共享历史。
- 本 Exec 的回滚为 `git revert <commit>` 或关闭未合并 PR；不得触碰 Vercel Production 别名或 DNS 记录。

## 结果记录

- 实际分支：未创建。本次执行开始时检出的是 `feature/exec-001-01-repository-baseline`，不是本 Exec 指定的 `feature/exec-001-02-release-diagnostics`。
- 实际提交：未创建。工作树已有不属于本 Exec 的已修改与未跟踪文档；为避免将其纳入本 Exec 提交，未切换分支、未提交、未推送。
- PR：未创建或更新本 Exec 的 PR。现有 PR #1 仍为 `Open`，源分支为 `feature/exec-001-01-repository-baseline`，不是本 Exec 的提交反馈闭环。
- GitHub Actions：只读确认 PR #1 的提交 `cebf854d8838a805d1a5505331bf0413935a30d9` 对应 [CI run 31140983082](https://github.com/alphaqwqwq/fleet-campaign/actions/runs/31140983082) 于 2026-08-07 完成且为 `success`；`npm ci`、`npm run typecheck`、`npm run lint`、`npm run test`、`npm run build` 五项均成功。该记录仅证明既有 EXEC-001-01 提交的门禁结果，不能代替本 Exec 的真实提交验收。
- Vercel Preview：只读确认同一既有提交产生 Preview `https://fleet-campaign-kuwblv4r0-alphaqwqwq114514.vercel.app`，状态为 `Ready`。构建日志显示 Vercel 从 `feature/exec-001-01-repository-baseline` 克隆提交 `cebf854`，执行 `npm ci` 与 `npm run build`，并完成 `apps/web/dist` 静态产物部署；构建耗时约 9 秒。该部署不是本 Exec 的 Preview。
- 本地门禁：本次执行实际通过 `npm ci`、`npm run typecheck`、`npm run lint`、`npm run test`（1 个测试通过）与 `npm run build`；构建产物为 Vite 静态文件。`npm ci` 额外提示 `esbuild@0.28.1` 有待审批安装脚本，不影响本次命令成功，未执行任何审批或配置写入。
- Preview 浏览器验收：独立浏览器只读访问上述既有 Preview，主文档请求为 `net::ERR_CONNECTION_TIMED_OUT`；无 HTTP 状态、目标页面 DOM、响应体、目标站点控制台或可用 TLS 会话可记录。浏览器网络记录中该 Preview 的 `Document` 请求超时，未观察到证书错误、混合内容或其他可归因的浏览器安全告警。
- 默认入口 DNS/TLS/HTTP 诊断：默认入口 `https://fleet-campaign.vercel.app` 的 A 记录在本执行环境解析为 `69.63.178.13`（查询时 TTL 233 秒，复核时 TTL 67 秒）。至该地址的 TCP 443 连接在 10 秒内超时；`curl.exe -I` 在约 10 秒连接超时。因 TCP 未建立，TLS 握手、证书、HTTP 状态、响应头和响应体均未验证。CNAME 查询返回 DNS server failure，不能据此推断 DNS 根因。独立浏览器对默认入口同样得到 `ERR_CONNECTION_TIMED_OUT`，没有目标页面 DOM 或目标网络响应。
- 用户本机验收：未验证。本 Exec 无法替代用户本机实际访问，且没有把执行环境结果标记为用户本机结果。
- 独立浏览器验收：已尝试；默认入口与既有 Preview 均在主文档连接前超时。该环境仅证明在该独立浏览器网络路径上不可访问，不足以确认 Vercel 配置、DNS 或 TLS 的根因。
- 不同网络/移动网络验收：未验证。本 Exec 未获得可用的第二网络或移动网络，不得以现有环境结果推断跨网络可访问性。
- 结论与后续阻塞：本次已建立本地固定门禁通过、既有 PR CI/Vercel 构建成功、以及执行环境和独立浏览器网络路径上的默认入口/既有 Preview TCP 443 超时基线。自动化构建状态不等于网页可访问性，且本 Exec 尚未具备自己的 feature 分支、提交、PR 与 Preview，不能标记 `Verified` 或 `Pushed`。后续须在干净工作树中创建本 Exec 指定分支并仅提交允许文件，随后对该提交重复 CI 与 Preview 验收；在获得用户本机与独立网络证据前，不更新主页入口、不写 DNS、不合并 PR，也不宣布发布完成。
- 回滚演练：本 Exec 不执行生产回滚；待后续正式发布 Exec 在获准范围内演练。
