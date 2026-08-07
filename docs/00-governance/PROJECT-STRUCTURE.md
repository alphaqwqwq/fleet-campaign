# 项目文件管理方案

## 1. 仓库边界

正式项目位于此独立公开仓库。原始参考资料与本仓库保持隔离，不得提交。

正式仓库使用 npm workspaces：

```text
fleet-campaign/
├─ apps/web/                         # React/Vite 网页
├─ packages/domain/                  # 纯规则状态机
├─ packages/protocol/                # 命令、快照、同步事件与运行时校验
├─ packages/persistence/             # 本地持久化、导入导出与迁移
├─ packages/realtime/                # PeerJS/WebRTC 传输适配器
├─ packages/narration/               # Hook、事实账本与降级文本
├─ packages/content/                 # 自写内容与校验
├─ docs/                             # 本文档体系
└─ .github/workflows/                # GitHub Actions
```

## 2. 代码依赖方向

```text
content ─┐
         ├─> domain ─> protocol ─> persistence / realtime / narration ─> web
fixtures ┘
```

- `domain` 不得导入 React、浏览器 API、PeerJS、IndexedDB、LLM SDK 或网络代码。
- `realtime` 只传递经过协议校验的命令、事件和快照，不得自行结算游戏规则。
- `persistence` 只保存版本化数据，不得从 UI 组件直接调用浏览器存储。
- `narration` 只消费已确认领域事件、可见事实和结构化分析；不得写入规则状态。
- `web` 只负责展示、收集意图、调用应用服务和渲染异步旁白。

## 3. Git 与提交

- `main` 始终保持可构建、可部署和可回滚。
- 每个 Exec 使用 `feature/exec-<计划>-<序号>-<短名>` 分支。
- 合并前必须通过本 Exec 所列检查，并在 Exec 文档填入提交哈希与验证证据。
- 合并 `main` 时使用普通 merge 或 squash；线上问题使用 `git revert`，不改写共享历史。

## 4. GitHub Actions 最小门禁

每个 Pull Request 与 `main` 推送都执行：

```text
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
```

