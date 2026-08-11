# EXEC-002-01：领域与协议基础

- Plan：[PLAN-002-01：游戏骨架与最小可玩电子化循环](../../04-plans/PLAN-002-01-GAME-SKELETON-MVP-LOOP.md)
- 状态：Merged
- 分支：`feature/exec-002-01-domain-protocol-foundation`
- 依赖：PLAN-002-01 已 Approved
- 影响域：抽象内容 / 纯领域规则 / 协议契约 / 单元测试

## 必读材料

- [PLAN-002-01](../../04-plans/PLAN-002-01-GAME-SKELETON-MVP-LOOP.md)：已批准的 MVP、状态机、协议、RNG 和模块边界。
- [工作流](../../00-governance/WORKFLOW.md)：Exec 生命周期、证据与止损规则。
- [项目文件管理方案](../../00-governance/PROJECT-STRUCTURE.md)：包依赖方向、分支、回滚和固定门禁。
- [文档索引](../../README.md)：公开资料与文档优先级。

## 目标

实现 `demo-v1` 的纯 TypeScript 内容、领域状态机和 `protocolVersion: 1` 契约，为后续存档、实时和网页提供无 UI/网络依赖的可测试真源。

## 非目标

- 不实现 React 页面、浏览器存储、PeerJS/WebRTC、房间连接、身份令牌签发或真实 LLM。
- 不实现地图、骰子、武器、舰船、AI、原作内容或任何 `advance` 之外的游戏行动。
- 不新增运行时 schema 依赖；若既有依赖不足，使用最小本地校验器，或停止并回到 Plan。

## 允许范围

- `packages/content/**`：`demo-v1` 抽象模板、夹具和内容校验。
- `packages/domain/**`：`GameState`、纯 reducer、领域事件、不变量、确定性 RNG 接口。
- `packages/protocol/**`：v1 信封、命令、事件、快照、错误码和运行时校验。
- 上述包的测试、根 workspace 配置中仅为使这些已存在包可构建所必需的最小改动、本 Exec 文档与对应短提示词。

## 禁止范围

- `apps/web/**`、`packages/persistence/**`、`packages/realtime/**`、`packages/narration/**`。
- 浏览器 API、React、PeerJS、IndexedDB、网络/计时器、存储适配器、外部服务和机密信息。
- 改动发布、DNS、Vercel、GitHub Actions 或正式入口。

## 实施与验收

1. 以 `host-unit`、`guest-unit`、`integrity: 3`、`actionPoints: 1` 建立 `demo-v1`；实现 `awaiting-player → active → completed` 与 `start-demo`、`advance` 的纯状态转换。
2. 保证非法阶段、非行动席位、完成后动作和无效命令返回 Plan 规定的确定性拒绝，且不会改变输入状态。
3. 实现 `protocolVersion: 1` 的 `command-intent`、`command-result`、有序事件、完整快照和错误码校验；未知版本或非法数据不得进入领域层。
4. 实现客户端幂等键、房主收据和事件序列所需的无副作用数据结构/接口；重复键必须可重放原结果，不得重复结算。
5. 实现可注入的确定性 RNG 接口与 v1 的零消费记录；相同种子和命令序列必须产生相同状态及事件。
6. 编写表驱动测试，覆盖初始状态、开始、轮换、胜负、每个拒绝码、不可变性、幂等重放、协议非法输入和 RNG 重现。
7. 运行 `npm ci`、`npm run typecheck`、`npm run lint`、`npm run test`、`npm run build`；所有命令成功后再提交、推送、创建 PR 与记录 Preview。

## 自动 Review

- 独立审查目标为 [REVIEW-002-01](../../06-reviews/PLAN-002/REVIEW-002-01-DOMAIN-PROTOCOL-FOUNDATION.md)，由 `fleet-review`/Terra 核对 `packages/domain` 不导入 UI、浏览器、网络、存储或 LLM，领域层不反向导入 `protocol`。
- Review 核对所有公开示例、fixture 和事件名称只使用 `demo-v1` 抽象内容，协议不含令牌值或客户端提交的伤害/胜负结论字段，并复核固定门禁、PR #7、CI 和合并证据。
- 本 Exec 不要求用户审查底层代码；用户人工验收聚合到父 Plan Gate。实现会话的静态自查不能替代独立 Review `pass`。

## 回滚与止损

- 合并后使用本 Exec 合并提交的 `git revert` 回滚，不改写共享历史。
- 协议 v1 对外字段、随机消费点、状态机、不变量或跨包依赖发生未裁决变化时立即停止并回到 Plan/ADR。
- 任一固定门禁、PR CI 或 Preview 失败时保留真实证据，不得通过删除/弱化测试继续推进。

## 结果记录

- 实际分支：`feature/exec-002-01-domain-protocol-foundation`（基于 `origin/main` f1cef48 创建）。
- 提交 / PR / CI / Preview：实现提交 `36ddc4d`、结果记录提交 `8b957f9`（已推送该 feature 分支）；PR [#7](https://github.com/alphaqwqwq/fleet-campaign/pull/7) 于 2026-08-10 合并，合并提交 `bb86363f9f9b9aab2982b4fc727852db2408e98b`；CI verify [SUCCESS](https://github.com/alphaqwqwq/fleet-campaign/actions/runs/31385170677/job/93443867885)；Preview [fleet-campaign-git-feature-exec-002-01-38ecfa-alphaqwqwq114514.vercel.app](https://fleet-campaign-git-feature-exec-002-01-38ecfa-alphaqwqwq114514.vercel.app)。本 Exec 不改变发布入口，正式入口验收不属于本 Exec。
- 固定门禁：`npm ci`、`npm run typecheck`、`npm run lint`、`npm run test`（6 文件 66 用例）、`npm run build` 全部通过，本地 2026-08-10 与 PR CI verify 双验证。
- 实现会话静态自查（非用户人工验收、非独立 Review）：记录称 `packages/domain` 仅依赖 `@fleet-campaign/content`，公开示例使用 `demo-v1` 抽象内容，协议不含令牌值或客户端结论字段；该结论须由 REVIEW-002-01 以代码和 Git/CI 证据独立校正。
- 遗留风险与对父 Plan 验收的影响：会话账本与协议信封的无副作用数据结构已就绪，但其宿主组合（房主应用服务）属于 `apps/web`，由 EXEC-002-03/04 接线；协议 v1 对外字段、随机消费点、状态机、不变量或跨包依赖的任何未裁决变化需按 PLAN-002-01 触发 Review/ADR 并停止本阶段。

## 补救结果（REVIEW-002-01 remediation）

- 补救分支：`feature/exec-002-01-protocol-schema-remediation`（基于 `origin/main` `ef1f5b1` 创建）。本次仅修复 REVIEW-002-01 的两项 High finding，不改动协议 v1 对外字段、事件类型或幂等语义。
- 根因与修复：
  1. `ids.ts` 的 `isValidIdempotencyKey` 接受任意 1-32 字符 URL-safe 字符串，单字符键也通过，削弱跨重试幂等键的碰撞边界。现与 Plan 已批准的 URL-safe 128-bit 表示一致：要求无填充 base64url 编码 16 字节所需的最短 22 字符且最长不超过 32 字符，拒绝过短/过长键；`validate.ts` 中两处错误信息同步更新。
  2. `validate.ts` 的 `Snapshot.game` 未拒绝未知字段、`BroadcastEvent.publicPayload` 无约束。现对 v1 游戏投影整体与每个 `units` 条目施加精确 schema：`game` 与 `unit` 均拒绝未知字段，`unit.id` 只允许 `host-unit`/`guest-unit`；按事件类型建立公开载荷 schema（`demo-started: {round, activeSeat}`、`action-confirmed: {targetSeat, targetIntegrity}`、`demo-completed: {winnerSeat}`、`room-closed: {}`），未知字段一律拒绝，token 无法经 v1 校验进入下行快照/公开事件。未新增运行时依赖。
- 测试：先改/新增失败测试（短键、单字符键、非法长度边界；publicPayload 未知字段/缺字段/非法值/room-closed 空载荷；game 与 unit 未知字段、未知 unit id），再最小实现。`packages/protocol/src/validate.test.ts` 由 35 增至 46 用例。
- 固定门禁（2026-08-11 本地）：`npm ci`、`npm run typecheck`、`npm run lint`、`npm run test`（6 文件 79 用例）、`npm run build` 全部通过；提交、PR CI 与 Vercel Check 见本文件上方 Git/PR 记录。
- 遗留风险：仍待 EXEC-002-03/04 宿主组合产生真实广播事件与快照后，以端到端证据复核公开载荷与 `projectGame` 映射；`room-closed` 公开载荷定为空对象，若未来需要携带展示字段须先经 Plan/ADR 裁决。

## Terra 补救结果（REVIEW-002-01 +02）

- 升级缘由：独立复审 `REVIEW|E002-01+02` 仍为 `remediation required`，指出首次 Flash 补救将 16 字节无填充 base64url 的精确表示错误实现为 22-32 字符范围，因而错误接受 23、24、31、32 字符键及 32 字符测试样例。Plan 批准的格式是精确 22 个 URL-safe 字符。
- 会话恢复：正确收尾会话标题为 `EXEC|E002-01+02+协议SchemaTERRA补救`（ID：`ses_0113421beffeMN6BZeQTzMI4PA`）；OpenChamber `session.fork` 忽略显式标题，实际执行会话 `ses_011385e4dffeQBTsIobKB9b5Zb` 因此生成不合规标题。内置 Terra 已在原 EXEC、同一分支和同一 PR #10 上完成一次受限补救；不改变已关闭的 `validate.ts` 公开 schema finding、协议 v1 字段、事件类型或幂等重放语义。
- 测试与修复：先增加 23、24、31、32 字符的拒绝断言，定向测试如预期以 5 项失败暴露旧 22-32 实现；`ids.ts` 随后最小收紧为 `value.length === 22`。首次与 `npm ci` 并发的定向测试出现 `ERR_MODULE_NOT_FOUND`，原因是依赖目录重建竞争，非代码失败；`npm ci` 完成后串行复验发现共享合法 `KEY` fixture 实际为 23 字符，已最小修正为 22 字符并保留全部新增拒绝边界。
- 验证（2026-08-11 本地）：串行执行 `npm ci`、`npx vitest run packages/protocol/src/validate.test.ts`（1 文件 50 用例）、`npm run typecheck`、`npm run lint`、`npm run test`（6 文件 83 用例）、`npm run build`，全部通过。无新增运行时依赖。
- 提交与远端证据：Terra 修复提交 `92d514c69beef210932db0aaf6d61d8967740233` 相对前序 `c21ad8e` 仅包含 `packages/protocol/src/ids.ts`、`packages/protocol/src/validate.test.ts` 与本 Exec 记录；`git diff --check ef1f5b1..92d514c` 通过。PR [#10](https://github.com/alphaqwqwq/fleet-campaign/pull/10) head 为 `92d514c`、base 为 `ef1f5b1`；GitHub verify [run 31454510883](https://github.com/alphaqwqwq/fleet-campaign/actions/runs/31454510883) 与 Vercel check 均为 `SUCCESS`。
- 风险与后续：精确长度校验只能验证表示长度与字符集，不能证明客户端随机源的密码学质量；生成方仍须按 Plan 使用本地加密安全随机 16 字节值并在同次用户操作重试中复用。PR #10 不合并，交回独立 Review 和 Master。
