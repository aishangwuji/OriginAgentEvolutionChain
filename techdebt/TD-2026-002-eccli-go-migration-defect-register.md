---
schema_version: 1
---

# TD-2026-002: eccli Go 迁移缺陷与未接入模块登记清单

## 基本信息
| 字段 | 内容 |
|------|------|
| 创建时间 | 2026-09-16T23:10:00+08:00 |
| 创建人 | opencode（deepseek-v4.1-flash） |
| 优先级 | P3（待评估） |
| 状态 | 待评估 |

## 登记明细
| 序号 | 位置/描述 | 发现时间 | 关联规则 | 备注 |
|------|-----------|----------|----------|------|
| 1 | `eccli/cmd/eccli/main.go:406-420` `create-module-manifest`：`module_digest` 用 `sha256(module_id@version)` 计算，而非 EC-16A 定义的制品真实摘要；`created_at` 硬编码 `2026-06-18T00:00:00.000Z`；`storage_kind` 硬编码 `github_release`；缺 `--module-digest/--digest-algorithm/--storage-kind/--created-at` | 2026-09-16 | 边界数据校验 | 待人工确认是否修复 |
| 2 | `eccli/cmd/eccli/main.go:1073` `score-commit` 的 `requireAllHex64` 要求**不含 `0x`** 的 64 位 hex，与 README/TS 示例（`0x...`）不一致，按文档用法直接报错 | 2026-09-16 | 契约一致性 | 待人工确认 |
| 3 | CLI 接口与设计 §5.2「命令名保持不变」不符：`verify-proof` 用 `-p`（TS 为位置参数）、`validate-proof` 为 Go 新增、`score-commit` 对应 TS `compute-score-commit`；且设计中的 `index-events` **未实现**，导致 audit-bundle 的链上事件输入链路缺失 | 2026-09-16 | 契约一致性 | 待人工确认 |
| 4 | 未接入包：`eccli/pkg/validate`（本次仅部分接入）、`eccli/pkg/audit`、`eccli/pkg/artifact` 无任何调用方（`grep` 无引用） | 2026-09-16 | 规则6 未接入模块禁默认删除 | 标记转人工，不删 |
| 5 | `contracts-go/` 下 **0 个 Go 单测**（设计 Phase1 要求「合约 Go 测试覆盖」）；`eccli/` 仅 `pkg/validate` 有测试 | 2026-09-16 | 测试策略 | 待补 |
| 6 | 构建不可复现：依赖 `go mod vendor` + 手工补 `common/v2/opencrypto/{gmssl,tencentsm}` 的国密 cgo 静态库与头文件；无 Makefile/脚本固化该配方，且服务器无外网需离线构建 | 2026-09-16 | 生产级工程导向 | 建议脚本化 |
| 7 | 缺 `deployments-go/`、`sdk.yml`、ChainMaker 开发网与合约安装脚本，`eccli` 只能 dry-run，无法真实上链（设计 Phase1/Phase2 未完成） | 2026-09-16 | 目标驱动执行 | 阶段二处理 |
| 8 | `eccli/pkg/validate/privacy.go` 的 Windows 路径正则采用 `sdk/src/evidence.ts` 的**锚定**形式（`(?:^|[^A-Za-z0-9])`），与 `sdk/src/proof.ts` 的**非锚定**副本行为不同（非锚定会把 `https://` 中的 `s://` 误判为本地路径）。本实现有意选锚定以规避 URL 误报，属已知跨语言差异；另有 Go RE2 与 JS `\s`（Unicode 空白）语义差异。已加回归测试固定当前行为 | 2026-09-16 | 契约一致性 | 已加测试；如需与 proof.ts 完全一致需人工裁决 |
| 9 | `eccli/pkg/canonical/canonical.go:79,117` 用 `encoding/json.Marshal` 会 HTML 转义 `<`/`>`/`&`，而 `sdk/src/canonical.ts` 用 `JSON.stringify` 不转义；含这些字符的字符串会算出**不同哈希**，导致跨语言校验不一致（既有缺陷，非本次引入；当前 fixture 未覆盖） | 2026-09-16 | 边界校验/契约一致性 | 待人工确认，建议优先级 P1 |
