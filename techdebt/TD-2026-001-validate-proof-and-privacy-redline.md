---
schema_version: 1
---

# TD-2026-001: eccli validate-proof 空校验与隐私红线缺失

## 基本信息
| 字段 | 内容 |
|------|------|
| 发现时间 | 2026-09-16T23:00:00+08:00 |
| 发现人 | opencode（deepseek-v4.1-flash），阶段一服务器构建验证 |
| 关联Spec | docs/superpowers/specs/2026-06-18-chainmaker-migration-design.md |
| 关联规则 | P0 边界数据强制校验 / P0 安全边界最低要求 |
| 优先级 | P0 |
| 状态 | 已修复 |

## 详细描述
ChainMaker Go 迁移把 TypeScript SDK 的校验逻辑简化成了空壳，导致边界校验与隐私红线双双失守：

1. `cmdValidateProof`（原 `eccli/cmd/eccli/main.go:1039-1060`）只读 JSON 并打印 `canonical.HashJSON(bundle)`，不做任何字段/schema/哈希/隐私校验。实测把 `fixtures/challenge_record.privacy.invalid.json` 当参数也能输出 `Proof bundle valid.`。
2. `cmdVerifyProof` 内联校验只检查 14 个字段，而 TS `REQUIRED_FIELDS` 为 18 个（缺 `activation_event_hash`、`capability_snapshot_digest`、`state_branch_digest`、`signature_scheme`）；且无未知字段检查、无 `schema_version` 检查、无 `module_type` 校验、无 hex 格式校验。
3. Go 侧**完全没有隐私扫描**：本地绝对路径、URL 查询串、类密钥字符串、`prompt` 等私有字段均可通过校验，违反 spec 隐私红线。
4. `submit-module` 读入 proof bundle 后**不校验即构造上链参数**。

## 影响范围
- **影响文件**：`eccli/cmd/eccli/main.go`、`eccli/pkg/validate/validate.go`
- **影响功能**：`verify-proof` / `validate-proof` / `submit-module` 的入参校验与隐私过滤
- **潜在风险**：私有数据（prompt、本地路径、密钥）可被提交上链；篡改或畸形 bundle 可通过校验并进入广播路径

## 复现/验证路径
修复前（服务器 `/opt/oaec`）：
```
./eccli/eccli validate-proof -f fixtures/challenge_record.privacy.invalid.json   # 输出 "Proof bundle valid."，exit=0
```
修复后：同命令 exit=1，并逐条列出 `forbidden private field` / `local absolute path` / `URL query string` / `secret-like string`。
回归证据：`go test ./pkg/validate/... -v` 11 项全 PASS；`submit-module --dry-run` 对篡改 bundle 在广播前即拒绝。

## 修复方案
1. 新增 `eccli/pkg/validate/privacy.go`：`CollectPrivacyErrors` 逐条对齐 `sdk/src/proof.ts` 与 `sdk/src/evidence.ts` 的 `FORBIDDEN_KEYS` 与四个正则（Windows 路径、Unix 私有路径、URL 查询串、类密钥赋值）。
2. 重写 `eccli/pkg/validate/validate.go` 的 `ValidateProofBundle`，对齐 TS `validateProofBundle` 语义（必填字段/未知字段/schema/必填与可选 hex/module_type/signature_scheme/隐私/“仅当无结构错误才比对哈希”的次序）。
3. `verify-proof`、`validate-proof`、`submit-module` 统一接入该校验器；`EvidenceReport`/`ChallengeRecord`/`ModuleManifest` 补隐私扫描。
4. 新增 `eccli/pkg/validate/validate_test.go`（11 个用例，含真实 fixture 与数组嵌套路径）。

## 评审记录
| 日期 | 评审人 | 结论 |
|------|--------|------|
| 2026-09-16 | opencode 独立子 Agent 实例（general，只读核验） | 通过（PASS）。逐项比对 `privacy.go`/`validate.go` 与 `sdk/src/proof.ts`、`sdk/src/evidence.ts`：`FORBIDDEN_KEYS` 11/11 一致；必填字段 18/18 且次序一致；未知字段检查、schema 字面量、必填/可选 hex 字段、`module_type` 枚举、`signature_scheme`、以及"仅当无结构错误才比对哈希"的次序均一致；`main.go` 三处接线（verify-proof/validate-proof/submit-module）已确认；独立运行 `go test ./pkg/validate/... -v` 11 项全 PASS。发现 2 项跨语言差异与 1 项既有缺陷，均已登记至 TD-2026-002 第 8/9 条。 |
| 2026-09-16 | opencode（修复者） | 采纳核验结论；补充 8 个回归用例（大小写不敏感禁用字段、非对象输入、空 module_id/module_version、signature_scheme、可选 digest 非法非空值、"有结构错误时不比对哈希"、普通 URL 不被误判为本地路径、Windows 路径边界锚定）；未修复 canonical.go 既有缺陷（超出本次范围，转技术债）。 |
