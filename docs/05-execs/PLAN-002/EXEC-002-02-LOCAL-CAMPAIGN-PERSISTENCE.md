# EXEC-002-02：本地战役档持久化

- Plan：[PLAN-002-01：游戏骨架与最小可玩电子化循环](../../04-plans/PLAN-002-01-GAME-SKELETON-MVP-LOOP.md)
- 状态：Draft
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

- 实际分支：未开始。
- 提交 / PR / CI / Preview：未开始。
- 固定门禁与存档测试：未开始。
- 人工验收：未开始。
- 遗留风险与对父 Plan 验收的影响：未开始。
