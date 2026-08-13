# EXEC-001-04：正式入口发布与旧项目清理

- Plan：[PLAN-001：程序与发布自动化基础](../../04-plans/PLAN-001-ROOM-PERSISTENCE-FOUNDATION.md)
- 状态：Merged
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
- 本 Exec 文档和提示词索引；会话入口使用通用 Exec 模板。

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

- 分支创建前状态确认（2026-08-07）：原工作树位于 `feature/exec-001-01-repository-baseline`，存在不属于 EXEC-001-04 明确列举的已修改与未跟踪文档（EXEC-001-02 文档、PLAN-001/WORKFLOW/EXEC-001-01 更新、RELEASE-CICD-PLAYBOOK.md、EXECUTION-AGENT.md 等）。用户确认：之前未闭合的 Exec 实际工作均已完成（主要是网页自动化 CICD），本 Exec 分支将全部未提交 docs+scripts 一并提交，无异议。
- fleet-campaign 分支：从 `origin/main`（`28999aa`）创建 `feature/exec-001-04-public-entry-release`；纳入 EXEC-001-03 允许文件（`scripts/Invoke-VercelFleetCnameDns.ps1`、EXEC-001-03 文档与短提示词、提示词索引）、本 Exec 文档与短提示词、PLAN-001 发布自动化文档体系更新及根配置 `vercel.json`。`.gitignore` 仅存在末尾空行差异，已恢复为 main 版本，不纳入提交。
- 本地门禁（2026-08-07）：`npm ci`、`npm run typecheck`、`npm run lint`、`npm run test`（1 个测试通过）、`npm run build` 全部通过；`npm ci` 提示 `esbuild@0.28.1` 待审批安装脚本，不影响命令成功，未执行任何审批或配置写入。
- 提交：`92c71eb9d0fd0ef8fd59c076c8c50e4c6ad2f2f8`（docs(exec-001-04): release public entry foundation and carry exec-001-03 verified content）。
- PR：[#2](https://github.com/alphaqwqwq/fleet-campaign/pull/2)（Open，base main，head `feature/exec-001-04-public-entry-release`，MERGEABLE）。
- GitHub Actions：[verify run 31188538136](https://github.com/alphaqwqwq/fleet-campaign/actions/runs/31188538136) 对提交 `92c71eb` 执行五项门禁成功（conclusion=success）。
- Vercel Preview：[部署 2ArJk7xwfJ8LpWJrTMvpSu95VT2j](https://vercel.com/alphaqwqwq114514/fleet-campaign/2ArJk7xwfJ8LpWJrTMvpSu95VT2j) 状态 Ready（pass），Preview URL `https://fleet-campaign-git-feature-exec-001-04-d8517d-alphaqwqwq114514.vercel.app`；提交关联 `92c71eb`，构建 `npm ci` + `npm run build`，产物 `apps/web/dist`。
- Preview 浏览器验收：执行环境访问 Preview 域名 `*.vercel.app` TCP 443 超时（curl 20s 超时），与 EXEC-001-02 已记录的默认 `*.vercel.app` 网络路径基线一致；不推断成功，正式入口验收以自定义域名 `https://fleet.alphaqwq.xyz` 为准。
- main 合并：PR #2 合并至 main，合并提交 `926b4b5b2f4626f6e9a69f54054c2c804a5c4be5`（Merge pull request #2 from alphaqwqwq/feature/exec-001-04-public-entry-release）；main 分支 GitHub Actions [run 31188799017](https://github.com/alphaqwqwq/fleet-campaign/actions/runs/31188799017) 对 `926b4b5` 五项门禁成功；main 提交的 Vercel 检查（Preview Comments）为 success。Vercel Production 部署为 `https://fleet.alphaqwq.xyz`（自定义域名已由 EXEC-001-03 映射至 Vercel 项目）；执行环境 Vercel CLI/API 网络间歇性不可达（与 EXEC-001-02/03 记录一致），Production 部署状态以正式入口实测为准。
- 正式入口复验（执行环境，2026-08-07）：`curl -I https://fleet.alphaqwq.xyz` 返回 `HTTP/1.1 200 OK`（Server: Vercel、Content-Type: text/html; charset=utf-8、Strict-Transport-Security: max-age=63072000、X-Vercel-Cache: HIT）。TLS 证书：`Subject: CN=fleet.alphaqwq.xyz`、`Issuer: CN=YR1, O=Let's Encrypt, C=US`、有效期 2026-08-07 至 2026-11-05，SslStream AuthenticateAsClient（默认信任校验）成功。浏览器验收（独立浏览器环境）：HTTP 200、标题 `Fleet Campaign`、DOM 正常（站点标识 FLEET CAMPAIGN、h1 `房间基础工程准备中`、占位说明文本）、控制台无错误/警告、无 4xx/5xx 网络请求、截图成功（`fleet-acceptance.png`）。观察项：页面加载 `/@vite/client`，为 Vite 开发态痕迹，当前部署物为 EXEC-001-01 基线占位页，非故障，不属本 Exec 修改范围。
- alphaqwq-home 入口文件：`D:\workspace\alphaqwq-home\src\App.tsx`，TOOLS 数组含 `fleet-room` 卡片（url `https://fleet-room.vercel.app`）。远端 `alphaqwqwq/alphaqwq-home`，默认分支为 `master`（仅初始提交），实际开发与部署分支为 `main`；Vercel 项目 `alphaqwq-home`（prj_ffAaquALvB7Yusv1Kddp2l7dKdtj），Production Branch 原配置为 `master`。主页正式入口为 `https://www.alphaqwq.xyz`（alphaqwq.xyz 308 重定向至 www）。
- alphaqwq-home 分支与提交：创建 `feature/exec-001-04-home-entry-update`，修改 App.tsx 中 fleet 卡片：`id: fleet-campaign`、标题"舰队战役"、描述改为官方入口说明、url `https://fleet.alphaqwq.xyz`、标签 `战役/官方入口`。提交 `081cbe904c53325217804e15d6570b6eec7474bd`（feat: point fleet campaign card to fleet.alphaqwq.xyz）。仅跑 `npm ci` 与 `npm run build`（项目无 typecheck/lint/test 脚本，如实标记不适用），构建成功。PR：https://github.com/alphaqwqwq/alphaqwq-home/pull/1 合并至 main（合并提交 `9fcad7b674a595b7d9c37c1250d8332ece1a9008`）。
- alphaqwq-home Vercel 生产分支修复（关键）：PR #1 合并后 www.alphaqwq.xyz 生产未更新，仍为旧 `8ea272c`（含 fleet-room 卡片）。诊断发现 Vercel 项目 `alphaqwq-home` 的 Production Branch 为 `master`，而修改在 `main`，故 main 合并只产生 Preview（`alphaqwq-home-git-main-...`）。Vercel 官方 Update Project API（`PATCH /v9/projects/{id}`）请求体不含 `link` 字段（经 Vercel SDK v1.28.16 类型定义与 API 实测确认），无法通过该端点修改 productionBranch；`PATCH/DELETE /v9/projects/{id}/link` 亦不接受 productionBranch。经用户授权，使用 Vercel API `POST /v9/projects/{id}/link`（body `{type:"github", repo:"alphaqwq-home", productionBranch:"main"}`）重新连接 Git，`productionBranch` 生效为 `main`；随后在 main 推送空提交 `ebcc1ac`（chore: trigger vercel production deploy after git relink）触发生产部署。新生产部署 `alphaqwq-home-cbbprvdtr-alphaqwqwq114514.vercel.app`（production，sha `ebcc1ac`，ref main）READY。
- alphaqwq-home 生产验收：www.alphaqwq.xyz 主 bundle 更新为 `index-Qng80zV8.js`（200）；浏览器验收通过——标题 `alphaqwq · 工具集`，卡片含"舰队战役"（url `https://fleet.alphaqwq.xyz`），fleet-room.vercel.app 卡片已移除，点击跳转 `https://fleet.alphaqwq.xyz` 成功（标题 Fleet Campaign，200），控制台无错误，站点自身资源全部 200（旧 bundle `index-jLvPPwF0.js` 已删除返回 404，为旧部署残留清理）。
- 正式入口多网络验收（2026-08-07）：用户确认已完成——本机、独立浏览器及移动网络均可访问 `https://fleet.alphaqwq.xyz`，并可从 `https://www.alphaqwq.xyz/` 通过点击相应卡片访问 OW Coach（coach.alphaqwq.xyz）、随机分队器（tb.alphaqwq.xyz）与舰队战役（fleet.alphaqwq.xyz）三个入口。
- 旧 fleet-room 目标清单与用户最终确认（2026-08-07）：用户核对后确认删除。目标清单：GitHub 仓库 `alphaqwqwq/fleet-room`（PUBLIC、TypeScript、2026-08-06 创建、未归档、仅 `main` 分支、0 open issues/PRs、0 releases）；Vercel 项目 `fleet-room`（`prj_VoLIEtJJbXXBVUG4MPxNI1cJlqO6`，绑定同一仓库、productionBranch=main、域名 `fleet-room.vercel.app`、0 环境变量、2 个 production 部署、框架 vite）。
- 旧 fleet-room 删除与写后查询：Vercel 项目已删除（2026-08-07，DELETE `/v9/projects/prj_VoLIEtJJbXXBVUG4MPxNI1cJlqO6` 返回 204；写后查询 API 返回 404 `Project not found`，`fleet-room.vercel.app` 站点实测不可达 HTTP 000）。GitHub 仓库删除需 `delete_repo` scope（当前 GitHub token 无此权限），由用户在 GitHub 网页删除 `alphaqwqwq/fleet-room`；写后验证：`gh repo view` 返回 `Could not resolve to a Repository`，REST API `GET /repos/alphaqwqwq/fleet-room` 返回 404 `Not Found`，确认仓库已不存在。删除不可逆、不适用 `git revert`、平台不保证恢复，删除前的用户确认是唯一准入；已确认无独立环境变量/日志需求（0 env、无 releases、无 open issues/PRs）。
- 回滚、阻塞与遗留风险：fleet-campaign 与 alphaqwq-home 的已合并 Git 变更可按 `git revert` 回滚（fleet-campaign 合并提交 `926b4b5`/`c2a6de6`/`cbd038a`/`dd04c48`，alphaqwq-home 合并提交 `9fcad7b`）；DNS 按 EXEC-001-03 流程回滚。旧 fleet-room GitHub 仓库与 Vercel 项目均已删除并经写后验证（见上），属外部不可逆清理，无自动回滚。Vercel `alphaqwq-home` 项目已重连 Git 并设 productionBranch=main（经用户授权），后续主页 main 推送会自动触发生产部署。无未决阻塞。
