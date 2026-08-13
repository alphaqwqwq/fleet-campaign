# REVIEW-002-03：房主权威实时会话

- 状态：Pass
- 下一动作：Master 核验 PR #13 最终 head checks 后合并，并核验合并后 `main` CI。
- 证据：首轮 `f0509cd` 为 `remediation required`；`3e2e213` 复审发现 PeerJS leave 交付 P1；最终固定 head `91def22` 聚焦复审 `pass`。
- 基线：`origin/main 69e4fe6` → PR #13 `91def22`。

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

## 最终复审

- 显式离开使用 `leave-request`/`leave-accepted` 确认：客户端仅在房主完成撤销并确认后关闭 transport；确认超时保持连接和 token 以便重试。
- 房主验证 `roomId + clientId + connectionId + token fingerprint` 后删除 binding；重复 leave 可再次确认，旧 token join 仍为 `identity_invalid`；纯网络断线保留 binding并允许旧 token重连。
- realtime 源码、manifest和 lockfile均无 realtime→domain 直接依赖；终局玩家/观战双事件、连续 sequence、首事件 result和最终 completed snapshot断言通过。
- 固定 head `91def22`：治理门禁通过；定向 5 文件 61 项、全量 12 文件 190 项、typecheck、lint、build、`git diff --check` 均通过；GitHub verify、Vercel与 Preview Comments全绿。
- 结论：`pass`。残余风险仅为真实公共 PeerJS 信令/DataChannel 环境，按合同留给 EXEC-002-04/05，不阻塞本 Exec合并。
