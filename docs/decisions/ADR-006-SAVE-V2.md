# ADR-006 存档 v2：交战级领域快照 + 确定性回放

- 状态：接受
- 日期：2026-08-13

## 背景

demo-v1 存档（schemaVersion: 1）以 `GameView` 保存抽象演示状态，RNG 从不消费（`rngIndex` 恒 0）。
M2-A 引入交战级领域引擎（`packages/battle`）：多战斗群、环带、阶段时钟、计数器、真实随机消费。
存档若继续用 `GameView` 投影，将丢失裁决细节、无法确定性回放，也无法支撑"结算包/持久伤痕"（P4）。

## 决定

- 存档 schemaVersion 升级为 **2**。`CampaignSave` 载荷从 `gameSnapshot: GameView` 改为
  `snapshot: BattleSnapshot`（或按 contentId 分派的领域快照联合），内容为领域可回放快照：
  - 交战标识、contentId、阶段、轮次、环带、临界点、结果
  - 各战斗群（舰船/护航/机队状态、计数器 charge/flight/reload、statusEffects、limitedUsed）
  - RNG 状态 `{ seed, index }`：`index` 为已消费随机数索引，加载后从该索引继续
- 导入导出包装 `FleetCampaignSave`（format / formatVersion）保持 v1 不变，仅 `save.schemaVersion` 升 2。
- 迁移：沿用显式 `migrateSave(fromVersion, raw)` 链；v1→v2 提供**演示内容**迁移，
  M2 交战内容从 v2 起才存在，无 v1→v2 交战迁移需求（内容不可比）。
- 校验链追加：领域不变量 + RNG `{ seed, index }` 合法性 + 快照可回放性（可选严格模式）。
  任一步失败不覆盖现有档案，返回既有错误码语义。

## 后果

- 存档在"游戏进行中"保存时，除领域快照外还保留**事件回放起点**，供结算包/叙事（M2-G）与
  裁定透明面板（M2-E）重建上下文。
- 迁移代码与 schema 定义集中在 `packages/persistence`，领域层不依赖存档格式。
- 代价：快照体积大于 `GameView`；导入上限仍 1 MB，超限拒绝。

## 备选

- 继续用 `GameView` 投影：体积小，但丢失裁决/计数器/环带，回放不可靠，拒绝。
- 存事件日志（event sourcing）而非快照：可回放更强，但加载须重放全序列，
  与"房主单写者 + 快照下发"现状冲突，另立 ADR 再裁决。
