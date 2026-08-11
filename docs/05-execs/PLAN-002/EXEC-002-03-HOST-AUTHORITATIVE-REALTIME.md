# EXEC-002-03：房主权威实时会话

- Plan：[PLAN-002-01：游戏骨架与最小可玩电子化循环](../../04-plans/PLAN-002-01-GAME-SKELETON-MVP-LOOP.md)
- 状态：Pushed
- 分支：`feature/exec-002-03-host-authoritative-realtime`
- 依赖：EXEC-002-01 已 Merged
- 影响域：临时房间 / 最小会话令牌 / PeerJS-WebRTC 适配 / 同步与降级

## 必读材料

- [PLAN-002-01](../../04-plans/PLAN-002-01-GAME-SKELETON-MVP-LOOP.md)：房间码、令牌、房主权威、观战、重连和关闭降级裁决。
- [EXEC-002-01](EXEC-002-01-DOMAIN-PROTOCOL-FOUNDATION.md)：已合并的领域与协议契约。
- [工作流](../../00-governance/WORKFLOW.md) 与 [项目文件管理方案](../../00-governance/PROJECT-STRUCTURE.md)。

## 目标

实现可替换的临时房主传输适配器及应用服务接口：通过 `roomId` 连接、签发最小会话令牌、绑定 `clientId + role`、上行命令意图、房主下行结果/事件/快照，并提供观战与断线降级。

## 非目标

- 不实现网页 UI、存档实现、完整玩法、账号、密码、OAuth、云服务、常驻服务器、匹配、房主迁移、反作弊或真实 LLM。
- 不扩张 EXEC-002-01 的领域和协议契约，不让实时层结算规则或篡改快照。
- 不把令牌放进 URL、日志、导出包或旁白输入。

## 允许范围

- `packages/realtime/**`：传输抽象、PeerJS/WebRTC 适配、连接状态与测试替身。
- 仅为传输编排所必需的 `apps/web/src/application/**` 无 UI 应用服务接口。
- 传输/应用服务测试、必要依赖和公开入口、本 Exec 文档与对应短提示词。

## 禁止范围

- `apps/web/src` 下的 UI 组件/样式、`packages/persistence/**`、`packages/narration/**`。
- 新游戏行动/内容、账号与云端认证、发布/DNS 变更、API Key/Secrets。

## 实施与验收

1. 实现房主创建端点、`roomId` 映射和玩家/观战请求；仅允许一个客机玩家席位，重复玩家请求返回 `player_seat_unavailable`。
2. 实现 `roomId + clientId + role` 绑定的临时令牌签发、存储边界和每条受保护消息的校验；不得信任客户端自报席位或结算结果。
3. 只允许客户端上行 `command-intent`；应用服务依次执行 schema、房间、连接、令牌、角色、幂等和序列检查，之后才调用领域 reducer；房主下行 `command-result`、事件和完整快照。
4. 实现观战只读：协议和应用服务均拒绝观战者状态命令为 `forbidden_role`，不依赖 UI 隐藏。
5. 实现重连完整快照同步、同 clientId 最后连接生效、旧连接关闭、房间不存在、传输不可用、序列缺口和房主关闭的确定性状态。
6. 用无网络测试替身验证协议校验、角色拒绝、重复命令、快照同步、重连、重复连接、房主关闭和不发生领域结算的错误路径；若 PeerJS/WebRTC 依赖/API/公共信令与 Plan 不兼容，记录证据并停止。
7. 执行固定门禁，成功后提交、推送、PR、CI、Preview 和结果记录。

## 自动 Review 与 Plan Gate

- 实现 PR 合并前由独立 `fleet-review`/Terra 审查传输包不实现游戏 reducer、不生成规则结论，并核对令牌不出现在 URL、测试快照、日志、导出数据或错误文案。
- 自动 Review 复核房主权威、观战拒绝、幂等、快照、重连/关闭测试、固定门禁、PR/CI/Preview 和回滚；可自动化双浏览器建连交 Browser 会话留证。只有 Review `pass` 才允许合并。
- 真实独立设备、移动网络和主观联机体验汇总到父 Plan Gate；环境不可执行时如实标为未验证，不以模拟成功替代。

## 回滚与止损

- 合并后使用 `git revert` 回滚；房间关闭不尝试迁移。
- PeerJS/WebRTC API、依赖、信令服务可达性、安全边界或浏览器兼容性需改变已批准契约时停止并回到 Plan/ADR。
- 任一门禁、传输测试或人工验证失败均保留证据并停止，不以本地模拟成功替代真实结论。
- Flash 一次可信修复仍失败、Review 失败或出现复杂跨包根因时，由 Master fork 原 Exec 给 `fleet-exec`/Terra；补救不得改变房主权威、认证或协议 v1。

## 结果记录

- 实际分支：`feature/exec-002-03-host-authoritative-realtime`。worktree 初建时基线错误指向 `defabe0`（缺少 EXEC-002-02 持久化合并），已 `git reset --hard origin/main` 校正到 `eb0e499`；分支无唯一提交且工作树干净，该校正未销毁任何工作。
- 依赖版本与传输可行性：新增运行时依赖 `peerjs@^1.5.5`（2026-08-11 由 npm registry 解析 `dist.tarball` 成功，`npm install` 与 `npm ci` 均通过）。peerjs 自带 `dist/types.d.ts` 与 ESM `dist/bundler.mjs`；`import('peerjs')` 在 Node 24 下可加载不崩溃，ESM 仅默认导出（named 类型仅用于类型）。API 与 Plan 契约兼容：房主接受多条 `DataConnection`、客户端按 `roomId` 确定性映射拨号、DataConnection 有序可靠；房主端点 id 用 `fc-` + roomId 的十六进制编码映射以符合 PeerJS id 首尾字母数字约束。公共信令与真实浏览器建连未在本环境验证，按 Plan 留待 EXEC-002-04/05，不以模拟成功替代。
- 实现裁决（均在已批准契约内，未改变 protocol v1 或领域公开契约）：
  1. `state_conflict` 的完整快照通过已批准的独立 `snapshot` 下行帧发送；被拒 v1 `command-result` 保持原字段不变。
  2. 单个终局命令产生的多个领域事件逐条广播并分别分配严格递增的事件序列，`command-result` 携带第一个事件与最终完整快照；`expectedEventSequence` 与账本当前序列一致后才进入领域 reducer。
  3. 加入握手使用传输级错误码（`player_seat_unavailable`、`room_not_found` 等），不扩张 protocol v1 的 `PROTOCOL_ERROR_CODES`。
- 令牌与安全：令牌 `t_` + 256-bit URL-safe 随机值（无填充 base64url 43 字符）；房主绑定只保存 `sessionTokenFingerprint`（确定性十六进制摘要）与 `roomId + clientId + role + connectionId` 关联，不保存客机明文令牌。每条受保护 `command-intent` 帧携带令牌并逐条校验：帧 `clientId` === 绑定 `clientId` === `intent.senderClientId`，`connectionId` === 绑定连接，令牌摘要匹配；席位与角色只来自绑定，不信任自报字段；令牌不进入 URL、日志、快照、导出包或错误文案。
- 测试证据（无网络替身）：`MemoryHostTransport`/`MemoryClientTransport` 与 PeerJS 适配器共用 `validateInboundFrame`/`validateOutboundFrame`，测试与真实适配器帧校验行为一致。12 个测试文件 184 用例通过，覆盖：外层帧 schema 校验、加入握手、唯一玩家席位（`player_seat_unavailable`）、观战只读（`forbidden_role`）、令牌/身份/绑定拒绝（`identity_invalid`）、`room_mismatch`、`protocol_invalid`、幂等重放不重复结算、`state_conflict` + 完整快照、重连完整快照、同 clientId 最后连接生效 + 旧连接 `duplicate_connection`、房主关闭广播（`room-closed`）、关闭后命令（`room_closed`）、传输不可用、客户端不暴露令牌。
- 固定门禁（2026-08-11 本地串行）：`npm ci`、`npm run typecheck`、`npm run lint`、`npm run test`（12 文件 184 用例）、`npm run build` 全部通过。
- 提交 / PR / CI / Preview：实现提交 `1b3a775`，结果记录与短提示词提交 `c342cfe`、`21008a3`、`e64c0e7`、`9d71e86`（分支头 `9d71e86`，均基于 `eb0e499`，已推送 `feature/exec-002-03-host-authoritative-realtime`）；PR [#13](https://github.com/alphaqwqwq/fleet-campaign/pull/13) 于 2026-08-11 创建，base 为 `main`，状态 OPEN 且 mergeable。最终头 CI verify [SUCCESS](https://github.com/alphaqwqwq/fleet-campaign/actions/runs/31471802203/job/93716538294)，Vercel deployment [SUCCESS](https://fleet-campaign-76ah4429q-alphaqwqwq114514.vercel.app)。本 Exec 不改变发布入口，正式入口验收不属于本 Exec。
- 自动化与人工联机验收：真实浏览器、公共信令建连与主观联机体验未在本环境执行，按 Plan 汇入父 Plan Gate；无网络替身与本地门禁成功不替代真实结论。
- 遗留风险与对父 Plan 验收的影响：`sessionTokenFingerprint` 为确定性非加密摘要，作用仅为避免房主内存保留明文令牌，令牌熵为 256-bit 使预像不可行；未来若需密码学 verifier 应改 SHA-256。浏览器会话存储保留令牌与 `clientId` 的恢复接线、真实 PeerJS 建连与公共信令可达性留待 EXEC-002-04/05。观战者出现在公开 roster 中席位记为 `guest`（v1 schema 仅允许 host/guest 席位），语义待网页验收确认。
