# 提示词资产索引

本目录保存开发过程提示词与运行时旁白提示词；它们必须分开版本、分开审查、分开测试。

## 开发对话提示词

Plan、Exec 和 Review 的完整边界不是放在聊天提示词里，而是写在对应的仓库内目标文档。新对话使用 [工作流](../00-governance/WORKFLOW.md) 定义的短提示词，只传递标题、角色和目标文件绝对路径。

```text
FLEETCAMPAIGN｜EXEC｜P001 仓库与工程基线｜01
角色：EXEC。只处理并更新：D:\workspace\deckgame\fleet-campaign\docs\05-execs\PLAN-001\EXEC-001-01-REPOSITORY-BASELINE.md。
先阅读该文档列出的必读材料和本工作流；遵守文档内硬约束，不执行其范围外操作。
```

目标文档必须包含足以抵抗上下文压缩的硬约束：当前事实、目标、非目标、必读材料、允许/禁止范围、验收、止损和结果记录位置。提示词不得复制这些内容，也不得成为唯一规范来源。

## 运行时提示词

运行时模板仅在后续批准的旁白计划中创建。每个模板必须有 `promptId`、`version`、Hook、输入事实、可见性、允许实体、禁止断言、输出 Schema 和降级文本；不得保存 API Key，也不得让输出改写规则状态、资源、任务结果、随机数或权限。

## 当前状态

PLAN-001 只建立程序与发布自动化基础，不接入游戏、联机或运行时模型。游戏骨架与旁白提示词模板由后续 PLAN-002 及更晚计划裁决。

## 当前开发对话入口

- [PLAN-001 发布自动化短提示词](development/PLAN-001-RELEASE-AUTOMATION-SHORT-PROMPT.md)
- [EXEC-001-01 仓库与工程基线短提示词](development/PLAN-001-EXECUTION.md)
- [EXEC-001-02 CI/CD 诊断与部署反馈基线短提示词](development/EXEC-001-02-RELEASE-DIAGNOSTICS-SHORT-PROMPT.md)
- [EXEC-001-03 本机 Alidns 与 Vercel CNAME 自动化短提示词](development/EXEC-001-03-DNS-VERCEL-AUTOMATION-SHORT-PROMPT.md)
- [EXEC-001-04 正式入口发布与旧项目清理短提示词](development/EXEC-001-04-PUBLIC-ENTRY-RELEASE-SHORT-PROMPT.md)
