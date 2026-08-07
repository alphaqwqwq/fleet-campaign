# EXEC-001-01：正式仓库与工程基线

- Plan：[PLAN-001：临时房主房间与可恢复战役基础](../../04-plans/PLAN-001-ROOM-PERSISTENCE-FOUNDATION.md)
- 状态：Pushed
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

- 实际仓库：https://github.com/alphaqwqwq/fleet-campaign
- 实际分支：`feature/exec-001-01-repository-baseline`
- 实际提交：`28999aad27a3b63502c561cf4a9c783424348406`（首次 `main` 初始化）与 `24cbb3a183b233c2bcf86bf8e60f4a6179f78f2c`（feature 分支 Vercel 配置）。
- GitHub Actions：https://github.com/alphaqwqwq/fleet-campaign/actions/runs/31139907539（main，成功）；https://github.com/alphaqwqwq/fleet-campaign/actions/runs/31140647074（feature，成功）。PR：https://github.com/alphaqwqwq/fleet-campaign/pull/1（Open，CI 与 Vercel 检查成功，未合并）。
- Vercel 生产 URL：https://fleet-campaign.vercel.app；部署详情：https://vercel.com/alphaqwqwq114514/fleet-campaign/5vX3QyUNrWcHA3WuYnuUUCRa4aKA。Vercel 构建与部署状态为 Ready，但当前执行环境与人工访问均无法连接默认域名，网页可访问性未验证。
- 依赖决策：ESLint 用于根级静态检查；Vitest 用于执行一个真实断言；其余依赖为 React、Vite 和 TypeScript 的工程所需依赖。
- 验证结果：已实际通过 `npm ci`、`npm run typecheck`、`npm run lint`、`npm run test`（1 个测试）和 `npm run build`。GitHub Actions 在 main 与 feature 分支成功。Vercel 使用 `npm ci` 与 `npm run build` 成功构建并标记 Ready。默认生产域名访问失败，未验证网页可访问性。
- 已知限制：空 workspace 包只建立边界；不含 PeerJS、IndexedDB、游戏规则或真实 LLM。首次空远端使用已验证的基线提交初始化 main，随后 feature 分支的 Vercel 配置通过 PR 等待合并。默认 `*.vercel.app` 域名当前无法从人工与执行环境访问；自定义域名、阿里云 DNS、发布可访问性策略和主页入口迁移不属于本 Exec，需在新 Plan 或 ADR 裁决。
