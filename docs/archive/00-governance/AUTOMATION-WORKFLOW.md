# 自动化工作流 V2

- 状态：生效
- 适用范围：Master 调度、短目标子会话、Review、PR/CI、Browser 和资产回收

## 真源与控制面

- 仓库文档是决策和交接真源；Git、GitHub、Vercel 与 Browser 记录是完成证据；会话不是状态载体。
- Master 使用普通会话，不使用覆盖整个 Plan 的 Goal Mode。Plan 总目标由路线图状态机维护。
- 子会话只承担一个有界目标，允许以 `Pushed`、`pass`、`remediation required` 或有证据的 `Blocked` 结束。
- `session.status/messages` 只确认派发和运行，不作为完成判据；`idle` 且无 Git/文档证据等于未完成。

## 单写者租约

- 任一 worktree 同一时刻只有一个写者。路线图活动表记录会话、worktree、分支、PR/head 和下一动作。
- Master 不与 Exec 并发编辑功能 worktree。Review 从固定 PR head 建 detached worktree，只审不修，只写指定 `docs/06-reviews/**` 报告。Review 释放租约后，普通 Master 将报告原样复制到 feature PR并提交，使结论进入 Git 真源；不创建证据收尾会话。
- 子会话 idle 且无新增证据时释放租约；状态不明时先检查 Git，不重复发送消息制造并发。

## Goal Mode

- Goal Mode 只用于有界 Exec、Review 或 Browser 任务，不用于长期 Master 或整个 Plan。
- Goal 必须声明成功、Review 不通过、有证据阻塞三类终态，并禁止自行推进下游工作。
- 同一目标同一时刻最多一个活动 Goal。旧 Goal 仍为 `active` 时禁止创建接替 Goal。
- Goal 卡在评估/retry 时先在 OpenChamber 暂停；确认 `paused + idle` 后才能归档或创建替代会话。归档本身不等于停止 Goal。

## 会话与资产预算

- 每个 Exec 默认一个 EXEC 会话和一个 REVIEW 会话；局部 finding 回原 EXEC 会话修复，只有真实升级条件满足时才增加一个 REMEDIATION 会话。
- PLAN-002 共用一个 Browser 会话。等待 CI、合并、证据更新、标题修正和运行诊断不得单独创建会话。
- 活动 worktree 上限：一个用户共享工作区、一个治理 worktree、一个活动 Exec worktree、一个临时 Review worktree。
- PR 合并且 `main` CI 成功后，核验干净并回收 Exec/Review worktree和已合并本地分支。dirty、未合并或状态不明的对象不得自动删除。
- 完成会话在 Goal 已停止后归档；OpenChamber 未提供归档 API 时由用户在 UI 操作，归档不阻塞开发。

## 模型路由与升级

- Master 固定 Sol；默认 Exec 使用 Flash；Plan/Review 和复杂补救使用 Terra；Browser 使用专用 Agent。长会话中不切换模型。
- 只有模型实际执行并产生代码/测试证据，且一次可信修复仍失败，才计为模型失败并升级 Terra。
- 权限 deny、空消息、Goal retry、fork/标题异常、网络 502、CI 等待、并发污染和证据收尾均不计为 Flash 失败。
- 局部明确 finding 默认回原 Exec 修复一次；跨包根因、身份安全边界或潜在契约变化可直接交 Terra，但契约变化仍须返回 Plan/ADR。

## 权限与合并

- fleet Agent 的 bash 采用 broad deny 后精确 allow；白名单外命令 fail-fast，禁止 `ask` 静默挂起。角色 Agent 禁止通用 `node*`、`gh api*`、Git 写操作和子 Agent 调度等可绕过职责边界的入口。普通 Master 编排层在释放角色租约后集中执行提交、推送、PR、合并与安全回收。
- Exec/Review Agent 不执行 Git 写操作。普通 Master 编排层仅在依赖、固定门禁、独立 Review `pass`、PR checks、结果记录和契约边界全部满足后合并。
- 合并后记录 merge commit 与 `main` CI；回滚使用 `git revert` 和独立 PR，不改写历史。

## Master 轮换

- Master 优先在一个复杂 Exec 闭环后轮换，或在响应变慢、首次网关异常、上下文接近约 200k token、需要换模型前轮换。
- 轮换不是 Goal 迁移：当前 Master 必须先停止新派发、更新路线图活动表并释放写者租约；下一普通 Master 从 Git/GitHub 重建状态。
- 旧 Master 交接后不得恢复调度权。若旧会话处于 Goal Mode，必须先暂停 Goal，不能仅归档。

## Browser 证据

- Browser 记录必须含 URL、时间、步骤、截图路径、控制台和网络结果，并区分 Preview 与生产入口。
- 自动 Browser 不替代真实设备、移动网络和主观体验；这些聚合到 Plan Gate。
