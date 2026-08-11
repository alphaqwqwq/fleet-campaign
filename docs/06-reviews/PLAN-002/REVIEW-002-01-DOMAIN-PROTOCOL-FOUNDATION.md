# REVIEW-002-01：领域与协议基础独立自动审查

- 状态：Remediation Required
- 审查目标：[EXEC-002-01：领域与协议基础](../../05-execs/PLAN-002/EXEC-002-01-DOMAIN-PROTOCOL-FOUNDATION.md)
- 父 Plan：[PLAN-002-01：游戏骨架与最小可玩电子化循环](../../04-plans/PLAN-002-01-GAME-SKELETON-MVP-LOOP.md)
- 执行角色：`fleet-review`
- 模型：`congee/gpt-5.6-terra`
- 依赖：EXEC-002-01 已合并；治理基线可并行准备，但本 Review 结论必须纳入其 PR

## 目标

独立核对已合并 EXEC-002-01 的代码范围、领域/协议契约、依赖方向、测试和 Git/PR/CI 证据，校正 Exec 结果记录中被误称为“人工验收”的实现会话静态自查。Review 不重做实现、不要求用户审查底层代码，也不改变游戏规则、protocol v1、存档 v1、房主权威、认证或公开授权。

## 审查输入

- Plan、目标 Exec、`docs/00-governance/WORKFLOW.md` 与 `.opencode` 的 Review/会话规则。
- `packages/content/**`、`packages/domain/**`、`packages/protocol/**` 在实现提交 `36ddc4d`、结果提交 `8b957f9`、PR #7 合并提交 `bb86363` 和当前 `main` `218be25` 上的实际差异。
- PR [#7](https://github.com/alphaqwqwq/fleet-campaign/pull/7)、GitHub Actions 与 Vercel Check，以及 Exec 记录的 6 文件 66 用例和固定门禁证据。

## 文件权限

- 允许写入：仅本 Review 文档；若 Master 明确授权校正证据，可只改目标 Exec 的“结果记录”小节。
- 禁止写入：`apps/**`、`packages/**`、Plan 契约、Master/WORKFLOW、基础设施、测试实现和任何功能代码。
- Review 不提交、不推送、不创建或合并 PR；结果交由治理基线工作单元纳入可追溯提交。

## 必查项

1. 实际 changed-files 未越过 EXEC-002-01 允许范围，且不混入 UI、持久化、实时、发布或基础设施。
2. `domain` 不导入 `protocol`、React、浏览器 API、网络、存储、时间或 LLM；跨包只经公开入口。
3. 内容只含自创 `demo-v1` 抽象数据；状态机、`advance`、RNG 零消费与确定性拒绝保持 Plan 已批准语义。
4. `protocolVersion: 1` schema 拒绝非法/未知输入；客户端只提交意图，不提交令牌公开值、伤害、资源、胜负、事件序列或快照结论。
5. 幂等收据、事件序列、输入不可变性、拒绝路径和固定种子复现均有未弱化测试；核对实际测试数量与 Exec 记录一致性。
6. 固定门禁、PR CI、Vercel Check、提交/合并哈希和 `git revert bb86363` 回滚路径真实可定位。

## 验证命令

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `git diff --check 218be25^..218be25`

若当前并行工作树会污染门禁，Review 必须使用可追溯提交/干净隔离工作树读取证据，不能覆盖、暂存或还原他人变更。无法安全隔离时记录阻塞，不把历史成功冒充本轮复验。

## 结论与升级

- findings-first，按严重度给出文件/行号或提交/CI 链接，结论只能是 `pass`、`remediation required`、`blocked` 或 `contract escalation required`。
- 可复现代码缺陷返回原 Exec 会话修复；Flash 一次可信修复仍失败后由 Master fork 同一 Exec 给 `fleet-exec`/Terra。Review 不自行修复。
- 需要改变协议 v1、状态机、RNG、依赖方向、认证或公开授权时标记 `contract escalation required`，返回 Plan/ADR/Master，不得自行放行。
- `pass` 表示 EXEC-002-01 代码级自动 Review 闭环，不表示父 Plan 用户人工验收完成。

## 结果记录

- 审查会话：`REVIEW|E002-01+01+领域协议独立验收`（`ses_01155d506ffelTGleqmXFz2SGk`），内置 build 临时执行；仅审查并更新本文件。
- Findings（按严重度）：
  1. High - [packages/protocol/src/ids.ts#L23-L30](../../../packages/protocol/src/ids.ts#L23-L30) 将 `idempotencyKey` 接受为任意 1 至 32 字符 URL-safe 字符串；相应测试还明确接受单字符键（[validate.test.ts#L282-L293](../../../packages/protocol/src/validate.test.ts#L282-L293)）。这违反 Plan 已批准的 128-bit 随机键格式，削弱跨重试幂等键的碰撞边界。返回 EXEC-002-01：运行时校验必须与批准的 128-bit 表示一致，并补充边界拒绝测试。
  2. High - [packages/protocol/src/validate.ts#L60-L89](../../../packages/protocol/src/validate.ts#L60-L89) 对 `Snapshot.game` 未执行未知字段拒绝，且 [packages/protocol/src/validate.ts#L148-L159](../../../packages/protocol/src/validate.ts#L148-L159) 将广播 `publicPayload` 接受为无约束记录。因而 token 或其他未裁决字段可通过 v1 运行时校验并进入下行快照/公开事件，违反“协议不泄露令牌、未知字段不得进入”的契约。返回 EXEC-002-01：为 v1 游戏投影和按事件类型定义的公开载荷施加精确 schema，拒绝 token/未知字段，并补充否定测试。
- 静态核对：`36ddc4d` 实际变更仅为 Exec/短提示词、锁文件与 `packages/content`、`packages/domain`、`packages/protocol`；未混入 UI、持久化、实时、发布或基础设施。`domain` 仅依赖 content 公开入口，不反向依赖 protocol，且未发现 React、浏览器、网络、存储、时间或 LLM 使用。`demo-v1` 只含 `host-unit`、`guest-unit`、`integrity: 3` 与 `advance` 抽象内容。领域 reducer、账本和 RNG 测试覆盖阶段转换、确定性拒绝、不可变更新、序列/重放、零 RNG 消费与固定种子重现；但上述协议契约漏洞阻止放行。
- 固定门禁与证据复核：当前工作树仅有治理文档修改、删除和未跟踪项，未触及 `apps/**` 或 `packages/**`，故不影响代码门禁；本轮未覆盖、暂存或还原它们。2026-08-11 本轮 `npm ci`、`npm run typecheck`、`npm run lint`、`npm run test`、`npm run build` 均成功；Vitest 实测 6 个测试文件、66 个用例。`git diff --check 218be25^..218be25` 成功。实现提交 `36ddc4dd08aebcba2db15b353fc1a28367bcd8d9`、结果提交 `8b957f926f07c81f66f4232d3ae690621d2ce7e2`、PR #7 合并提交 `bb86363f9f9b9aab2982b4fc727852db2408e98b`、当前 main `218be25d96fc64315a63186066d0242cc24051d4` 均已核对；回滚路径为 `git revert bb86363f9f9b9aab2982b4fc727852db2408e98b`。PR [#7](https://github.com/alphaqwqwq/fleet-campaign/pull/7) 为 Merged；PR CI [verify](https://github.com/alphaqwqwq/fleet-campaign/actions/runs/31385170677/job/93443867885) 成功，合并提交的 [Vercel Check](https://vercel.com/alphaqwqwq114514/fleet-campaign/8jBtfGXXD54pK5fZoR5Wrx2fFiVw) 成功。
- 结论：remediation required。
- 对 EXEC-002-02 准入影响：EXEC-002-01 的 Git 合并依赖存在，但治理基线不得放行 EXEC-002-02 进入 `In Progress`，直至原 EXEC-002-01 修复两项 protocol v1 schema 缺口、通过独立复审并留存新的 PR/CI 证据；不需要用户人工代码审查。

## 治理基线审查记录

- 审查会话标题：`REVIEW|P002-01+01+治理基线审查`；会话 ID：`ses_011507c30ffebzPeT7wGZ1IbRR`。
- 审查范围：仅 GOV-002-01 指定的 Plan、五份 Exec 与本 Review 七文件；当前工作树的 `docs/00-governance/**`、`.opencode/**`、`docs/08-prompts/**`、其他 Plan/Exec、代码和基础设施变更均为并行变更，不纳入本次审查或治理提交。
- Findings（按严重度）：High，既有第 57 行的 `idempotencyKey` 运行时格式未满足批准的 128-bit 契约；High，既有第 58 行的快照和公开事件载荷 schema 未拒绝未知字段，可能允许令牌或未裁决字段进入下行数据。两项均未在本次只审不修范围内修复。
- 自洽性核对：七文件仅定义自动会话续接、独立自动 Review、父 Plan Gate 人工验收、Flash 一次可信修复失败后由 Master fork Terra，以及 GOV-002-01 治理工作单元；未改变游戏循环、`protocolVersion: 1`、存档 v1、房主权威、认证或公开授权语义。事实、未验证状态、Draft/Merged 生命周期、Exec 依赖、提交/PR/回滚职责彼此一致。
- 验证命令：相对 Markdown 链接存在性 Node 检查（七文件）通过；`git diff --check -- <七文件精确范围>` 通过；`git status --short` 与 `git diff --name-only -- <七文件精确范围>` 完成范围清单审计。
- 结论：`remediation required`。
- 对治理提交准入影响：GOV-002-01 文档可形成仅七文件的治理提交候选，但不得作为 EXEC-002-02 进入 `In Progress` 的放行依据；须先由原 EXEC-002-01 修复两项 protocol v1 schema finding，并获得新的独立 Review `pass` 及对应 PR/CI 证据。无需用户人工代码审查；父 Plan Gate 仍保留给最终集中人工验收。
