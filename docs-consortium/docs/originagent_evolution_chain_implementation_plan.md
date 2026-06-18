# OriginAgentEvolutionChain Implementation Plan

更新：2026-05-23

本文跟踪独立链侧项目 `D:\Demo\OpenHome\OriginAgentEvolutionChain`，与 `OpenHome` 客户端仓库解耦。

## 总原则

OriginAgent 客户端必须保持离线可用，不依赖链才能完成本地 staging、verification、activation、rollback 和 proof bundle 生成。

OriginAgentEvolutionChain 只记录治理事实、证明摘要和未来结算事实，不记录代码本体、prompt、facts 原文、私有遥测或本地路径。

执行路线必须区分北极星设计和 MVP。`originagent_evolution_chain_brainstorm.md` 中的完整威胁模型是长期设计边界，不等于第一版全部实现范围。MVP 只聚焦 tool 模组、证据权重和测试网提交闭环。

## 当前权威路线（2026-05-24）

```text
本节覆盖早期 brainstorm 和客户端 Phase 2+ 路线中的旧 Points / staking / Credit Deduction / ContributionPool / CreditPool 设想。

EC-15 候选：
  Network Bootstrap / Work Node Registry / Growth Reward Simulator。
  先定义 Genesis Manifest、Endpoint Manifest、Ingress Gateway、Artifact Mirror、Work Node、community evaluation claim 和 Contribution Points 增长模拟。

EC-16 候选：
  Reward Weight / Anti-Sybil Calibration。
  校准 formally valid / challenge-surviving / market-referenced / adoption-correlated 贡献权重。

EC-17 候选：
  Marketplace Dry Run / 非结算市场索引。
  只做索引、排序、展示和模拟，不做真实 settlement。

EC-18+：
  再评估真实 Points、staking、Credit Deduction、DAO、ContributionPool、CreditPool。
```

未来 EC 路线补充（2026-05-25）：

```text
当前执行计划不展开 EC-16+ 的完整社会经济层、治理层和商业化设计，避免把远期路线误读为当前实施范围。

EC-16A 已收敛并执行：
  Module Verification Protocol + Work Claim Artifact + Audit Linkage。
  已定义测试者如何记录升级模组来源、校验 moduleDigest、在 sandbox / runner 中验证、生成链下工作证明，再记录“谁负责、哪个 Agent 可选执行、关联哪些 artifact、证明 hash 是什么”。
  本阶段不做真实奖励、节点收益、市场结算或复杂反女巫权重。

远期候选内容已移入：
  agentplan/originagent_evolution_chain_future_ec_backlog.md。

2026-05-25 关于模块分发、公司准入、邀请担保、Agent 执行体护照、测试者验证协议、链下工作证明、多签恢复和公司收入模型的完整讨论记录：
  agentplan/originagent_evolution_chain_social_protocol_design_record_2026-05-25.md。
```

网络发布控制路线（2026-05-24 补充）：

```text
当前不急于公开 EVM 测试网。
当前不急于完整公开源码和官方部署地址。
长期目标明确为 OriginAgent 自营 private appchain / 自建底层链网络。
技术栈方向备选 Cosmos EVM 或 EVM appchain。
当前不从零自写共识引擎、VM 或 P2P 链底层。

推荐路线：
  Local Anvil
  -> PVE Private Devnet
  -> PVE Private Appchain
  -> Closed Public Network
  -> Public Testnet Or Public Appchain
  -> Production Network。

专门文档：
  OriginAgentEvolutionChain/docs/appchain-and-network-operations-plan.md。
```

## EC-1：独立链项目骨架、共享协议与最小 EVM 闭环

目标：

```text
建立独立链侧工程。
固化 Phase 1 proof bundle / manifest / digest 的共享协议。
提供 OriginAgentEvolutionChain CLI 校验证明并生成合约提交参数。
用 Solidity / Foundry 实现身份、模组、验证报告、commit-reveal 评分的最小合约闭环。
```

范围：

```text
spec/
sdk/
contracts/
fixtures/
docs/
```

不做：

```text
真实 Points
CreditPool / ContributionPool
ArenaRegistry
BaselineRegistry
Governor / DAO
验证节点网络
OCI push / pull
appchain
```

验收：

```text
npm test
forge test（本机安装 Foundry 后）
valid proof bundle 可由 SDK 校验。
prepare-module 输出可提交合约的 bytes32/hash/URI 参数。
合约测试覆盖 identity、module、verification report、score commit/reveal。
链上事件不包含 prompt、文件内容、facts 原文、本地路径。
```

## EC-2：测试网提交适配与 Artifact URI 工作流

目标：

```text
增加部署脚本和本地 Anvil / 测试网配置。
定义 OCI artifact URI 规范和离线签名 metadata。
提供 submit-module / submit-verification 的 dry-run 与交易准备。
不要求 OriginAgent 客户端直接依赖链 SDK。
```

范围：

```text
Foundry deploy script。
deployments/<network>.json 地址文件格式。
submit-module / submit-verification / submit-score-commit / submit-score-reveal CLI。
OCI URI digest 校验。
viem ABI 编码和可选 RPC 广播。
```

不做：

```text
真实 Points。
CreditPool / ContributionPool / ArenaRegistry / BaselineRegistry / Governor。
OCI push / pull。
Cosign / SBOM 真实验证。
主网部署。
```

验收：

```text
npm test。
npx --yes solc 编译检查合约和 deploy script。
安装 Foundry 后 forge test 可运行。
submit-* --dry-run 输出 calldata 且不触链。
去掉 dry-run 仍需显式 --broadcast、EVOLUTION_CHAIN_RPC_URL、EVOLUTION_CHAIN_PRIVATE_KEY。
```

## EC-3：Tools-only 外部验证证据权重 MVP

状态（2026-05-22）：

```text
代码实现已完成：
  VerificationRegistry 多 evidence、validator allowlist、invalidate 状态。
  SDK/CLI submit-tool-module、set-validator-profile、submit-validator-report、invalidate-evidence、evidence-summary。
  Tool proof fixture、validator evidence fixtures、schema、runbook。

本地验证已完成：
  npm test。
  npx --yes solc 编译检查。

外部验收已完成：
  独立云服务器 47.84.130.213 已执行 npm test 和 EC-3 dry-run 验收。
  docs/external_validator_artifact.ec3.json 已保存 sanitized external validator artifact。
  docs/ec3-external-validation-result.md 已记录结果与摘要。
  fixture 仍只证明集成路径，不替代外部验收记录。
  forge test 需在安装 Foundry 后执行。
```

## EC-3.5：外部验证流程产品化与安全收口

状态（2026-05-22）：

```text
代码实现已完成：
  create-external-validator-artifact。
  validate-external-validator-artifact。
  create-evidence-report。
  scripts/run-ec3-external-validation.sh。
  runbook / README 更新。

本地验证已完成：
  npm test。
  Git Bash 执行 scripts/run-ec3-external-validation.sh。

外部验收已完成：
  47.84.130.213 已执行 scripts/run-ec3-external-validation.sh。
  runner 输出 artifact/report/summary。
  validate-external-validator-artifact: ok=true。
  evidence-summary: ok=true, score=120, highConfidence=true, testnetOnly=true。

边界：
  不新增合约、不改变 sandbox-only 边界、不提高 evidence 经济权重。
```

目标：

```text
把链侧协议从“可提交 dry-run”推进到“可解释的最小验证闭环”。
首发只支持 tool 模组，不扩展 skill / memory / planning。
建立 evidence tier / weight 模型，让客户端自报、用户签名、验证节点报告有明确权重差异。
闭环不能只依赖 fixture；至少要有一份来自非本仓库 CI、独立机器运行的 validator_report。
```

范围：

```text
ToolModule schema:
  固定工具接口、JSON Schema 参数、权限声明、测试 fixture。

EvidenceWeight:
  local_client_report 低权重。
  user_signed_receipt 中权重。
  validator_report 只有通过 EC-3 最低门槛后才是高权重。
  unqualified_validator_report 低权重或零权重，并必须显式标记。
  foundation_seed_report 冷启动权重但必须标记。

Validator minimum gate:
  EC-3 先采用基金会 allowlist，不引入 CreditPool。
  validator identity 必须登记 operator_id、operator_group、runner_fingerprint_hash。
  同一 operator_group / runner_fingerprint_hash 的多份报告不能线性叠加权重。
  单一 validator 或单一相关 group 不能单独把 module 推入 high-confidence。
  至少保留一份 external_validator_artifact，证明报告来自非 CI 独立机器。

VerificationRegistry 扩展:
  记录 evidence_type、report_hash、reporter、operator_group_hash、weight、challenge_window_end、report_status。

CLI:
  submit-tool-module。
  submit-validator-report。
  evidence-summary。

Challenge window:
  先只做状态和事件，不做真实 Credit Deduction / 信用扣除。
  被挑战成立的报告标记 invalidated，并降低 EC-3-only validator reputation / weight。
  EC-3 reputation 默认 sandbox-only，不直接迁移到未来真实 Points / Credit Deduction 阶段。
```

不做：

```text
真实 Points。
ContributionPool / CreditPool。
DAO / Governor。
Trait registry。
baseline advancement。
skill / memory / planning 模组。
自动安装或 safe-auto。
复杂反事实评估。
```

验收：

```text
一个 tool fixture 可提交为 module。
一个 validator report fixture 可绑定到 module，但 fixture 不是 EC-3 完成条件。
至少一份 validator_report 来自独立机器，且不是本仓库 CI 产物。
evidence-summary 能显示按来源分层后的证据权重。
客户端自报不能单独让模块进入高置信状态。
测试覆盖伪造客户端高采用报告不能超过低权重上限。
测试覆盖未通过 allowlist 的 validator_report 不能获得高权重。
测试覆盖同一 operator_group / runner_fingerprint_hash 多报告不能绕过多样性上限。
测试覆盖单一 qualified validator + 客户端自报仍不能单独进入 high-confidence。
测试覆盖 invalidated report 只触发 EC-3-only 降权，不产生真实 Credit Deduction。
EC-3 链上/索引数据明确标记 sandbox-only；未来主网信誉初始化不得默认继承。
```

## EC-4：Challenge Adjudication + contribution standing

状态（2026-05-23）：

```text
代码实现已完成：
  VerificationRegistry 增加 challengeId 公式、ChallengeRecord、公开 challenges getter。
  submitChallenge 对所有地址开放，只允许挑战 Active evidence。
  resolveChallenge 仅 foundation owner，可 uphold/reject。
  upheld challenge 会 invalidate evidence，并按 testnetReputation 结算 +5/-10。
  rejected challenge 会扣 challenger -2。
  self-challenge 使用同一规则，upheld 净变化 -5。
  legacy invalidateEvidence 后再 resolve challenge 不 revert，并发 ChallengeResolvedOnAlreadyInvalidated。

2026-05-24 补丁：
  submitChallenge 增加 challengeWindowEnd 校验；challengeWindowEnd=0 视为 legacy / no-window evidence，仍可挑战。
  resolveChallenge 只有在 upheld challenge 确实把 evidence 从 Active 变为 Invalidated 时才结算 +5/-10。
  如果 evidence 已经被 legacy invalidateEvidence 标记为 Invalidated，后续 upheld challenge 只记录 ChallengeResolvedOnAlreadyInvalidated，不再重复结算 testnetReputation。

SDK/CLI 已完成：
  computeEvidenceId(report) 与合约 evidenceId 公式一致。
  computeChallengeId(evidenceId, challenger, reasonHash) 与合约 challengeId 公式一致。
  submit-challenge / resolve-challenge dry-run。
  create-challenge-record / validate-challenge-record。
  challenge-summary。
  evidence-summary --challenge-summary。

Fixtures/docs/scripts 已完成：
  challenge_record.upheld.valid.json。
  challenge_record.rejected.valid.json。
  challenge_record.self.valid.json。
  challenge_record.privacy.invalid.json。
  challenge-record / challenge-summary JSON Schema。
  scripts/run-ec4-challenge-validation.sh。
  docs/ec4-challenge-runbook.md。
  docs/ec4-challenge-validation-result.md。

本地验证已完成：
  npm test: 40 passed。
  Git Bash 执行 scripts/run-ec4-challenge-validation.sh: passed。
  npx --yes solc 编译检查: passed。
  forge test 未执行：本机未安装 Foundry。

外部验收状态：
  47.84.130.213 已恢复 root key 登录并启用 2G swap。
  已安装独立 Node v24.11.1 / npm 11.6.2。
  已执行 scripts/run-ec4-challenge-validation.sh。
  远端 npm test: 40 passed。
  远端 runner 输出：/root/originagent-ec4-20260523102340/OriginAgentEvolutionChain/out/ec4-challenge-validation。

边界：
  不新增 Points / Credit Deduction / CreditPool / ContributionPool / DAO。
  contribution standing 只做审计和负向约束，不产生经济收益，不默认迁移主网。
```
## EC-5：Anvil Live Chain Transaction Closure

状态（2026-05-23）：

```text
代码实现已完成：
  已把 EC-1 到 EC-4 的 dry-run/offline audit 闭环推进到 Anvil 本地链真实交易。
  继续只使用本地 Anvil，不做公网测试网、真实 Points、CreditPool、ContributionPool、DAO 或 OriginAgent 客户端集成。

  loadDeployment 支持 deploymentsDir，live run 不覆盖 deployments/local.json fixture。
  CLI 增加 --deployments-dir 透传。
  SDK/CLI 增加 register-identity，角色只接受 developer / validator / operator。
  SDK 增加 chain-state-check 读链能力，用 viem readContract 读取 identity/module/evidence/challenge/reputation。
  scripts/run-ec5-anvil-live-flow.sh 启动全新 Anvil、部署合约、广播 identity/module/evidence/challenge/resolve 交易并读回状态。

本地验证：
  npm test: 43 passed。
  npx --yes solc 编译检查: passed。
  npm run test:contracts 未在本机执行：本机未安装 Foundry。
  scripts/run-ec5-anvil-live-flow.sh 未在本机执行：本机缺 Foundry/Git Bash runtime。

外部验收已完成：
  47.84.130.213 默认 Node 已切到 v24.11.1 / npm 11.6.2。
  47.84.130.213 已安装 Foundry v1.7.1-dev alpine/musl build，避免 CentOS 8 GLIBC 2.28 与 linux_amd64 预编译包不兼容。
  远端 npm test: 43 passed。
  远端 npm run test:contracts: 21 passed。
  远端 scripts/run-ec5-anvil-live-flow.sh: passed。
  远端输出：/root/originagent-ec5-live/OriginAgentEvolutionChain/out/ec5-anvil-live-flow。

验收读回：
  moduleExists=true。
  evidenceStatus=invalidated。
  challengeStatus=upheld。
  challenger testnetReputation=+5。
  reporter testnetReputation=-10。
  evidenceId=0x54713e83485ffd987e0d4dd68f7615462e3d9366264fc3cc967d50f59930e9cb。
  challengeId=0x9716d7844f288fc4dcd13faee3ebc2503dd7cbf4b0b1ca2f05821de9c9e1c5d4。

边界：
  Anvil 私钥仅用于脚本测试上下文。
  live deployment 写入 out/ec5-anvil-live-flow/deployments/local.json，不提交地址 fixture。
  EC-5 只证明本地链交易路径，不产生经济权益。
```

## EC-6：Event Indexer + Audit Bundle

状态（2026-05-23）：

```text
代码实现已完成：
  SDK ABI 补齐 11 个链上事件，enum 字段按 uint8 解码。
  新增 index-events CLI，用 viem public client 一次读取四个合约地址的 logs，并输出 originagent.evolution.event.v1 JSONL。
  新增 audit-bundle CLI，交叉校验 events.jsonl、evidence report 和 challenge record。
  audit-bundle 复用 computeEvidenceId、computeChallengeId、computeEvidenceSummary 和 privacy scan。
  scripts/run-ec5-anvil-live-flow.sh 已升级，在 chain-state-check 后追加 index-events、audit-bundle，并断言 ok=true。

审计边界：
  EvidenceSubmitted 事件不包含 proofBundleHash / reportHash。
  evidenceId 校验必须结合 evidence report artifact，events.jsonl 单独不能重建 evidenceId。
  EC-6 不改合约、不引入数据库、不做公网测试网、不做 Points/DAO/CreditPool/ContributionPool。

本地验证：
  npm test: 54 passed。
  npx --yes solc 编译检查: passed。

外部验收已完成：
  47.84.130.213 已执行升级后的 scripts/run-ec5-anvil-live-flow.sh。
  远端 runner 内 npm test: 54 passed。
  远端 npm run test:contracts: 21 passed。
  远端输出：/root/originagent-ec6-live/OriginAgentEvolutionChain/out/ec5-anvil-live-flow。

审计包读回：
  audit-bundle.ok=true。
  events.total=7。
  EvidenceSubmitted / ChallengeSubmitted / EvidenceInvalidated / ChallengeResolved 均存在。
  evidence_linkage[0].artifact_matched=true。
  challenge_linkage[0].record_matched=true。
  challenge_linkage[0].resolution_found=true。
  challenge_linkage[0].invalidation_found=true。
  privacy_scan.ok=true。
  challenger reputation delta=+5。
  reporter reputation delta=-10。
```

## EC-7：Server Standardization + Multi-Node Independent Validation

状态（2026-05-23）：

```text
代码实现已完成：
  新增 scripts/bootstrap-ec7-node.sh，用 SSH 对远端节点做幂等标准化。
  新增 scripts/run-ec7-multi-node-validation.sh，执行两台远端服务器的独立验证闭环。
  SDK 测试新增 multi-node rejected challenge audit bundle 用例。
  EC-7 runner 生成两份独立 validator evidence，并提交到同一条 coordinator Anvil chain。
  rejected challenge 保留挑战审计路径，同时不 invalidates evidence。

服务器角色：
  coordinator / validator-1: 47.84.130.213。
  validator-2 / auditor: 154.40.59.232。

标准化结果：
  validator-2 已安装 Node v24.15.0 / npm 11.12.1。
  validator-2 已安装 forge/anvil/cast 1.7.1。
  validator-2 已启用 2G swap。
  Foundry 工具已链接到非交互 SSH PATH。
  server-standardization artifact 不写生产密钥、Anvil 私钥、password、Points、本地路径或 URL query。

远端验收已完成：
  coordinator npm test: 55 passed。
  coordinator npm run test:contracts: 21 passed。
  validator-2 npm test: 55 passed。
  validator-2 npm run test:contracts: 21 passed。
  validator-2 scripts/run-ec5-anvil-live-flow.sh: passed。
  scripts/run-ec7-multi-node-validation.sh: passed。

多节点读回：
  evidence-summary.ok=true。
  acceptedReports=2。
  score=120。
  highConfidence=true。
  effectiveValidatorGroups.length=2。
  effectiveRunnerFingerprints.length=2。
  challengeStatus=rejected。
  primary evidence status=active。
  secondary evidence status=active。
  challenger testnetReputation=-2。
  audit-bundle.ok=true。
  audit-bundle events.total=9。
  audit-bundle evidence_linkage.length=2。
  audit-bundle privacy_scan.ok=true。

输出：
  out/ec7-multi-node-validation/server-standardization.coordinator.json。
  out/ec7-multi-node-validation/server-standardization.validator-2.json。
  out/ec7-multi-node-validation/validator-1/evidence-report.json。
  out/ec7-multi-node-validation/validator-2/evidence-report.json。
  out/ec7-multi-node-validation/events.jsonl。
  out/ec7-multi-node-validation/audit-bundle.json。
  out/ec7-multi-node-validation/evidence-summary.json。
  out/ec7-multi-node-validation/challenge-summary.json。
  out/ec7-multi-node-validation/chain-state-check.json。

文档：
  docs/ec7-multi-node-validation-runbook.md。
  docs/ec7-multi-node-validation-result.md。

边界：
  仍只使用本地 Anvil。
  不做公网测试网、真实 Points、CreditPool、ContributionPool、DAO、PVE 矩阵或数据库 indexer。
  不让 OriginAgent 客户端依赖链运行。
```

## EC-8：Agent Passport Identity Anchor

状态（2026-05-23）：

```text
代码实现已完成，远端验证结果记录在 docs/ec8-agent-passport-validation-result.md。

实现内容：
  新增 AgentPassportRegistry，独立于 IdentityRegistry。
  Passport ID = keccak256(abi.encode(owner, agentKeyHash, genesisHash))。
  agentKeyHash = sha256(raw 32-byte Ed25519 public key)。
  genesisHash = keccak256(abi.encode(owner, agentKeyHash, genesisNonce, metadataHash))。
  migrationHash = keccak256(abi.encode(passportId, oldAgentKeyHash, newAgentKeyHash, migrationNonce))。
  migrationIndex 由合约自动递增，metadataHash 允许 bytes32(0)。
  新增 Passport 注册和迁移事件，并纳入 index-events / audit-bundle。

SDK/CLI：
  新增 compute-agent-key-hash / compute-agent-genesis-hash / compute-agent-passport-id / compute-agent-migration-hash。
  新增 create/validate agent passport record。
  新增 create/validate agent migration record。
  新增 register-agent-passport / record-agent-migration，默认 dry-run。
  broadcast 时校验 owner 与 EVOLUTION_CHAIN_PRIVATE_KEY 推导地址一致。
  chain-state-check 支持 --passport-id。
  audit-bundle 支持 --agent-passports / --agent-migrations。

Runner：
  新增 scripts/run-ec8-agent-passport-live-flow.sh。
  runner 启动全新 Anvil，部署五个合约，注册 Passport，记录迁移，读链，索引事件，生成 audit bundle。
  EC-8 JSON/JSONL artifacts 通过隐私扫描。

边界：
  Agent Passport 是公开身份锚点，不是记忆加密密钥。
  不存原始 memory、facts、prompt、telemetry。
  不做 encrypted memory vault。
  不做 Points、staking、ContributionPool、CreditPool、DAO。
  不做 owner transfer / recovery。
  OriginAgent 客户端仍可完全离线运行。

建议路线：
  EC-9: Encrypted Memory Vault 原型。
  EC-10: Agent Reputation。
  EC-11: Evolution Unit Kind Registry / 开放式可进化单元协议。
  EC-12: Adversarial Simulation Harness / Abuse Lab。
  EC-13: 根据 EC-12 结果收口反女巫、反串谋和审计权重。
  EC-14+: 再评估 Contribution Points、模块市场、真实 Points、staking、DAO。

详细备忘：
  docs/ec8-agent-passport-runbook.md。
  docs/ec8-agent-passport-validation-result.md。
  docs/ec8-agent-passport-memory-economy-note.md。
```

## EC-9：Encrypted Memory Vault + Cross-Machine Restore

状态（2026-05-23）：

```text
代码实现已完成，本地验证结果记录在 docs/ec9-memory-vault-validation-result.md。

客户端实现：
  OriginAgentclient 新增 OriginAgent.evolution.memory_vault。
  新增 originagent evolution-vault export / inspect / verify / import。
  新增 memory_vault_exported / memory_vault_imported 本地事件类型。
  export 使用 AES-256-GCM 加密 canonical JSON payload。
  import 默认 dry-run，--apply 才写目标 workspace。
  --replace 只覆盖 vault 中同路径冲突文件，不删除目标已有其他文件。

Vault schema：
  顶层 schema_version = originagent.evolution.memory_vault.v1。
  payload schema_version = originagent.evolution.memory_vault_payload.v1。
  payload_digest、encrypted_payload_digest、vault_digest 均为 lowercase sha256 hex。
  source_ledger_terminal_hash 来自 EvolutionLedger.verify_chain().terminal_event_hash。
  metadata 作为 AES-GCM AAD；encrypted_payload_b64 只保存 ciphertext+tag。

Allowlist：
  SOUL.md。
  USER.md。
  memory/MEMORY.md。
  memory/facts.jsonl。
  memory/evolution_events.jsonl。

明确排除：
  history.jsonl。
  sessions。
  provider config。
  API key / Points。
  .originagent/evolution_identity.json 私钥。

链侧实现：
  新增 sdk/src/memory-vault.ts。
  audit-bundle 支持 --memory-vaults。
  AuditBundle 增加 memory_vault_linkage。
  校验 memory vault 公共 digest、自身 privacy scan、Passport/migration artifact 关联。
  链侧不解密 vault，不验证 payload 明文。

Runner：
  新增 scripts/run-ec9-memory-vault-restore-flow.sh。
  runner 生成最小 source workspace，导出 vault，inspect/verify，dry-run import，apply import，校验恢复文件 digest，合成 Passport 事件并生成 audit bundle。
  本地 Windows 环境 bash 指向未安装的 WSL，runner 需在远端 Ubuntu 或 Git Bash/WSL 可用环境运行。

本地验证：
  OriginAgentclient tests/evolution/test_memory_vault.py: 7 passed。
  OriginAgentEvolutionChain npm test: 68 passed。

边界：
  不新增合约。
  不上传数据库或对象存储。
  不做公网测试网。
  不发行 Points。
  不迁移 Agent Ed25519 私钥。
  key-file 由用户通过独立安全通道传输。
  OriginAgent 客户端仍可完全离线运行。

建议路线：
  EC-10: Agent Reputation，不可转让声誉。
  EC-11: Evolution Unit Kind Registry / 开放式可进化单元协议。
  EC-12: Adversarial Simulation Harness / Abuse Lab。
  EC-13: 根据 EC-12 结果收口反女巫、反串谋和审计权重。
  EC-14+: 再评估 Contribution Points、模块市场、真实 Points、staking、DAO。
```

## Investor Whitepaper V0.1：融资 Pitch 白皮书主稿

状态（2026-05-22）：

```text
已在 C:\Users\15216\Documents\baipishu 生成中文融资 Pitch 白皮书主稿：
  OriginAgent_Evolution_Chain_Whitepaper_zh_v0.1.md

定位：
  面向 AI infra + Web3/crypto + 传统 VC 的混合型投资人。
  项目对外统一名称为 OriginAgent Evolution Chain。
  20-30 页完整版中文主稿。
  不包含具体融资金额、估值或条款。

叙事：
  不从“发链”切入，而从 Agent 能力供应链信任层切入。
  强调 OriginAgent Phase 1 本地进化运行时已完成。
  强调 Evolution Chain Phase 2 是共享协议、链下证明、验证节点和测试网适配。
  强调不发行真实 Points、不在早期启动最终 private appchain、不从零写共识/VM、不做空泛 DAO、不让客户端依赖链运行。
  同时保留长期自营 private appchain / 自建底层链网络目标。

下一步：
  打磨投资人版表达。
  设计图表视觉版。
  视需要导出 PDF / Deck。
```

## EC-10：Agent Passport Reputation Checkpoint

状态（2026-05-23）：

```text
代码实现已完成，本地 SDK 验证结果记录在 docs/ec10-reputation-validation-result.md。

合约新增：
  AgentReputationRegistry。
  VERSION = ec10.0.0。
  构造时绑定 AgentPassportRegistry。
  checkpointReputation(passportId, score, positiveCount, negativeCount, reportHash) 仅 owner 可调用。
  checkpoint 前校验 passport 存在。
  同一 passport 可重复 checkpoint，后一次覆盖当前值并递增 checkpointCount。
  事件 AgentReputationCheckpointed 进入 index-events / audit-bundle。

兼容性决策：
  不修改 VerificationRegistry.testnetReputation。
  地址级 contribution standing 继续服务 challenge 流程。
  AgentReputationRegistry 是独立的 Passport 级最终 checkpoint。
  AgentReputationRegistry 在 deployment 中可选，旧 EC-5 到 EC-9 deployment 不因缺第 6 合约而失效。

SDK/CLI：
  新增 sdk/src/reputation.ts。
  新增 create/validate agent reputation record。
  新增 create/validate agent reputation report。
  新增 checkpoint-agent-reputation，默认 dry-run。
  chain-state-check --passport-id 返回 reputation.available / score / reportHash / checkpointCount。
  audit-bundle 支持 --reputation-reports，并新增 reputation_checkpoint_linkage。

声誉规则：
  v1 只处理 challenger 行为。
  challenge_upheld = +5。
  challenge_rejected = -2。
  reporter -10 暂留地址级 testnetReputation，不进入 Passport reputation，避免双重扣分。
  Passport 注册、迁移、memory vault linkage 只进入 continuity_signals，不直接加分。

Runner：
  新增 scripts/run-ec10-agent-reputation-flow.sh。
  runner 部署 6 合约，注册 Passport，提交两份 evidence，分别制造 upheld/rejected challenge，生成 reputation report，上链 checkpoint，读链，索引事件，生成 audit bundle。

本地验证：
  npm test: 74 passed。
  npm run test:contracts 未在本机执行：Windows shell 未安装 Foundry。

边界：
  不做 Points、staking、ContributionPool、CreditPool、DAO。
  不做自然人唯一性证明。
  不解决同 owner 多 Passport 的声誉碎片化，v1 依赖 foundation owner 审核。
  链上只保存 report hash 和当前 checkpoint，完整 report JSON 必须归档。
```

## EC-11：Evolution Unit Kind Registry / 开放式可进化单元协议

状态（2026-05-23）：

```text
代码实现已完成，本地与远端验证结果记录在 docs/ec11-unit-kind-registry-validation-result.md。

核心判断：
  当前 ModuleType / tool plugin 视角过窄。
  Evolution Chain 不应该预设未来 Agent 只能由固定模块类型组成。
  链不定义 Agent 的最终形态，只定义新进化单元如何被提出、验证、挑战、标准化和废弃。
  模块市场和 Contribution Points 应建立在开放 unit kind 协议之上，否则会把市场锁死在早期想象里。

概念调整：
  Module 降级为 Evolution Unit 的一种实现形态。
  Evolution Unit = 任何可声明权限、可验证、可审计、可回滚、可被治理的 Agent 进化单元。
  tool / skill / workflow / domain_pack 只是首批样例，不是最终 ontology。

可能的 unit_kind：
  tool。
  skill。
  workflow。
  domain_pack。
  memory_strategy。
  planner_policy。
  reflection_policy。
  self_model_adapter。
  capability_policy。
  provider_router。
  multi_agent_protocol。
  evaluation_suite。
  identity_recovery_policy。
  tool_runtime。
  workflow_engine。
  domain_reasoner。

Unit Kind Proposal 最小字段：
  kind_id。
  display_name。
  description。
  runtime_surface。
  schema_hash。
  schema_uri。
  required_fields。
  permission_model。
  verification_profile。
  risk_class。
  sandbox_requirement。
  install_semantics。
  rollback_semantics。
  example_artifacts。
  compatibility_rules。
  deprecation_rules。

生命周期：
  draft。
  experimental。
  candidate。
  canonical。
  deprecated。
  rejected。

治理原则：
  社区可以提交新的 unit kind proposal。
  experimental kind 可以低门槛进入测试，不代表高信任或官方推荐。
  canonical kind 必须经过 validator review、challenge window 和明确的验证 profile。
  初期不采用纯 Points vote。
  初期治理由 proposer + validator review + challenge window + foundation/validator committee 组合完成。
  后续再评估 reputation-weighted voting。

EC-11 非目标：
  不发行 Points。
  不做真实经济。
  不做 DAO。
  不强行统一所有 Agent 架构。
  不让客户端依赖链才能运行。
  不把任何一个 unit_kind 设为永久唯一标准。

EC-11 验收信号：
  能创建/校验 unit kind proposal artifact。
  能把 experimental/candidate/canonical/deprecated 状态写入链上或审计 artifact。
  能验证 proposal schema hash、权限模型、sandbox 要求和 rollback 语义。
  audit-bundle 能证明某个 evolution unit 使用了哪个 unit kind 版本。
  旧 tool module flow 仍可作为 tool kind 的兼容样例继续工作。

合约新增：
  EvolutionUnitKindRegistry。
  VERSION = ec11.0.0。
  proposeKind(kindIdHash, versionHash, schemaHash, proposalHash) 开放提交 Draft。
  setReviewReport / setKindStatus 仅 owner 可调用。
  kindVersionKey = keccak256(abi.encode(kindIdHash, versionHash))。
  状态支持 Draft / Experimental / Candidate / Canonical / Deprecated / Rejected。

SDK/CLI：
  新增 sdk/src/unit-kind.ts。
  新增 create/validate unit kind proposal。
  新增 create/validate unit kind review。
  新增 propose-unit-kind / set-unit-kind-review / set-unit-kind-status，默认 dry-run。
  chain-state-check 支持 --unit-kind <kind_id> --version <version>。
  audit-bundle 支持 --unit-kind-proposals / --unit-kind-reviews。

兼容性：
  不修改 ModuleRegistry enum 和 submit flow。
  EvolutionUnitKindRegistry 是 deployment 可选合约。
  旧 EC-5 到 EC-10 deployment 不因缺第 7 合约而失效。
  tool@1 与 ModuleType.Tool 的关系是 audit convention，不是合约级外键。

Runner：
  新增 scripts/run-ec11-unit-kind-registry-flow.sh。
  runner 部署 7 合约，创建 tool@1 proposal/review，设置 Canonical，读链，索引事件，生成 audit bundle。

验证：
  本地 npm test: 80 passed。
  本地 npx --yes solc --bin: passed。
  本地 npm run test:contracts 未执行：Windows shell 未安装 Foundry。
  远端 154.40.59.232 npm test: 80 passed。
  远端 npm run test:contracts: 38 passed。
  远端 EC-11 runner: passed。

建议路线：
  EC-12: Adversarial Simulation Harness / Abuse Lab，先模拟攻击和滥用。
  EC-13: 根据 EC-12 结果收口反女巫、反串谋和审计权重。
  EC-14+: 再推进 Contribution Points / 模块市场 MVP。
  更后续再评估真实 Points、staking、DAO。
```

## EC-12：Adversarial Simulation Harness / Abuse Lab

状态（2026-05-23）：

```text
代码实现已完成，验证结果记录在 docs/ec12-adversarial-simulation-validation-result.md。

核心判断：
  不能在没有攻击模拟的情况下直接进入 Contribution Points 或模块市场。
  当前协议已经有 Passport、reputation、unit kind、audit-bundle，但还需要主动验证女巫、串谋、刷声誉、冒名 kind、spam、篡改和隐私泄漏。
  EC-12 使用单条 Anvil 链 + 多钱包 + 多 artifact 变体即可覆盖 v1，不需要购买物理服务器。

SDK/CLI：
  新增 sdk/src/adversarial.ts。
  新增 analyze-adversarial-simulation。
  新增 validate-abuse-report。
  audit-bundle 支持 --abuse-report，并暴露 abuse_signals。

Abuse categories：
  passport_sybil。
  reputation_farming。
  validator_collusion。
  unit_kind_typosquatting。
  module_spam。
  artifact_tampering。
  privacy_leakage。

Runner：
  新增 scripts/run-ec12-adversarial-simulation-flow.sh。
  runner 部署 7 合约，制造正常路径和攻击路径，生成 abuse-report、normal audit、tampered audit、privacy scan 和 attack-scenarios。

验证：
  本地 npm test: 85 passed。
  远端 154.40.59.232 npm test: 85 passed。
  远端 npm run test:contracts: 38 passed。
  远端 EC-12 runner: passed。
  attack-scenarios.json 记录 high_or_critical_count=9，覆盖 artifact_tampering、module_spam、passport_sybil、privacy_leakage、reputation_farming、unit_kind_typosquatting、validator_collusion。

边界：
  不新增合约。
  不做真实攻击。
  不扫描公网。
  不加 Points、staking、Credit Deduction、DAO。
  abuse report 不自动惩罚，只作为审计信号。
```

## EC-13：Trust Policy / Risk Gate

状态（2026-05-23）：

```text
代码实现已完成，验证结果记录在 docs/ec13-trust-policy-validation-result.md。

核心判断：
  EC-12 已经能发现攻击和滥用，但还需要把 abuse signal 翻译成可执行的准入建议。
  EC-13 是解释层，不是惩罚层；它输出 gate，不写链、不扣分、不 Credit Deduction、不发 Points。
  EC-14 Contribution Points / marketplace 应消费 EC-13 的 trust policy report，而不是直接消费裸 abuse signals。

SDK/CLI：
  新增 sdk/src/trust-policy.ts。
  新增 evaluate-trust-policy。
  新增 validate-trust-policy-report，支持 --source-abuse-report 交叉校验。
  audit-bundle 支持 --trust-policy-report，并只暴露 trust_policy_summary。

Trust gates：
  test_credit: eligible / manual_review / blocked / not_applicable。
  module_recommendation: eligible / manual_review / blocked / not_applicable。
  unit_kind_canonicalization: eligible / manual_review / blocked / not_applicable。
  validator_weight: normal / capped / zeroed / not_applicable。
  artifact_handling: accepted / manual_review / quarantined / not_applicable。

Runner：
  新增 scripts/run-ec13-trust-policy-flow.sh。
  runner 依赖 EC-12 abuse-report.json 和 events.jsonl；缺失时提示先跑 EC-12。
  runner 生成 trust-policy-report、validation、audit-bundle 和 summary。

验证：
  本地 npm test: 90 passed。
  本地 npm run test:contracts 未执行：Windows shell 未安装 Foundry。
  远端 154.40.59.232 npm test: 90 passed。
  远端 npm run test:contracts: 38 passed。
  远端 EC-12 runner: passed。
  远端 EC-13 runner: passed。
  trust-policy-summary.json 记录 max_risk=critical、total_subjects=18、blocked_count=10、manual_review_count=6、quarantined_count=3。

边界：
  不新增合约。
  不修改 VerificationRegistry.testnetReputation。
  不修改 EC-10 reputation checkpoint。
  trust policy report 是 EC-14 的输入建议，不是自动处罚系统。

建议路线：
  EC-14: Contribution Points 沙盒应先读取 EC-13 trust gates。
  模块市场、真实 Points、staking、DAO 继续后置。
```

## EC-14：Contribution Points Sandbox

状态（2026-05-23）：

```text
代码实现已完成，本地 SDK 验证结果记录在 docs/ec14-test-credit-validation-result.md。

核心判断：
  EC-14 是进入 marketplace dry run 前的非真钱积分沙盒。
  Contribution Points 只验证准入、记账、审计和 trust gate 消费路径。
  它不是 ERC20，不可转让，不可提现，不代表真实经济权益。

合约新增：
  ContributionPointsLedger。
  VERSION = ec14.0.0。
  构造时绑定 AgentPassportRegistry。
  grantCredit / consumeCredit 仅 foundation owner 可调用。
  账本按 passportId 记录 granted、consumed、balance、operationCount、exists。
  grant / consume 共用 usedActionHashes，防止 action 重放。
  consume 不得超过余额。
  合约不实现 transfer / approve / allowance / withdraw。

部署与兼容：
  Deploy.s.sol 部署第 8 个合约。
  ContributionPointsLedger 是 deployment 可选合约。
  旧 EC-5 到 EC-13 deployment 不因缺 ContributionPointsLedger 而失效。
  EC-12 和 EC-13 没有新增合约，因此 contractVersion 从 ec11.0.0 跳到 ec14.0.0。

SDK/CLI：
  新增 sdk/src/test-credit.ts。
  新增 create/validate Contribution Points action。
  新增 create/validate Contribution Points report。
  新增 grant-test-credit / consume-test-credit，默认 dry-run。
  chain-state-check --passport-id 返回 test_credit.available / granted / consumed / balance / operationCount。
  audit-bundle 支持 --test-credit-reports，并新增 test_credit_linkage。

Trust gate：
  grant / consume 只允许 test_credit gate eligible 或无相关 decision。
  检查 passport 和 owner address 两层 decision。
  manual_review / blocked 生成 deny action，不广播链上交易。
  deny action 不要求链上事件，audit linkage 标记 denied=true、event_found=null。
  合约本身不强制 trust gate，v1 由 SDK/runner/runbook 强制操作纪律。

固定金额：
  passport_bootstrap = 100。
  validator_report_grant = 25。
  module_submission_grant = 10。
  audit_request_fee = 5。
  challenge_bond = 10。
  blocked_by_trust_policy = 0。

Runner：
  新增 scripts/run-ec14-test-credit-sandbox-flow.sh。
  runner 要求先存在 EC-12 abuse-report 和 EC-13 trust-policy-report。
  runner 部署 8 合约，注册 clean/risky Passport，clean grant 100、consume 5，risky 只生成 deny artifact，索引事件并生成 audit bundle。

本地验证：
  npm test: 98 passed。
  本地 npm run test:contracts 未执行：Windows shell 未安装 Foundry。

边界：
  不做 marketplace。
  不做真实 Points。
  不做 staking、Credit Deduction、ContributionPool、CreditPool、DAO。
  不自动扣罚已有余额。
  Contribution Points 是审计输入和沙盒记账，不是自动处罚系统。

建议路线：
  EC-15 候选: Network Bootstrap / Work Node Registry / Growth Reward Simulator。
  EC-16 候选: Reward Weight / Anti-Sybil Calibration。
  EC-17 候选: Marketplace Dry Run / 非结算市场索引。
  EC-18+: 再评估真实 Points、staking、Credit Deduction、DAO。
```

## EC-14 后当前能力快照

状态（2026-05-24）：

```text
详细能力地图已记录在 OriginAgentEvolutionChain/docs/ec14-current-capability-map.md。

当前进化链已经具备：
  8 合约本地/远端验证闭环。
  module -> evidence -> challenge -> audit-bundle。
  Agent Passport 注册和迁移。
  memory vault public metadata linkage。
  Passport reputation checkpoint。
  Evolution Unit Kind proposal/review/status。
  EC-12 adversarial abuse report。
  EC-13 trust policy gate。
  EC-14 non-transferable Contribution Points sandbox。
  chain-state-check 可读 module/evidence/challenge/Passport/reputation/unit-kind/Test-Credit 状态。

当前进化链仍缺：
  first-class Node Operator identity。
  node_id。
  uptime / activity / useful work report。
  epoch reward pool。
  node reward weight。
  routing attribution 防刷规则。
  节点增长奖励的模拟和校准。
  marketplace dry-run 前的节点侧贡献账户。
```

核心判断：

```text
不应直接进入真实 Points 或 marketplace。
也不应设计“注册节点即可随时间领币”的机制。
这会立即诱导 Sybil、空跑节点、刷上传和 referral farming。

下一步应先定义节点身份和节点贡献，而不是定义真实积分。
Node ID 应是贡献账户，不是邀请码、稀缺编号资产或可交易身份。
节点价值应来自长期有效贡献、低风险状态和可审计活动。
```

## EC-15 前置架构边界：四层拆分

状态（2026-05-24）：

```text
EC-15 之前必须先固定四层边界：

1. OriginAgent 客户端层。
2. OriginAgent 躯体层 / Artifact 层。
3. OriginAgent 进化链层。
4. OriginAgent 节点层。
```

四层职责：

```text
OriginAgent 客户端层：
  用户本地 Agent runtime。
  负责本地执行、安装、卸载、activate、rollback、本地 memory、本地 prompt/facts/session。
  可以导出 proof bundle、adoption artifact、audit request。
  不依赖链或节点层才能运行。

OriginAgent 躯体层 / Artifact 层：
  存储模块包、升级包、manifest、schema、workflow、planner policy、memory strategy、multi-agent protocol 等可下载进化内容。
  可使用 IPFS、Arweave、OCI registry、Git release 或专用 artifact storage。
  进化链只记录 hash、digest、URI、schema hash、version hash、review hash、audit hash。

OriginAgent 进化链层：
  逻辑账本层和审计协议层。
  记录公开事实、hash、事件、Passport、module digest、evidence、challenge、reputation checkpoint、unit kind status、trust summary、Contribution Points。
  当前用 Anvil / 本地 EVM 闭环验证协议。
  长期目标是 OriginAgent 自营 private appchain，候选技术方向为 Cosmos EVM 或 EVM appchain。
  不是客户端 runtime，不是躯体层存储，不是真实经济系统。

OriginAgent 节点层：
  现实机器上的协议工作节点网络。
  负责索引、验证、审计、镜像、入口上传、沙盒试运行等工作。
  连接客户端层、躯体层和进化链层。
  是进化链协议的服务/执行网络，不是账本本身。
```

关键边界：

```text
EC-15 不是直接启动最终 private appchain。
EC-15 不先定义正式底层链 validator / sequencer / 出块治理。
EC-15 要为未来自营 private appchain 准备 Genesis Manifest、Endpoint Manifest、工作节点、入口、镜像和贡献度量对象。
EC-15 不决定谁可以使用 OriginAgent 客户端。
候选下一阶段定义网络发现、入口 gateway、artifact mirror、OriginAgent 进化网络工作节点和可度量公开贡献。
```

节点类型示例：

```text
Indexer Node：读取链上事件，生成 events.jsonl 和查询索引。
Community Validator / Evaluator Node：下载 artifact，复算 digest，运行测试，提交可挑战 evaluation claim。
Audit Node：生成 audit-bundle，检查 artifact 和链上事件一致性。
Artifact Mirror Node：镜像模块包、manifest、schema、review report 等躯体层内容。
Ingress / Gateway Node：帮助开发者或客户端上传 artifact，并把 hash/URI 提交到进化链。
Trial / Sandbox Node：隔离试运行模块，提交 adoption/failure/rollback 摘要。

注意：
  这些测试、试运行和评估报告是社区 claim，不是官方质检结论。
```

## EC-15 前置网络边界：发现、入口与社区工作层

状态（2026-05-24）：

```text
EC-15 的具体节点奖励设计之前，必须先固定网络接入和社区工作边界。

专门文档：
  OriginAgentEvolutionChain/docs/network-bootstrap-and-community-work-layer.md。
```

网络发现原则：

```text
公开网络清单是 bootstrap，不是唯一入口。
OriginAgent 官方域名可以提供默认 discovery source，但不能成为协议单点。

domain = 方便发现。
genesis manifest = 网络身份权威。
signed endpoint manifest = 可更新 endpoint 元数据。
chain state = 最终审计锚点。
artifact digest = 内容权威。
client cache = 抗短期宕机。
community mirrors = 抗中心化入口故障。
```

客户端应支持：

```text
读取内置 genesis manifest 或 manifest signing public key。
从官方域名、GitHub/release mirror、IPFS、Arweave、社区 mirror、已知节点和本地文件读取 manifest。
验证 manifest 签名、network_id、chain_id、合约地址、code hash、版本和过期时间。
缓存最近有效 manifest。
官方域名不可用时继续使用缓存 endpoint。
新客户端无法访问官方域名时支持手动导入 manifest。

manifest 必须拆分为：
  Genesis Manifest：锁定 network_id、chain_id、genesis deployment hash、root signer set。
  Endpoint Manifest：更新 RPC、indexer、gateway、mirror endpoint。

Endpoint Manifest 不能静默替换 Genesis Manifest 中的 root identity。
公网生产前应从单签名过渡到 m-of-n threshold signing。
```

公共 endpoint 职责：

```text
RPC endpoint:
  读链状态和广播签名交易。

Indexer endpoint:
  提供查询视图，不是最终权威。

Ingress / Gateway endpoint:
  接收公开 artifact envelope，检查 digest、signature、schema envelope，返回 receipt，可选 relay 链上 anchor。
  不做质量、安全、性能或是否值得安装的结论。

Artifact Gateway / Mirror:
  分发内容寻址 artifact。
```

官方协议边界：

```text
链、客户端、躯体层和官方 gateway 不负责测试用户上传内容质量。
不负责模块安全审计、压力测试、质量评分、推荐或权威认证。

它们只做协议完整性：
  digest 对齐。
  signature 对齐。
  schema envelope 可解析。
  submitter 可追踪。
  URI 可引用。
  report hash 可复算。
  challenge 可发起。
  privacy / secret scan 拒绝公开 artifact 中的 prompt、facts、raw telemetry、本地路径、URL query、API key 或 secret-like string。
```

privacy / secret scan 是协议卫生，不是官方安全审计。通过 privacy scan 不代表模块安全或高质量。

社区工作层原则：

```text
测试、评分、安全扫描、压力测试和采用报告交给社区验证市场。
这些报告是可挑战 claim，不是官方结论。

未来可能形成：
  Evaluation Validation Work。
  Validation Validation Work。
  Audit Validation Work。
  Challenge Validation Work。
  Distribution Validation Work。
```

## EC-15 前置发布控制：PVE Devnet 与自营 Private Appchain

状态（2026-05-24）：

```text
专门文档：
  OriginAgentEvolutionChain/docs/appchain-and-network-operations-plan.md。

当前结论：
  长期目标是 OriginAgent 自营 private appchain / 自建底层链网络。
  技术栈候选方向是 Cosmos EVM 或 EVM appchain。
  自建 appchain 不等于第一步从零写共识引擎、VM 或 P2P 链底层。
  在此之前，先用 PVE 私有 Devnet 验证网络发现、endpoint、artifact 分发、gateway、indexer、工作节点和奖励模拟。
```

发布阶梯：

```text
Local Anvil：
  单机快速开发和 runner 验证。

PVE Private Devnet：
  所有测试行为留在局域网。
  使用 10 台 Ubuntu VM 模拟 RPC、indexer、gateway、artifact mirror、客户端、worker、攻击者和监控。
  先不需要启动正式多 validator private appchain。

PVE Private Appchain：
  使用 Cosmos EVM 或 EVM appchain 候选框架运行 OriginAgent 自营私有链。
  测试 chain id、genesis、validator set、出块、同步、RPC failover、indexer recovery、备份和升级。

Closed Public Network：
  邀请少量外部开发者或验证者，仍使用 Contribution Points。

Public Testnet Or Public Appchain：
  公开 Genesis Manifest、Endpoint Manifest、SDK 和节点设置说明。
  预期会出现 spam、滥用、fork 和攻击测试。

Production Network：
  只有合约审计、manifest 多签、节点运维、artifact 分发、反滥用、奖励校准和治理 runbook 都稳定后再评估。
```

PVE 10 台 Ubuntu 的使用边界：

```text
现在可以准备机器，但不应把“连上 10 台机器”误认为 EC-15 完成。

10 台机器有意义的前提是已经有：
  Genesis Manifest。
  Endpoint Manifest。
  ArtifactIngressEnvelope。
  IngressReceipt。
  WorkNodeProfile。
  NodeActivityReport。
  GrowthRewardSimulationReport。
```

自建 appchain 的新增工程面：

```text
OriginAgentNetwork 候选仓库 / 包：
  PVE devnet 配置。
  Cosmos EVM / EVM appchain 技术评估。
  private appchain genesis、validator set 和节点配置。
  Docker Compose / systemd 部署。
  endpoint manifest 生成。
  gateway / indexer / artifact mirror 原型。
  monitoring / backup runbook。
  node onboarding runbook。
```

边界：

```text
短期不公开测试网。
短期不完整公开源码、官方 manifest 和部署地址。
不写新共识引擎。
不写新 VM。
不把公共 EVM 测试网当作目标网络架构。
不发行真实 Points。
不做 staking / Credit Deduction / DAO。
不让客户端依赖链才能运行。
```

## EC-15 候选：Network Bootstrap / Work Node Registry / Growth Reward Simulator

候选目标：

```text
如果 EC-15 继续作为下一阶段，应先定义 OriginAgent 网络发现、入口 gateway、artifact mirror、社区工作节点身份、活动报告和 Contribution Points 增长奖励模拟。
先用 Contribution Points 模拟节点扩张激励，不发行真实 Points。
```

EC-15 不做：

```text
底层区块链共识节点。
真实 Points。
marketplace settlement。
staking / Credit Deduction / DAO。
客户端运行时改造。
具体躯体层存储后端或存储网络实现。
```

建议对象：

```text
NodeOperatorProfile:
  node_id。
  passport_id。
  operator_address。
  node_public_key_hash。
  operator_group_hash。
  runner_fingerprint_hash。
  metadata_hash。

ArtifactIngressEnvelope:
  submitter_passport_id。
  submitter_address。
  artifact_digest。
  artifact_kind。
  storage_uri。
  nonce。
  created_at。
  submitter_signature。

IngressReceipt:
  artifact_digest。
  submitter_address。
  relayer_address。
  ingress_node_id。
  received_at。
  receipt_hash。
  gateway_signature。

NodeEpochActivityReport:
  node_id。
  epoch。
  uptime summary hash。
  indexed event count。
  formally valid community evaluation claim count。
  valid audit bundle count。
  challenge-surviving unit kind review count。
  routing attribution count。
  abuse/trust gate references。

GrowthRewardReport:
  epoch。
  epoch_reward_pool。
  active_node_count。
  eligible_node_count。
  node weights。
  node Contribution Points grants。
  capped/blocked reasons。
```

节点 ID 原则：

```text
node_id = hash(passport_id, operator_address, node_public_key, nonce)。

node_id 只标识节点贡献账户。
node_id 不可转让。
node_id 不应产生永久抽成。
node_id 不应因为编号早而自动更值钱。
```

奖励原则：

```text
epoch_reward_pool = fixed_or_decaying_pool(epoch)。

node_reward_i =
  epoch_reward_pool
  * node_weight_i
  / sum(active_node_weights)。

节点越多，平均收益自然下降。
但只有有效节点进入 active_node_weights。
```

node_weight 输入：

```text
uptime。
valid indexed events。
formally valid community evaluation claims。
valid audit bundles。
challenge-surviving unit kind reviews。
EC-10 Passport reputation。
EC-12 abuse report。
EC-13 trust policy gate。
owner/operator_group/runner_fingerprint diversity cap。
```

明确禁止：

```text
注册即验证工作。
多级推荐。
永久上传税。
只按上传数量给奖励。
只按 Passport 数量给奖励。
只按地址数量给奖励。
真实 Points emission。
staking / Credit Deduction / DAO。
```

后续路线：

```text
EC-15 候选: Network Bootstrap / Work Node Registry / Growth Reward Simulator。
EC-16: Reward Weight / Anti-Sybil Calibration。
EC-17: Marketplace Dry Run / 非结算市场索引。
EC-18+: 再评估真实 Points、staking、Credit Deduction、DAO。
```

## EC-15A：Challenge Adjudication v2 基线

2026-05-24 更新：

```text
EC-15A 已在当前工程阶段冻结为独立基线。

新增 ChallengeAdjudicationRegistry：
  validator committee 提交 challenge response / verdict。
  达到 quorum 后 finalize。
  finalize 通过 VerificationRegistry.resolveChallengeFromAdjudicator 结算 evidence 状态和 contribution standing。

VerificationRegistry 保留 legacy resolveChallenge，但 v2 adjudication 启动后 legacy owner resolve 会被阻断。
Deploy.s.sol 只部署并 propose adjudicator；runner 在 Anvil 中快进时间后单独 confirm。

已验证：
  本地 npm test: 103 passed。
  远端 154.40.59.232 forge test: 58 passed。
  远端 EC-15A runner: passed。
```

EC-15A 边界：

```text
EC-15A 仍是 Foundation allowlist committee MVP。
validator profile 仍由 owner/foundation 管理。
submitVerdict 仍是明文 verdict，不适合公开激励。
operatorGroupHash / runnerFingerprintHash 在 EC-15A 中仍参与 quorum 去重。
真实 Points、staking、Credit Deduction、DAO、marketplace settlement 仍禁止。
```

下一阶段：

```text
EC-15B: Public Adjudication Hardening。
目标是 commit-reveal、timeout / ExpiredNoQuorum、Commitment State Vault、challenge bond artifact、operator/runner hash 降级为 diversity hint。
EC-15B 完成前不得引入真实经济激励或空投预期积分。
```

## EC-15B：Public Adjudication Hardening

2026-05-24 Phase 2 更新：

```text
EC-15B 合约状态机已完成并提交：
  ChallengeAdjudicationRegistry.VERSION = ec15b.0.0。
  verdict 已从明文 submitVerdict 切换为 commitVerdict / revealVerdict。
  response / commit / reveal deadline 已进入合约状态机。
  ExpiredNoQuorum 不回调 VerificationRegistry，不结算 reputation。
  quorum 只统计 Foundation allowlist 中已 reveal 的独立 EVM validator 地址。
  operatorGroupHash / runnerFingerprintHash 只作为事件 hint，不再参与合约 quorum 去重。

SDK artifact / transaction surface 已完成：
  EC-15A challenge_response.v1、validator_verdict.v1、adjudication_report.v1 保持 legacy artifact 校验兼容。
  EC-15B 新增 validator_verdict_commitment.v1、validator_verdict_reveal.v1、adjudication_report.v2。
  transactions.ts 新增 commitValidatorVerdictTransaction、revealValidatorVerdictTransaction、expireChallengeNoQuorumTransaction。
  finalizeChallengeAdjudicationTransaction 只接受 finalized adjudication_report.v2。
  submitValidatorVerdictTransaction 保留为 legacy helper，但生产路径明确拒绝。

本地验证：
  npm test: 103 passed。
```

后续 EC-15B Phase 3+：

```text
新增 SQLite Commitment State Vault 和 vault-backed CLI。
更新 audit-bundle、chain-state-check、Contribution Points bond artifact 和 Trust Policy unresolved dispute。
新增 EC-15B runner、runbook、validation result。
```

2026-05-24 Phase 3 更新：

```text
Commitment State Vault 已完成：
  sdk/src/adjudication-vault.ts 使用 Node 24 node:sqlite DatabaseSync。
  vault 在 commit broadcast 前持久化 challengeId、validator、claimedUpheld、verdictHash、methodHash、salt、commitmentHash。
  reveal / retry 从 vault 读取 salt；缺少 vault 或 export 时明确报错，不能恢复 salt。
  支持 export-verdict-commitment / import-verdict-commitment 迁移备份。
  retry-verdict-reveal 支持 reveal_pending 但链上未 reveal 的 dropped tx / reorg-like 本地不一致场景。

CLI 已新增：
  create-verdict-commitment。
  commit-validator-verdict。
  reveal-validator-verdict。
  retry-verdict-reveal。
  list-pending-verdict-reveals。
  export-verdict-commitment。
  import-verdict-commitment。
  expire-challenge-no-quorum。

本地验证：
  node --test sdk/test/adjudication-vault.test.ts: passed。
```

后续 EC-15B Phase 4+：

```text
更新 audit-bundle、chain-state-check、Contribution Points bond artifact 和 Trust Policy unresolved dispute。
新增 EC-15B runner、runbook、validation result。
```

2026-05-24 Phase 4 更新：

```text
EC-15B audit / state inspection surface 已完成：
  audit-bundle 支持 adjudication_report.v2 的 commit / reveal / finalize / expire linkage。
  audit-bundle 校验 AdjudicationPhaseStarted deadline、ValidatorVerdictCommitted commitmentHash、ValidatorVerdictRevealed verdictHash、ChallengeAdjudicationFinalized / ChallengeAdjudicationExpiredNoQuorum 终局事件。
  audit-bundle 不重算 quorum，不把 operatorGroupHash / runnerFingerprintHash 当 quorum proof。
  chain-state-check --challenge-id 读取 ChallengeAdjudicationRegistry 的 phase、response、commit/reveal count、quorum、finalized / expired outcome。
  Contribution Points challenge bond 仍是纯链下 artifact，不触发链上 credit movement。
  TrustPolicyDecision 新增可选 dispute_status: resolved | unresolved；unresolved 继续映射到既有 manual_review gate，不新增 admission gate 枚举。

本地验证：
  npm test: 112 passed。
```

2026-05-24 Phase 5 更新：

```text
EC-15B runner / docs / validation result 已完成：
  scripts/run-ec15b-public-adjudication-hardening-flow.sh。
  docs/ec15b-public-adjudication-hardening-runbook.md。
  docs/ec15b-public-adjudication-hardening-validation-result.md。
  README 已补充 EC-15A / EC-15B 能力、命令和安全边界。

runner 覆盖：
  upheld path: response -> 3 commits -> 3 reveals -> finalize upheld -> evidence invalidated。
  rejected path: response -> 3 commits -> 3 reveals -> finalize rejected -> evidence active。
  expired path: no response -> delayed commit -> no quorum -> expire no quorum。
  chain-state-check 读回 finalized / expired adjudication state。
  audit-bundle.ok=true。

已验证：
  本地 npm test: 112 passed。
  本地 git diff --check: passed。
  远端 154.40.59.232 npm test: 112 passed。
  远端 154.40.59.232 npm run test:contracts: 62 passed。
  远端 EC-15B runner: passed。

修正记录：
  runner 初版 CHALLENGER_PRIVATE_KEY 与 CHALLENGER_ADDRESS 不匹配。
  已改为使用 funded VALIDATOR_2 账号作为 challenger，并在远端复跑通过。

EC-15B 当前边界：
  Foundation allowlist 仍是 validator 准入控制面。
  operatorGroupHash / runnerFingerprintHash 只作为 diversity hint。
  challenge bond 仍是 Contribution Points 链下 artifact，不触发链上 credit movement。
  不引入真实 Points、staking、Credit Deduction、DAO、marketplace settlement、节点验证工作奖励或空投预期积分。
```

## EC-16A：Module Verification Protocol + Work Claim Artifact + Audit Linkage

2026-05-25 更新：

```text
EC-16A 已完成：
  sdk/src/module-verification.ts。
  module_manifest.v1。
  module_acquisition_receipt.v1。
  verification_run_receipt.v1。
  community_work_claim.v1。
  create / validate CLI 命令。
  audit-bundle community_work_linkage。
  scripts/run-ec16a-module-verification-protocol-flow.sh。
  docs/ec16a-module-verification-protocol-runbook.md。
  docs/ec16a-module-verification-protocol-validation-result.md。

已验证：
  node --test sdk/test/module-verification.test.ts: passed。
  node --test sdk/test/module-verification.test.ts sdk/test/indexer.test.ts: 32 passed。
  Git Bash EC-16A runner: passed。

EC-16A 边界：
  不改 Solidity 合约。
  不做真实奖励。
  不做节点收益。
  不做 marketplace settlement。
  不做复杂反女巫权重。
  不做开发者邀请担保。
  不做公司多签灾难恢复。
  不做 TreasuryRouter。
  不做 Agent Passport 数量限制。
```

### EC-16A 核心边界：责任主体与执行体

```text
responsibleAddress = 责任地址。
responsibleRole = Developer / Validator / Operator / Company / User。
agentPassportId = Agent 执行体护照，可选。
runnerId = 验证运行器编号，可选。
```

设计决定：

```text
社区真正的贡献责任主体是 responsibleAddress，而不是 Agent Passport。
Agent Passport 是 execution identity / 执行体身份，用来记录哪个 Agent 执行了工作、积累了什么执行历史、如何跨机器迁移。
奖励、惩罚、准入、担保和违规责任优先归 responsibleAddress。
Agent Passport 可以作为信誉和执行历史输入，但不能替代 Developer / Validator / Operator 的主体责任。
```

开发者提交和测试者验证不应被强制绑定到 OriginAgent 客户端：

```text
OriginAgent Client = 普通产品入口。
CLI = 开发者 / 验证者专业入口。
CI Bot = 自动化提交入口。
ValidatorRunner = 验证者运行器。
Sandbox = 隔离测试环境。
```

开发者可以通过 Client、CLI 或 CI 提交模组。测试者不应该把未知模组直接装进自己的生产 Agent；应优先使用干净 test Agent、validator runner 或 sandbox 执行验证。

### EC-16A 已实现模组验证协议

```text
module_manifest.v1 = 模组清单。
module_acquisition_receipt.v1 = 下载校验回执。
verification_run_receipt.v1 = 验证运行回执。
community_work_claim.v1 = 社区工作声明。
```

`module_manifest.v1` 已实现字段：

```text
schema_version = originagent.evolution.module_manifest.v1。
module_id = 模组编号。
module_name = 模组名称。
version = 模组版本。
storage_uri = 存储 / 分发地址。
storage_kind = 存储类型，可选。
module_digest = 模组包哈希。
digest_algorithm = sha256 / keccak256。
responsible_address = 责任地址。
agent_passport_id = Agent 执行体护照，可选。
source_repository_uri = 源码仓库地址，可选。
created_at = 创建时间。
manifest_hash = 清单哈希。
```

`module_acquisition_receipt.v1` 已实现字段：

```text
schema_version = originagent.evolution.module_acquisition_receipt.v1。
module_id = 模组编号。
manifest_hash = 清单哈希。
storage_uri = 下载地址。
downloaded_digest = 下载后本地计算哈希。
expected_digest = 预期模组哈希。
hash_matched = 是否匹配。
acquired_by = 获取 / 校验者地址。
acquired_at = 获取时间。
created_at = 创建时间。
receipt_hash = 回执哈希。
```

`verification_run_receipt.v1` 已实现字段：

```text
schema_version = originagent.evolution.verification_run_receipt.v1。
module_id = 模组编号。
manifest_hash = 清单哈希。
acquisition_receipt_hash = 下载校验回执哈希。
validator_address = 验证者地址。
environment_hash = 环境哈希。
run_result = passed / failed / inconclusive。
log_uri = 日志地址。
log_digest = 日志哈希。
started_at = 开始时间。
completed_at = 完成时间。
created_at = 创建时间。
receipt_hash = 运行回执哈希。
```

工作证明材料可以是视频、文档、日志、截图、benchmark 输出或审计报告。材料存放在线下：

```text
GitHub repository / release asset。
IPFS。
Arweave。
公司镜像。
对象存储。
其他可下载仓库地址。
```

URI 只负责可下载，hash 才负责可信。audit / client 必须重新下载并校验 `proof_digest` 或 `module_digest`；可访问性问题后续由 liveness evidence 处理。

### EC-16A CommunityWorkClaim 已实现字段

```text
schema_version = originagent.evolution.community_work_claim.v1。
claim_id = 工作声明编号。
responsible_address = 责任地址。
agent_passport_id = Agent 执行体护照，可选。
work_kind = development / testing / audit / documentation / operation。
summary = 工作摘要。
proof_uri = 工作证明地址。
proof_digest = 工作证明哈希。
artifact_hashes = 关联 artifact 哈希列表。
referenced_events = 关联链上事件列表，可选。
created_at = 创建时间。
claim_hash = 声明哈希。
```

### Agent Passport 数量边界（未来约束，EC-16A 未实现）

当前 `AgentPassportRegistry` 不限制同一 owner 注册多少 passport。后续不能把这个现状直接接到奖励权重上，否则会形成 Agent-level Sybil 攻击面。

未来 `AgentPassportRegistry v2` 或准入层应考虑：

```text
max_active_passports_per_formal_subject = 3。
passport_status = Active / Retired / Revoked。
activePassportCount = 正式主体当前活跃 Agent 数量。
retireAgentPassport = 退休 Agent 护照。
extraAgentQuota = 额外 Agent 额度。
quotaReasonHash = 额外额度理由哈希。
```

限制对象应是正式准入主体，而不是任意钱包地址。一个正式 Developer / Validator / Operator 默认最多 3 个 Active Agent：主力 Agent、验证 / 测试 Agent、沙箱 / 实验 Agent。历史 passport 不能删除，应保留审计轨迹；退休 passport 不应继续获得工作权重或 Contribution Points 权重。

远期内容已移入：

```text
agentplan/originagent_evolution_chain_future_ec_backlog.md
agentplan/originagent_evolution_chain_social_protocol_design_record_2026-05-25.md
```
