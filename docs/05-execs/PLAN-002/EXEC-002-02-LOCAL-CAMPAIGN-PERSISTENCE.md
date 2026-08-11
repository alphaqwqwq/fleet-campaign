# EXEC-002-02：本地战役档持久化

- Plan：[PLAN-002-01：游戏骨架与最小可玩电子化循环](../../04-plans/PLAN-002-01-GAME-SKELETON-MVP-LOOP.md)
- 状态：Completed
- 分支：`feature/exec-002-02-local-campaign-persistence`
- 依赖：EXEC-002-01 已 Merged
- 影响域：版本化存档 / 导入导出 / 浏览器存储适配 / 测试

## 必读材料

- [PLAN-002-01](../../04-plans/PLAN-002-01-GAME-SKELETON-MVP-LOOP.md)：存档 v1、数据最小化、兼容和迁移裁决。
- [EXEC-002-01](EXEC-002-01-DOMAIN-PROTOCOL-FOUNDATION.md)：已合并的领域与协议公开契约。
- [工作流](../../00-governance/WORKFLOW.md) 与 [项目文件管理方案](../../00-governance/PROJECT-STRUCTURE.md)。

## 目标

实现 `CampaignSave` v1 与 `FleetCampaignSave` 导出包的编码、校验、迁移和存储端口，使应用服务可保存、加载、列出、删除、导入和导出已确认的 `demo-v1` 快照。

## 非目标

- 不实现实时房间、PeerJS/WebRTC、账号、云同步、跨设备恢复或网页 UI。
- 不实现游戏规则、修改 `domain`/`protocol` 已批准契约，或持久化令牌、连接状态、房间码、命令收据、外部凭据和旁白原始输入。
- 不承诺修复未知版本或损坏数据。

## 允许范围

- `packages/persistence/**`：存档 schema、编码/解码、迁移链、存储端口和浏览器适配器。
- `packages/persistence/**` 的测试、必要的公开入口及仅用于既有包互操作的最小类型导出。
- 本 Exec 文档与对应短提示词。

## 禁止范围

- `apps/web/**`、`packages/realtime/**`、`packages/narration/**`。
- 游戏规则/协议扩张、真实联机、云服务、账号/认证、发布/DNS 与机密信息。

## 实施与验收

1. 实现 `schemaVersion: 1` 的 `CampaignSave` 和 `formatVersion: 1` 的 `FleetCampaignSave`，只保存 Plan 指定的 `campaignId`、内容 ID、已确认游戏快照、RNG 状态及迁移元数据。
2. 通过存储端口实现 `save/load/list/delete/export/import`；具体浏览器存储实现只能由应用服务注入，不能要求 UI 组件直接调用浏览器 API。
3. 导入在写入前完成大小限制、JSON、格式、版本、字段、内容 ID、领域不变量和 RNG 状态校验；失败返回稳定存档错误并保持当前存档不变。
4. 为未来版本预留显式 `migrateSave(fromVersion, raw)` 入口；v1 只读取已知同版本，未知未来版本拒绝且保留原文件。
5. 编写测试覆盖 v1 往返、列出/删除、导出/导入、损坏 JSON、未知版本、字段非法、不兼容内容、迁移失败不覆盖与禁止字段不落盘。
6. 执行固定门禁，成功后按流程提交、推送、创建 PR、记录 CI/Preview 和结果。

## 自动 Review 与 Plan Gate

- 实现 PR 合并前由独立 `fleet-review`/Terra 审查导出 JSON 不含 `roomId`、`clientId`、令牌、连接信息、PeerJS 端点、命令收据、凭据或旁白原始输入，并核对持久化包只依赖协议公开契约。
- Review 必须复核 v1 往返、损坏/未知版本/迁移失败不覆盖测试、固定门禁、PR/CI/Preview、文件范围与回滚，结论写入 `docs/06-reviews/PLAN-002/**`；只有 `pass` 才允许合并。
- 本 Exec 不单独请求用户审查代码。导入/导出真实体验与跨浏览器主观验收汇总到父 Plan Gate。

## 回滚与止损

- 合并后仅用 `git revert` 回滚。
- 需要支持云同步、跨设备、旧原型、未知版本自动修复或改变存档字段语义时停止并回到 Plan/ADR。
- 任一固定门禁、导入不覆盖断言或迁移测试失败时，保留证据并停止。
- Flash 对同一问题完成一次可信修复仍失败时停止，由 Master fork 原 Exec 给 `fleet-exec`/Terra；不得在补救中改变存档 v1 或扩大文件范围。

## 结果记录

- 实际分支：`feature/exec-002-02-local-campaign-persistence`，隔离 worktree 基于 `origin/main` `9839b24` 创建。Terra 将测试导出辅助函数的入参从不安全的 `CampaignSave` 断言改为 `unknown`，关闭 TS2352；同时使 IndexedDB 事务或请求的同步创建异常按存储失败路径拒绝。未改变存档 v1、协议 v1 或领域契约。
- 提交 / PR / CI / Preview：实现提交 `441fe0c`（`feat(persistence): add local campaign saves`）已推送；PR [#11](https://github.com/alphaqwqwq/fleet-campaign/pull/11) 指向 `main`。GitHub Actions `verify` 通过（18 秒，run `31465783045`）；Vercel Preview 和 Vercel Preview Comments 均通过。未合并 PR。
- 固定门禁与存档测试：`npx vitest run packages/persistence/src/persistence.test.ts` 通过（1 文件、18 用例）；`npm run typecheck` 通过；`npm run lint` 通过；`npm run test` 通过（7 文件、101 用例）；`npm run build` 通过。审查确认保存和导入使用精确字段 schema，禁止字段拒绝且不导出；导入在唯一写入前完成大小、JSON、格式、版本、内容、领域投影和 RNG 校验；迁移只接受 v1 并拒绝未知版本；IndexedDB 请求、事务和打开错误均向端口调用者失败；包只依赖 `@fleet-campaign/protocol` 的公开入口。
- 自动 Review / 人工验收：独立自动 Review 仍须依照本 Exec 的 Review 合同完成；用户人工验收仍聚合到父 Plan Gate。
- 遗留风险与对父 Plan 验收的影响：浏览器真实 IndexedDB 兼容性和导入导出体验须在后续网页/Plan Gate 中验证；本 Exec 的自动化门禁不覆盖真实多浏览器交互。
