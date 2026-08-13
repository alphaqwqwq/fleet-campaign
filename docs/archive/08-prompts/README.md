# 提示词资产索引

本目录保存开发过程提示词与运行时旁白提示词；它们必须分开版本、分开审查、分开测试。

## 开发对话提示词

Master、Plan、Exec、Review 和 Browser 的完整边界不放在聊天提示词里，而写在对应目标文档。开发入口按角色复用，不再为每个 Exec 复制短提示词。

```text
EXEC|E002-03+01+房主权威实时
角色：EXEC。目标文档：<目标 Exec 绝对路径>。
先阅读目标文档和工作流；只完成有界目标，不推进下游工作。
```

目标文档必须包含足以抵抗上下文压缩的硬约束：当前事实、目标、非目标、必读材料、允许/禁止范围、验收、止损和结果记录位置。提示词不得复制这些内容，也不得成为唯一规范来源。

## 运行时提示词

运行时模板仅在后续批准的旁白计划中创建。每个模板必须有 `promptId`、`version`、Hook、输入事实、可见性、允许实体、禁止断言、输出 Schema 和降级文本；不得保存 API Key，也不得让输出改写规则状态、资源、任务结果、随机数或权限。

## 当前状态

开发 Agent 使用五个通用入口；运行时旁白模板仍不在 PLAN-002 范围内。

## 当前开发对话入口

- [Master](development/MASTER.md)
- [Plan](development/PLAN.md)
- [Exec](development/EXEC.md)
- [Review](development/REVIEW.md)
- [Browser](development/BROWSER.md)
