# EXEC-002-04：网页最小垂直切片

- Plan：[PLAN-002-01：游戏骨架与最小可玩电子化循环](../../04-plans/PLAN-002-01-GAME-SKELETON-MVP-LOOP.md)
- 状态：Draft
- 分支：`feature/exec-002-04-web-vertical-slice`
- 依赖：EXEC-002-01、EXEC-002-02、EXEC-002-03 均已 Merged
- 影响域：网页应用服务接线 / MVP 界面 / 浏览器验收

## 必读材料

- [PLAN-002-01](../../04-plans/PLAN-002-01-GAME-SKELETON-MVP-LOOP.md)：MVP 玩法交互、可观察状态、认证边界和正式入口验收要求。
- [EXEC-002-01](EXEC-002-01-DOMAIN-PROTOCOL-FOUNDATION.md)、[EXEC-002-02](EXEC-002-02-LOCAL-CAMPAIGN-PERSISTENCE.md)、[EXEC-002-03](EXEC-002-03-HOST-AUTHORITATIVE-REALTIME.md)：已合并包的公开接口与结果限制。
- [工作流](../../00-governance/WORKFLOW.md)、[项目文件管理方案](../../00-governance/PROJECT-STRUCTURE.md) 与 [网页发布 CI/CD 全流程经验手册](../../00-governance/RELEASE-CICD-PLAYBOOK.md)。

## 目标

在不绕过领域、协议、持久化和实时应用服务的前提下，交付可由两浏览器操作的 MVP 页面：建房、输入房间码加入、选择玩家/观战者、轮流 `advance`、同步反馈、房间关闭/重连提示及本地存档操作。

## 非目标

- 不修改游戏规则、协议 v1、存档格式或实时认证语义。
- 不实现原作内容、美术素材、地图、AI、聊天、账号/云服务、真实 LLM 或发布/DNS 架构改动。
- 不让组件直接访问 IndexedDB、PeerJS/WebRTC、领域 reducer 或快照写接口。

## 允许范围

- `apps/web/**`：`application` 编排、React UI、样式、组件/浏览器测试与可访问性实现。
- 为消费已合并公开包所必需的根/网页配置、测试文件及本 Exec 文档；会话使用通用 Exec 模板。

## 禁止范围

- `packages/domain/**`、`packages/protocol/**`、`packages/persistence/**`、`packages/realtime/**`、`packages/narration/**` 的契约或实现变更。
- GitHub/Vercel/DNS、账号/云服务/机密信息、真实 LLM 和范围外功能。

## 实施与验收

1. 实现入口页：创建房间、输入房间码、选择玩家/观战者、复制房间码和退出/新建房间入口；房间码不得包含令牌。
2. 通过 `web/application` 调用已合并服务，渲染角色、房间、连接/同步、回合、行动方、行动点、双方完整度、最近确认事件与胜者。
3. 实现 `start-demo` 与 `advance` 交互。动作仅在当前玩家、已同步、active 状态可操作；禁用展示不替代应用服务/协议授权。
4. 实现房间不存在、席位占用、越权、状态冲突、传输不可用、重连中、重连失败和房主关闭的确定性可见反馈。
5. 实现房主存档列表、保存、加载、删除、JSON 导入/导出；导入失败显示稳定错误且不替换当前页面状态。
6. 编写组件/应用服务测试，覆盖关键可见状态和禁止操作；执行两浏览器人工流程：建房、加入、观战、完整对局、保存/加载、关闭房主、重连。
7. 执行固定门禁；完成 PR/CI/Preview 后，以 `https://fleet.alphaqwq.xyz` 完成浏览器验收，记录 HTTP、关键 DOM、控制台、网络请求与不可验证项。

## 自动 Review 与 Plan Gate

- 实现 PR 合并前由独立 `fleet-review`/Terra 核对组件不绕过应用服务、观战/身份授权、错误状态、固定门禁、PR/CI/Preview 和回滚；Browser 自动化验证两浏览器从建房到胜负、观战只读、断线/关闭降级、控制台和关键网络请求。
- 自动验收证据必须区分 Preview 与正式入口，且不使用默认 `*.vercel.app` 作为可访问性结论。只有 Review `pass` 才允许合并。
- 用户只在父 Plan Gate 集中验收真实独立设备、移动网络、交互可理解性和玩法主观体验；自动 Browser 证据不能替代该 Gate。

## 回滚与止损

- 合并后使用 `git revert` 回滚。
- 发现需改变领域/协议/存档/传输契约、引入真实旁白、发布认证或外部服务时停止并回到 Plan/ADR。
- 固定门禁、浏览器控制台、关键网络请求、Preview 或正式入口验收任一失败时，不合并并保留证据。
- Flash 一次可信修复仍失败或 Review 判定需复杂补救时，由 Master fork 原 Exec 给 `fleet-exec`/Terra；不得借补救修改游戏规则、协议 v1、存档 v1、认证或发布架构。

## 结果记录

- 实际分支：未开始。
- 提交 / PR / CI / Preview：未开始。
- 自动化验证：未开始。
- 浏览器与正式入口验收：未开始。
- 遗留风险与对父 Plan 验收的影响：未开始。
