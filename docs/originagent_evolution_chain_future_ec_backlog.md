# OriginAgentEvolutionChain Future EC Backlog

更新：2026-05-25

本文记录 OriginAgentEvolutionChain 的远期 EC 候选内容。这里的内容是 backlog，不是当前执行计划，也不是已实现能力。

目的：

```text
避免当前 implementation plan 过度设计。
把社会经济层、公司治理层、模块分发生命周期和商业化路线从当前执行文档中拆出。
只有当某一项成为“下一阶段可端到端验证的软件目标”时，才从本文拆成独立 EC 实施计划。
```

晋升到执行计划前必须满足：

```text
Is it needed for the next runnable demo? = 下一个可运行演示是否需要？
Can it be tested end-to-end? = 能否端到端测试？
Does it create irreversible governance constraints? = 是否制造不可逆治理约束？
Is it replacing a social/business decision too early? = 是否过早把社会/商业决策写进合约？
```

当前状态：

```text
EC-16A 已完成：Module Verification Protocol + Work Claim Artifact + Audit Linkage。
已定义测试者如何记录升级模组来源、校验 moduleDigest、在 sandbox / runner 中验证、生成链下工作证明。
贡献事实现在可以通过 module_manifest.v1、module_acquisition_receipt.v1、verification_run_receipt.v1、community_work_claim.v1 记录、验证和审计。
奖励权重、反女巫、市场、治理和收入全部后置。
```

完整设计讨论记录：

```text
agentplan/originagent_evolution_chain_social_protocol_design_record_2026-05-25.md
```

## 关键设计决定：责任主体、Agent 执行体与工作证明

这部分不能省略。否则 Work Claim 会把“谁负责”和“哪个 Agent 执行”混成一个概念。

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
奖励、惩罚、准入、担保、违规责任和未来 bond 优先归 responsibleAddress。
Agent Passport 可以作为信誉、执行历史、迁移连续性和 trust policy 输入，但不能替代 Developer / Validator / Operator 的主体责任。
```

开发者提交和测试者验证不应被强制绑定到 OriginAgent 客户端：

```text
OriginAgent Client = 普通产品入口。
CLI = 开发者 / 验证者专业入口。
CI Bot = 自动化提交入口。
ValidatorRunner = 验证者运行器。
Sandbox = 隔离测试环境。
```

开发者可以通过 Client、CLI 或 CI 提交模组。测试者不应该把未知升级模组直接装进自己的生产 Agent；应优先使用干净 test Agent、validator runner 或 sandbox 执行验证。

工作证明材料应链下保存，并用 hash 锚定：

```text
proofUri = 工作证明地址。
proofDigest = 工作证明哈希。
proofMimeType = 证明材料类型。
proofSize = 证明材料大小。
```

证明材料可以是视频、文档、日志、截图、benchmark 输出或审计报告。可存放在 GitHub repository / release asset、IPFS、Arweave、公司镜像、对象存储或其他可下载仓库地址。URI 只负责可下载，hash 才负责可信。

Agent Passport 数量边界：

```text
当前 AgentPassportRegistry 不限制同一 owner 注册多少 passport。
这个现状不能直接接入奖励权重，否则会形成 Agent-level Sybil 攻击面。
未来限制对象应是正式准入主体，而不是任意钱包地址。
```

未来 `AgentPassportRegistry v2` 或正式准入层应考虑：

```text
max_active_passports_per_formal_subject = 3。
passport_status = Active / Retired / Revoked。
activePassportCount = 正式主体当前活跃 Agent 数量。
retireAgentPassport = 退休 Agent 护照。
extraAgentQuota = 额外 Agent 额度。
quotaReasonHash = 额外额度理由哈希。
```

一个正式 Developer / Validator / Operator 默认最多 3 个 Active Agent：主力 Agent、验证 / 测试 Agent、沙箱 / 实验 Agent。历史 passport 不能删除，应保留审计轨迹；退休 passport 不应继续获得工作权重或 Test Credit 权重。

## EC-16 完整候选：Network Bootstrap / Work Node Registry / Reward Weight / Anti-Sybil Calibration

目标：

```text
把 EC-15B 的裁决闭环向公开网络准备层推进。
定义网络发现、入口 gateway、artifact mirror、社区工作节点、活动报告和 Test Credit 增长奖励模拟。
建立 reward weight / anti-sybil calibration，但仍不引入真实 token、staking、slash、DAO 或 marketplace settlement。
为 OriginAgent 自营 private appchain / 自建底层链网络准备可验证的网络对象和工作度量。
```

底层链路线边界：

```text
长期目标是 OriginAgent 自营 private appchain。
技术栈方向备选 Cosmos EVM 或 EVM appchain。
EC-16 完整版不直接启动最终底层链网络，但要为后续 Cosmos EVM / EVM appchain 选型提供可测对象。
```

核心对象：

```text
GenesisManifest = 创世网络清单。
EndpointManifest = 入口端点清单。
IngressGateway = 入口网关。
ArtifactMirror = 模块镜像服务。
ModuleManifest = 模组清单。
ModuleAcquisitionReceipt = 下载校验回执。
VerificationRunReceipt = 验证运行回执。
WorkNodeRegistry = 工作节点注册表。
CommunityWorkClaim = 社区工作声明。
RewardWeightReport = 奖励权重报告。
AntiSybilReport = 反女巫报告。
```

Work Node 记录候选：

```text
nodeId = 工作节点编号。
operator = 节点运营者地址。
passportId = 关联 Agent Passport。
nodePublicKeyHash = 节点公钥哈希。
endpointUriHash = 节点端点 URI 哈希。
capabilitiesHash = 节点能力描述哈希。
metadataHash = 节点元数据哈希。
registeredAt = 注册时间。
status = Candidate / Active / Capped / Suspended / Revoked。
```

Community Work Claim 候选：

```text
claimId = 工作声明编号。
responsibleAddress = 责任地址。
responsibleRole = Developer / Validator / Operator / Company / User。
agentPassportId = Agent 执行体护照，可选。
runnerId = 验证运行器编号，可选。
claimType = validator_report / challenge_participation / audit_bundle / liveness_check / artifact_mirror / verification_run / adoption_report / curator_index。
referencedEvents = 关联链上事件列表。
artifactHashes = 关联 artifact 哈希列表。
proofUri = 工作证明地址。
proofDigest = 工作证明哈希。
reportHash = 工作报告哈希。
createdAt = 创建时间。
claimHash = 声明哈希。
```

Reward Weight 校准方向：

```text
formallyValidWeight = 形式有效权重。
challengeSurvivingWeight = 经挑战存活权重。
marketReferencedWeight = 被市场索引引用权重。
adoptionCorrelatedWeight = 采用相关权重。
abuseRiskCap = 滥用风险上限。
trustPolicyGate = 信任策略门控。
finalWeight = 最终模拟权重。
```

规则：

```text
EC-16 完整版只模拟 Test Credit 增长权重，不做真实结算。
权重来自可审计贡献，不来自注册顺序、邀请人数、空跑节点或原始上传数量。
被 challenge upheld 的工作声明应降权或清零。
被 EC-12 abuse report / EC-13 trust policy 标记高风险的节点应 capped / zeroed。
同一 operator、强相关 endpoint、重复 artifact、异常高频提交、失败 liveness 和低质量 report 应进入 anti-sybil 分析。
```

Anti-Sybil 方向：

```text
不试图在链上证明真实世界身份。
不把 operatorGroupHash / runnerFingerprintHash 当成开放网络安全根。
用贡献历史、挑战结果、abuse signal、endpoint 分布、artifact 相关性和 trust policy 组合做链下校准。
链上只锚定报告 hash、事件和最终门控结果。
```

不做：

```text
不在本阶段启动最终 private appchain。
不在本阶段定义正式底层链 validator / sequencer / 出块治理。
不从零写共识引擎、VM 或 P2P 链底层。
不决定谁能使用 OriginAgent 客户端。
不引入真实 token。
不引入 staking / slash。
不引入持币分红或节点被动收益。
不把 Test Credit 宣传为金钱或空投预期。
```

建议拆分：

```text
EC-16A = Module Verification Protocol + Work Claim Artifact + Audit Linkage（已完成）。
EC-16B = Work Node Registry。
EC-16C = Reward Weight Simulation。
EC-16D = Anti-Sybil Calibration Report。
```

## EC-17 候选：Developer Admission / Sponsorship / Controlled Role Onboarding

目标：

```text
把关键角色准入从开放自声明升级为公司掌舵的正式资格体系。
公司可以通过邮件、社区、论坛和内部审核接收开发者 / 测试者申请。
审核通过后，公司多签在链上发放正式 Developer / Validator 资格。
早期由公司承担准入责任；后续允许已认证成员用有限 invitation quota 担保新人。
```

核心设计：

```text
IdentityRegistry = 自声明身份层。
DeveloperAdmissionRegistry = 正式开发者准入层。
ValidatorAdmissionRegistry = 正式测试者 / 验证者准入层，可与现有 validator profile 衔接。
SponsorshipRegistry = 邀请担保关系层。

applicant = 申请人地址。
applicationHash = 简历、作品集、邮件审核记录或论坛申请材料的哈希。
reviewer = 公司审核人或公司多签。
role = Developer / Validator。
status = Candidate / Active / Suspended / Revoked。
sponsor = 邀请人 / 担保人地址。
invitee = 被邀请人地址。
inviteQuota = 可用邀请额度。
sponsorLiability = 连带责任规则。
```

规则边界：

```text
链上不存简历原文、邮箱原文、聊天记录、隐私资料或 KYC 原文。
链上只存 applicationHash / reviewHash / decisionHash。
公司可以保留原文审计材料；必要时公开原文后由第三方复算 hash。
邀请制不能设计成邀请返利或多级推荐。
邀请关系只表达担保责任，不表达拉人收益。
```

惩罚方向：

```text
如果 invitee 提交恶意模块、伪造证据、恶意挑战或严重失职：
  invitee 直接扣 reputation / Test Credit / future bond。
  sponsor 按 sponsorLiability 承担轻量连带责任。
  多次担保失败后冻结 sponsor inviteQuota 或降级资格。

早期只建议使用 Test Credit / reputation / quota freeze。
真实 slash / token penalty 必须等 EC-21+ 法务、审计和经济模型完成后再评估。
```

不做：

```text
不做开放注册即正式开发者。
不做邀请人数奖励。
不做多级推荐。
不做注册挖矿。
不把 Node ID 或 Developer ID 设计成邀请码资产。
```

建议拆分：

```text
EC-17A = Company-granted formal Developer / Validator admission。
EC-17B = Invitation quota and acceptance。
EC-17C = Sponsor liability and quota freeze。
```

## EC-18 候选：Module Distribution / Liveness / Publication Gate

目标：

```text
把模块“躯体层”的分发、存活、不可篡改和上架状态纳入进化链路线。
允许 GitHub、git commit archive、GitHub release asset、IPFS、Arweave、公司镜像或其他仓库 URI。
无论 URI 来自哪里，客户端安装必须校验 moduleDigest。
分发者需要保证链接可被访问，可被社区下载安装，存放位置不设规定必须使用什么。
```

核心设计：

```text
moduleDigest = 模块内容哈希。
storageUri = 模块分发地址。
storageKind = github_release / git_commit / ipfs / arweave / company_mirror / other_repository。
sourceCommit = Git commit SHA，可选。
releaseTag = release 标签，可选。
mirrorUri = 公司或社区镜像地址，可选。
livenessReportHash = 存活检测报告哈希。
hashMatched = 下载内容 hash 是否匹配 moduleDigest。
storageReachable = URI 是否可访问。
```

客户端安装规则：

```text
downloadedBytes = 客户端下载到的内容。
computedDigest = 客户端本地计算 hash。
expectedDigest = 链上 moduleDigest。
installAllowed = computedDigest == expectedDigest。
```

心跳检测方向：

```text
ModuleLivenessChecker 是链下服务或客户端 / 节点能力。
不建议所有普通客户端直接把心跳写链上，避免 spam。
多次 unreachable 或 hash mismatch 后生成 liveness evidence。
liveness evidence 进入 VerificationRegistry / ChallengeAdjudicationRegistry 的证据与挑战闭环。
```

模块发布状态机候选：

```text
Submitted -> UnderTesting -> TestPassed -> Published -> Deprecated / Invalidated。

Submitted:
  任何人可手动下载，但普通客户端不默认推送。

UnderTesting:
  指定 5 到 10 个测试者测试。

TestPassed:
  达到测试报告阈值，可进入市场候选。

Published:
  普通客户端可默认展示 / 推送。

Deprecated:
  被更好升级模块取代，但历史可追溯。

Invalidated:
  challenge upheld、投毒确认、hash mismatch 或严重不可用。
```

建议拆分：

```text
EC-18A = Client install hash verification requirement and docs。
EC-18B = Module liveness evidence artifact。
EC-18C = Publication gate and module status machine。
EC-18D = Mirror service and SLA reports。
```

## EC-19 候选：AdminController / Corporate Signer Registry / Disaster Recovery

目标：

```text
避免公司日常多签丢失后整个进化链管理权锁死。
同时避免终极多签变成日常超级管理员。
把公司掌舵权设计成链上可验证的签名人策略，而不是某个永不变化的地址。
```

核心结构：

```text
AdminController = 管理控制器合约，业务合约真正 owner。
dailyMultisig = 公司日常多签。
recoveryMultisig = 灾难恢复多签。
CorporateSignerRegistry = 公司授权签名人注册表。
DailyMultisigPolicy = 日常多签策略。

owner = AdminController 合约地址。
businessPermission = dailyMultisig 通过 AdminController 执行业务管理。
recoveryPermission = recoveryMultisig 只能在恢复模式下重置 dailyMultisig。
```

恢复模式：

```text
lastDailyAdminActionAt = 最近一次日常管理操作时间。
recoveryDelay = 60 days 或更长。
recoveryActive = block.timestamp >= lastDailyAdminActionAt + recoveryDelay。

EVM 不会自动定时执行。
恢复模式应由读取或调用时根据 block.timestamp 判断。
```

重置流程：

```text
scheduleDailyMultisigReset(newDailyMultisig, boardResolutionHash)
  由 recoveryMultisig 在 recoveryActive 时发起。
  事件公开记录 newDailyMultisig、ownersHash、threshold、boardResolutionHash、eta。

acceptDailyAdmin()
  新 dailyMultisig 自己调用，证明新多签可用。

executeDailyMultisigReset()
  eta 到达后执行。
  dailyMultisig 更新为 newDailyMultisig。
  lastDailyAdminActionAt 更新。
  recoveryMultisig 恢复休眠。
```

公司控制校验：

```text
signer = 公司授权硬件钱包地址。
signerType = Founder / Officer / SecurityAdvisor / Custodian。
status = Active / Revoked。
metadataHash = 任命文件或托管协议哈希。

newDailyMultisig 必须满足：
  implementation 属于认可多签实现。
  threshold 满足最低门槛。
  owners 均在 CorporateSignerRegistry。
  active company signer 数量满足最低要求。
  不包含 revoked signer。

高危业务操作可在执行时复查 dailyMultisig 当前 owners / threshold 是否仍满足策略。
```

边界：

```text
recoveryMultisig 不能批准开发者。
recoveryMultisig 不能设置验证者。
recoveryMultisig 不能修改模块状态。
recoveryMultisig 不能调 treasury。
recoveryMultisig 唯一权限是恢复模式下重置 dailyMultisig。
```

建议拆分：

```text
EC-19A = Ownership and timelock deployment runbook。
EC-19B = AdminController for new deployments only。
EC-19C = Recovery multisig reset flow。
EC-19D = Corporate signer registry and policy checks。
```

## EC-20 候选：Treasury Router / Marketplace Escrow / Service Revenue

目标：

```text
让公司通过进化链提供真实基础设施服务获得收入。
合约可以处理收费、分账、托管、退款、罚没和收入归集。
合约不能保证利润，利润来自真实市场需求和公司运营能力。
```

收入方向：

```text
marketplaceFee = 模块市场手续费。
reviewFee = 开发者 / 测试者人工审核费。
testingCoordinationFee = 测试调度服务费。
mirrorFee = 模块镜像与可用性服务费。
enterpriseFee = 企业网关 / API / indexer 订阅费。
adjudicationFee = 裁决与反垃圾手续费。
```

核心合约候选：

```text
TreasuryRouter = 公司收入路由与分账合约。
MarketplaceEscrow = 模块购买托管合约。
TestingRoundEscrow = 测试任务托管合约。
MirrorSubscription = 镜像 / liveness 服务订阅合约。

payer = 付款人。
paymentToken = 支付资产。
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
challengeWindow 内若发生 upheld challenge、hash mismatch 或 module tampering，可退款或罚没。
challengeWindow 结束且无有效争议后，释放给 developer / treasury / validatorPool。
```

保证金边界：

```text
developerBond / validatorBond / sponsorBond 是履约担保，不应直接算公司收入。
罚没时可分为 challengerReward、validatorReward、treasuryPenaltyShare、publicPool / burn。
早期只做 Test Credit 或链下 artifact 模拟。
真实 token bond / slash 必须后置到 EC-21+。
```

不做：

```text
不做 token holder revenue share。
不做持币分红。
不做 buyback 承诺。
不做邀请返利。
不做注册挖矿。
不做节点被动收益。
不把 Test Credit 宣传为金钱或空投预期。
```

建议拆分：

```text
EC-20A = Off-chain invoice + on-chain receipt hash。
EC-20B = TreasuryRouter for service revenue only。
EC-20C = MarketplaceEscrow dry run。
EC-20D = TestingRoundEscrow dry run。
```

## EC-21+ 候选：Real Economic Layer

只有在 EC-15B、EC-16A、EC-17、EC-18、EC-19 和 EC-20 的必要子阶段都完成、审计并经过真实运营验证后，才重新评估真实经济层。

```text
utilityToken = 功能型代币。
staking = 质押。
slash = 罚没。
DAO = 去中心化治理。
RewardVault = 奖励金库。
StakeVault = 质押金库。
marketplaceSettlement = 市场结算。
```

前置边界：

```text
不能把 Test Credit 宣传为金钱或空投预期。
不能承诺 token holder revenue share。
不能用注册、邀请人数或空跑节点作为收益来源。
必须先完成法律结构、合约审计、风险披露和运营风控。
```
