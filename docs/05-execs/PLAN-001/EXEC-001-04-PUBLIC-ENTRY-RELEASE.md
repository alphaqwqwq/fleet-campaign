# EXEC-001-04：正式入口发布与旧项目清理

- Plan：[PLAN-001：程序与发布自动化基础](../../04-plans/PLAN-001-ROOM-PERSISTENCE-FOUNDATION.md)
- 状态：In Progress
- 分支：`feature/exec-001-04-public-entry-release`
- 依赖：[EXEC-001-02：CI/CD 诊断与部署反馈基线](EXEC-001-02-RELEASE-DIAGNOSTICS.md)、[EXEC-001-03：本机 Alidns 与 Vercel CNAME 自动化](EXEC-001-03-DNS-VERCEL-AUTOMATION.md)
- 影响域：Git/CI 发布闭环 / 正式主页入口 / 外部旧项目清理

## 当前事实

- `fleet.alphaqwq.xyz` 已完成 Vercel CNAME、Alidns 及公共 DNS 双验证，并在执行环境返回 HTTP 200；用户已确认本机、独立浏览器和移动网络访问通过。EXEC-001-03 状态为 `Verified`。
- EXEC-001-03 的 feature 分支、固定 CI 门禁、提交、推送、PR、Actions 与 Preview 尚未执行；它们由本 Exec 承接，不得追溯性地将 EXEC-001-03 标为 `Pushed` 或 `Merged`。
- `fleet-campaign` 的 PR #1 仍为 Open；main 不能被描述为包含所有当前发布自动化文档或脚本。
- `alphaqwq-home` 的本地目录为 `D:\workspace\alphaqwq-home`，GitHub 记录真源为 `alphaqwqwq/alphaqwq-home`；其 `src/App.tsx` 当前 `fleet-room` 工具卡片仍指向 `https://fleet-room.vercel.app`。该项目仅有 `build` 脚本，未定义 typecheck、lint 或 test；执行时至少运行 `npm ci` 与 `npm run build`，不得虚构缺失门禁的成功结果。
- 用户已裁决不保留或归档旧 `fleet-room`，而是在新入口和主页入口验收通过后直接删除 GitHub 仓库与 Vercel 项目。准确仓库名、Vercel 项目 ID、关联域名和资源影响尚未确认。

## 必读材料

- [工作流](../../00-governance/WORKFLOW.md)
- [项目文件管理方案](../../00-governance/PROJECT-STRUCTURE.md)
- [PLAN-001：程序与发布自动化基础](../../04-plans/PLAN-001-ROOM-PERSISTENCE-FOUNDATION.md)
- [EXEC-001-01：正式仓库与工程基线](EXEC-001-01-REPOSITORY-BASELINE.md)
- [EXEC-001-02：CI/CD 诊断与部署反馈基线](EXEC-001-02-RELEASE-DIAGNOSTICS.md)
- [EXEC-001-03：本机 Alidns 与 Vercel CNAME 自动化](EXEC-001-03-DNS-VERCEL-AUTOMATION.md)
- `D:\workspace\alphaqwq-home` 的现有源码、Git 状态和部署配置。

## 目标

1. 为允许文件建立 `feature/exec-001-04-public-entry-release` 分支，运行固定门禁，提交、推送并创建 PR；记录同一提交的 GitHub Actions 与 Vercel Preview。
2. 在通过门禁后合并已验证的发布基础变更至 `main`，记录合并提交和 main 对应 Vercel 生产部署。
3. 在 `alphaqwq-home` 中将 Fleet Campaign 的主页按钮、链接和相关说明改为 `https://fleet.alphaqwq.xyz`，以其独立分支、PR、CI 与部署完成验证。
4. 在正式入口和主页入口均通过验收后，直接删除用户最终确认的旧 `fleet-room` GitHub 仓库与 Vercel 项目，并记录外部资源清理事实与不可逆风险。

## 非目标

- 不修改游戏功能、领域包、协议、持久化、联机、LLM、DNS 记录、Alidns 脚本、Vercel 域名映射、环境变量或 Secrets。
- 不在 CI 或仓库中写入 GitHub、Vercel、DNS 凭据；外部平台的登录及删除确认由用户完成。
- 不删除任何 GitHub 仓库、Vercel 项目、部署、域名、日志、环境变量或文件，直到用户在执行期确认已查询到的准确目标清单。
- 不将旧项目删除描述为可由 `git revert` 恢复，不将 Vercel `Ready` 作为跨网络可访问性的替代证据。

## 允许范围

- `fleet-campaign`：`docs/**`、`scripts/Invoke-VercelFleetCnameDns.ps1`、`.github/**`、根配置及本 Exec 已存在的允许文件；仅为承接 EXEC-001-03 已验证内容所需的提交与发布证据更新，不扩展游戏功能。
- `alphaqwq-home`：仅修改 `src/App.tsx` 内 `fleet-room` 工具卡片的 URL、可见名称/说明和标签，使其明确指向 `https://fleet.alphaqwq.xyz`；不进行无关重构。
- GitHub/Vercel：只在用户最终确认的旧 `fleet-room` 准确资源清单内执行删除；删除前后的查询与结果只记录非机密标识、时间和状态。
- 本 Exec 文档、对应短提示词和提示词索引。

## 执行顺序与验收

1. 在干净工作树确认 `fleet-campaign` 当前分支、未提交修改、PR #1 与 main 基线；创建本 Exec 分支，纳入 EXEC-001-03 允许文件及本 Exec 文档的可提交改动，运行 `npm ci`、`npm run typecheck`、`npm run lint`、`npm run test`、`npm run build`。
2. 提交、推送并创建/更新本 Exec PR；记录提交哈希、PR URL、Actions URL、五项门禁结果、同一提交的 Vercel Preview URL 和浏览器验收。失败时停止，保留真实证据。
3. 确认合并目标、PR 差异和 CI 成功后合并至 main；记录合并提交、main Actions、Vercel Production URL，并使用 `https://fleet.alphaqwq.xyz` 复验 HTTP、DOM/截图、控制台、网络请求和 HTTPS 证书。
4. 只读确认 `alphaqwq-home` 的实际入口文件、远端、部署项目、默认分支和现有 Fleet Campaign 链接；在独立 feature 分支改为 `https://fleet.alphaqwq.xyz`，运行该项目已有的 `npm ci` 与 `npm run build`，创建 PR 并记录部署验收。typecheck、lint 和 test 脚本当前不存在，必须如实标记为不适用。
5. 在用户本机、独立浏览器及不同网络/移动网络分别验证 Fleet 正式入口和主页跳转；记录时间、环境、HTTP 状态、页面/DOM 或截图、控制台、网络请求与证书。任一失败时不删除旧项目。
6. 从 GitHub 与 Vercel 只读查询旧 `fleet-room` 的准确仓库、项目、团队/所有权、关联域名、生产别名、部署、环境变量、日志及数据保留影响；将非机密目标清单呈给用户最终确认。未收到针对该清单的确认时不删除。
7. 用户最终确认后删除目标 GitHub 仓库和 Vercel 项目；立即重新查询确认资源不存在或处于平台删除状态。记录删除时间、操作者、精确标识、验证结果和平台恢复可用性；不得声称可回滚。

## 止损与回滚

- 任一固定门禁、Actions、Vercel 构建、正式入口、主页部署、HTTPS 或多网络验收失败时，停止合并、主页更新和旧项目删除。
- 旧项目标识、资源所有权、关联域名、数据保留影响或用户最终确认任一缺失时，停止删除；不可根据名称猜测目标。
- `fleet-campaign` 与 `alphaqwq-home` 的已合并 Git 变更使用 `git revert` 回滚；DNS 按 EXEC-001-03 已记录流程回滚。旧 GitHub/Vercel 项目删除不可保证恢复，删除前的用户确认是唯一准入，不存在自动回滚。
- 出现需注入密钥、变更认证边界、修改 DNS 或清理未列资源时，停止并回到 Plan/ADR。

## 结果记录

- fleet-campaign 分支、提交、PR、Actions、Preview：待执行。
- main 合并提交、Actions 与 Vercel Production：待执行。
- 正式入口多网络验收：待执行。
- alphaqwq-home 入口文件、分支、提交、PR、部署与验收：待执行。
- 旧 fleet-room GitHub/Vercel 目标清单与用户最终确认：待执行。
- 旧 fleet-room 删除与写后查询：待执行。
- 回滚、阻塞与遗留风险：待执行。
