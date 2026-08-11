# OpenChamber 会话命名

格式固定为：

```text
<ROLE>|<TARGET>+<CHAT-NN>+<SHORT-GOAL>
```

- `ROLE`：`MASTER`、`PLAN`、`EXEC`、`REVIEW` 或 `BROWSER`。
- `TARGET`：稳定文档 ID，例如 `ROADMAP`、`P002-01`、`E002-03`。
- `CHAT-NN`：同角色同目标按真实创建顺序递增的两位编号，fork 也递增。
- 创建前查询含归档会话；创建时显式传 title、agent、model、directory，不能依赖自动标题。
- 错误标题会话不得承担正式工作；完成会话在 Goal 已暂停后归档。

示例：

```text
MASTER|ROADMAP+03+PLAN-002续接
EXEC|E002-03+02+实时会话补救
REVIEW|E002-03+02+实时会话复审
```
