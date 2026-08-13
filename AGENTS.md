# Fleet Campaign — Agent 工作指南

## 项目

网页联机电子桌游（《枪骑兵：战斗群》电子化）。架构：纯规则 `packages/domain` → `protocol` → `persistence/realtime` → `apps/web`。领域 demo-v1 已合入；M2 = 舰队战斗引擎 + 单指挥战役循环（进行中）。

## 每个会话开始先读

1. `docs/WORKFLOW.md` — 单轨流程（分支/门禁/评审/ADR 触发）
2. `docs/reference/DESIGN-M2.md` — M2 设计基线（原则、范围、分层）
3. `docs/reference/DESIGN-M2-UI.md` — UI 与星系背景基线（视觉定稿）
4. `docs/reference/SPEC.md` — 现行产品契约（demo-v1/协议 v1/存档 v1/实时）
5. `git log --oneline -10` — 最近进展

## 门禁（合入前必须全绿）

```text
npm run verify:governance && npm run typecheck && npm run lint && npm run test && npm run build
```

## 铁律

- git 是唯一真源；会话可随时丢失，恢复只靠 `git log` + `docs/decisions` + 上述文档。
- `main` 永远绿：feature 分支 + PR + CI + 合并即删。
- 跨契约变更（协议/存档/房主权威/传输/LLM 边界）先写 `docs/decisions/` 的 ADR。
- 原作规则书/素材（`D:\workspace\deckgame\reference`）只做设计输入，不入仓库（R-004）；仓库内一切自创抽象。
- 联机默认 Vercel 轮询中继（`?transport=peerjs` 备选）；改 relay 轮询逻辑必须保留 inFlight 守卫 + 跑慢网络回归测试（见 `docs/reference/PLAYBOOK-CICD.md`）。

## 交接（新会话接手）

- 若上一会话上下文丢失：读本文件 + 上述文档 + `git log` 即可重建全部状态。
- 视觉样稿：`docs/reference/ui-mockups/`（holo-map.html / orbit-editor.html，可拖调参导出 JSON）。
- 无图像模型的视觉参考方法：`D:\workspace\deckgame\reference\06-techniques\给无图像模型的视觉参考方法.md`。
- 明确的下一任务与激活提示词见 `docs/reference/DESIGN-M2.md` 的"交接与下一步"（或沿用本文件的"每会话开始先读"）。
