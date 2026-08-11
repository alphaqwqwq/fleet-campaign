# GOV-002-02：Workflow V2 治理审查

- 状态：Remediation in progress
- 下一动作：对修复后的 PR #14 新 head 重新执行独立审查。
- 证据：首轮冻结 head `ffe32b9`；独立审查结论 `remediation required`。
- 基线：`origin/main eb0e499` → PR #14 `ffe32b9`。

## 首轮 Findings

1. High：Agent 允许 `node*`、`gh api*`、子 Agent 调度等通用入口，可绕过职责边界；push/amend deny 模式不完整。
2. High：Review 可写报告但无法将报告纳入 Git，独立 Review Gate 无持久证据。
3. High：路线图与 PLAN-002/E002-03 的状态互相冲突，REVIEW-002-03 尚未进入 Git。
4. Medium：旧 Plan/Exec 仍把任意 Review 失败直接升级 Terra，与真实失败判据冲突。
5. Medium：Master 无法创建或回收 worktree，资产预算不可执行。
6. Medium：专用短提示词迁移不完整，旧目标文档和 PR #13 会重新引入该模式。
7. Medium：CI 未验证 Agent 权限、Markdown 链接和专用 prompt 回归。

## 补救

- 禁止角色 Agent 的 `task`、`node*` 与 `gh api*` 通用入口，补齐 force-push/amend deny；Master 仅获得受限 worktree 生命周期命令。
- Review 只可提交 `docs/06-reviews/**` 并快进到被审 feature PR，不可修改实现、amend、force-push 或合并。
- 同步 PLAN-002、E002-03 与路线图事实，新增 REVIEW-002-03 Git 记录。
- 局部 Review finding 先回原 Exec 修复；只有真实修复失败或复杂/契约问题才升级 Terra。
- 将全部开发会话入口收敛为五个通用角色模板，并清除稳定目标文档的专用短提示词引用。
- 新增 `npm run verify:governance` 并接入 CI，检查相对链接、危险 Agent 权限和专用 prompt 引用。
