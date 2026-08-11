# EXEC-002-03：房主权威实时会话

- Plan：[PLAN-002-01：游戏骨架与最小可玩电子化循环](../../04-plans/PLAN-002-01-GAME-SKELETON-MVP-LOOP.md)
- 状态：Verified / awaiting independent re-review
- 下一动作：Master 提交 PeerJS leave 确认补救并推送，冻结新 head 对最后 P1 聚焦复审。
- 证据：首轮三项 finding 已关闭；复审发现 PeerJS send 后立即 close 的交付竞态，现由 `leave-accepted` 确认、超时保留连接和可重试确认闭环。定向 61 项、全量 190 项及固定门禁通过。
- 基线：已合入 `origin/main` `69e4fe6` 的 Workflow V2；补救前 PR #13 head `c787a95`，首轮 Review 固定 head `f0509cd`；补救提交 `3e2e213` 已推送。
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
- 传输/应用服务测试、必要依赖和公开入口及本 Exec 文档；会话使用通用 Exec 模板。

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
- Review 的局部 finding 先回原 Exec 完成一次可信修复；仍失败、出现复杂跨包根因或可能改变契约时才创建 Terra 补救。补救不得改变房主权威、认证或协议 v1。

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
- 提交 / PR / CI / Preview：实现提交 `1b3a775`，结果记录提交 `c342cfe`、`21008a3`、`9d71e86`、`c787a95`，均基于 `eb0e499` 并已推送 `feature/exec-002-03-host-authoritative-realtime`；专用短提示词曾由 `e64c0e7` 恢复，现随 Workflow V2 合并淘汰。PR [#13](https://github.com/alphaqwqwq/fleet-campaign/pull/13) 于 2026-08-11 创建，base 为 `main`，状态 OPEN 且 mergeable。`c787a95` 的 verify、Vercel 与 Preview Comments 均成功。本 Exec 不改变发布入口，正式入口验收不属于本 Exec。
- 自动化与人工联机验收：真实浏览器、公共信令建连与主观联机体验未在本环境执行，按 Plan 汇入父 Plan Gate；无网络替身与本地门禁成功不替代真实结论。
- 遗留风险与对父 Plan 验收的影响：`sessionTokenFingerprint` 为确定性非加密摘要，作用仅为避免房主内存保留明文令牌，令牌熵为 256-bit 使预像不可行；未来若需密码学 verifier 应改 SHA-256。浏览器会话存储保留令牌与 `clientId` 的恢复接线、真实 PeerJS 建连与公共信令可达性留待 EXEC-002-04/05。观战者出现在公开 roster 中席位记为 `guest`（v1 schema 仅允许 host/guest 席位），语义待网页验收确认。
- Review 补救状态：REVIEW-002-03 要求显式 leave 撤销 token、移除 realtime→domain 依赖，并补终局双事件广播断言；以上证据均早于补救，修复后必须重跑固定门禁。当前不满足合并或 EXEC-002-04 准入。
- Review 补救结果（2026-08-11）：
  1. 新增外层 `leave-request`/`leave-accepted` 帧及严格校验；客户端显式关闭时发送受保护 leave，房主仅在 `roomId + clientId + connectionId + token` 全部匹配后删除 binding 并确认撤销。客户端收到确认后才关闭 PeerJS；超时保持连接供重试。房主为已撤销 token 保留会话内指纹，使确认丢失后的重复 leave 可再次确认，同时旧 token join 仍为 `identity_invalid`。纯传输断线仍保留 binding并允许旧 token重连。
  2. realtime 的 seat 类型改由 protocol Snapshot 公开投影派生，删除源码与 package manifest/lockfile 中 realtime 对 domain 的直接依赖；未移动 reducer、事件生成或规则结算。
  3. 终局测试断言玩家和观战者均按 sequence 6/7 收到 `action-confirmed`、`demo-completed`，result 只带首事件，最终 snapshot 为 `completed` 且 winner 为 host。
- 补救验证（2026-08-11 本地串行复跑）：`npm ci`、`npm run verify:governance`（32 个 Markdown）、定向 5 文件 61 用例、`npm run typecheck`、`npm run lint`、全量 `npm test`（12 文件 190 用例）、`npm run build`、`git diff --check` 均通过。
- 提交与工作树状态：首轮补救已由 Master 提交并推送为 `3e2e213`；PeerJS 确认竞态补救与成对 memory/超时断言待本轮提交后冻结新 head。
- 会话证据：`EXEC|E002-03+03+实时会话Review补救` 因当前 OpenChamber 未重载已合并 Agent 配置且 build 会话无 Assistant/Git 产出，由普通 Master 依据 Workflow V2 接管；该执行器故障不计作 Flash 失败，未创建 Terra 会话。
