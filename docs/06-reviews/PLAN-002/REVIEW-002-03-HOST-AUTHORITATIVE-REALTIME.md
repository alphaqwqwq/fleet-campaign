# REVIEW-002-03：房主权威实时会话

- 状态：Remediation required
- 下一动作：原 EXEC-002-03 关闭以下三个 finding 后，对新的固定 PR head 重新独立审查。
- 证据：审查基线 `origin/main eb0e499` → PR #13 `f0509cd`；定向 55 项与固定门禁 184 项通过，但代码 finding 不放行。
- 基线：本轮结论严格适用于 `f0509cd`；PR 当前 head `c787a95` 仅增加证据记录，尚无补救代码。

## Findings

### P1 - 显式离开未撤销会话令牌

客户端关闭只断开 transport，房主保留 binding/token fingerprint，旧 token 随后仍可重连。补救必须区分显式 leave 与网络断线：受 token 保护的 leave 验证 `roomId + clientId + connectionId + token` 后删除 binding；纯网络断线继续允许有效 token 重连。增加两条 memory transport 断言。

### P1 - realtime 直接依赖 domain

`packages/realtime/src/frames.ts` 仅为 `SeatId` 直接导入 domain，违反已批准的 realtime 只依赖 protocol 方向。使用 protocol 公开投影或本地无行为字面类型，并移除 realtime manifest 中的 domain 依赖；不得移动 reducer 或规则结算。

### P2 - 终局双事件广播契约缺少测试

终局 `advance` 产生 `action-confirmed` 与 `demo-completed`。实现会分配连续 sequence 并广播，但测试未断言玩家和观战者均收到两个有序事件、result 只带首个事件且 snapshot 为最终 completed 状态。补测试即可，不改变 protocol v1。

## 放行条件

- 三项 finding 均有定向断言并通过串行固定门禁。
- PR 新 head checks 全绿，变更仍在 EXEC-002-03 允许范围。
- 独立 Review 对新 head 结论为 `pass`；公共信令与真实浏览器证据仍明确留给 EXEC-002-04/05。
