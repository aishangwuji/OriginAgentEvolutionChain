# OriginAgentEvolutionChain Social Protocol Design Record

日期：2026-05-25

本文记录 2026-05-25 关于 OriginAgentEvolutionChain 后续社会协议层、模块分发层、角色准入层、Agent 执行体身份、工作证明、公司治理恢复和公司收入模型的完整设计讨论。

这不是当前已实现能力，也不是立即执行计划。本文的用途是避免后续推进时把关键设计聊天压缩失真。

## 0. 总结论

```text
currentImplemented = EC-16A 已完成的模块验证协议与工作声明审计闭环。
previousImplemented = EC-15B 已完成的挑战裁决硬化闭环。
nextExecutable = EC-16B / EC-17+ 候选，需要从 future backlog 中另拆独立计划。
futureBacklog = EC-16 full / EC-17 / EC-18 / EC-19 / EC-20 / EC-21+。
```

核心边界：

```text
responsibleAddress = 责任地址，代表真正负责的人、公司、开发者、测试者或运营者。
agentPassportId = Agent 执行体护照，代表执行工作的 Agent，不替代责任主体。
proofUri = 链下工作证明地址。
proofDigest = 链下工作证明哈希。
moduleDigest = 模组内容哈希，客户端安装必须重新计算并比对。
companyMultisig = 公司多签，早期掌舵人。
```

当前阶段仍必须避免：

```text
不要把 Contribution Points 宣传成金钱或空投预期。
不要把 Agent Passport 当作可刷奖励的身份。
不要把邀请制做成拉人返利。
不要把公司恢复多签做成超级管理员。
不要在没有真实市场验证前写死复杂经济模型。
```

## 1. 模块分发与躯体层存活

设计背景：

用户提出升级模组的“躯体层”可以选择 GitHub 仓库、GitHub release、git commit archive 或其他仓库分发地址。GitHub 是世界上最大的分发平台之一，但协议不应限制必须使用 GitHub。只要地址真实、有效、可访问、可下载，并且内容 hash 不变，就可以成为分发来源。

核心设计：

```text
storageUri = 模组分发地址。
storageKind = github_release / git_commit / ipfs / arweave / company_mirror / other_repository。
moduleDigest = 模组内容哈希。
sourceCommit = Git commit SHA，可选。
releaseTag = GitHub release 标签，可选。
mirrorUri = 公司或社区镜像地址，可选。
```

规则：

```text
URI 只负责可下载。
hash 才负责可信。
任何 Agent、测试者或客户端安装升级模组前，都必须下载内容并重新计算 moduleDigest。
computedDigest 必须等于链上 expectedDigest。
hash mismatch 时必须拒绝安装。
```

客户端安装规则：

```text
downloadedBytes = 客户端下载到的模组内容。
computedDigest = 客户端本地计算出来的哈希。
expectedDigest = 链上 moduleDigest。
installAllowed = computedDigest == expectedDigest。
```

防止的问题：

```text
防止 GitHub release 被替换。
防止仓库被投毒。
防止 storageUri 指向内容变化后仍被客户端安装。
防止开发者或攻击者事后声称“这是同一个模块”。
```

存活检测方向：

```text
ModuleLivenessChecker = 模块存活检测器。
storageReachable = URI 是否可访问。
hashMatched = 下载内容 hash 是否匹配 moduleDigest。
livenessReportHash = 存活检测报告哈希。
```

设计边界：

```text
不建议所有普通客户端直接把心跳写链上，否则会产生 spam。
客户端、轻节点、验证者或公司服务可以周期性检查 storageUri。
多次 unreachable 或 hash mismatch 后生成 liveness evidence。
liveness evidence 进入 VerificationRegistry / ChallengeAdjudicationRegistry 的证据与挑战闭环。
```

未来状态机候选：

```text
Submitted = 已提交，任何人可手动下载，但普通客户端不默认推送。
UnderTesting = 测试中，指定测试者或合格测试者验证。
TestPassed = 测试通过，可进入市场候选。
Published = 已发布，普通客户端可默认展示 / 推送。
Deprecated = 已废弃，被更好升级模组取代，但历史可追溯。
Invalidated = 已失效，挑战成立、投毒确认、hash mismatch 或严重不可用。
```

## 2. 开发者与测试者的中心化准入

设计背景：

用户希望公司作为早期掌舵人，通过社区、论坛、邮件、简历、作品集等方式筛选优秀开发者和测试者。公司严谨审核后发放资格，让这些人正式成为进化链 Developer / Validator，而不是让所有人都可以直接成为关键角色。

当前问题：

```text
IdentityRegistry 当前只表示自声明身份。
role = Developer / Validator / Operator 目前不是公司审核后的正式资格。
```

未来设计：

```text
DeveloperAdmissionRegistry = 开发者正式准入注册表。
ValidatorAdmissionRegistry = 测试者 / 验证者正式准入注册表。
CompanyGrant = 公司授予资格事件。
```

字段候选：

```text
applicant = 申请人地址。
role = Developer / Validator。
applicationHash = 简历、作品集、邮件审核记录或论坛申请材料的哈希。
reviewHash = 审核记录哈希。
decisionHash = 准入决定哈希。
reviewer = 公司审核人或公司多签。
status = Candidate / Active / Suspended / Revoked。
grantedAt = 授权时间。
revokedAt = 撤销时间。
```

隐私边界：

```text
链上不存简历原文。
链上不存邮箱原文。
链上不存聊天记录。
链上不存 KYC 原文。
链上只存 applicationHash / reviewHash / decisionHash。
公司可以保留原文材料，必要时公开原文让第三方复算 hash。
```

为什么中心化准入合理：

```text
早期网络质量比表面去中心化更重要。
公司愿意以自己的声誉筛选首批开发者和测试者。
链上记录让公司所有准入行为公开可审计。
这比“任何人自称 Developer / Validator”更稳。
```

## 3. 邀请制与担保责任

设计背景：

用户提出：技术大牛 A 通过公司审核成为正式开发者后，如果他认识技术同样优秀的 B，可以把有限的邀请资格给 B。A 与 B 深度耦合；如果 B 犯错，A 也要负责。

核心设计：

```text
SponsorshipRegistry = 邀请担保注册表。
sponsor = 邀请人 / 担保人地址。
invitee = 被邀请人地址。
role = 被邀请角色。
inviteQuota = 可用邀请额度。
sponsorLiability = 连带责任规则。
invitationId = 邀请编号。
acceptedAt = 接受时间。
status = Pending / Accepted / Revoked / Used。
```

规则：

```text
邀请不是拉人头奖励。
邀请不是多级推荐。
邀请不产生邀请返利。
邀请只表达担保责任。
```

连带责任候选：

```text
offender = 违规者地址。
sponsor = 担保人地址。
violationHash = 违规证据哈希。
penaltyToOffender = 对违规者的惩罚。
penaltyToSponsor = 对担保人的轻量连带惩罚。
quotaFreeze = 冻结担保人的邀请额度。
roleDowngrade = 多次担保失败后的资格降级。
```

建议的早期惩罚：

```text
先使用 reputation。
先使用 Contribution Points。
先使用 inviteQuota freeze。
先不要真实 Credit Deduction。
先不要真实 Points penalty。
```

防止的问题：

```text
防止开放注册导致关键角色质量失控。
防止无责任拉人。
防止邀请制变成 referral farming。
防止新人作恶时推荐人完全无成本。
```

## 4. 测试者数量限制与测试任务责任

设计背景：

用户提出：每个提案或升级模组不应无限开放给所有测试者，而是可以指定 5 到 10 个测试者测试。如果测试者接受任务后在规定时间内不提交测试结果，应承担惩罚。

设计方向：

```text
TestingRound = 测试轮。
moduleDigest = 被测模组哈希。
assignedValidators = 指定测试者列表。
requiredReports = 最低报告数量。
testingDeadline = 测试截止时间。
missedDeadlinePenalty = 超时未提交惩罚。
```

规则：

```text
被指派测试者必须在 deadline 前提交 ValidatorReport 或 VerificationRunReceipt。
无故不提交可以扣 reliability score、Contribution Points 或后续 bond。
早期不要惩罚过重，避免测试者背后形成过强压力。
```

防止的问题：

```text
防止测试者划水。
防止所有模块无人测试。
防止测试质量没有责任主体。
防止测试者无限接任务后不交付。
```

## 5. 普通用户、投票、候选开发者与账号泛滥

设计背景：

用户提出：普通用户可以随意注册，但可能有人大量注册账号攻击进化链。普通用户也可以投票，质量很高的人可以进入开发者试用期，成功后转正。

设计方向：

```text
User = 普通用户。
DeveloperCandidate = 开发者候选人。
ProbationDeveloper = 试用期开发者。
FormalDeveloper = 正式开发者。
```

普通用户注册边界：

```text
普通用户可以低门槛注册。
普通用户不能直接获得正式 Developer / Validator 权限。
普通用户的投票权重应低。
普通用户高质量贡献可成为候选信号。
```

反泛滥方向：

```text
低权重默认状态。
trust policy gate。
abuse report。
贡献历史。
挑战结果。
可能的生命周期 / inactive 标记。
未来 bond 或申请费。
```

防止的问题：

```text
防止大量账号直接影响关键治理。
防止普通用户注册变成验证工作。
防止投票刷量直接决定模块上架。
```

## 6. Agent Passport 是执行体护照，不是责任主体

设计背景：

用户追问：Agent 的编号到底是做什么的？社区真正贡献人是开发者还是 Agent？Agent 身份凭证未来只是宠物性质，还是有协议作用？

当前实现：

```text
passportId = keccak256(owner, agentKeyHash, genesisHash)。
owner = Agent 所属钱包地址。
agentKeyHash = Agent 本地密钥哈希。
genesisHash = Agent 创世状态哈希。
metadataHash = Agent 元数据哈希。
migrationCount = 迁移次数。
```

设计决定：

```text
responsibleAddress = 真正承担责任和收益的人 / 公司 / 开发者 / 测试者 / 运营者地址。
agentPassportId = 执行工作的 Agent 护照。
```

责任归属：

```text
奖励归 responsibleAddress。
惩罚归 responsibleAddress。
准入归 responsibleAddress。
担保责任归 responsibleAddress。
违规责任归 responsibleAddress。
Agent Passport 记录执行来源、迁移连续性、执行历史和 Agent 级信誉信号。
```

Agent Passport 应该做：

```text
executionProvenance = 执行来源证明。
executionHistory = 执行历史。
migrationContinuity = 跨机器迁移连续性。
agentScopedReputation = Agent 范围信誉。
memoryVaultLinkage = 加密记忆保险库关联。
trustPolicyInput = 信任策略输入。
```

Agent Passport 不应该做：

```text
不作为自然人证明。
不作为开发者正式资格。
不作为可交易 NFT 身份。
不作为邀请码资产。
不作为自动奖励账户。
不替代 Developer / Validator / Operator 的责任。
```

## 7. 每个正式主体最多 3 个活跃 Agent 的未来约束

设计背景：

用户指出：当前同一 owner 可以无限注册 Agent Passport，这可能成为 Agent-level Sybil 攻击点。如果每个主体只能注册 3 个活跃 Agent，就能减少泛滥，并让主体更珍惜 Agent。

当前缺口：

```text
AgentPassportRegistry 当前不限制同一 owner 注册多少 Passport。
只要换 agentKeyHash 或 genesisHash，就能继续注册新 passportId。
```

设计判断：

```text
限制任意钱包最多 3 个 Agent 没有太大意义，因为攻击者可以创建很多钱包。
限制对象应该是正式准入主体。
formalSubject = 公司审核通过的 Developer / Validator / Operator。
```

未来设计：

```text
maxActivePassportsPerFormalSubject = 3。
passportStatus = Active / Retired / Revoked。
activePassportCount = 当前活跃 Agent 数量。
retireAgentPassport = 退休 Agent 护照。
extraAgentQuota = 额外 Agent 名额。
quotaReasonHash = 额外额度理由哈希。
```

默认 3 个 Agent 的合理分工：

```text
primaryAgent = 主力工作 Agent。
validatorAgent = 测试 / 验证 Agent。
sandboxAgent = 实验 / 隔离 Agent。
```

规则：

```text
历史 Passport 不删除，保留审计轨迹。
Retired Passport 不应继续获得工作权重或 Contribution Points 权重。
Revoked Passport 表示因违规或安全风险被撤销。
公司或治理可基于 reasonHash 授予 extraAgentQuota。
```

防止的问题：

```text
防止一个正式主体用无限 Agent 刷工作记录。
防止 Agent Passport 数量直接变成奖励放大器。
防止 Agent 级信誉被无限重置。
```

## 8. 开发者提交与测试者验证不能只依赖 OriginAgent 客户端

设计背景：

用户追问：如果 Agent Passport 是执行体护照，是不是开发者只能通过 Agent 客户端提交升级模组？测试者应该怎么下载升级模组并使用与验证？当前有没有协议？

设计决定：

```text
开发者不应该只能通过 OriginAgent Client 提交。
测试者不应该把未知升级模组直接装进生产 Agent。
需要 Module Verification Protocol。
```

合法入口：

```text
OriginAgent Client = 普通产品入口。
CLI = 开发者 / 验证者专业入口。
CI Bot = 自动化提交入口。
ValidatorRunner = 验证者运行器。
Sandbox = 隔离测试环境。
TestAgent = 干净测试 Agent。
```

测试者验证流程：

```text
download module = 下载模组。
compute moduleDigest = 计算模组哈希。
compare expectedDigest = 比对链上模组哈希。
inspect permissions = 检查权限声明。
run in sandbox = 在沙箱运行。
produce proofBundle = 生成证明包。
submit evidence = 提交验证证据。
create work claim = 生成工作声明。
```

防止的问题：

```text
防止未知模组污染测试者生产 Agent。
防止测试者只口头声称运行过。
防止验证报告缺少下载、哈希、环境、方法和结果链路。
```

## 9. Module Verification Protocol 最小工件

EC-16A 不应只做 Work Claim。它应先补“测试者怎么获取和验证模组”的协议。

最小工件：

```text
module_manifest.v1 = 模组清单。
module_acquisition_receipt.v1 = 下载校验回执。
verification_run_receipt.v1 = 验证运行回执。
community_work_claim.v1 = 社区工作声明。
```

`module_manifest.v1`：

```text
schema_version = originagent.evolution.module_manifest.v1。
module_digest = 模组包哈希。
storage_uri = 下载地址。
storage_kind = github_release / git_commit / ipfs / arweave / mirror / other_repository。
runtime = 需要的运行时。
permissions = 权限声明。
entrypoint = 启动入口。
dependency_digest = 依赖锁定哈希。
test_instructions_hash = 测试说明哈希。
manifest_hash = 清单哈希。
```

`module_acquisition_receipt.v1`：

```text
schema_version = originagent.evolution.module_acquisition_receipt.v1。
module_digest_expected = 链上期望模组哈希。
module_digest_computed = 下载后本地计算哈希。
storage_uri = 下载地址。
downloaded_at = 下载时间。
hash_matched = 是否匹配。
acquirer = 下载校验者地址。
receipt_hash = 回执哈希。
```

`verification_run_receipt.v1`：

```text
schema_version = originagent.evolution.verification_run_receipt.v1。
responsible_address = 责任地址。
agent_passport_id = 执行 Agent 护照，可选。
runner_id = 验证运行器编号，可选。
sandbox_hash = 沙箱环境哈希。
module_digest = 被验证模组哈希。
method_hash = 验证方法哈希。
result_hash = 结果摘要哈希。
proof_uri = 链下证明材料地址。
proof_digest = 链下证明材料哈希。
proof_mime_type = 证明材料类型。
proof_size = 证明材料大小。
started_at = 开始时间。
finished_at = 结束时间。
receipt_hash = 运行回执哈希。
```

`community_work_claim.v1`：

```text
schema_version = originagent.evolution.community_work_claim.v1。
claim_id = 工作声明编号。
responsible_address = 责任地址。
responsible_role = Developer / Validator / Operator / Company / User。
agent_passport_id = Agent 执行体护照，可选。
runner_id = 验证运行器编号，可选。
claim_type = validator_report / challenge_participation / audit_bundle / liveness_check / artifact_mirror / verification_run。
referenced_events = 关联链上事件列表。
artifact_hashes = 关联 artifact 哈希列表。
proof_uri = 工作证明地址。
proof_digest = 工作证明哈希。
report_hash = 工作报告哈希。
created_at = 创建时间。
claim_hash = 声明哈希。
```

## 10. 工作量证明与链下存储

设计背景：

用户提出：工作量证明应该放在线下，可能是视频、文档、日志、截图、benchmark、审计报告，也可以存到 GitHub 或其他仓库，并使用 hash 保证不会改变。

设计决定：

```text
workProof = 工作证明材料。
proofUri = 证明材料地址。
proofDigest = 证明材料哈希。
```

可用存储：

```text
GitHub repository。
GitHub release asset。
IPFS。
Arweave。
company mirror。
S3 / R2 / OSS。
其他可下载仓库地址。
```

规则：

```text
链上不存视频、文档、日志原文。
artifact 不存敏感原文。
链上或 artifact 只存 proofUri 和 proofDigest。
audit 工具或客户端下载 proofUri 后重算 hash。
computedDigest 必须等于 proofDigest。
```

防止的问题：

```text
防止工作证明事后篡改。
防止大文件上链。
防止敏感日志直接进入公开链。
防止贡献声明没有证据材料。
```

## 11. 公司多签、灾难恢复与公司控制权

设计背景：

用户提出：多签地址丢失时，整个进化链管理权不能锁死；但终极多签也不能变成日常超级管理员。恢复后的新多签必须仍然由公司控制。

核心原则：

```text
公司控制权不是来自某个永不变化的多签地址。
公司控制权来自一套链上可验证的公司签名人策略。
```

核心结构：

```text
AdminController = 管理控制器合约，业务合约真正 owner。
dailyMultisig = 公司日常多签。
recoveryMultisig = 灾难恢复多签。
CorporateSignerRegistry = 公司授权签名人注册表。
DailyMultisigPolicy = 日常多签策略。
```

业务合约 owner：

```text
owner = AdminController 合约地址。
businessPermission = dailyMultisig 通过 AdminController 执行业务管理。
recoveryPermission = recoveryMultisig 只能在恢复模式下重置 dailyMultisig。
```

恢复模式：

```text
lastDailyAdminActionAt = 最近一次日常管理操作时间。
recoveryDelay = 60 days / 180 days 或更长。
recoveryActive = block.timestamp >= lastDailyAdminActionAt + recoveryDelay。
```

注意：

```text
EVM 不会自动定时执行。
恢复模式不是后台自动切换。
读取或调用时根据 block.timestamp 判断 recoveryActive。
```

新多签公司控制策略：

```text
wallet = 新日常多签地址。
implementation = Safe / 受认可多签实现。
threshold = 3/5 或 4/7 等门槛。
owners = 多签成员列表。
ownersHash = 多签成员列表哈希。
ownersAllRegistered = 成员均在 CorporateSignerRegistry。
minimumCompanySigners = 最低公司签名人数。
blockedSignerCount = 0。
policyOk = true。
```

`CorporateSignerRegistry` 字段：

```text
signer = 公司授权硬件钱包地址。
signerType = Founder / Officer / SecurityAdvisor / Custodian。
status = Active / Revoked。
metadataHash = 任命文件、雇佣协议、顾问协议或托管协议哈希。
addedAt = 加入时间。
revokedAt = 撤销时间。
```

两阶段重置流程：

```text
scheduleDailyMultisigReset = 排队重置日常多签。
newDailyMultisig = 新日常多签地址。
ownersHash = 新多签成员列表哈希。
threshold = 新多签门槛。
boardResolutionHash = 公司决议哈希。
eta = 当前时间 + 7 / 14 / 30 天。
```

然后新多签必须自证可用：

```text
acceptDailyAdmin = 新 dailyMultisig 自己调用，证明新多签真的能凑齐签名发交易。
```

最后执行：

```text
executeDailyMultisigReset = 执行重置。
dailyMultisig = newDailyMultisig。
lastDailyAdminActionAt = 当前时间。
oldDailyMultisig = 旧多签失效。
recoveryMultisig = 恢复休眠。
```

持续策略复查：

```text
currentOwners = 当前多签成员。
currentThreshold = 当前门槛。
policyOk = 当前多签仍满足 DailyMultisigPolicy。
executeAllowed = policyOk。
```

理由：

```text
Gnosis Safe / Safe 多签的 owners 可能被多签自己更改。
不能只在重置时检查一次。
高危业务操作应复查 dailyMultisig 当前 owners / threshold 是否仍满足公司策略。
如果多签偷偷换成非公司成员，AdminController 应拒绝执行高危操作。
```

终极多签权限边界：

```text
recoveryMultisig 不能批准开发者。
recoveryMultisig 不能设置验证者。
recoveryMultisig 不能修改模块状态。
recoveryMultisig 不能调 treasury。
recoveryMultisig 不能做日常治理。
recoveryMultisig 唯一权限是在 recoveryActive 时重置 dailyMultisig。
```

链下公司治理配套：

```text
hardwareWallet = 公司硬件钱包。
custodyPolicy = 密钥保管制度。
boardResolution = 董事会 / 管理层决议。
employmentOrAdvisorAgreement = 员工 / 顾问协议。
annualKeyAttestation = 年度钥匙存活证明。
```

防止的问题：

```text
防止日常多签丢失后系统锁死。
防止终极多签成为超级管理员。
防止 recoveryMultisig 把权限重置给陌生地址。
防止新 dailyMultisig 后续偷偷换成非公司成员。
防止旧多签丢失后仍残留业务权限。
```

## 12. 公司盈利与 Treasury 路线

设计背景：

用户希望公司能够靠进化链盈利，并询问是否可以在合约里设计。

设计判断：

```text
revenue = 公司收入，可以通过合约收费、分账、托管和归集。
profit = 公司利润，不能由合约保证，取决于真实市场需求和运营能力。
```

建议收入来源：

```text
marketplaceFee = 模块市场手续费。
reviewFee = 开发者 / 测试者人工审核费。
testingCoordinationFee = 测试调度服务费。
mirrorFee = 模块镜像与可用性服务费。
enterpriseFee = 企业网关 / API / indexer 订阅费。
adjudicationFee = 裁决与反垃圾手续费。
```

未来合约候选：

```text
TreasuryRouter = 公司收入路由与分账合约。
MarketplaceEscrow = 模块购买托管合约。
TestingRoundEscrow = 测试任务托管合约。
MirrorSubscription = 镜像 / liveness 服务订阅合约。
```

分账字段：

```text
payer = 付款人。
paymentPoints = 支付资产。
amount = 金额。
treasury = 公司金库地址。
developer = 模块开发者。
validatorPool = 测试者奖励池。
protocolFeeBps = 平台费率。
developerAmount = 开发者分成。
validatorAmount = 测试者分成。
treasuryAmount = 公司收入。
```

托管规则：

```text
模块购买款应先进入 escrow。
challengeWindow 内若发生 upheld challenge、hash mismatch 或 module tampering，可退款或信用扣除。
challengeWindow 结束且无有效争议后，释放给 developer / treasury / validatorPool。
```

保证金边界：

```text
developerBond / validatorBond / sponsorBond 是履约担保，不应直接算公司收入。
信用扣除时可分为 challengerReward、validatorReward、treasuryPenaltyShare、publicPool / burn。
早期只做 Contribution Points 或链下 artifact 模拟。
真实 Points bond / Credit Deduction 必须后置。
```

不建议早期做：

```text
Points holder revenue share。
持币分红。
buyback 承诺。
邀请返利。
注册验证工作。
节点被动收益。
把 Contribution Points 宣传为金钱或空投预期。
```

## 13. 当前执行建议

不要把本文全部一次性实现。

EC-16A 已完成：

```text
EC-16A = Module Verification Protocol + Work Claim Artifact + Audit Linkage。
```

EC-16A 已做：

```text
module_manifest.v1。
module_acquisition_receipt.v1。
verification_run_receipt.v1。
community_work_claim.v1。
hash validation。
privacy scan。
audit-bundle linkage。
runner / runbook / validation result。
```

EC-16A 没有做，也仍应保留到未来 EC：

```text
真实奖励。
节点收益。
复杂反女巫评分。
开发者邀请担保。
多签灾难恢复。
TreasuryRouter。
真实 Points / staking / Credit Deduction。
```
