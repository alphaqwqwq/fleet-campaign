# Fleet Campaign

Fleet Campaign 是一个正在建立工程基线的网页联机电子桌游项目。

当前页面仅用于确认 React、TypeScript、Vite、npm workspaces、测试、CI 与静态部署链路可用，不包含游戏规则、联机、存档或模型调用。

## 工作区

```text
apps/web                 React/Vite 静态网页
packages/domain          未来的纯规则边界
packages/protocol        未来的命令与事件协议边界
packages/persistence     未来的本地持久化边界
packages/realtime        未来的实时通信边界
packages/narration       未来的叙事 Hook 边界
packages/content         未来的自写内容边界
```

这些 package 目前只定义工程边界，不提供业务 API。

## 开发与验证

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
```

## 开发流程

单轨 git 驱动工作流见 [docs/WORKFLOW.md](docs/WORKFLOW.md)：feature 分支 + PR + CI，跨契约变更先写 [docs/decisions](docs/decisions) 的 ADR。

## 资料与兼容性

- 旧 `fleet-room` 原型的存档与本项目不兼容。
- 原始规则资料、PDF、OCR 文本、外部原文、原作图片、真实存档、API Key 与 Token 不随本仓库发布。
- `docs/` 仅保存项目自身的治理、计划、执行记录与提示词索引。

