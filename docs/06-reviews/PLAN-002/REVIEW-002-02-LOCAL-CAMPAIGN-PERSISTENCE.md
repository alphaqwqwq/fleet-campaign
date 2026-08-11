# REVIEW-002-02：本地战役档持久化独立代码审查

- 状态：Remediation Required
- 审查目标：[EXEC-002-02：本地战役档持久化](../../05-execs/PLAN-002/EXEC-002-02-LOCAL-CAMPAIGN-PERSISTENCE.md)
- 父 Plan：[PLAN-002-01：游戏骨架与最小可玩电子化循环](../../04-plans/PLAN-002-01-GAME-SKELETON-MVP-LOOP.md)
- PR：[PR #11](https://github.com/alphaqwqwq/fleet-campaign/pull/11)
- 审查角色：独立 OpenCode Review；只审不修
- 审查日期：2026-08-11

## 结论

`remediation required`。PR #11 的现有自动化门禁全部成功，但存在一个可复现的 High 导入原子性缺口和两个 Medium schema/领域校验缺口，不满足 Exec 要求的“迁移后重新校验”和“字段、领域不变量稳定拒绝”合同；当前不得合并。

## Findings

### High：迁移结果未经校验即覆盖现有存档

- 位置：[packages/persistence/src/persistence.ts#L88-L103](../../../packages/persistence/src/persistence.ts#L88-L103)、[packages/persistence/src/types.ts#L63-L67](../../../packages/persistence/src/types.ts#L63-L67)、[packages/persistence/src/persistence.test.ts#L119-L132](../../../packages/persistence/src/persistence.test.ts#L119-L132)
- 复现：向 `createCampaignPersistence` 注入一个返回 `{ rngState: { seed: "short", index: 99 } }` 的 `migrateSave`，再导入其他方面合法的 v1 包。实测 `import()` 成功，`store.save()` 被调用一次，非法 RNG 状态成为写入值。
- 根因：导入包在迁移前通过 `decodeFleetCampaignSave`，但自定义迁移器的返回值直接传给 `store.save`，没有再次调用 `decodeCampaignSave`。现有测试只覆盖迁移器抛异常，不覆盖迁移器成功返回非法 schema、领域投影或 RNG 状态。
- 影响：迁移错误可以覆盖同 `campaignId` 的有效现有档，违反 Plan 第 145 行要求的“迁移后重新执行领域不变量校验”和 Exec 第 40 行要求的“导入在写入前完成全部校验”；导入失败原子性因此不成立。
- 补救要求：在唯一写入前对迁移结果执行完整 v1 decode/校验，并新增断言迁移器返回非法顶层字段、领域状态或 RNG 状态时 `store.save` 零调用且原档不变的测试。

### Medium：领域校验接受 demo-v1 不可达状态

- 位置：[packages/persistence/src/validate.ts#L55-L92](../../../packages/persistence/src/validate.ts#L55-L92)、[packages/persistence/src/persistence.test.ts#L134-L158](../../../packages/persistence/src/persistence.test.ts#L134-L158)
- 复现：`decodeCampaignSave` 实测接受 `phase: "awaiting-player", round: 99`，也接受 `phase: "active"` 且一方 `integrity: 0` 的快照。两者均不能由批准的初始状态和 reducer 转换产生。
- 根因：校验器只检查局部字段值和部分 phase 关系，没有落实状态机的组合不变量。现有“invalid domain invariant”测试仅覆盖 active 阶段 `actionPoints: 0`。
- 影响：外部导入可恢复为领域层永远不会生成的战役状态，后续应用服务可能展示或继续处理不可信的“已确认快照”，不满足导入前领域不变量校验要求。
- 补救要求：明确并复用 demo-v1 的完整持久化领域不变量，至少拒绝 awaiting-player 的非初始轮次/受损单位以及 active 阶段已归零单位，并增加各 phase 的正反例矩阵；若要允许这些状态，须先回到 Plan 裁决。

### Medium：损坏的 schemaVersion 被误报为未知版本

- 位置：[packages/persistence/src/validate.ts#L94-L104](../../../packages/persistence/src/validate.ts#L94-L104)、[packages/persistence/src/persistence.test.ts#L134-L158](../../../packages/persistence/src/persistence.test.ts#L134-L158)
- 复现：删除 `schemaVersion`，或将其设为 `null`、字符串等非版本值，均在精确字段检查前进入 `assertSupportedSaveVersion`，返回 `save_unsupported_version`。
- 根因：版本支持判断先于字段存在性和版本值类型校验，无法区分损坏/不完整记录与结构完整的未知整数版本。
- 影响：数据不会被覆盖，但调用方会把损坏文件当作未来版本，无法按稳定错误码提供正确的删除/重新导入恢复提示；这与 `save_invalid` 处理损坏/字段非法、`save_unsupported_version` 处理未知版本的合同不一致。
- 补救要求：先区分缺失/非整数/非法版本字段并返回 `save_invalid`，仅对结构可识别的未知整数版本返回 `save_unsupported_version`；补齐缺失、`null`、字符串、负数和未来整数测试，并断言均不写入。

## 审查范围

- 已读取 Plan、Exec、`WORKFLOW.md`、`PROJECT-STRUCTURE.md`、既有 REVIEW-002-01，以及 `packages/persistence` 的全部源码、配置、包入口和 23 个测试。
- 已审查本地 `main...HEAD` 全部差异；本地 `main` 为 `218be25`，因此该范围还包含已合并的 EXEC-002-01/治理历史。另以 PR 实际基线 `origin/main` `9839b24` 到 head `182da5a` 和 `gh pr diff 11 --name-only` 核对 PR #11 的 12 个文件，实际实现范围只含目标 Exec/短提示词、`package-lock.json` 和 `packages/persistence/**`。
- `packages/persistence` 只声明并通过公开入口依赖 `@fleet-campaign/protocol`；未发现穿透其他包内部、React、实时网络、旁白、账号、云服务或额外运行时依赖。
- v1 顶层、导出包装、游戏投影、单位、RNG 和迁移元数据均使用精确键集合；禁止字段测试覆盖 `roomId`、`clientId`、token、命令收据、连接状态、Peer 端点、凭据和旁白输入。除上述 findings 外，导出字段最小化、UTF-8 大小限制、JSON 解析、内容 ID、RNG seed 编码、localStorage 前缀隔离、损坏/未知本地记录不自动删除、公开类型与包入口未发现其他阻塞问题。
- 迁移公开入口存在，但 v1 当前只支持同版本；非 v1 数据会在迁移器调用前被拒绝。此行为符合当前“v1 只读同版本、未来版本拒绝”边界，但未来实现真实旧版迁移时必须调整解包顺序，不能把当前注入钩子误当作已验证的跨版本迁移链。

## 验证证据

- `npm ci`：成功，0 vulnerabilities；npm 报告 `esbuild@0.28.1` install script 尚未列入 `allowScripts`，未导致本轮安装或构建失败。
- `npx vitest run packages/persistence/src/persistence.test.ts`：成功，1 文件、23 用例。
- `npm run typecheck`：成功，包含 persistence workspace。
- `npm run lint`：成功。
- `npm run test`：成功，7 文件、106 用例。
- `npm run build`：成功，Vite 产物构建完成。
- `git diff --check main...HEAD` 与 `git diff --check origin/main...HEAD`：成功。
- 针对性运行时复现：迁移器返回非法 RNG 状态时导入仍成功并写入一次；awaiting-player round 99 和 active 零完整度快照均被接受；未来 schemaVersion 2 在迁移器调用前以 `save_unsupported_version` 拒绝。

## PR 与回滚

- 核对时 PR #11 为 Open、非 Draft、`MERGEABLE`、`mergeStateStatus: CLEAN`，head 为 `182da5afe1eedaefb599d93b6aabc52b52ae5e49`，base 为 `main`。
- GitHub Actions [verify](https://github.com/alphaqwqwq/fleet-campaign/actions/runs/31466168445/job/93699403480)、Vercel Preview 和 Vercel Preview Comments 均为 success。自动 checks 成功不关闭上述未覆盖 findings。
- 当前结论禁止合并。合并前回滚路径是关闭 PR；若后续修复并合并后需撤销，应对 GitHub 实际合并提交执行 `git revert <merge-commit>` 并走独立 PR，不改写共享历史。

## 残余风险

- 注入式内存 `Storage` 测试不覆盖真实浏览器 localStorage 的配额、隐私模式、访问权限异常、多标签页并发和浏览器差异；按 Exec 记录留待网页集成与父 Plan Gate 验证。
- `list()` 对损坏和未来版本记录统一静默隔离，当前没有向应用层返回可提示用户删除/重新导入的诊断；Plan 要求“隔离并提示”，实际提示能力仍依赖后续应用层设计。
- 当前存档无校验和、签名或并发控制，符合纯本地首发范围，但不能提供防篡改、跨标签原子事务或云同步保证。

## 后续责任

原 EXEC-002-02 实现会话应在同一 PR 分支修复上述 findings、补齐未弱化测试并重跑固定门禁；随后必须再次获得独立 Review `pass`。本 Review 只新增和提交该审查记录，不修改实现、不合并 PR，也不代表父 Plan 用户人工验收完成。
