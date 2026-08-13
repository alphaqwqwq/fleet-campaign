# Workflow（单轨 · git 驱动）

- 状态：生效（2026-08-13，替代旧 Master/Plan/Exec/Review 多层流程）
- 适用范围：fleet-campaign 全部日常开发

## 原则

1. **git 是唯一真源**。进度 = 分支名 + 最近提交 + PR；会话随时可能丢失，恢复只靠 `git log` 与 `docs/decisions`。
2. **`main` 永远绿**。typecheck / lint / test / build 全绿才允许合并。
3. **一个工作树、一个长期驱动会话**。不建 worktree、不按角色开会话、不写进度文档。
4. **文档只保存决策（ADR）与流程**，不复刻 git 事实。

## 日常循环

1. 从最新 `main` 建 `feature/<slug>` 分支。
2. 改代码 + 测试，跑固定门禁：`npm run typecheck` / `npm run lint` / `npm run test` / `npm run build`。
3. commit（写清"做了什么、为什么"）→ push → 开 PR。
4. CI 绿后合并，删除分支。

## 评审

- 例行改动：CI + 自检 diff。
- 高风险改动（见下）合并前派一个**只读**子 agent 读 PR diff 给 pass / 需返工结论；pass 才合并。
- 人工验收（真实设备 / 浏览器 / 体验 / 移动网络）由你在 feature 合并前或发布前执行。

## 决策记录（ADR）

触碰以下契约必须先在 `docs/decisions/` 写 ADR（背景 / 决定 / 后果 / 备选），随同一 PR 入库，再实现：

- 协议 v1 对外字段、命令 / 事件 / 快照语义
- 存档格式与迁移策略
- 房主权威、身份 / 令牌模型、实时传输方案
- LLM 边界、发布架构、外部权限

## 会话纪律

- 会话永不创建子会话 / 子工作树 / 子分支。
- 需要独立意见时用 `task` 派只读子 agent；子 agent 不碰 git、不开 PR。
- 不依赖会话标题 / fork 行为（平台特性不稳定）。
