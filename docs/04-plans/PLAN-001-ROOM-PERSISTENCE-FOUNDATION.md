# PLAN-001：临时房主房间与可恢复战役基础

- 状态：Approved
- 责任边界：建立正式网页项目的工程骨架，验证临时房主联机、可恢复状态和叙事 Hook 的数据通道；不实现完整游戏规则。

## 目标

交付一个可上线至 Vercel 的网页原型：房主浏览器建房即开服，玩家与观战者通过房间码和本地随机客户 ID 加入；房主确认命令并维护唯一会话状态；房主能导出、导入和跨房间延续一个演示战役。

## 非目标

- 不实现完整舰船、武器、伤害、AI、任务卡、战役内容或美术资产。
- 不实现常驻后端、账号系统、云存档、房主迁移、防作弊承诺或跨房间匹配。
- 不调用真实 LLM，不保存 API Key，不生成自由旁白。

## 范围

- npm workspace 工程基线、React/Vite 网页、GitHub Actions 和 Vercel 静态部署。
- 后续 Exec 才实现 `domain`、`protocol`、`persistence`、`realtime`、`narration` 与网页流程。

## Exec 拆分

1. `EXEC-001-01-REPOSITORY-BASELINE`：创建独立仓库、workspace、基础页面、GitHub Actions、文档迁移与 Vercel 配置。
2. `EXEC-001-02-DOMAIN-PROTOCOL`：实现演示战役状态、命令/事件模型、运行时校验、reducer 与单元测试。
3. `EXEC-001-03-PERSISTENCE-REPLAY`：实现版本化战役包、本地快照、事件追加、导入导出、迁移和回放测试。
4. `EXEC-001-04-REALTIME-SESSION`：实现 PeerJS 房主会话、权限、幂等、快照/增量同步和重连。
5. `EXEC-001-05-WEB-FLOW-NARRATION-HOOKS`：实现演示循环 UI、日志、保存界面与无模型 Hook 展示。
6. `EXEC-001-06-END-TO-END-ACCEPTANCE`：联机手动验收、浏览器 E2E、部署验证、缺陷修复和 PLAN-001 结项。

