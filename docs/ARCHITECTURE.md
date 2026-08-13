# 架构与包边界

- 状态：现行（2026-08-13，源自旧 PLAN-002 模块所有权裁决）
- 依赖方向：`content → domain → protocol → persistence/realtime → web(application/ui)`

## 包职责

| 包 | 职责 | 可依赖 | 明确禁止 |
| --- | --- | --- | --- |
| `packages/content` | demo-v1 内容模板与校验（`demo-v1.ts`） | 无业务包 | 原作材料、传输、浏览器 API |
| `packages/domain` | 纯规则：`GameState`、`reduceCommand`、`ledger`、`rng` | `content` 类型 | UI、协议实现、存储、网络、时间、LLM |
| `packages/protocol` | protocol v1：信封、命令意图、结果、快照投影、错误码 | `domain` 公开类型 | React、PeerJS、IndexedDB、业务结算 |
| `packages/persistence` | 存档 v1：编码、导入导出校验、迁移、存储端口 | `protocol` | UI 调用、领域结算、令牌/连接持久化 |
| `packages/realtime` | 传输抽象：`HostTransport`/`ClientTransport`、帧校验、令牌；PeerJS 适配 + 内存替身 | `protocol` | 规则结算、快照篡改、身份授权决策 |
| `apps/web/src/application` | 组合层（**唯一**可多包依赖处）：`host-session`/`client-session` 编排、授权检查、持久化调用 | 上述所有包 | 在组件外泄露令牌、绕过协议/领域 |
| `apps/web/src/ui` | 渲染、输入、可访问性 | `application` | 直接改状态、直接访问存储/传输 |

## 关键不变量

- `domain` 不得导入 `protocol`；协议只能引用领域公开类型（如 `GameState`）。
- 每个包只从其公开入口导入，不得用相对路径穿透其他包内部。
- 应用服务在调用领域 reducer 前，必须再次执行角色、房间、令牌、幂等、序列检查；传输只传已通过 `protocol` 校验的数据。
- 网络状态不属于 `GameState`，不得被序列化为规则结论。

## 数据流（一次行动）

```
UI intent → client-session 组装 command-intent → 传输（PeerJS/内存）→
host-session: 帧校验 → 房间/令牌/幂等/序列检查 →
domain.reduceCommand → 账本记录 → 投影 Snapshot → 广播 command-result + 事件
```

## 测试策略

- `domain`/`protocol`/`persistence`：表驱动单元测试，固定夹具复现状态与事件。
- `realtime`：`MemoryHostTransport` 无网络验证协议校验、角色拒绝、幂等重放、重连、房主关闭。
- `application`：host/client-session 集成测试走内存传输。
- 浏览器验收：真实 PeerJS 双浏览器走通一次行动循环。
