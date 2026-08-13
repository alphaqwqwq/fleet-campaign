# M2 领域命令 / 事件 Schema 草案（M2-A 交战引擎）

- 状态：草案（2026-08-13，M2-A 实现前定稿基线）
- 范围：M2-A 单场交战沙盒引擎（`packages/battle`），纯规则、确定性可复现
- 关联：[M2 设计基线](DESIGN-M2.md) / [存档 v2 ADR](../decisions/ADR-006-SAVE-V2.md)
- 规则来源：原作《枪骑兵：战斗群》§2（全舰接战 / 涡流盘 / 临界点），仓库内一律自创抽象名

## 1. 本草案的边界

只定义 **领域层** 的命令 / 事件 / 状态 / 拒绝码，与 demo-v1 的 `packages/domain` 完全隔离。
协议 v1 的 `command-intent` / 广播事件 / 快照接线 **不在本草案内**（由 M2-E 网页切片接入，届时走新 ADR）。
存档 v2 形状见 [ADR-006](../decisions/ADR-006-SAVE-V2.md)。

## 2. 实体与状态

引擎只认数据（P1）：所有规则对象来自 `packages/content` 的 schema 数据，引擎无内置目录。

```text
BattleState
├── engagementId        领域内唯一（引擎生成，内容无关）
├── contentId           引用战斗内容 schema（M2-B 目录 / 沙盒夹具）
├── round               ≥1，第 5 轮进入临界点（collapseActive）
├── phase               阶段时钟：logistics → ballistics → action → boarding
├── critical            临界点状态：round>=5 后每轮开始强制决策
├── battleGroups[]      每指挥一个战斗群（各战斗群独立距离带）
├── actionOrder[]       行动阶段回合顺序（战场双方交替，玩家先手）
├── activeGroupId       行动阶段当前行动的战斗群
├── outcome             null | 交战结果（幸存比例判定）
└── rngIndex            已消费随机数索引（确定性回放唯一依据）

BattleGroup
├── id / controller     controller = actorId（单指挥先行为一人指挥全部，M2-F 扩展）
├── faction             player | enemy
├── distance            该群涡流盘距离带 0..5（0=至近，5=极限；各自独立移动）
├── flagship            旗舰（+3 HP / +1 阻滞骰 / +1 系统槽）
├── ships[]             主力舰（巡防舰/航母/战列舰，由内容 schema 定义）
├── escorts[] / squadrons[]   M2-B 内容；引擎在状态模型中预置槽位
├── blockDice           阻滞骰（战斗群级聚合，v1 简化：旗舰 +1d6，内容可叠加）
├── status              active | retreated | surrendered | eliminated
├── limitedUsed[]       受限 1 的机动/战术使用记录（如紧急机动）
├── statusEffects[]     锁定/巩固/谨慎射击等持续效果（含到期标记）
└── counterState[]      每武器计数器：charge / flight / reload
```

- 环带修正（原作 P45-47，对**该群当前距离带**生效）：5/4 带充能武器 +1 准度、其余单目标 +1 难度、酬载飞行计数 5/4；3 带无修正、酬载 3；2 带酬载 2；1/0 带非充能单目标 +1 准度、酬载 1/0（0 带酬载即时命中并自伤一半）。
- 临界点（原作 P45）：第 5 轮开始每轮后勤前决策撤退/继续；第 6 轮 5 带→4 带、不可退回 5；第 7 轮 2 带外→2 带；第 8 轮全体→0 带、不可撤退。

## 3. 阶段时钟（4 阶段轮次）

v1 只保留一轮内 4 阶段，**接舷阶段空转**（DESIGN-M2 §3）。每轮由 `advance-phase` 驱动：

```text
round N 开始
  ├─(round>=5) 临界点决策：declare-retreat / declare-surrender / continue
  ├─ logistics   计数器 tick（charge/flight/reload -1）、护航/机队重新整备（内容预留）
  ├─ ballistics  充能=0 可 fire-charged / delay-charged；酬载=0 自动命中；结束时阻滞骰结算
  ├─ action      战斗群轮流：每群 1 机动 + 1 战术，或 2 战术
  └─ boarding    空转（v1），直接进入 round N+1
```

- 撤退/投降在 **后勤阶段开始前** 声明（含临界点后的每轮）；至近带第 6 轮后不可撤退。
- 行动阶段回合交替：玩家（P）→ 敌方（NPC，M2-D）→ 下一玩家。单指挥 v1 简化为一对一。

## 4. 命令 Schema

统一命令信封：`{ type, actorId, ...载荷 }`。`actorId` 声明"谁指挥该战斗群"；引擎校验 controller 归属。

| 命令 | 载荷 | 允许阶段 | 语义 | 前置/拒绝 |
| --- | --- | --- | --- | --- |
| `start-engagement` | `contentId` | （创建） | 用内容 schema 建立 BattleState，round=1, logistics | 内容校验失败 → `content_invalid` |
| `advance-phase` | — | 任一阶段 | 驱动阶段时钟前进一步 | 行动阶段所有战斗群须已 `end-turn`，否则 `not_all_turns_ended` |
| `declare-retreat` | `battleGroupId` | 后勤前 | 整群撤退：酬载攻击全部自毁、伴随单位移除 | round<5 → `critical_not_reached`；至近第 6 轮后 → `cannot_retreat` |
| `declare-surrender` | `battleGroupId` | 任意轮开始 | 整群投降，退出交战 | 已撤退/已投降 → `command_invalid` |
| `maneuver` | `battleGroupId, maneuver: full-thrust / all-guns-fire / ramming-speed / retro-thrust, target?` | 行动·该群回合 | 见 §4.1 | 非该群回合 → `not_active_group`；受限超限 → `limit_reached` |
| `tactic` | `battleGroupId, tactic: lock-on / careful-fire / emergency-maneuver, target?` | 行动·该群回合 | 见 §4.2 | 同上 |
| `fire-charged` | `battleGroupId, weaponId, target?` | 弹着 | 充能=0 武器开火并重设计数；延后则 `delay-charged` | 非充能/非 0 → `command_invalid` |
| `delay-charged` | `battleGroupId, weaponId` | 弹着 | 延后开火，计数保持 0 | 同上 |
| `end-turn` | `battleGroupId` | 行动·该群回合 | 结束该群行动回合，交给下一个（`turn-advanced` 事件） | 非该群回合 → `not_active_group` |
| `resolve-engagement` | — | 战果条件达成（任一方无 active 战斗群：全灭/撤退/投降） | 按幸存比例判定交战结果并结束 | 未达成战果条件 → `command_invalid` |

- 全灭判定：active 状态战斗群内全部舰船 destroyed/disabled → 状态置 `eliminated`；任一方无 active 战斗群即满足战果条件。

- `actorId` 与 `battleGroupId` 的 controller 不符 → `forbidden_controller`。
- 所有拒绝码见 §6，拒绝不改变状态、不消费 RNG。

### 4.1 机动（v1 保留：全速前进 / 全舰开火 / 反向喷射；撞击速度后置）

| 机动 | 效果 |
| --- | --- |
| `full-thrust` 全速前进 | 前进 1 距离；可在移动前/后发射 1 主武器 |
| `all-guns-fire` 全舰开火 | 不移动；发射 1 超重型武器，或至多 2 个不同武器 |
| `retro-thrust` 反向喷射 | 后退 1 距离（或忽略下一次强制移动）；获得巩固（+1 阻滞骰、全舰 +2 防御，至下回合结束） |
| `ramming-speed` 撞击速度 | （后置，schema 占位）仅至近/近带；双方同时承受 2D6 不可减免伤害 |

### 4.2 战术（v1 保留：锁定 / 谨慎射击 / 紧急机动）

| 战术 | 效果 |
| --- | --- |
| `lock-on` 锁定 | 指定 1 敌主力舰/护航舰获得锁定；单目标攻击 +1 准度，结算后消耗；持续至下个弹着阶段 |
| `careful-fire` 谨慎射击 | 至下回合结束：己方攻击无法会心、无法将敌降至 0HP 以下（可瘫痪）；超重型/充能/酬载忽略 |
| `emergency-maneuver` 紧急机动 | 前进或后退 1 距离；受限 1（每交战一次） |
| `defensive-cover` 防御性掩护 | （后置，需护航内容） |

## 5. 事件 Schema

每个事件携带 `rngIndex`（该事件消费随机数前的索引）；无随机消费的事件沿用当前索引。
事件是公开事实记录，供回放 / 结算包 / 检定透明面板（M2-E）。

| 事件 | 载荷 | 随机 |
| --- | --- | --- |
| `engagement-started` | `engagementId, contentId, round, distance, battleGroups[]` | 无 |
| `round-started` | `round, phase: logistics` | 无 |
| `phase-advanced` | `from, to` | 无 |
| `turn-advanced` | `fromGroupId, toGroupId (null=行动阶段结束)` | 无 |
| `counter-tick` | `battleGroupId, weaponId, charge?, flight?, reload?` | 无 |
| `charged-fired` | `battleGroupId, weaponId, target?` | 命中 1d20 + 准度/难度 d6 |
| `charged-delayed` | `battleGroupId, weaponId` | 无 |
| `attack-resolved` | `attackerGroupId, weaponId, targetShipId, roll, accuracyBonus, difficultyPenalty, total, defense, hit, crit` | 1d20 + 准度 d6（取最高）+ 难度 d6（取最高） |
| `damage-applied` | `targetGroupId, targetShipId, gross, blocked, net, destroyed?, disabled?` | 伤害骰 + 阻滞骰 |
| `block-rolled` | `battleGroupId, blockDice, roll` | 阻滞 d6 |
| `maneuver-performed` | `battleGroupId, maneuver, distanceBefore, distanceAfter` | 撞击/含骰伤害机动除外无 |
| `tactic-performed` | `battleGroupId, tactic, target?` | 无 |
| `status-applied` | `battleGroupId, status, target?, until` | 无 |
| `status-expired` | `battleGroupId, status` | 无 |
| `retreat-declared` | `battleGroupId` | 无 |
| `surrender-declared` | `battleGroupId` | 无 |
| `ship-destroyed` | `battleGroupId, shipId` | 无 |
| `ship-disabled` | `battleGroupId, shipId` | 无 |
| `engagement-completed` | `outcome, survivorsRatio, battleGroups[]` | 无 |

## 6. 拒绝码（领域层）

| 码 | 语义 |
| --- | --- |
| `content_invalid` | 内容 schema 校验失败，无法建立交战 |
| `phase_mismatch` | 命令与当前阶段不符 |
| `forbidden_controller` | actorId 不指挥该战斗群 |
| `not_active_group` | 行动阶段非该战斗群回合 |
| `not_all_turns_ended` | advance-phase 时仍有战斗群未 end-turn |
| `critical_not_reached` | 未到第 5 轮不可撤退 |
| `cannot_retreat` | 至近带第 6 轮后不可撤退 |
| `limit_reached` | 受限 1 机动/战术已使用 |
| `no_valid_target` | 目标无效/不在射程/已破坏 |
| `command_invalid` | 其他非法命令（含已投降/已撤退后命令） |

## 7. RNG 固定消费序（确定性契约）

- RNG 复用 `packages/domain` 的 `createSeededRng`（同一算法，单一实现）。
- **消费次数与结果无关**：任何裁决按同一顺序消费，**伤害骰无论命中与否都掷**（未命中时丢弃结果），
  条件分支不得改变消费次数。攻击结算固定顺序：`1d20 命中骰 → 准度 d6（取最高）→ 难度 d6（取最高）→ 伤害骰 → 阻滞骰`。
- **拒绝不消费 RNG**：命令的全部前置校验（目标/射程/武器合法/回合归属）在创建 RNG 上下文前完成，拒绝路径零消费。
- 每个消费 RNG 的事件写入 `rngIndex`（该事件消费前的索引）；同一种子 + 同命令序列 ⇒ 同状态 + 同事件流（回放测试强制）。
- 存档 v2 持久化 `{ seed, index }`，加载后从该索引继续（见 ADR-006）。

## 8. 内容 Schema（引擎即内容消费者）

本草案只约束引擎接口。M2-B 负责具体目录与校验。引擎读取：

```text
BattleContent
├── contentId
├── battleGroups[]: { id, faction, flagship, ships[], escorts[], squadrons[], startingDistance }
Ship/Hull: { id, type, hp, defense, weapons[], systems[], blockBonus?, flag? }
Weapon:    { id, size: secondary/main/superheavy, tags: [charge:N|payload:N|reload:N|area|crit], damage, range }
```

沙盒夹具 `battle-sandbox-v1`（M2-A 测试用，纯自创抽象名）随引擎同仓提供。

### M2-B 内容与构筑（本轮实现）

- 精选目录 `packages/content/src/battle-catalog.ts`：船体（巡防/航母/战列）+ 武器（副/主/超重型）自创抽象名，每项带 `points`。
- 20 点构筑器 `buildBattleContent`：选目录船体/武器 → 校验（恰好 1 旗舰、≥2 主力舰、舰型上限 巡防≤3/航母≤2/战列≤1、总点 ≤20）→ 产出引擎可消费的 `BattleContent`。
- 旗舰加成在构筑层应用：+3 HP / +1 阻滞骰 / +1 系统槽。
- 人工验证：`npm run battle:sim` 控制台沙盒，固定种子跑整场交战并批量打印阶段/骰子/事件/战果（确定性可复现）。

## 9. 验收（M2-A 完成定义）

1. `start-engagement` → `advance-phase` 全轮次（logistics→ballistics→action→boarding→round+1）可确定性走通。
2. 机动/战术 v1 保留项全部可执行并产生可复现事件流。
3. 攻击结算按 §7 固定消费序；同种子同序列回放完全一致。
4. 撤退/投降/临界点/交战结果判定路径齐全，拒绝码确定。
5. 不变量检查（`checkInvariants`）在每次已接受转换后成立。
6. 门禁：`npm run verify:governance && npm run typecheck && npm run lint && npm run test && npm run build` 全绿。
