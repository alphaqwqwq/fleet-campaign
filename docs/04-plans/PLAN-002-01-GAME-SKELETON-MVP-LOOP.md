# PLAN-002-01：游戏骨架与最小可玩电子化循环

- 状态：Approved
- Master 委派：[PLAN-002 游戏骨架与最小可玩电子化循环](../00-governance/MASTER-ROADMAP.md)
- 责任边界：将已批准的 PLAN-002 阶段委派裁决为可执行的最小垂直切片范围、领域/协议/持久化/实时/网页边界、验收和 Exec 拆分；本 Plan 不实现代码、外部服务或真实游戏内容。

## 必读材料

- [Master 路线图与阶段交接](../00-governance/MASTER-ROADMAP.md)：PLAN-002 的已确认输入、硬边界、非目标、开放裁决与风险账本。
- [工作流](../00-governance/WORKFLOW.md)：Plan 职责、状态流转、事实记录、Exec 准入与止损条件。
- [项目文件管理方案](../00-governance/PROJECT-STRUCTURE.md)：workspace 包边界、依赖方向、Git 策略和固定 CI 门禁。
- [文档索引](../README.md)：文档优先级、公开资料边界和稳定路径要求。
- [PLAN-001：程序与发布自动化基础](PLAN-001-ROOM-PERSISTENCE-FOUNDATION.md)：已完成发布基础与不可重新裁决的发布/DNS 边界。
- [EXEC-001-04：正式入口发布与旧项目清理](../05-execs/PLAN-001/EXEC-001-04-PUBLIC-ENTRY-RELEASE.md)：`main` 发布基线、正式入口验收和遗留发布风险的结果证据。

## 当前基线

- 正式工程位于 `D:\workspace\deckgame\fleet-campaign`，公开仓库为 `alphaqwqwq/fleet-campaign`；React、TypeScript、Vite、Vitest、ESLint、GitHub Actions 与 Vercel 发布链路均已存在。
- `fleet.alphaqwq.xyz` 是已验证的正式入口；默认 `*.vercel.app` 域名在部分网络不可达，不能作为玩家入口或本 Plan 的可访问性依据。
- workspace 已预留 `domain`、`protocol`、`persistence`、`realtime`、`narration`、`content` 与 `web` 的职责边界，但游戏领域、协议、持久化、实时联机和旁白运行时模型尚未实现或裁决。
- 旧 `fleet-room` 已删除。其 PeerJS/WebRTC 临时房主、房间码、玩家/观战者和快照同步只能作为可行性输入，不能迁移其原型状态模型、内容或实现。
- 当前没有已批准的游戏 Exec；在本 Plan 获得批准前不得创建 Exec、修改应用代码、接入外部服务或执行发布写操作。

## 目标

- 裁决一个可由后续独立 Exec 实现与验证的最小电子桌游垂直切片：创建临时房间、加入房间、显示演示状态与回合、提交一次行动意图、由房主裁决并同步展示，以及本地保存/加载技术骨架。
- 明确领域状态、命令/事件、随机数、幂等、身份隔离、存档 Schema、传输适配与断线降级的初始契约，使规则结算不依赖 UI、网络、持久化或 LLM。
- 为后续 Exec 写出不可扩大范围的模块所有权、依赖方向、验收、回滚与止损边界；最后一个 Exec 结束后向 Master 回报 Gate 输入，不自行开启下一 Plan。

## 非目标

- 不实现完整《枪骑兵》规则、原作名称、数据、文案、美术、舰船、武器、AI 或自由战役生成。
- 不实现账号、云存档、常驻服务器、房主迁移、防作弊承诺、多人匹配、多地区部署或赛季运营。
- 不调用真实 LLM、不保存 API Key、不将旁白输出写回规则状态，也不将旁白作为规则、随机数、结算或胜负依据。
- 不修改已稳定的 GitHub/Vercel/DNS 发布流程、认证边界或正式域名；若其阻塞实现，停止并通过 ADR 或 Master/用户决定处理。

## MVP 实施边界

本 Plan 的 MVP 是“两个浏览器通过房间码进入同一临时会话，并完成一局可验证的抽象回合对抗”。它验证规则权威、命令同步、最小会话认证和本地战役档技术路径，不验证完整游戏内容或线上服务运营。

| 必须实现的玩法与交互 | 完成定义 |
| --- | --- |
| 建立房间 | 用户点击“创建房间”；浏览器成为房主，生成临时 `roomId`、本地 `campaignId` 与房主会话令牌；页面展示可复制、可手动输入的房间码和等待玩家状态 |
| 加入房间 | 第二位用户输入房间码并选择“玩家”或“观战者”；房主完成令牌/角色绑定后才下发完整快照；不存在、已关闭或连接失败的房间显示确定性错误和返回入口 |
| 最小对局 | 一名房主玩家和一名客机玩家轮流执行 `advance`；双方可见回合、行动方、行动点、双方 `integrity`、确认事件和胜者；观战者只看同一公开状态 |
| 房主裁决与同步 | 客机只能提交不含结果的行动意图；房主校验身份、角色、房间、幂等键和状态序列后结算；成功或拒绝结果及完整快照同步到所有已连接客户端 |
| 会话可观察性 | 页面持续显示当前角色、连接/同步状态、房间状态和最近操作反馈；非行动方、观战者、同步中或会话结束时，动作控件不可执行且协议仍会拒绝越权请求 |
| 本地战役档 | 房主可在已确认快照基础上保存、列出、加载、删除、导出与导入 `demo-v1` 战役档；导入损坏、未知版本或不兼容内容不覆盖既有档案 |
| 首发降级 | 客机断线后可使用有效令牌手动/有限重连并获得完整快照；房主关闭后明确结束房间，用户可保存现有本地档后新建房间，不提供房主迁移 |

| 明确不实现 | 不能以“骨架”名义混入 MVP |
| --- | --- |
| 完整玩法 | 地图、移动、距离、骰子、武器、舰船、AI、任务链、战役生成、原作规则/名称/数据/文案、美术和音频 |
| 在线服务 | 账号注册/登录、密码或第三方 OAuth、云存档、常驻后端、匹配大厅、邀请链接承载令牌、房主迁移、多地区部署、反作弊承诺和运营系统 |
| 叙事与商业能力 | 真实 LLM、API Key、自动旁白、聊天、支付、分析追踪或任何会写入规则状态的外部服务 |

### 房间码与最小会话认证

- 房间码是 `roomId`，只解决“连接到哪个临时房间”，不是密码、身份或授权凭据。它可以被用户复制/口述/手动输入，不能携带身份令牌，也不能单独赋予玩家或观战权限。
- 认证在本 Plan 中仅指房主签发并校验的本地临时会话令牌：房主创建或批准加入时，为绑定的 `roomId + clientId + role` 签发令牌；连接后的每条受保护消息均由该绑定关系校验。它防止普通客户端伪造席位、把观战身份提升为玩家，或向别的房间提交命令。
- 此认证不属于账号系统，也不能防止恶意房主、被控制的浏览器或主动泄露令牌；不承诺跨设备身份、密码找回、封禁、反作弊或安全审计。若产品需要上述能力，必须由后续 Plan 重新裁决认证模型。
- MVP 只允许一个房主席位和一个玩家席位；第一个成功选择 `player` 的加入者占用客机玩家席位，后续加入者只能选择 `spectator`。玩家席位已占用时的 `player` 请求返回 `player_seat_unavailable`，不得替换现有玩家。

## 依赖与责任边界

- `main` 必须始终可构建、可部署、可回滚；每个后续 Exec 在独立 feature 分支完成固定门禁、提交、PR、Preview 和结果记录后才可合并。
- 所有公开演示内容必须为自创或抽象测试内容。原作内容公开使用范围尚未核查，任何拟公开的原作名称、数据或文案须先单独取得许可裁决。
- 房间是临时会话，战役档是长期资产；`roomId`、`campaignId`、`clientId` 与玩家身份令牌必须分别定义生成方、作用域、存储位置、传输可见性与失效条件。
- 房主是单个临时会话内的权威裁判。客机只能提交经协议校验的命令意图；不得提交或覆盖伤害、骰子、资源、胜负、事件序列或快照结论。
- 发布入口继续使用 `https://fleet.alphaqwq.xyz`；默认 `*.vercel.app` 域名不可达风险不应阻塞本 Plan，但必须保留在最终验收风险中。

## 设计裁决

本节的契约是本 Plan 已批准的初始版本。除明确标为“已验证事实”的当前基线外，本节均为后续 Exec 必须实现和验证的设计裁决；任何改变均须先回到 Plan、Review 或 ADR。

### 演示循环与领域状态

- 最小切片固定为一场名为“演示遭遇”的抽象双阵营会话：房主创建临时房间并产生一个新战役档；一名玩家可加入，任意数量的观战者可只读加入；房主和玩家都看到同一回合、行动点、双方单位状态及已确认事件。
- 演示内容固定为 `host-unit` 与 `guest-unit` 两个抽象单位，各有 `integrity: 3`；每回合行动方有 `actionPoints: 1`。唯一改变状态的游戏行动是 `advance`：消耗 1 点行动点，使行动方对手的 `integrity` 减 1。它不含骰子、距离、武器、舰船、原作名称或原作数值。
- 房主创建的初始领域状态为 `phase: "awaiting-player"`、`round: 0`、`activeSeat: null`、两单位完整度均为 3、`winnerSeat: null`、事件序列为 0。至少一名玩家完成加入后，房主显式发出 `start-demo`，状态转为 `phase: "active"`、`round: 1`、`activeSeat: "host"`、行动点为 1。
- 在 `active` 阶段，当前行动席位只能提交自己的 `advance` 意图。房主对有效意图裁决 `action-confirmed`：目标完整度减 1；若目标仍大于 0，则转为另一个席位、将其行动点重置为 1，并在从 `guest` 转回 `host` 时将 `round` 加 1；若目标为 0，则转为 `phase: "completed"` 并设置行动方为 `winnerSeat`。`completed`、`closed` 与 `awaiting-player` 不接受 `advance`。
- 正常终止条件只有一方完整度归零；房主关闭、传输不可用、加入目标不存在及导入失败是会话/操作失败，不伪造为游戏胜负。房主关闭必须使本地会话进入 `closed`，并向已连接客户端广播可见的 `room-closed` 结果；不尝试房主迁移。

| 领域数据 | 真源与所有者 | 允许变更者 | 前置条件与转换 | 不变量 | 拒绝与测试 |
| --- | --- | --- | --- | --- | --- |
| `GameState` | 房主内存中的 `domain` 状态 | 仅纯领域 reducer，由房主应用 | 只接收已验证命令；按命令产生下一个状态和领域事件 | 不可变更新；不含 UI、连接、令牌、旁白或存储句柄 | 非法命令返回确定性领域拒绝；表驱动单元测试覆盖全部状态转换 |
| `phase/round/activeSeat/actionPoints` | `GameState` | `start-demo`、已确认 `advance` | 如上所述 | 非 active 时 `activeSeat` 为 `null` 且行动点为 0；active 时恰有一个行动席位且为 1 点 | 阶段不符或非当前席位为 `phase_mismatch`/`not_active_seat` |
| 单位 `integrity` 与 `winnerSeat` | `GameState.units` | 仅已确认 `advance` | 目标完整度大于 0 后才可扣减 | 完整度为 0–3 整数；仅 completed 可有 winner；winner 的对手完整度必须为 0 | 无目标、目标失效或完成后行动均拒绝；边界值单测 |
| `eventSequence` 与 `commandReceipts` | 房主应用服务管理的会话账本 | 仅房主应用服务 | 新接受命令分配下一个序列；同一幂等键重放既有收据 | 序列严格递增；同一 `clientId + idempotencyKey` 永远映射同一结果 | 重复命令返回原结果，不重复结算；重放单测 |

- `packages/domain` 是上述 `GameState`、纯命令 reducer、领域事件、确定性错误和随机数消费的唯一规则实现位置。它不得导入 React、浏览器 API、PeerJS、IndexedDB、LLM SDK、计时器或网络代码。
- `packages/content` 只导出经校验的 `demo-v1` 抽象初始模板和测试夹具；领域层通过显式内容输入创建初始状态，不能从 UI 或网络拉取内容。未来非抽象内容必须先经过独立公开许可裁决。
- 域层测试使用固定夹具验证初始状态、开始、轮换、胜负、每个拒绝码、输入不可变性和事件序列，不以组件或联机测试替代规则测试。

### 命令、事件与随机数

- `packages/protocol` 定义 `protocolVersion: 1` 的 TypeScript 类型与运行时 schema 校验。运行时校验库由 EXEC-002-01 在现有依赖中选择；若仓库没有适合的已批准库，Exec 必须采用无新增运行时依赖的最小校验器或回到 Plan，不得隐式引入库。
- 每个传输信封都有 `protocolVersion`、`messageId`、`roomId`、`senderClientId` 与 `kind`。`messageId` 仅用于传输诊断；服务端/房主不把它当作游戏命令幂等键。未知版本、未知字段语义或 schema 不合法的数据一律不进入领域层，返回 `protocol_invalid`（可安全回复时）或关闭该传输消息。
- 客户端上行命令为 `command-intent`：`{ protocolVersion, roomId, senderClientId, idempotencyKey, expectedEventSequence, command }`。`command` 初版仅为 `{ type: "start-demo" }` 或 `{ type: "advance" }`。`idempotencyKey` 由发起客户端以本地加密安全随机值生成，在同一次用户操作重试时复用；格式为 URL-safe 128-bit 随机字符串，最长 32 字符。
- 房主验证顺序固定为：协议 schema → 房间匹配 → 连接绑定的 `clientId` → 身份令牌/席位授权 → 幂等收据查询 → `expectedEventSequence` 与当前序列一致 → 领域前置条件。成功时先原子写入命令收据、递增事件序列、更新领域状态，再下行事件和快照；失败时不改变领域状态或序列。
- `expectedEventSequence` 是客户端所依据的最后已确认序列。若落后或超前，房主返回 `state_conflict` 与当前完整快照；客户端替换只读展示后由用户重新发起意图，不自动重放有业务含义的旧点击。
- 房主下行结果为 `command-result`：成功包含原 `idempotencyKey`、`accepted: true`、单个领域事件和结果快照；拒绝包含原键、`accepted: false`、稳定错误码、可展示的非机密文案键及当前序列。对已见收据，房主原样重放此前 `command-result`，包括此前的成功或拒绝。
- 广播事件使用 `{ protocolVersion, roomId, eventSequence, eventId, type, actorSeat?, publicPayload }`。初版事件类型限定 `demo-started`、`action-confirmed`、`demo-completed`、`room-closed`；`eventId` 由房主生成并仅作日志/渲染键，排序唯一依据为 `eventSequence`。没有客户端时间作为规则输入；可选 `emittedAt` 只用于展示和诊断，必须由房主生成且不参与结算。
- 完整快照为 `{ protocolVersion, roomId, campaignId, eventSequence, game, roster, visibility }`。`game` 是所有参与者可见的完整抽象状态；`roster` 只含 `clientId`、席位与角色，绝不含令牌；`visibility` 明示 `host`、`player` 或 `spectator`。首版无秘密状态，未来出现私有信息前必须升级协议和可见性模型。

| 错误码 | 触发点 | 房主行为 | 客户端体验 |
| --- | --- | --- | --- |
| `protocol_invalid` | schema/版本/字段非法 | 不进入领域层 | 显示通用传输错误，保留当前状态 |
| `room_not_found` / `room_mismatch` | 目标房间不存在或信封不匹配 | 不结算 | 显示房间不可用，返回建房/加入入口 |
| `identity_invalid` / `forbidden_role` | 令牌、连接绑定或观战权限无效 | 不结算 | 清除本房间会话并提示重新加入 |
| `state_conflict` | `expectedEventSequence` 不匹配 | 回传当前快照 | 替换展示，要求用户重新操作 |
| `phase_mismatch` / `not_active_seat` / `command_invalid` | 领域前置条件不满足 | 回传确定性拒绝 | 显示操作未执行，不乐观修改状态 |
| `room_closed` / `transport_unavailable` | 会话已结束或适配器不可用 | 不伪造成功 | 显示保存后新建房间的降级路径 |

- 随机数不参与 `demo-v1` 的 `advance` 结算；为避免以后由 UI 随机化，初版仍保留 `rng` 契约：战役创建时由房主生成 128-bit 种子，种子只留在房主内存及经确认的本地存档，不下发给客机或观战者；领域调用注入的确定性 `nextRandom`，每次消费生成一个带 `rngIndex` 的领域事件事实。
- 初版没有消耗随机数的命令，故所有 `demo-v1` 事件的 `rngIndex` 为 0，且不写伪随机结果。后续任何随机规则必须先在 Plan/ADR 中定义消费点、范围映射和事件公开范围；客机、UI、传输适配器、持久化和 LLM 均不得产生或决定随机结果。固定种子与同一命令序列必须在域层测试中复现相同状态和事件。

### 模块所有权与依赖方向

- 组合层定名为 `apps/web/src/application`，属于网页应用而非共享包。它是唯一可同时依赖 `domain`、`protocol`、`persistence`、`realtime`、`narration` 与 `content` 的位置，负责创建房主会话、把已校验命令送入域层、保存确认快照、编排传输和向 UI 暴露只读 view model。
- 依赖方向固定为 `content/fixtures → domain → protocol → persistence/realtime/narration → web/application → web/ui`。`protocol` 可引用领域公开类型的序列化投影，但 `domain` 不得引用 `protocol`；实现时若该投影导致反向依赖，应将共享的无行为数据定义下沉到 `domain` 的公开类型，不能由 `domain` 导入协议。

| 模块 | 可写责任 | 可依赖 | 明确禁止 |
| --- | --- | --- | --- |
| `content` | 自创/抽象模板、内容 schema 与夹具 | 无业务包 | 原作材料、传输、浏览器 API |
| `domain` | 规则状态、纯 reducer、领域事件、确定性 RNG 接口 | `content` 类型/值 | UI、协议实现、存储、网络、时间与 LLM |
| `protocol` | 版本化信封、schema、错误码、快照投影 | `domain` 公开类型 | React、PeerJS、IndexedDB、业务结算 |
| `persistence` | 版本化编码、迁移、导入校验、存储端口 | `protocol` | UI 组件调用、领域结算、令牌/连接状态持久化 |
| `realtime` | PeerJS/WebRTC 适配、连接状态与经校验消息收发 | `protocol` | 规则结算、快照篡改、身份授权决策 |
| `narration` | 已确认事实格式化、Hook 契约、手写降级文本 | `protocol` 公开事件 | 模型调用、密钥、规则写入或随机数 |
| `web/application` | 会话编排、授权检查、持久化调用、view model | 所有上述模块 | 在组件外泄露令牌、绕过协议/领域 |
| `web/ui` | 渲染、输入、可访问性、调用应用服务 | `web/application` | 直接修改状态、直接访问存储/传输 |

- 每个包只从其公开入口导入；不得用相对路径穿透其他包内部。跨包依赖、运行时 schema 库或新共享层若与上表不符，必须停止并更新本 Plan 或 ADR。

### 房间、身份与持久化

- `roomId` 由房主建房时生成，格式 `r_` 加 12 个 URL-safe 随机字符；它仅定位一个临时实时会话，存在于房主内存、加入输入与协议消息中，房主关闭/刷新且未恢复会话时失效，不写入导出包。
- `campaignId` 由房主创建战役档时生成，格式 `c_` 加 UUIDv4；它仅定位长期本地战役资产，存于本地存档和导出包，允许出现在快照中，但不作为房间码、连接端点或认证凭据。
- `clientId` 由每个浏览器首次使用时生成，格式 `u_` 加 UUIDv4；存于该浏览器的本地设备标识存储，可在多个临时房间中复用，用于命令归属和幂等收据范围；它不是账号，清除站点数据后会改变，导出包不含它。
- 身份令牌由房主在创建/成功加入房间时为“房间 + clientId + 角色”生成，格式 `t_` 加 256-bit URL-safe 随机值；只保存在该浏览器的会话存储与房主内存中的令牌哈希/关联记录，传输时仅在握手和后续受保护信封中出现，绝不放入 URL、快照、导出包、旁白事实、分析事件或公开日志。令牌在房主关闭、明确离开、同 clientId 被新令牌替换或会话存储清除后失效。
- 这套令牌只降低临时会话误操作和角色混淆，不构成账号、密码学防作弊、跨设备身份或对恶意房主的安全保证。房主必须将连接与令牌解析出的 `clientId`/角色绑定，不能信任命令体自报的席位或结果字段。
- 初版存档载荷为 `schemaVersion: 1` 的 `CampaignSave`：`{ schemaVersion, campaignId, contentId: "demo-v1", savedAt, gameSnapshot, rngState, migrationMetadata }`。仅当应用服务获得已确认完整快照后才写入；`savedAt` 是展示元数据，不能用于规则结算。`gameSnapshot` 不含 `roomId`、`clientId`、身份令牌、命令收据、连接状态、PeerJS 端点、外部凭据或旁白原始输入。
- 导出包是 UTF-8 JSON 的 `FleetCampaignSave` 包装：`{ format: "fleet-campaign-save", formatVersion: 1, save: CampaignSave }`。导入在写入前依次校验 JSON 大小上限、包装格式、已知版本、字段 schema、内容 ID、领域不变量和 RNG 状态；任一步失败都不覆盖当前存档，返回 `save_invalid`、`save_unsupported_version` 或 `save_incompatible_content`。
- 兼容策略为只读取同主版本的 v1；未来 schema 以 `migrateSave(fromVersion, raw)` 的显式迁移链升级，迁移在纯数据层完成后重新执行领域不变量校验。未知未来版本直接拒绝并保留原导入文件；损坏/不完整本地记录隔离并提示删除或重新导入，不自动猜测修复。首发不承诺云同步、跨设备恢复或旧原型兼容。
- `persistence` 通过存储端口提供 `save/load/list/delete/export/import`，具体 IndexedDB/浏览器实现由应用服务注入；UI 组件不得直接调用浏览器存储。当前房间的传输快照只用于同步，只有用户明确保存或房主选择保存后才成为战役档。

### 实时与降级体验

- 实时层首发采用 PeerJS/WebRTC 的可替换适配器，但 PeerJS 云信令可用性不是领域或存档前置条件。房主将 `roomId` 映射为当前临时 PeerJS 端点；加入者手动输入 `roomId` 与角色请求，不能由 URL 暴露身份令牌。若具体 PeerJS API、公共信令 SLA、依赖版本或浏览器兼容性与此契约冲突，EXEC-002-03 必须停止并回到本 Plan。
- 建连流程固定为：房主创建端点并进入 `awaiting-player` → 加入者请求 `player` 或 `spectator` → 房主生成并验证最小身份令牌、绑定角色 → 房主下发完整快照 → 后续客户端只上行 `command-intent`，房主只下行 `command-result`、有序事件与必要的完整快照。加入中断或 schema 失败时不得创建半授权席位。
- 重连仅表示同一 `clientId` 使用仍有效会话令牌重新建立传输；房主重新绑定连接并下发完整快照，不补发未经确认的本地点击。令牌失效、浏览器会话清除或房主已关闭时，显示为新加入/会话结束，不能声称恢复成功。
- 同一 `clientId` 的重复连接以最后一个通过令牌校验的连接为有效连接，旧连接被主动关闭并收到 `duplicate_connection` 的可观察状态；该规则不改变领域席位或事件序列。不同浏览器相同 `clientId` 的碰撞按身份冲突拒绝，不自动合并。
- 观战者可接收同玩家相同的公开快照和事件，但协议授权与应用服务均拒绝其 `start-demo`、`advance` 和所有未来改变状态命令为 `forbidden_role`；UI 同时不呈现可执行控制。隐藏按钮不是授权机制。

| 情况 | 适配器/应用服务行为 | 必须呈现的体验 | 恢复边界 |
| --- | --- | --- | --- |
| 房间不存在或房主不可达 | 连接超时或收到 `room_not_found` 后停止重试 | “房间不存在或已结束”，提供返回建房/重新输入 | 不创建本地伪房间 |
| 客机临时断线 | 标记 `reconnecting`，有限次数重连；成功后强制快照同步 | 保留最后确认状态并显示不可操作 | 不自动提交断线期间点击 |
| 重连失败/传输不可用 | 停止命令上行 | “无法连接房主”，提供退出与本地存档入口 | 房主仍在时可手动重试 |
| 房主关闭/刷新 | 广播 `room-closed`（可用时）并销毁端点 | “会话已结束”，提供保存后新建房间路径 | 无房主迁移、无原房间恢复承诺 |
| 快照或事件序列缺口 | 请求完整快照，拒绝应用乱序增量 | 显示同步中，完成前禁用动作 | 快照校验失败则退出会话 |

- 实时适配器只传递已通过 `protocol` 校验的数据；应用服务在调用领域 reducer 前再次执行角色、房间、令牌、幂等和序列检查。网络状态不属于 `GameState`，不得被序列化为规则结论。

### 旁白边界

- 最小垂直切片不接入 `narration` 运行时，也不建立真实 LLM、API Key 或网络调用。网页只为已确认领域事件显示手写的抽象结果文本。
- 为后续兼容保留但不要求实现的 Hook 契约：`promptId: "demo-event-summary"`、`promptVersion: 1`、触发点为确认的 `demo-started`、`action-confirmed`、`demo-completed`；输入只可为事件 ID、事件类型、回合、公开单位完整度和赢家席位；可见性与对应快照一致。
- 若未来实现该 Hook，其输出必须是 `{ promptId, promptVersion, eventId, text }`，并且手写降级文本始终可用。禁止断言任何未确认事实，禁止产生权限、随机数、资源、伤害、任务结果、胜负或规则状态；输出只可作为 UI 展示，不能回写 `GameState`、快照、存档或事件序列。

## 验收标准

- Plan 在批准前已明确最小演示循环的实体、前置条件、状态转换、不变量、错误处理与纯 TypeScript 测试策略。
- 命令、事件、快照、错误、幂等和随机数策略均有版本化初始契约，并明确房主与客机各自可写与只读的字段。
- 模块所有权与依赖方向能够防止 UI、网络、持久化与旁白绕过领域规则；每个模块的实现责任由后续 Exec 独立覆盖。
- 房间、战役、客户端和身份标识不混用；本地存档/导出 Schema、导入失败处理和迁移策略已裁决且可测试。
- 实时传输、观战、房主关闭和断线/重连拥有明确的首发降级体验；不将未验证的原型实现当作既成能力。
- 每个 Exec 已定义允许/禁止文件范围、依赖、自动化验证、人工验收、提交、回滚与结果记录；本 Plan 获批前不得创建这些 Exec 文档。获批后，Exec 文档必须先处于 Draft，再进入实现。
- 后续实现保持现有固定门禁 `npm ci`、`npm run typecheck`、`npm run lint`、`npm run test`、`npm run build`；正式网页验收以自定义正式入口为准。

### 自动 Review 与 Plan Gate

- 每个含应用代码的 Exec 必须在 PR 合并前由独立 `fleet-review` 会话完成代码级自动 Review。Review 至少核对目标文件范围、批准契约、跨包依赖、Schema/权限边界、测试断言、固定门禁、PR/CI/Preview 证据和回滚路径，并在 `docs/06-reviews/**` 写出 findings-first 结论；`pass` 才允许 Master 推进合并或下游依赖，`remediation required`、`blocked` 或 `contract escalation required` 均不放行。
- 用户人工验收集中到父 Plan Gate，不再作为纯领域、协议、持久化或其他可自动验证 Exec 的逐项准入条件。Exec 中原“人工验收”清单改作 Review 可执行的静态/自动浏览器核查；真实独立设备、移动网络、主观交互与产品方向由 EXEC-002-05 汇总成一次 Plan Gate 清单，用户明确验收前不得将本 Plan 标记完成。
- 只有不可逆外部操作、凭据/权限、未裁决契约变化，或必须由真实用户环境完成且会阻塞后续工作的前置验证，才能提前请求用户；缺少用户代码审查本身不阻塞后续纯代码 Exec。
- Exec 默认由 Flash 执行。Flash 对同一可复现问题完成一次有证据的可信修复后仍失败，或遇到 Review 失败、复杂跨包根因、止损条件或可能改变批准契约时，必须停止重复试错并向 Master 回报；Master 使用原 Exec 目标文档、`fleet-exec` Agent 和下一个会话序号 fork 给 Terra。Terra 仍受原文件范围、固定门禁和非目标约束，不能借补救扩大功能。

### 会话恢复与调度

- 未闭合 Plan、Exec 或 Review 由 Master 先查询包括归档在内的 OpenChamber 项目会话；存在标题正确且目标相同的会话时继续发送目标，不存在时才依据 `.opencode/SESSION-NAMING.md`、对应短提示词、专用 Agent 与指定模型创建。fork 也使用下一个真实序号。子会话不得调度下游会话或要求用户跨层转述结果。
- Master 读取目标文档、Git/PR/CI/部署和子会话结果后裁决依赖。Trae 历史只可作为待核对背景；本轮仓库文件名、提交信息和当前 OpenChamber 会话均未定位到可用 Trae 记录，因此不得据此补写完成事实。
- 本轮核验到同目标已有 `PLAN|P002-01+01` 至 `+05` 会话，其中部分仍未闭合；后续 Master 应恢复可用会话或明确废弃异常会话后再创建下一序号，不得把“已有会话未结束”解释为等待用户手工推动。

### 治理基线工作单元

`GOV-002-01-PLAN-EXEC-REVIEW-BASELINE` 是进入后续实现前的独立文档工作单元，不包含 `apps/**`、`packages/**`、基础设施、Master 路线图或 WORKFLOW 修改，也不声称提交当前工作树中的其他并行治理变更。

| 项目 | 固定合同 |
| --- | --- |
| 精确文件范围 | `docs/04-plans/PLAN-002-01-GAME-SKELETON-MVP-LOOP.md`；`docs/05-execs/PLAN-002/EXEC-002-01-DOMAIN-PROTOCOL-FOUNDATION.md`；`docs/05-execs/PLAN-002/EXEC-002-02-LOCAL-CAMPAIGN-PERSISTENCE.md`；`docs/05-execs/PLAN-002/EXEC-002-03-HOST-AUTHORITATIVE-REALTIME.md`；`docs/05-execs/PLAN-002/EXEC-002-04-WEB-VERTICAL-SLICE.md`；`docs/05-execs/PLAN-002/EXEC-002-05-INTEGRATION-REVIEW-RELEASE.md`；`docs/06-reviews/PLAN-002/REVIEW-002-01-DOMAIN-PROTOCOL-FOUNDATION.md` |
| 明确排除 | 当前工作树中所有其他已修改、删除或未跟踪文件，包括 `docs/00-governance/**`、`.opencode/**`、`docs/08-prompts/**`、`apps/**`、`packages/**` 和基础设施；不得顺手格式化或恢复这些文件 |
| 固定门禁 | 范围清单核对；相对 Markdown 链接存在性检查；`git diff --check -- <精确文件范围>`；确认 diff 不含游戏规则、`protocolVersion: 1`、存档 v1、房主权威、认证或公开授权语义变化 |
| 提交与 PR 责任 | 仅由 Master 明确派发的治理执行会话从最新 `origin/main` 建独立文档分支、仅暂存上列文件、提交、推送并创建治理 PR；Plan/Review 会话只产出合同和结论，本轮不提交、不推送、不创建或合并 PR |
| Review 与合并责任 | 独立 `fleet-review` 复核范围和链接/差异门禁；Master 核验 Review 与 CI 后决定是否交由具备合并授权的步骤合并，任何子会话不得自行合并 |
| 回滚责任 | 合并后由 Master 记录治理 PR 合并提交；需要撤销时由获授权执行会话 `git revert <治理合并提交>` 并走独立 PR，不改写共享历史 |
| 后续依赖 | `REVIEW-002-01` 可与治理 PR 并行调查，但其结论必须写入并纳入治理基线；`EXEC-002-02` 的代码依赖已因 EXEC-002-01 合并而满足，但只有治理基线 Review 通过且 Master 确认目标 Exec 范围后才进入 `In Progress`；EXEC-002-03 依赖同一治理基线和自身 Review 合同，EXEC-002-04/05 继续遵守既有合并依赖 |

## 风险、回滚与止损

- R-003：房主浏览器关闭后实时房间不可恢复。首发以明确会话结束、保存与新建房间的路径降级，不承诺迁移；任何试图加入迁移的需求须回到 Master/ADR。
- R-004：原作公开使用范围未核查。发现需要原作名称、数据、文案、美术或外部资料时立即停止相关工作，改用自创/抽象内容或请求用户许可裁决。
- 默认 `*.vercel.app` 的网络兼容问题保持为发布遗留风险；不得改用它作为玩家入口，也不得在未经 ADR 的情况下重构发布架构。
- 出现未裁决的存档迁移、事件协议、随机数、房主权威、LLM 边界、跨包所有权、认证模型或外部权限变化时，停止扩展并回到 Plan、Review、ADR 或 Master。
- 后续 Exec 的类型检查、lint、测试、构建、CI、Preview 或正式入口验收任一失败，必须保留真实证据并停止推进；同一问题两次仍无可信结论时不以猜测继续。
- Flash 一次可信修复仍失败后不得继续由 Flash 反复试错；由 Master fork 给 Terra，Terra 仍失败或要求改变已批准契约时标记阻塞并返回 Plan/Review/ADR 或用户裁决。
- 代码与文档变更使用 `git revert` 回滚，不改写共享历史；临时房间与本地演示存档必须允许用户删除或重新创建，但不得把不可恢复的外部资源操作纳入本 Plan。

## Exec 拆分

本 Plan 已批准，后续 Exec 必须按以下可独立验证的责任边界拆分并先建立 Draft 目标文档：

1. `EXEC-002-01-DOMAIN-PROTOCOL-FOUNDATION`：实现并测试演示循环的纯领域模型、命令/事件/快照初始契约、随机数与幂等；不接入网页、浏览器存储或实时网络。
2. `EXEC-002-02-LOCAL-CAMPAIGN-PERSISTENCE`：实现版本化本地存档、导入/导出与迁移失败处理；不接入实时网络或真实旁白。
3. `EXEC-002-03-HOST-AUTHORITATIVE-REALTIME`：在已批准协议上接入临时房主、加入、观战和同步传输，并实现断线/房主关闭降级；不扩展规则或引入账号/云服务。
4. `EXEC-002-04-WEB-VERTICAL-SLICE`：实现最小网页展示、意图提交、房主确认、同步反馈与本地存档操作，并完成浏览器验收；不绕过领域与协议层。
5. `EXEC-002-05-INTEGRATION-REVIEW-RELEASE`：整合已验证工作单元、执行端到端验收、记录正式入口发布证据与回滚；不新增功能或改变已裁决契约。

| Exec | 依赖 | 允许范围 | 禁止范围 | 必须验证与回滚 |
| --- | --- | --- | --- | --- |
| EXEC-002-01 | Plan Approved | `packages/content/**`、`packages/domain/**`、`packages/protocol/**`、对应测试与该 Exec 文档 | `apps/web/**`、`persistence`、`realtime`、真实旁白 | 领域/协议 schema、幂等和 RNG 复现测试；固定门禁；以该 Exec 的 Git 提交 revert |
| EXEC-002-02 | EXEC-002-01 已合并 | `packages/persistence/**`、其测试、必要的公开包入口与 Exec 文档 | 实时、UI、账号/云服务 | v1 往返、损坏/未知版本/迁移失败不覆盖测试；固定门禁；Git revert |
| EXEC-002-03 | EXEC-002-01 已合并 | `packages/realtime/**`、传输测试、必要应用服务接口与 Exec 文档 | 规则扩展、持久化实现、UI、美术、账号/常驻服务 | 协议校验、房主权威、观战拒绝、断线/关闭降级测试；固定门禁；Git revert |
| EXEC-002-04 | EXEC-002-01 至 03 已合并 | `apps/web/**`、必要应用组合、组件/浏览器测试与 Exec 文档 | 绕过共享包、发布/DNS、真实 LLM | 建房/加入/观战、一次行动、同步、保存/加载及无障碍可见状态；固定门禁、Preview 与正式入口浏览器验收；Git revert |
| EXEC-002-05 | EXEC-002-01 至 04 已合并 | 集成测试、仅为修复集成缺陷所必需的最小文件、结果记录与 Exec 文档 | 新功能、协议/规则扩张、发布架构变更 | 端到端矩阵、正式入口、CI/Preview 证据与风险汇总；任一失败停止；Git revert |

- 每个 Exec 在独立 `feature/exec-002-<序号>-<短名>` 分支中完成；不得把下一 Exec 的实现、未批准依赖或无关格式化混入提交。每个 Exec 的 Draft 文档还必须列出实际新增文件、精确自动化命令、人工验收脚本、PR/Preview 记录位置与回滚提交。
- 每个 Exec 的实现 PR 必须依赖对应独立自动 Review `pass`；Review 记录不是 Exec 自评，也不能由成功 CI、Preview 或生产 HTTP 200 替代。Review 发现可复现缺陷时回到原 Exec 会话修复；一次可信修复仍失败时由 Master fork Terra 补救会话。
- 需要独立 Review 的触发条件是：协议 v1 对外字段改变、引入新的运行时依赖、PeerJS/WebRTC 传输安全/兼容性结论变化、存档迁移策略变化，或 EXEC-002-05 发现跨包绕过。触发后不得自行放行，先创建对应 Review/ADR 的规划记录。

## 验收状态与结果记录

- 当前状态：Approved。用户已确认 MVP 实施边界，并批准 `demo-v1` 的确定性 `advance` 循环、初版 `protocolVersion: 1`/存档 v1、房主局部令牌模型、PeerJS/WebRTC 可替换适配器和无运行时旁白的范围裁决；已于 2026-08-08 创建后续 Exec Draft 文档与短提示词。批准不等于任何游戏、联机或存档实现已完成。
- 未验证项：现有 PeerJS/WebRTC 依赖版本、公共信令可达性、浏览器 IndexedDB 实现、跨浏览器断线行为和实际网页交互尚未调查或实现，必须由批准后的相应 Exec 以真实证据验证；不得提前陈述为可用能力。
- 后续准入：每份 Exec 必须保持 Draft，直至其依赖已经合并、允许/禁止文件范围与验证清单复核完成；不得因 Plan 已批准而跳过独立分支、固定门禁、PR、Preview、结果记录或止损条件。
- 当前 Git/PR/CI 事实（2026-08-11 核验）：`main` 与 `origin/main` 均为 `218be25`；EXEC-002-01 的 PR [#7](https://github.com/alphaqwqwq/fleet-campaign/pull/7) 已合并为 `bb86363`，对应 CI 与 Vercel Check 成功；PLAN-002 Plan、EXEC-002-02 至 05 及相关治理材料仍位于未提交工作树，不能陈述为已进入 Git 基线。
- EXEC-002-01 结果中的“人工验收”是实现会话的静态自查记录，不是用户人工验收或独立 Review。必须由 [REVIEW-002-01](../06-reviews/PLAN-002/REVIEW-002-01-DOMAIN-PROTOCOL-FOUNDATION.md) 校正并提供代码级放行结论；该 Review 不重做实现，也不因等待用户审查底层代码而阻塞 EXEC-002-02 的代码依赖。
- Plan 对话只将已发生、已验证的事实写入本节；设计假设、待用户决定项、失败项和未验证项必须显式标记。
- 所有 Exec 结束后，汇总关联提交、PR、CI、测试、浏览器验收、发布与遗留风险，回报 Master 进入 Gate Review；不得自行宣布 PLAN-002 完成或开启下一 Plan。
