# Plan、Exec、Review 与 Agent 工作流

## 文档角色与状态事实

- Plan 负责裁决长期边界、数据契约、兼容和风险；Exec 只能在已裁决边界内实施。
- Exec 是一个可独立构建、验证、提交和回滚的工作单元。
- 架构、状态与结果记录只能写已发生、已验证的事实。

## Exec 生命周期

```text
Draft → In Progress → Verified → Pushed → Merged
```

- `Draft`：范围、文件边界和验证清单完整。
- `In Progress`：仅在对应 feature 分支修改。
- `Verified`：所有必需自动化和手动验证完成，结果写入 Exec。
- `Pushed`：有对应提交哈希并已推送 GitHub。
- `Merged`：通过 PR 合入 `main`，记录合并提交和部署结果。

## 每次执行必须遵守

1. 先阅读关联 Plan、已有规则约束、ADR 和最近相关 Exec。
2. 只修改 Exec 列出的文件；新增文件必须记录用途。
3. 不得以删除、跳过或弱化既有断言换取通过。
4. 完成后按 Exec 清单验证；失败要保留真实证据。
5. 更新 Exec 的结果记录，提交并推送；未验证的变更不得标记完成。

