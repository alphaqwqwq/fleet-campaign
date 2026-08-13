# 文档索引

本目录只保存项目自身的设计、规则约束、决策与流程记录。原始规则书、模组 PDF、提取文本及其他外部参考资料必须保留在本仓库之外的本地参考目录，不得提交到公开仓库。

## 内容

| 路径 | 内容 |
| --- | --- |
| `WORKFLOW.md` | 单轨开发流程：分支、门禁、评审、ADR 触发条件 |
| `decisions/` | ADR 决策日志：跨契约变更的背景、决定、后果 |
| `archive/` | 旧多层流程（Plan/Exec/Review 文档、历史审查、提示词）归档，仅作参考 |

## 文档优先级

1. 已确认的规则约束与版本化 Schema（代码内）。
2. 已接受的 ADR（`docs/decisions/`）。
3. 流程规则（`WORKFLOW.md`）。
4. 归档参考材料（`docs/archive/`）。

需要修改前两级的变更，先新增或更新 ADR，不得在代码中隐式改变约束。

## 当前状态

- 正式入口：`https://fleet.alphaqwq.xyz`（Vercel，`main` 自动发布）。
- 已合入：领域 `demo-v1` 纯规则层、协议 v1、本地存档 v1、PeerJS 房主权威实时层。
- 进行中：`feature/exec-002-04-web-vertical-slice`（网页垂直切片）→ 集成与发布验收。
- 详细历史与决策依据见 `git log` 与 `decisions/`。
