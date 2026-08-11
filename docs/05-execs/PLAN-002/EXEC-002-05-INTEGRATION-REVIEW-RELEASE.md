# EXEC-002-05：集成复核与发布验收

- Plan：[PLAN-002-01：游戏骨架与最小可玩电子化循环](../../04-plans/PLAN-002-01-GAME-SKELETON-MVP-LOOP.md)
- 状态：Draft
- 分支：`feature/exec-002-05-integration-review-release`
- 依赖：EXEC-002-01 至 EXEC-002-04 均已 Merged
- 影响域：集成测试 / 缺陷修复 / 发布验收 / Gate 输入汇总

## 必读材料

- [PLAN-002-01](../../04-plans/PLAN-002-01-GAME-SKELETON-MVP-LOOP.md)：完整 MVP 契约、验收、风险、Exec 边界与 Gate 回报规则。
- [EXEC-002-01](EXEC-002-01-DOMAIN-PROTOCOL-FOUNDATION.md) 至 [EXEC-002-04](EXEC-002-04-WEB-VERTICAL-SLICE.md)：实际提交、CI、Preview、测试和遗留风险记录。
- [工作流](../../00-governance/WORKFLOW.md)、[项目文件管理方案](../../00-governance/PROJECT-STRUCTURE.md) 与 [网页发布 CI/CD 全流程经验手册](../../00-governance/RELEASE-CICD-PLAYBOOK.md)。

## 目标

在不扩大功能的条件下整合已合并工作单元，执行端到端 MVP 验收、修复阻止验收的最小集成缺陷、记录发布证据和遗留风险，并向父 Plan 提供 Gate Review 输入。

## 非目标

- 不新增玩法、协议字段、存档版本、实时能力、账号、云服务、旁白、内容、美术或发布架构。
- 不用移除断言、跳过人工验收或弱化权限检查换取通过。
- 不自行宣布 PLAN-002 完成或开启下一 Plan。

## 允许范围

- 端到端/集成测试、测试夹具、验收记录及本 Exec 文档；会话使用通用 Exec 模板。
- 仅为修复已复现且阻止 Plan 验收的缺陷所需的最小文件；每项修复必须在结果记录关联复现、根因、测试和影响包。
- 不改变任何已批准的公开领域、协议、存档或传输契约。

## 禁止范围

- 任何未在 MVP 中列出的功能、依赖、外部服务、机密信息、发布/DNS/认证架构改动。
- 大规模重构、无关格式化、替换实时技术或未先经 Review/ADR 的跨包契约变化。

## 实施与验收

1. 汇总前四个 Exec 的实际分支、提交、PR、CI、Preview、已验证结论和未验证项；缺少任何依赖合并证据时停止。
2. 执行端到端矩阵：建房、玩家加入、观战、回合轮换、胜负、幂等/状态冲突、存档往返、导入失败不覆盖、客机重连、重复连接、房主关闭和无越权命令。
3. 执行固定门禁以及真实两浏览器验收；正式网页仅以 `https://fleet.alphaqwq.xyz` 记录可访问性，并保留 HTTP、关键 DOM、控制台、网络请求、HTTPS 与多网络可验证证据。
4. 仅修复阻止验收的最小缺陷；若根因要求改变协议 v1、存档迁移、RNG、房主权威、认证、PeerJS/WebRTC 结论或跨包依赖，停止并创建 Review/ADR 规划记录。
5. 提交、推送、PR、CI、Preview、合并和正式入口验收完成后，在本节记录可追溯证据、回滚提交、遗留风险及对父 Plan 每项验收的满足情况。
6. 向父 Plan 提供不超过十行的结案摘要，供 Master 进入 Gate Review；不改变 Master 路线图。

## 自动 Review 与 Plan Gate

- 独立 `fleet-review`/Terra 汇总全部 Exec Review、固定门禁、PR/CI/Preview、正式入口与 Browser 证据，核对观战只读、令牌不泄露、房主关闭无迁移承诺及默认 `*.vercel.app` 不作为入口结论。
- 自动化与 Browser 覆盖项完成后，本 Exec 生成一次父 Plan Gate 用户清单：正式入口、前置条件、至少两个真实独立浏览器/设备、可选移动网络、完整 MVP 步骤、预期结果、主观体验问题和失败回传要求。
- 用户明确完成该集中验收前，本 Exec 可记录自动证据已完成，但不得把父 Plan 标记 Completed；无法执行的真实设备或网络项必须保持未验证。

## 回滚与止损

- 合并后使用 `git revert`；不改写 `main` 历史。
- 任一 CI、测试、Preview、正式入口或浏览器验收失败即停止推进并记录真实证据；同一问题两次无可信结论时不猜测继续。
- 发现范围扩张或需要改变已批准契约时停止，回到 Plan、Review、ADR 或 Master。
- Flash 若承担最小缺陷修复，一次可信修复仍失败后由 Master fork 原目标给 `fleet-exec`/Terra；Terra 仍失败或需改契约时停止并形成 Review/ADR 阻塞结论。

## 结果记录

- 依赖 Exec 证据汇总：未开始。
- 实际分支 / 提交 / PR / CI / Preview：未开始。
- 自动化与端到端验收：未开始。
- 正式入口与多网络验收：未开始。
- 回滚路径、遗留风险与父 Plan Gate 输入：未开始。
