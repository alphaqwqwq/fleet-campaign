# ADR-005 Vercel 轮询中继（替代 PeerJS 云信令）

- 状态：接受
- 日期：2026-08-13

## 背景

MVP 使用 PeerJS/WebRTC P2P，依赖免费云信令 `0.peerjs.com`。实测：本机 DNS 与 HTTPS 可达，但 **WebSocket 升级握手被网络阻断**（返回 200 而非 101），导致手机 + 电脑跨网络联机时客机永远停在"连接中"。PeerJS 云信令在国内网络不可用（已实证）。

替代评估：自建 PeerServer 需常驻服务器（与免费 serverless 思路冲突），且 P2P 跨网仍受 NAT/ICE 打洞约束，不保证成功；Cloudflare Workers 的 `*.workers.dev` 在国内同样被墙，且需新平台/梯子。项目规模极小（数百访问/月、并发约 4 人），回合制游戏对亚秒级延迟无感。

## 决定

采用 **Vercel 轮询中继**：在现有 Vercel 项目上新增一组 serverless 函数 + KV，作为"帧转发总线"。

- 每个房间一个**追加式事件日志**（存于 KV）：房主 / 客机通过 HTTP 轮询读增量、POST 写帧；记录格式 `{ kind, connectionId?, frame?, to? }`。
- 房主浏览器仍是**唯一权威**（ADR-001 不变）：中继只存转发帧，不解析、不裁决；帧形状校验仍在两端适配器内。
- 轮询默认 500ms（可配置），4 人规模约 8 请求/秒，远低于免费档上限。
- 时序一致性由既有机制保证：房主单写者 + `eventSequence` 全序 + `expectedEventSequence` 乐观并发 + 幂等键。轮询只增加传播延迟（亚秒级），不引入冲突风险。
- 传输接口（`HostTransport`/`ClientTransport`）不变：新增 `relay` 适配器内部用轮询实现；PeerJS 适配器降为可选备选。

## 后果

- 手机 + 电脑、跨网络联机不再依赖外部信令与 NAT，仅需两端能访问 Vercel 函数（自定义域名已验证国内可达）。
- 新增依赖：Vercel KV（免费档，需在控制台创建并注入环境变量）；`@vercel/kv` 包。
- 无账号 / 数据库 / 常驻服务器；成本保持为零。
- 中继可见帧明文（游戏自身的抽象状态，无令牌、无敏感信息）；令牌校验仍在房主侧。

## 备选

- 自建 PeerServer：需常驻机器 + 不保证 NAT 打洞，否决。
- Cloudflare Workers 中继：`*.workers.dev` 国内不可达 + 需新平台，否决。
- 手动信令交换（复制粘贴 SDP）：免服务器但体验不可用，仅作极客自测。
