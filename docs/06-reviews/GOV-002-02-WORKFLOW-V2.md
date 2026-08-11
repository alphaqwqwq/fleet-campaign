# GOV-002-02：Workflow V2 治理审查

- 状态：Pass
- 下一动作：Master 核验 PR #14 最终 checks 后合并，并核验合并后 `main` CI。
- 证据：首轮 `ffe32b9` 与后续 `8e4685f`、`545c47f`、`5da8254` 均经独立 findings-first 复审；最终固定 head `03de5f0` 结论 `pass`。
- 基线：`origin/main eb0e499` → PR #14 `03de5f0`。

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

## 第二轮 Findings 与补救

- 复审发现 raw `git add/push` 可追加路径/refspec，Master 的 branch/remove 模式也难以安全表达前置核验；最终取消所有角色 Agent 的 Git 写权限，由普通 Master 编排层在释放租约后集中执行提交、报告入库、推送、合并和安全回收。
- 治理门禁改为枚举 `docs/08-prompts/development`，只允许五个角色模板；PR #13 的专用 prompt 必须在补救时删除。
- REVIEW-002-03 已准确记录 `f0509cd..c787a95` 恢复专用 prompt 的事实。

## 第三轮 Finding 与补救

- 最终复审发现 `fleet-master` 仍允许会写入 refs/FETCH_HEAD 的 `git fetch*`。现已移除，并将常见 Git 写白名单纳入 `verify:governance` 回归检查；所有角色 Agent 只保留 Git/PR/CI 只读查询。
- 聚焦核验要求补齐 `reset/restore/clean` 回归检测；治理门禁现覆盖 Agent 已禁止的常见 Git 写命令全集。

## 最终结论

- `03de5f0` 的独立聚焦复审为 `pass`：角色 Agent 无 Git 写、通用 Node/GitHub API 或子 Agent 绕过；专用 prompt 枚举和治理 CI 生效。
- 本地治理门禁、typecheck、lint、129 项测试与 build 通过；PR #14 的 GitHub verify、Vercel 与 Preview Comments 全绿。
- 残余风险：OpenChamber 暂停/归档 API 与普通 Master 的全局权限不由仓库 Agent 配置控制，继续以 UI 暂停 Goal 和 Git 证据核验处理。
