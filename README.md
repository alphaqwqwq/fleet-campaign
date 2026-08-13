# Fleet Campaign

Fleet Campaign 是一个网页联机电子桌游项目：网页 + 临时房主联机 + 电子化游戏 + 可降级 LLM 叙事。

领域规则、协议、本地存档与实时传输已具备 demo-v1 技术骨架；网页垂直切片（建房/加入/对局/存档 UI）为下一个 feature。

## 工作区

```text
apps/web                 React/Vite 网页 + 组合层（host/client session 编排）
packages/domain          demo-v1 纯规则（reducer/ledger/rng）
packages/protocol        protocol v1 信封/命令/快照/错误码
packages/persistence     本地存档 v1 + 导入导出/迁移
packages/realtime        可替换实时传输（PeerJS 适配 + 内存替身）
packages/content         demo-v1 内容模板
```

架构与边界见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)，现行产品契约见 [docs/reference/SPEC.md](docs/reference/SPEC.md)。

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

- 原始规则资料、PDF、OCR 文本、外部原文、原作图片、真实存档、API Key 与 Token 不随本仓库发布。
- `docs/` 仅保存项目自身的流程、决策、架构与产品规格。

