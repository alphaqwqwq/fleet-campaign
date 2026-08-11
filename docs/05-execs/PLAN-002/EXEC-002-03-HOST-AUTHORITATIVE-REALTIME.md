# EXEC-002-03：房主权威实时会话

- Plan：[PLAN-002-01：游戏骨架与最小可玩电子化循环](../../04-plans/PLAN-002-01-GAME-SKELETON-MVP-LOOP.md)
- 状态：Pushed / remediation required
- 下一动作：关闭 REVIEW-002-03 的两个 P1 与一个 P2 finding，串行重跑固定门禁并更新 PR #13。
- 证据：PR #13 head `c787a95`；verify、Vercel、Preview Comments 成功；独立 Review 不放行。
- 基线：`origin/main` `eb0e499` → PR #13 `c787a95`；Review 固定 head `f0509cd`。
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

- 实际分支：`feature/exec-002-03-host-authoritative-realtime`，当前 head `c787a95`。
- 依赖版本与传输可行性：`peerjs@^1.5.5` 与无网络 memory transport 已实现；公共信令和真实浏览器建连仍未验证。
- 提交 / PR / CI / Preview：PR #13 Open 且 mergeable；当前 head 的 verify、Vercel 与 Preview Comments 成功。
- 自动化与人工联机验收：此前固定门禁为 12 文件、184 用例通过；该证据早于 Review 补救，补救后必须重跑。真实浏览器/公共信令留待后续 Browser。
- 遗留风险与对父 Plan 验收的影响：Review 要求显式 leave 撤销 token、移除 realtime→domain 依赖，并补终局双事件广播断言；当前不满足合并或 EXEC-002-04 准入。
