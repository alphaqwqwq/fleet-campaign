# EXEC-001-01：正式仓库与工程基线

- Plan：[PLAN-001：临时房主房间与可恢复战役基础](../../04-plans/PLAN-001-ROOM-PERSISTENCE-FOUNDATION.md)
- 状态：In Progress
- 分支：`feature/exec-001-01-repository-baseline`
- 依赖：无
- 影响域：工程 / CI / 部署 / 文档

## 本次交付

1. 在独立目录创建正式项目仓库，使用 npm workspaces 管理 `apps/web` 与计划要求的 `packages/*` 空包边界。
2. 建立最小 React + TypeScript + Vite 网页，展示“房间基础工程准备中”的无业务页面。
3. 建立根脚本：`typecheck`、`lint`、`test`、`build`，并有可运行测试入口。
4. 建立 GitHub Actions 工作流，对 PR 与 `main` 执行安装、类型检查、lint、测试和构建。
5. 将治理体系、PLAN-001 与本 Exec 迁入正式仓库，不复制外部原始规则资料。
6. 配置 Vercel 可识别的静态网页部署；部署前不添加自定义域名。

## 非目标

- 不接入 PeerJS、IndexedDB、LLM、战役状态机、游戏内容或真实联机 UI。
- 不复制 `fleet-room` 的业务实现。
- 不提交任何原始 PDF、OCR 文本、原作专有图片、完整规则数据、用户 API Key 或本地调试档案。

## 修改边界

- 根配置、`apps/web/**`、`packages/**` 的包占位文件、`.github/workflows/**`、`docs/**`、`.gitignore`、`README.md`。
- 如果需要新增构建、lint 或测试依赖，选择与 React/Vite/TypeScript 兼容的最少依赖，并在结果记录解释理由。

## 结果记录

- 实际仓库：待填写
- 实际分支：`feature/exec-001-01-repository-baseline`
- 实际提交：待填写
- GitHub Actions：待填写
- Vercel 生产 URL：待填写
- 依赖决策：ESLint 用于根级静态检查；Vitest 用于执行一个真实断言；其余依赖为 React、Vite 和 TypeScript 的工程所需依赖。
- 验证结果：待填写
- 已知限制：空 workspace 包只建立边界；不含 PeerJS、IndexedDB、游戏规则或真实 LLM。

