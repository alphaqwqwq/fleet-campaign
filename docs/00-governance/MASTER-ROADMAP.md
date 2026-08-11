# Master 路线图与活动控制台

- 当前状态：Active Plan
- 当前阶段：PLAN-002 游戏骨架与最小可玩电子化循环
- 事实截止：2026-08-11

本文件是跨 Plan 状态、活动租约与下一动作的唯一入口。执行纪律见 [WORKFLOW](WORKFLOW.md) 和 [自动化工作流 V2](AUTOMATION-WORKFLOW.md)。

## 当前事实

- PLAN-001 已完成，正式入口为 `https://fleet.alphaqwq.xyz`。
- PLAN-002-01 已批准；EXEC-002-01 已完成协议补救并合并。
- EXEC-002-02 的实现 PR #11 已合并为 `715c9fc`，合并记录 PR #12 已合并为 `eb0e499`，对应 `main` CI 成功。
- EXEC-002-03 的 PR #13 为 Open，head `c787a95`，verify、Vercel 与 Preview Comments 成功。
- REVIEW-002-03 结论为 `remediation required`：显式 leave 未撤销 token；realtime 直接依赖 domain；终局双事件缺完整广播断言。
- EXEC-002-04 与 EXEC-002-05 未开始；当前不满足人工 Plan Gate。

## 活动控制台

| 类型 | 对象 | 状态 | 会话/写者 | Worktree/分支 | PR/head | 下一动作 |
| --- | --- | --- | --- | --- | --- | --- |
| Master | PLAN-002 | Active | 当前普通 Master | `docs/workflow-v2` | 治理 PR 待创建 | 入库 Workflow V2 |
| Exec | E002-03 | Pushed / remediation | 无活动写者 | `feature/exec-002-03-host-authoritative-realtime` | #13 / `c787a95` | 治理合并后修复三个 findings |
| Review | E002-03 | Remediation required | 原 Review 已结束 | 无活动 Review 租约 | [REVIEW-002-03](../06-reviews/PLAN-002/REVIEW-002-03-HOST-AUTHORITATIVE-REALTIME.md) / `f0509cd` | 新 head 后重新独立审查 |
| Browser | P002-01 | Not started | 无 | 无 | 无 | E002-04 页面可用后启动 |

## 下一顺序

1. 合并 Workflow V2 治理 PR并核验 `main` CI。
2. 在原 EXEC-002-03 feature worktree完成三个 finding 的有界补救和固定门禁。
3. 更新 PR #13 后对固定新 head 独立 Review；`pass` 且 checks 全绿后合并并核验 `main` CI。
4. 顺序推进 EXEC-002-04、EXEC-002-05。
5. 自动证据闭环后提供一次性人工体验验收清单；用户确认前不将 PLAN-002 标记 Completed。

## 硬边界

- 房主权威；客机只提交意图；规则为纯 TypeScript。
- `roomId`、`campaignId`、`clientId` 和 token 不混用；房间临时，战役档长期本地。
- 不改变 protocol v1、存档 v1、RNG、认证或发布架构，除非先经 Plan/ADR 与用户裁决。
- 不接入账号、云存档、常驻后端、房主迁移、真实 LLM 或未授权原作内容。

## 待回收历史资产

- EXEC-002-02 的实现、Review 与 merge-record worktree均已完成，治理 PR 合并后核验干净并回收。
- 旧协议补救共享工作区含用户未提交变更，不自动清理或切换。
- 每次回收前必须核对 worktree 干净、PR 已合并且没有独有未提交文件。
