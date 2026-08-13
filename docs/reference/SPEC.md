# 产品规格（现行契约）

- 状态：现行（2026-08-13，提取自旧 PLAN-002-01 设计裁决，已对照代码核验）
- 代码是最终真源；本节与代码冲突时以代码为准，并应更新本节或补 ADR。

## 演示循环 demo-v1

两个浏览器通过房间码进入同一临时会话，完成一局可验证的抽象回合对抗。抽象单位 `host-unit` / `guest-unit`，初始 `integrity: 3`；每回合行动方 `actionPoints: 1`。唯一改变状态的命令是 `advance`：消耗 1 点，使对手 `integrity -1`。

- 状态转换（见 `packages/domain/src/reducer.ts`、`types.ts`）：
  - 初始：`phase: awaiting-player`，`round: 0`，`activeSeat: null`，双方 `integrity: 3`。
  - 房主 `start-demo` → `phase: active`、`round: 1`、`activeSeat: host`、行动点 1。
  - `advance`：目标归零 → `phase: completed`、设置 `winnerSeat`（事件 `action-confirmed` + `demo-completed`）；否则切换行动席、从 guest 转回 host 时 `round +1`。
  - `completed` / `closed` / `awaiting-player` 不接受 `advance`。
- 领域事件：`demo-started`、`action-confirmed`、`demo-completed`；`rngIndex` 初版恒为 0（无随机消费点）。
- 领域拒绝码：`phase_mismatch`、`not_active_seat`、`command_invalid`。
- 房主关闭 / 传输不可用 / 加入失败是会话失败，不伪造为游戏胜负。

## 协议 v1（`packages/protocol/src`）

- `PROTOCOL_VERSION = 1`。
- 信封公共字段：`protocolVersion / messageId / roomId / senderClientId / kind`。`messageId` 仅传输诊断，不是幂等键。
- 上行 `command-intent`：`{ idempotencyKey, expectedEventSequence, command }`，`command` 限 `start-demo | advance`，不含结果。
- 下行 `command-result`：成功含原 `idempotencyKey`、`accepted: true`、单个领域事件 + 结果快照；拒绝含稳定错误码 + 当前序列。幂等重放返回原结果。
- 广播事件：`{ eventSequence, eventId, type, actorSeat?, publicPayload }`；`eventSequence` 是唯一排序依据。
- 完整快照 `Snapshot`：`roomId / campaignId / eventSequence / game / roster / visibility`；`roster` 绝不含令牌；`visibility` 为 `host | player | spectator`。
- 错误码：`protocol_invalid / room_not_found / room_mismatch / identity_invalid / forbidden_role / state_conflict / phase_mismatch / not_active_seat / command_invalid / room_closed / transport_unavailable`。
- 房主验证顺序固定：协议 schema → 房间 → 连接绑定的 clientId → 令牌/席位 → 幂等收据 → `expectedEventSequence` → 领域前置条件。

## 身份与存档（`packages/persistence/src/types.ts`）

| 标识 | 格式 | 作用域 | 是否入存档 |
| --- | --- | --- | --- |
| `roomId` | 5 位数字（10000–99999，`\d{5}`） | 临时房间，仅房主内存与消息；中继按 roomId 建房间日志，房主关闭或 1h TTL 后释放，复用码会先清空旧日志 | 否 |
| `campaignId` | `c_` + UUIDv4 | 长期战役资产 | 是 |
| `clientId` | `u_` + UUIDv4 | 浏览器本地设备标识 | 否 |
| 会话令牌 | `t_` + 256-bit | 房主为「房间+clientId+角色」签发，仅会话存储 | 否（绝不入 URL/快照/日志） |

- 存档 `CampaignSave`：`schemaVersion: 1` + `{ campaignId, contentId, savedAt, gameSnapshot, rngState, migrationMetadata }`。
- 导出包 `FleetCampaignSave`：`{ format: "fleet-campaign-save", formatVersion: 1, save }`（UTF-8 JSON，导入上限 1 MB）。
- 导入依次校验大小 → 包装格式 → 版本 → schema → 内容 ID → 领域不变量 → RNG 状态；任一步失败不覆盖现有档案，返回 `save_invalid / save_unsupported_version / save_incompatible_content`。
- 迁移：只读同主版本 v1；未来用显式 `migrateSave(fromVersion, raw)` 链升级。

## 实时与降级（`packages/realtime/src`）

- 传输抽象 `HostTransport` / `ClientTransport` + 帧校验；默认 **Vercel 轮询中继**（ADR-005：同源 `/api/relay` 函数 + KV，HTTP 轮询，无 WebSocket/NAT/外部信令依赖），`MemoryHostTransport` 为无网络测试替身，PeerJS 适配为 `?transport=peerjs` 备选。
- 中继只存转发帧、不解析不裁决（房主仍是唯一权威）；每房间追加式日志 + 游标轮询，默认 500ms。
- 建连：房主建端点 → 加入者请求 `player | spectator` → 房主签发令牌绑定角色 → 下发完整快照 → 后续只走 `command-intent` / `command-result`。
- 重连 / 返回 = 同一 `clientId` 重新加入（可无令牌）：房主角色锁定、重绑连接并**换发新令牌**；只有房主无该 clientId 绑定（房主重启 / 新房间）时才视为令牌失效 → 按新加入处理。房主关闭视为会话结束。
- 重复连接：以最后通过令牌校验的连接为有效，旧连接收到 `duplicate_connection`。
- 观战：收同玩家公开快照与事件，但协议与应用服务拒绝其任何改变状态命令（`forbidden_role`）。
- 房主关闭：广播 `room-closed`（可用时）并销毁端点；提供"保存后新建房间"降级，无房主迁移。
- 时序一致性：房主单写者 + `eventSequence` 全序 + `expectedEventSequence` 乐观并发 + 幂等键；轮询只增加传播延迟（亚秒级），不引入冲突。

## 叙事边界

- 首版无旁白运行时（`packages/narration` 未实现，不占 workspace）。
- LLM / 旁白是可删除、可降级的叙事表现层：只写已确认事实 + 手写降级文本，不写回规则状态，不产生权限/随机数/资源/胜负。见 [ADR-003](../decisions/ADR-003-NARRATION-NON-AUTHORITATIVE.md)。

## M1 网页切片验收（下一个 feature）

- 建房：生成 `roomId/campaignId/令牌`，展示可复制房间码与等待状态。
- 加入：输房间码 + 选角色；房主令牌/角色绑定后才下发快照；房间不存在/已关闭显示确定性错误。
- 最小对局：host 与 guest 轮流 `advance`；双方可见回合/行动方/行动点/双方 `integrity`/确认事件/胜者；观战者只看同一公开状态。
- 本地存档：房主在已确认快照上保存 / 列出 / 加载 / 删除 / 导出 / 导入 `demo-v1` 档；导入损坏不覆盖。
- 降级：客机断线可凭有效令牌手动重连拿快照；房主关闭 → "会话已结束" → 保存后新建房间。
