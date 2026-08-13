# Master 路线图与活动控制台

- 当前状态：Active Plan
- 当前阶段：PLAN-002 游戏骨架与最小可玩电子化循环
- 事实截止：2026-08-11

本文件是跨 Plan 状态、活动租约与下一动作的唯一入口。执行纪律见 [WORKFLOW](WORKFLOW.md) 和 [自动化工作流 V2](AUTOMATION-WORKFLOW.md)。

## 当前事实

- PLAN-001 已完成，正式入口为 `https://fleet.alphaqwq.xyz`。
- PLAN-002-01 已批准；EXEC-002-01 已完成协议补救并合并。
- EXEC-002-02 的实现 PR #11 已合并为 `715c9fc`，合并记录 PR #12 已合并为 `eb0e499`，对应 `main` CI 成功。
- Workflow V2 治理 PR #14 已合并为 `69e4fe6`；独立 Review `pass`，合并后 `main` CI run `31488003426` 成功。
- EXEC-002-03 的最终 PR head `9f6f172` 经独立 Review `pass` 后，PR #13 已合并为 `920b11c`；合并后 `main` CI run `31490035013` 成功。
- E002-03 补救关闭：显式 leave 采用撤销确认并支持超时重试；realtime→domain 直接依赖已移除；终局双事件广播契约已覆盖。真实公共 PeerJS/DataChannel 仍留给 E002-04/05 Browser 验证。
- EXEC-002-04 与 EXEC-002-05 未开始；当前不满足人工 Plan Gate。

## 活动控制台

| 类型 | 对象 | 状态 | 会话/写者 | Worktree/分支 | PR/head | 下一动作 |
| --- | --- | --- | --- | --- | --- | --- |
| Master | PLAN-002 | Handoff | 当前普通 Master | `docs/roadmap-e002-03-handoff` | 当前路线图 PR | 路线图入库后创建下一普通 Master |
| Exec | E002-04 | Draft / ready | 无活动写者 | 尚未创建 | 无 | 从 `origin/main 920b11c` 建独立 feature worktree |
| Review | E002-03 | Pass / released | 无 | 临时 detached Review 已释放 | [REVIEW-002-03](../06-reviews/PLAN-002/REVIEW-002-03-HOST-AUTHORITATIVE-REALTIME.md) / `91def22` | 无 |
| Browser | P002-01 | Not started | 无 | 无 | 无 | E002-04 页面可操作后共用一个 Browser 会话 |

## 下一顺序

1. 下一普通 Master 从 `origin/main 920b11c` 核验 E002-04 合同和资产预算，创建一个活动 feature worktree。
2. 使用一个有界 Exec 会话实现网页垂直切片，Master集中提交/PR；页面可操作后使用 PLAN-002 共用 Browser 会话留证。
3. 固定 PR head 独立 Review；`pass` 且 checks 全绿后合并并核验 `main` CI。
4. 推进 EXEC-002-05 集成、正式入口和自动证据闭环。
5. 最后提供一次性人工体验验收清单；用户确认前不将 PLAN-002 标记 Completed。

## 硬边界

- 房主权威；客机只提交意图；规则为纯 TypeScript。
- `roomId`、`campaignId`、`clientId` 和 token 不混用；房间临时，战役档长期本地。
- 不改变 protocol v1、存档 v1、RNG、认证或发布架构，除非先经 Plan/ADR 与用户裁决。
- 不接入账号、云存档、常驻后端、房主迁移、真实 LLM 或未授权原作内容。

## 待回收历史资产

- EXEC-002-02 的 merge-record worktree和 Workflow V2 治理 worktree已回收；E002-02 实现分支有未合并争议提交、Review worktree有未提交证据，均保留不强删。
- E002-03 feature worktree待本路线图入库后核验干净并回收；旧 Review worktree包含未跟踪证据，保留至人工核对。
- 旧协议补救共享工作区含用户未提交变更，不自动清理或切换。
- 每次回收前必须核对 worktree 干净、PR 已合并且没有独有未提交文件。
