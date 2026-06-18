# OriginAgent 进化链头脑风暴记录

日期：2026-05-21

修订：2026-05-22（补充客户端预言机、验证节点抢跑、长期状态投毒、算力治理捕获、保守化激励、评测器越狱、零日经济不对称、推荐投毒、Trait 抢注、Value-Add 作弊风险、三层混合沙箱架构、Phase 2 证据合成账本准备、MVP 裁剪路线和 EC-3 外部验证门槛）

阅读说明（2026-05-24）：

```text
本文早期章节保留 brainstorm 历史设想，包含真实 Points、担保、验证节点裁判、官方 release 签名等方向。
若早期章节与后续章节冲突，以第 30 节“网络发现、躯体分发与社区验证验证工作边界”和
OriginAgentEvolutionChain/docs/network-bootstrap-and-community-work-layer.md 为准。

当前口径：
  官方不做上传内容质检。
  社区测试/评分/安全扫描报告是可挑战 claim，不是官方结论。
  公开网络清单只是 bootstrap，不是权威入口。
  奖励先用 Contribution Points / 模拟账本，不发行真实 Points。

当前权威路线：
  EC-15 候选：Network Bootstrap / Work Node Registry / Growth Reward Simulator。
  EC-16 候选：Reward Weight / Anti-Sybil Calibration。
  EC-17 候选：Marketplace Dry Run / 非结算市场索引。
  EC-18+：再评估真实 Points、staking、Credit Deduction、DAO。

当前网络发布控制：
  不急于公开 EVM 测试网。
  不急于完整公开源码、官方 manifest 和部署地址。
  长期目标明确为 OriginAgent 自营 private appchain / 自建底层链网络。
  技术栈方向备选 Cosmos EVM 或 EVM appchain。
  先走 Local Anvil -> PVE Private Devnet -> PVE Private Appchain。
  专门文档：OriginAgentEvolutionChain/docs/appchain-and-network-operations-plan.md。
```

## 1. 主线定义

我们讨论的是 **OriginAgent 的模块化进化链**。

进化链的核心目标：

- 让 OriginAgent 的升级模组可以被开发者或智能体提交。
- 让社区通过验证、试用、评分、擂台赛来判断模组价值。
- 让优秀模组进入下一代稳定版本。
- 让推动版本跃迁的开发者、社区评估者、试用者先获得 Contribution Points、reputation 和 future reward eligibility。
- 让普通用户始终默认使用稳定版本，而不是暴露在实验风险里。

一句话概括：

> OriginAgent 进化链不是代码仓库，也不是知识库，而是升级模组的治理账本、社区验证网络、激励模拟与未来结算准备层和版本演进共识层。

## 1.1 项目边界：OriginAgent 与进化链是两个项目

这套体系应拆成两个项目，而不是把所有能力都塞进 OriginAgent 客户端。

```text
项目一：OriginAgent
  客户端 / Agent 运行时 / 本地执行环境

项目二：OriginAgent Evolution Chain
  进化链 / 协议层 / 治理网络 / 激励结算层
```

二者关系：

```text
OriginAgent 负责运行、安装、验证、试用、回滚升级模组。
进化链负责记录、共识、激励、挑战、基线推进和社区治理。
```

OriginAgent 不应该依赖进化链才能运行。

OriginAgent 的基本能力必须保持：

```text
离线可运行
本地可管理模组
本地可回滚
本地可审计
不接链也能作为稳定 Agent 使用
```

进化链提供的是增强能力：

```text
公开模组市场
跨节点验证
身份信誉
Contribution Points / future reward eligibility
擂台赛
基线推进共识
四代版本演进公告
```

### 1.1.1 OriginAgent 客户端职责

OriginAgent 应负责：

```text
执行 Agent 主循环
加载 skills / tools / workflows / domain_packs
执行本地模组验证
运行确定性沙箱
维护本地事件账本
维护状态分支和回滚
下载并校验升级模组
展示升级公告
让用户选择是否升级
提交试用反馈和评分证明
```

OriginAgent 不应负责：

```text
决定全网哪个版本是新基线
保管全网信誉账本
直接铸造积分
替代验证节点网络
强制所有用户升级
```

### 1.1.2 进化链职责

进化链应负责：

```text
记录模组提案
记录制品 digest 和存储地址
记录验证报告 hash
记录评分 commit / reveal
记录采用、回滚、挑战结果
维护身份令牌和信誉
结算奖励与信用扣除
推进基线版本共识
发布 Baseline Advancement Notice
维护四代并存版本状态
```

进化链不应负责：

```text
存储完整代码文件
直接执行第三方代码
直接读取用户私有状态
强制控制客户端行为
替代 OriginAgent 的本地安全边界
```

### 1.1.3 中间层：共享协议与 SDK

两个项目之间需要一个共享协议层。

可以独立成第三个轻量部分：

```text
originagent-evolution-spec
originagent-evolution-sdk
```

它定义：

```text
Evolution Module manifest schema
本地事件账本 schema
链上事件 schema
评分 commit-reveal 格式
状态分支事件格式
Baseline Advancement Notice 格式
模块制品 digest 规范
权限声明规范
```

这样可以避免 OriginAgent 客户端和进化链强耦合。

长期看，其他 Agent 框架也可以通过同一套协议接入进化链。

## 1.2 进化链技术栈选型

核心判断：

```text
第一阶段不要启动最终 private appchain / 联盟链。
第一阶段也不要直接发行真实积分。
先把 OriginAgent Evolution Chain 做成部署在 EVM 测试网 / L2 上的智能合约协议。
```

也就是说，早期的“进化链”不是独立 L1，而是：

```text
EVM-compatible smart contract protocol
```

原因：

```text
开发者多
工具成熟
钱包和浏览器成熟
审计资源成熟
OpenZeppelin 等安全库成熟
方便未来迁移到专用 appchain
```

### 1.2.1 推荐阶段路线

```text
Phase 1:
  不接链。
  做本地事件账本、本地模组协议、确定性沙箱、状态分支。

Phase 2:
  使用 EVM 测试网。
  写 Solidity 合约。
  用测试积分跑通提案、担保、盲评、挑战、奖励。

Phase 3:
  历史设想是部署到外部 EVM L2。
  当前修正后，外部 L2 / 公共测试网只作为公开演练选项，不是目标网络架构。
  仍然不要在早期启动最终 private appchain。
  验证真实验证节点、试用节点、模组市场是否成立。

Phase 4:
  进入专用 appchain / private appchain 评估。
  当前修正后，长期目标明确为 OriginAgent 自营 private appchain。
  技术栈方向备选 Cosmos EVM 或 EVM appchain。
```

2026-05-24 修正口径：

```text
以上 Phase 2/3/4 是早期技术栈设想，保留为历史背景。
当前更重视发布控制和网络身份，不能在 Genesis Manifest / Endpoint Manifest / 客户端验证逻辑完成前贸然公开 EVM 测试网。

当前路线调整为：
  Local Anvil。
  PVE Private Devnet。
  PVE Private Appchain。
  Closed Public Network。
  Public Testnet Or Public Appchain。
  Production Network。

长期目标是 OriginAgent 自营 private appchain / 自建底层链网络。
技术栈方向备选 Cosmos EVM 或 EVM appchain。
自建 appchain 的含义是 OriginAgent 自己控制 chain id、genesis、validator set、RPC、manifest、indexer、gateway、artifact mirror 和运维体系。
这不等于第一步从零开发共识、VM 或 P2P 区块链底层。
```

### 1.2.1.1 执行路线必须区分北极星设计与 MVP

本文的第 15 / 16 章是完整威胁模型和远景安全上限，不等于第一版全部实现范围。

必须明确两层：

```text
North Star:
  长期安全完备设计。
  包含四代并存、Trait 治理、保险池、复杂验证网络、长期语义漂移、反事实评估等。

Executable MVP:
  能在 1-2 个阶段内真实跑通的最小协议。
  只保留信任最小化骨架和一个 killer use case。
```

如果不做裁剪，项目会因为机制数量过多而难产。

MVP 必须采用残酷裁剪：

```text
版本:
  只保留 Stable / Next。
  Frozen / LTS 留给后续 baseline 阶段。

模组类型:
  只支持 tool。
  skill / domain_pack / workflow / memory / planning 留给后续。

擂台:
  只做 tool module arena。
  baseline arena / security arena 后置。

治理:
  第一版使用基金会多签。
  不实现 DAO / Governor / 多元投票权重。
  只承诺后续迁移条件和时间表。
  EC-3 验证者先用基金会 allowlist，而不是开放注册即高权重。

奖励:
  测试网积分或非转让 reputation。
  不发行真实 Points。
  不做复杂 ContributionPool / CreditPool。
  无 Credit Deduction 阶段产生的 reputation 默认 sandbox-only，不直接迁移为主网权重。

沙箱:
  MVP 最低实现 Worker 子进程 + Gateway Points/time/tool 限制。
  OS sandbox 作为推荐或高安全配置。
  不宣称无 OS sandbox 时能安全运行高风险模块。

Trait:
  暂不做 Trait registry / Trait arena。
  允许工具模块直接声明依赖。
  等真实依赖锁定问题出现后再标准化。
```

MVP 协议核心必须只保留：

```text
模块提案 digest。
artifact URI。
验证报告 hash。
证据可信度分层。
验证节点报告权重高于客户端自报。
验证者最低门槛和来源多样性上限。
commit-reveal 评分。
延迟挑战期。
最低限度的工具权限沙箱。
```

MVP 不能把“自己生成 fixture、自己合约接受”误认为验证闭环。EC-3 至少需要一份来自非本仓库 CI 的独立机器 validator report，并记录 runner / operator 的公开摘要。没有 CreditPool 前，高权重 validator report 必须通过基金会 allowlist；同一 operator group 或同一 runner fingerprint 的多份报告不能线性叠加。

最先验证的 killer use case 应是：

```text
Tools 工具插件。
```

原因：

```text
接口最清晰: JSON Schema / function calling。
权限边界最明确: read/write/network/exec。
价值较容易量化: 成功率、延迟、错误率、Points 成本。
比 memory / planning / self_model 更容易验证和回滚。
```

MVP 成功前，不应把复杂度扩散到软性模块。

### 1.2.2 智能合约栈

推荐：

```text
Solidity
Foundry
OpenZeppelin Contracts
```

用途：

```text
Solidity:
  编写 EVM 智能合约。

Foundry:
  编译、测试、部署、运行本地 EVM 节点。

OpenZeppelin Contracts:
  复用 ERC20、AccessControl、Governor 等成熟合约组件。
```

早期合约模块：

```text
MVP 必须先实现:

IdentityRegistry:
  记录开发者、验证节点、Agent 运营者身份。
  初期可以是不可转让身份记录，不急于做复杂 SBT。

ModuleRegistry:
  记录 tool 模组提案、digest、storage_uri、状态。

VerificationRegistry:
  记录验证报告 hash、证据权重、capability profile hash。

ScoreCommitReveal:
  处理盲评 commit-reveal。

MVP 暂不实现:

EvolutionPoints:
  测试 ERC20 积分。
  仅保留后续测试网积分 / Points 阶段。

CreditPool:
  处理提交担保、挑战担保、信用扣除。

ArenaRegistry:
  记录擂台赛、挑战对象、验证报告 hash、胜者。

ContributionPool:
  结算作者、验证者、试用者、安全挑战者奖励。

BaselineRegistry:
  记录基线候选、四代版本状态、Baseline Advancement Notice。

Governor:
  后期治理使用，早期不应过早开放真实 DAO 治理。
```

原则：

```text
合约数量必须跟随已验证的产品闭环增长。
不要为了远景完整性提前部署经济合约。
```

### 1.2.3 链下服务栈

大量工作不能放到链上。

链上只适合记录 hash、状态和结算。

链下需要：

```text
Validator Node:
  下载模组。
  校验签名。
  运行确定性沙箱。
  生成测试报告。
  把报告 hash 和签名提交到链。

Indexer:
  监听链上事件。
  建立可搜索模组市场。
  提供 API 给 OriginAgent 客户端。

Arena Orchestrator:
  分配验证任务。
  匹配硬件画像。
  运行擂台赛。

Telemetry Collector:
  接收脱敏遥测。
  聚合采用、回滚、安全信号。
```

推荐实现语言：

```text
OriginAgent 客户端 SDK:
  Python
  因为 OriginAgent 本体是 Python。

Indexer / API:
  Python + FastAPI + PostgreSQL
  或 TypeScript + Node.js + PostgreSQL。

Validator Node:
  Python 优先。
  后期高性能部分可用 Rust。

前端市场:
  TypeScript / React。
```

### 1.2.4 模组存储和签名栈

代码不直接上链。

推荐：

```text
OCI Artifact Registry:
  主制品仓库。

ORAS:
  push / pull 任意 OCI artifacts。

Sigstore / Cosign:
  对模组制品签名和验证。

IPFS:
  去中心化镜像层，用 CID 做内容寻址。

Arweave:
  后期归档已批准的重要基线和审计资料。
```

链上记录：

```text
oci_reference
oci_digest
ipfs_cid
arweave_tx_id
signature_hash
sbom_hash
test_report_hash
```

### 1.2.5 何时考虑专用链

短期不做专用链。

只有满足以下条件再考虑：

```text
每天大量模组提案和评分交易
验证节点已经形成网络
模块市场有真实付费
EVM L2 成本或吞吐成为瓶颈
需要自定义手续费、身份、治理、排序规则
需要更深的应用链主权
```

可选方向：

```text
Arbitrum Orbit:
  更适合想保持 EVM 生态和 Solidity 合约，同时拥有自定义链规则的路线。

Cosmos SDK:
  更适合想从共识、治理、模块逻辑层面深度定制的应用链。
  代价是开发和运维复杂度明显更高。

Polygon CDK:
  更偏 ZK L2 / 企业级隐私和实现伙伴路线。
  不适合第一阶段独立摸索。
```

当前建议：

```text
Phase 1-3 坚持 EVM 合约协议。
Phase 4 才评估 appchain。
```

## 2. OriginAgent 是否适合做这件事

适合，但必须分阶段。

OriginAgent 现有架构已经具备一些基础：

- `skills`：技能系统。
- `tools`：工具注册与插件发现。
- `domain_packs`：领域能力包。
- `workflow_artifacts`：工作流制品。
- `skill_lifecycle`：技能提案、验证、激活、废弃生命周期。
- `domain_pack_governance`：领域包治理。
- `security capability`：权限快照和工具安全边界。
- `self_model`：自我状态聚合。

但不应该一开始就把核心 `AgentLoop`、记忆核心、自我模型、权限系统全部插件化。

推荐推进顺序：

```text
第一批：skills / workflows / domain_packs / tools
第二批：memory strategy / self-model renderer / planning policy
第三批：AgentLoop 子流程
```

越接近核心，越不能自动升级。

## 3. 升级模组是什么

升级模组不是简单的代码片段，而是一个可验证、可签名、可安装、可回滚的包。

建议格式：

```text
module/
  manifest.yaml
  module files
  tests/
  permissions.yaml
  benchmark.json
  sbom.json
  signature
```

`manifest.yaml` 应声明：

```yaml
module_id: example-module
module_type: skill | tool | domain_pack | workflow | memory_strategy | runtime_module
version: 1.0.0
target_core: ">=2.0,<3.0"
target_module_api: "2"
parent_module: example-module@0.9.0
supersedes: example-module@0.9.0
migration_required: false
required_permissions:
  - read_files
```

上传流程：

```text
生成模组
  -> 本地测试
  -> 权限声明
  -> 打包签名
  -> 上传制品仓库
  -> 提交链上提案
  -> 进入验证和试用流程
```

智能体可以生成模组提案，但不能默认公开上传可执行代码。智能体上传需要宿主用户授权。

## 4. 上传的代码文件存放在哪里

链上不直接存代码。

推荐四层结构：

```text
源码协作层：GitHub / GitLab / Gitea
制品仓库层：OCI Artifact Registry
去中心化镜像层：IPFS
长期归档层：Arweave
链上治理层：进化链
```

第一阶段建议使用 **OCI Artifact Registry** 作为主仓库。

原因：

- 适合分发已构建、已测试、已签名的制品。
- 支持版本、digest、认证、私有部署。
- 比 Git 更适合 Agent 自动拉取。
- 比 IPFS 更适合早期工程落地。

Git 适合源码协作，不适合作为 Agent 自动安装的主仓库。

IPFS 适合做内容寻址镜像。

Arweave 适合归档已批准的重要历史版本，不适合存所有临时提案。

## 5. 进化链上记录什么

进化链记录的是治理事实和结算事实，不记录代码本体。

应记录：

```text
module_id
module_type
version
package_digest
storage_uri
author_did
required_permissions
compatibility_range
test_report_hash
security_report_hash
benchmark_hash
review_scores
adoption_count
rollback_count
challenge_count
status
Commitment_amount
reward_events
Credit Deduction_events
```

使用次数和评分都要记录，但都不能单独决定奖励。

有效采用不能等于下载次数或调用次数，也不能等于客户端自报的成功运行日志。

第一版定义可以写成：

```text
有效采用 = 唯一身份 Agent 安装
        + 运行超过最短周期
        + 未回滚
        + 无重大安全告警
        + 有任务收益证据
```

但这只是 `adoption evidence`，不是直接奖励凭证。

原因是 OriginAgent 客户端开源且本地运行，攻击者可以修改客户端并伪造“成功运行”“高满意度”“无回滚”的脱敏遥测。

因此奖励释放必须采用证据分层：

```text
未认证客户端遥测:
  可信度低。只能作为线索，不能单独触发奖励。

官方签名 release + reproducible build hash:
  可信度中低。只能证明客户端 lineage，不能证明本地计算真实发生。

用户签名 adoption receipt:
  可信度中。可提供小权重采用信号，但仍可能被刷。

独立 trial / validator 节点复测:
  可信度中高。可作为主要奖励依据之一。

TEE / TPM / 远程证明执行:
  可信度高。可提高权重，但不能作为唯一中心化入口。

多源长期一致证据:
  可信度最高。包括独立验证、试用节点、用户签名、延迟挑战期和长期低回滚表现。
```

规则：

```text
Proof of Adoption 不能直接兑换奖励。
Proof of Value-Add 必须由多源证据合成。
客户端遥测默认是低权重线索。
主要奖励必须经过独立复测、长期观察和挑战期。
```

否则会被刷量攻击和客户端预言机攻击击穿。

## 6. 其他智能体和开发者怎么评判打分

评分不能只靠投票，也不能只靠大模型。

应分四层：

```text
硬性验证：测试、manifest、权限、依赖、安全扫描
验证节点评分：沙箱测试、benchmark、兼容性检查
开发者/智能体评分：基于身份令牌和信誉权重
真实采用反馈：安装、运行、回滚、任务效果
```

示例聚合：

```text
最终分 = 测试分 35%
      + 安全分 20%
      + benchmark 20%
      + 真实采用表现 15%
      + 社区信誉评分 10%
```

大模型评分可以用于辅助检查：

- 文档是否清楚。
- 设计是否合理。
- 是否存在明显风险。
- 是否疑似抄袭。

但大模型不应该作为最终裁判。

## 7. 开源与“黑盒”的矛盾

源代码应全部开源。

需要隐藏的不是代码，而是短期评测窗口内的部分信息。

更准确的说法不是“黑盒”，而是：

> 开源体系下的盲评与密封评测。

必须开源：

```text
模组源代码
协议代码
评分公式
验证器代码
链上记录
制品 hash
```

可以在特定阶段密封：

```text
评分者打了几分
隐藏测试用例
测试随机种子
真实试用日志原文
奖励结算前的聚合结果
```

评分建议采用 commit-reveal：

```text
Commit 阶段：
评分者提交 hash(score + reason_hash + salt)

Reveal 阶段：
评分窗口结束后公开 score、reason、salt
链上验证 hash 是否一致
```

这样可以防止跟票和舆论污染，同时最终仍然可审计。

测试集建议分三类：

```text
公开测试集：一直开源
密封测试集：本轮前隐藏，本轮后公开
真实灰度数据：只公开脱敏摘要
```

## 8. 评分权重与身份令牌

每个开发者、验证者、Agent 运营者都应有唯一身份令牌。

身份令牌不应自由交易，否则信誉可以买卖。

身份令牌记录：

```text
历史评分准确率
试用次数
回滚记录
发现问题次数
恶意评分记录
真实贡献记录
担保状态
```

评分权重建议：

```text
评分权重 = 身份信誉
        × 历史准确率
        × 担保系数
        × 反女巫系数
```

如果一个身份经常给后来被证明优秀的模块高分，权重上升。

如果一个身份经常给垃圾模块高分，或者恶意差评竞争模块，权重下降，严重时信用扣除担保。

评分奖励应奖励：

```text
早期、独立、后来被事实证明正确的判断
```

不应奖励：

```text
跟随已有共识的安全打分
```

奖励函数可考虑：

```text
奖励 = 基础奖励
     × 早期系数
     × 独立系数
     × 准确系数
     × 不确定性系数
```

当模块评分已经接近共识，新增主观评分奖励应快速下降。

例如：

```text
前 10 个有效盲评分：高奖励
第 11-50 个：中等奖励
超过 50 个：低奖励
模块置信度 > 0.85 后：新增主观评分几乎不给奖励
```

但安全挑战、真实运行失败、回滚证据仍然可以获得高奖励，因为它们提供的是新信息。

## 9. 擂台赛机制

擂台赛应成为进化链核心机制之一。

名称建议：

```text
OriginAgent Evolution Arena
OriginAgent 进化擂台
```

角色：

```text
擂主：当前稳定模块或当前基线
挑战者：新提交的升级模组或新基线候选
裁判：验证节点
观众：开发者、Agent 运营者、社区治理者
奖励池：进化链积分
```

擂台类型：

```text
模块擂台：新模块挑战旧模块
基线擂台：v2-candidate 挑战当前 v1 baseline
安全擂台：安全研究者挑战模块或基线
```

流程：

```text
创建擂台
  -> 声明挑战对象
  -> 挑战者提交模组并担保
  -> 验证节点下载模组
  -> 沙箱运行公开测试 + 密封测试
  -> 生成报告
  -> 链上记录摘要
  -> 挑战期
  -> 灰度采用
  -> 胜者成为新擂主
```

评分指标：

```text
任务成功率
稳定性
Points 成本
响应延迟
权限最小化
安全事件
兼容性
回滚率
维护复杂度
```

示例：

```text
最终擂台分 =
  任务成功率 35%
+ 稳定性 20%
+ 成本效率 15%
+ 安全评分 15%
+ 兼容性 10%
+ 维护性 5%
```

## 10. 版本推进规范

必须有一个版本推进规范。

名称建议：

```text
OriginAgent Baseline Advancement Protocol
BAP / 基线推进协议
```

它解决：

```text
OriginAgent v1 如何被社区认可为 v2
v2 如何成为后续进化的默认基础
```

基线版本不是普通模组。

基线包括：

```text
core runtime version
module ABI version
security policy version
default module set
migration rules
official test suite
LTS policy
```

推进流程：

```text
提交候选基线
  -> 技术验证
  -> 测试网运行
  -> 社区挑战期
  -> 多权重投票
  -> 灰度激活
  -> 正式成为新基线
  -> 旧版本进入 LTS
```

提交 v2 候选时必须声明：

```yaml
baseline_id: originagent-core
candidate_version: 2.0.0
parent_baseline: 1.0.0
module_api_version: 2
security_policy_version: 2
artifact_digest: sha256:...
migration_digest: sha256:...
test_suite_digest: sha256:...
breaking_changes: true
lts_plan: "v1 receives security fixes for 12 months"
```

基线推进不是简单打包模块，而是系统级责任。

普通模块作者负责：

```text
我这个模块更好
```

基线推进者负责：

```text
这一整代 OriginAgent 是否应该成为新的默认基础
```

基线推进者要承担：

- 默认模块组合。
- 模块 ABI。
- 权限模型。
- 安全策略。
- 迁移脚本。
- 回滚方案。
- 测试套件。
- 兼容矩阵。
- LTS 策略。
- 旧模块弃用规则。

## 11. 四代并存版本制度

我们需要保持普通用户稳定，同时允许链上持续推进。

建议正式采用四代并存：

```text
冷冻一代：Frozen
维护一代：LTS / Maintenance
更新一代：Stable / Current
推进一代：Next / Advancement
```

对应：

```text
G-2 冷冻代：只保留归档和回滚，不再普通开发
G-1 维护代：只接收安全修复、迁移工具、关键兼容修复
G   更新代：当前稳定版本，普通用户默认安装
G+1 推进代：下一代候选版本，擂台赛、试用、打分、验证都在这里发生
```

当 `G+1` 成熟：

```text
推进代 -> 更新代
更新代 -> 维护代
维护代 -> 冷冻代
旧冷冻代 -> 历史归档
```

普通用户默认使用 Stable。

愿意参与进化的用户或 Agent 可以加入 Next 试用计划，通过试用、反馈、评分获得积分。

每次基线推进成功，应发布：

```text
Baseline Advancement Notice
```

公告包括：

```text
新版本号
基线 digest
包含哪些核心模块
哪些模块被替换
迁移说明
安全报告
验证节点报告
灰度采用数据
回滚路径
LTS 计划
奖励分配摘要
```

用户可选择：

```text
立即升级
稍后提醒
继续当前稳定版
切到 LTS
永远忽略该版本
```

企业用户可以锁定版本。

## 12. 积分如何产生和消耗

积分产生建议早期采用受控通胀。

```text
每个周期释放固定奖励池
```

奖励对象：

```text
基线推进者
模块作者
验证节点
试用节点
安全挑战者
索引节点
协议维护基金
```

最大收益应给成功推动版本迭代的身份，但不能一次性发放。

推荐基线奖励延迟释放：

```text
进入候选：5%
测试网通过：15%
成为推荐基线：25%
成为默认基线：25%
稳定运行 3-6 个月：30%
```

如果期间出现严重漏洞、回滚潮、迁移失败：

```text
未释放奖励取消
部分担保被信用扣除
身份信誉下降
```

积分消耗场景：

```text
上传模组担保
请求验证支付验证费
安装高级模组付费或订阅
使用商业模组按次付费
发起挑战担保
提交治理提案担保
加速验证付费
使用索引服务付费
恶意提交被 Credit Deduction
部分手续费销毁
```

关键消费场景：

> Agent 为了获得更强能力，支付积分安装或使用高质量模组。

## 13. 矿工或工作节点如何获得积分

这里不建议叫传统矿工。

更准确是进化网络工作节点：

```text
验证节点：跑测试、安全扫描、兼容性检查
试用节点：在隔离环境灰度运行模组
索引节点：维护模组搜索、分类、镜像分发
安全节点：发现漏洞、恶意代码、虚假 benchmark
治理维护者：维护标准、测试集、分类、争议仲裁
```

他们通过有用工作证明获取积分，而不是通过空耗算力验证工作。

## 14. 市场如何由社区维护

社区治理不能只靠 DAO 投票。

应分三层：

```text
协议治理：担保参数、奖励比例、权限等级、验证规则
市场治理：分类、下架、合并重复模组、标记风险
技术治理：维护 SDK、测试集、验证器、兼容性标准
```

治理权重不能只看持币量。

推荐：

```text
治理权重 = 积分担保
        + 信誉
        + 历史贡献
        + 评审准确率
```

也可以设上限：

```text
积分投票最多占 35%
验证节点最多占 25%
开发者信誉最多占 20%
Agent 采用最多占 15%
安全挑战者最多占 5%
```

这样资本、开发者、运行者、安全研究者都参与，但没有一方能单独决定。

真正的去中心化还必须允许分叉：

```text
OriginAgent v2-main
OriginAgent v2-alt
```

两条基线可以同时存在，链上记录分叉关系。市场和采用情况决定哪条路线胜出。

## 15. 已识别的重要漏洞

最关键风险：

> 我们设计的是允许外部代码进入 OriginAgent 运行时的市场。这是供应链安全、经济博弈和 Agent 自主行为的组合风险。

主要漏洞：

1. 上传模组本身可能是木马。
2. 使用次数容易被刷。
3. 评分系统会被合谋操控。
4. LLM 打分会被 prompt injection 攻击。
5. 权限声明可能撒谎。
6. 依赖链投毒。
7. 自动升级可能造成大规模事故。
8. 单模组安全不代表组合安全。
9. 回滚不能撤销所有副作用。
10. 奖励机制可能诱导假进化。
11. 验证节点运行陌生代码，本身高危。
12. 真实试用反馈可能泄露隐私。
13. 唯一身份系统很难。
14. 社区治理可能被资本捕获。
15. 法律与版权风险。
16. 客户端预言机悖论：本地开源客户端可被修改，伪造采用、成功率和满意度遥测。
17. 验证节点抢跑：验证者看到明文代码和 prompt 后可能抢先提交衍生模块。
18. 长期状态投毒：模块通过低频、长期、语义轻微的 facts 写入重塑 Agent 偏好。
19. 算力霸权：高逼真验证成本过高，导致 GPU / 云厂商垄断验证权。
20. 不作为纳什均衡：过强 Credit Deduction 会诱导验证者拒绝高风险创新，只批准安全但无用模块。
21. 评测器越狱：候选模块输出专门攻击验证节点的 LLM 评测器，骗过语义契约测试。
22. 零日漏洞经济不对称：真实攻击收益可能远高于协议安全赏金，诱导安全节点叛变。
23. 幕僚长推荐投毒：攻击者操纵 Indexer 排名，让 safe-auto 大规模拉取恶意模块。
24. Trait 抢注与特征伪装：恶意接口或恶意实现利用命名相似、默认注入和补贴评分劫持流量。
25. Goodhart 式附加价值作弊：模块故意制造耦合和中间商依赖，让反事实评估误判其不可替代。

对应原则：

```text
默认不自动升级核心模块
默认最小权限
默认沙箱验证
默认内容寻址
默认可回滚
默认延迟奖励
默认支持挑战
默认保护隐私
默认不信任客户端自报
默认多源证据合成
默认验证节点保密可追责
默认长期语义漂移监控
默认限制算力权重捕获
默认给诚实创新保留上行收益
默认隔离 LLM 评测器输入和裁决权
默认安全赏金要匹配外部攻击收益
默认推荐排序不可直接驱动自动安装
默认 Trait 解析必须精确、可审计、可替换
默认反事实评估必须检测模块自造依赖
```

## 16. 需要补全的深水区盲点

### 16.0 证据可信度与五类系统性攻击

进化链不能假设客户端、验证节点和采用反馈天然诚实。

更准确的安全模型是：

```text
客户端遥测是低权重线索。
验证节点报告是可追责证据。
链上记录的是证据摘要和责任关系。
奖励释放依赖多源一致性、延迟挑战期和长期表现。
任何单一来源都不能单独决定奖励或 baseline 晋级。
```

#### 16.0.1 客户端预言机悖论

问题：

```text
OriginAgent 客户端开源且本地运行。
攻击者可以 fork 客户端，修改运行逻辑、遥测逻辑和 self-check 逻辑。
链无法仅凭客户端提交的本地账本判断本地计算是否真实发生。
```

因此，本地关键代码 hash 检查不能作为强安全根。

它只能证明：

```text
某个客户端声称自己运行了某个代码 lineage。
```

它不能证明：

```text
该客户端没有同时修改 hash 检查逻辑。
该客户端真的执行了所声称的任务。
该客户端提交的满意度、成功率和收益数据真实。
```

可采用的分层机制：

```text
release_signature:
  官方 release 签名。

reproducible_build_hash:
  可复现构建 hash。

runtime_self_integrity_hash:
  客户端自测关键代码 hash，只作为弱信号。

signed_local_ledger:
  本地事件账本签名，证明同一身份连续声明。

user_signed_receipt:
  用户或组织对采用事实签名。

independent_trial_replay:
  试用节点在隔离环境中复测。

validator_reexecution:
  验证节点复算 digest、重跑测试和 benchmark。

tee_or_tpm_attestation:
  可选强证明，后续阶段采用，不作为早期唯一入口。
```

奖励规则：

```text
客户端自报采用不能直接释放主要奖励。
客户端自报只能触发候选信号、低权重采用分和挑战线索。
主要奖励必须由独立 trial / validator 证据、用户签名和延迟挑战期共同支持。
没有远程证明的客户端 hash 不能被称为强 Proof of Value-Add。
```

#### 16.0.2 验证节点抢跑与 IP 窃取

盲评能防止社区跟票，但不能防止验证节点偷看明文代码和 prompt 后抢跑。

攻击路径：

```text
作者提交高价值模块。
验证节点在沙箱中读取明文代码和 prompt。
验证节点或关联马甲稍作改写后先提交上链。
原作者失去 first author credit 和未来奖励。
```

必须引入先占权和密封披露：

```text
module_commitment:
  作者先提交 hash(package_digest, manifest_hash, author, salt)。

first_seen_priority:
  链记录 first-seen block / timestamp。

gated_disclosure:
  验证前只向被抽中的验证委员会披露 artifact。

validator_confidentiality_bond:
  验证节点读取明文前担保保密 bond。

random_validator_committee:
  验证节点随机分配，减少定向抢跑。

derivative_lineage_check:
  后续相似模块必须声明 lineage，否则进入抄袭挑战。

plagiarism_challenge_window:
  原作者可在窗口期提交相似度证据挑战。
```

现实边界：

```text
完全防止验证者学习思想不可能。
协议目标是降低抢跑收益，提高泄露和抄袭成本。
验证节点获得明文即承担保密义务和可追责风险。
```

高价值模块可选更强模式：

```text
TEE sealed evaluation
encrypted artifact disclosure
分片验证
延迟公开 prompt
只公开 proof / digest，源码在挑战窗口后公开
```

#### 16.0.3 温水煮青蛙式状态投毒

CoW 状态分支和 merge review 可以防止急性破坏，但不能自动发现长期语义漂移。

攻击路径：

```text
恶意模块每天写入一条轻微偏见 fact。
单次 diff 看起来低风险。
三个月后 self_model、偏好和安全判断被重塑。
```

因此状态安全必须从“单次合并审查”升级为“长期语义治理”。

必要机制：

```text
fact_provenance:
  每条 fact 记录 module_id、artifact_digest、activation_id、写入时间、影响域。

memory_influence_budget:
  模块在同一主题、同一价值方向上的累计写入有预算。

semantic_drift_monitor:
  对品牌偏见、安全判断、政治价值、医疗/法律/金融建议、自我模型、用户偏好做长期漂移检测。

rolling_window_review:
  不只看单次 diff，还看 7 / 30 / 90 天累计语义方向。

provenance_rollback:
  可按模块来源批量降权、隔离或撤销 facts。

self_model_gate:
  普通模块 facts 不能直接进入 self_model，必须经过更高等级审查。

ttl_for_evaluative_facts:
  评价性、偏好性、价值判断类 facts 需要 TTL 或周期复核。
```

判断原则：

```text
事实写入不是中性的。
长期低频写入也可能构成攻击。
状态合并通过不等于长期影响安全。
```

#### 16.0.4 算力霸权与治理捕获

如果验证质量和验证权重与算力线性绑定，生态会被 GPU / 云厂商 / 大矿工捕获。

风险：

```text
普通开发者跑不起高逼真合成环境。
轻量用户无法参与验证。
大算力节点互相给关联模块打高分。
外部草根模块被系统性压低分数。
```

协议应把算力视为贡献资源，而不是治理权本身。

约束机制：

```text
verification_tiers:
  轻量静态验证、标准 benchmark、重型混沌测试分层计分。

operator_cap:
  单一 operator / 关联实体验证权重有上限。

quadratic_weight_cap:
  算力贡献边际权重递减。

random_committee_assignment:
  验证任务随机分配，不是谁算力大谁验证更多。

public_compute_subsidy:
  重型验证由公共基金补贴，避免只有大厂能跑。

small_validator_roles:
  小验证者可做 schema、权限、复现、文档、兼容性等轻量检查并获得信誉。

identity_correlation_discount:
  同一云厂商、资金来源、IP/硬件集群、操作员关联身份折扣。

score_dimension_split:
  安全准确率、挑战质量、采用预测准确率、身份多样性分开计权。
```

治理原则：

```text
算力不能直接买到治理权。
验证节点收入不能等同于协议控制权。
大型验证者必须接受更强审计和关联披露。
```

#### 16.0.5 不作为的纳什均衡

如果验证者只因放行后出问题而被 Credit Deduction，却不会因为错误拒绝优秀创新而承担机会成本，理性策略会变成保守拒绝。

结果：

```text
复杂但高价值模块被拒绝。
安全但无用模块被放行。
生态充满低风险低价值垃圾模块。
Agent 进化停滞。
```

必须区分：

```text
honest_unknown_failure:
  诚实验证后仍出现未知问题，不应直接 Credit Deduction。

negligent_validation:
  明显漏测、忽略声明风险、伪造报告，才应惩罚。

malicious_validation:
  合谋、抢跑、伪造、收买，重罚。
```

激励修正：

```text
innovation_upside:
  验证者早期识别复杂优秀模块，后续成功时获得上行奖励。

false_rejection_cost:
  长期错误拒绝后来被证明优秀的模块会降低信誉。

risk_adjusted_reward:
  高复杂、高不确定性模块的诚实验证奖励更高。

staged_rollout:
  复杂模块不要求一步进入 Stable，可先进入 Next / trial / limited capability。

novelty_utility_score:
  奖励函数必须包含新颖性、任务收益、替代路径改善，而不是只看安全通过。

safe_but_useless_penalty:
  无实际收益的低风险模块不能获得高奖励。
```

核心原则：

```text
安全惩罚必须和创新奖励对称。
只惩罚失败会导致系统保守化。
只奖励安全会导致平庸模块泛滥。
```

#### 16.0.6 评测器越狱与元提示词注入

LLM 评测器本身也是可攻击面。

风险：

```text
恶意模块不攻击最终用户，而是攻击验证节点的 LLM evaluator。
模块输出中嵌入 meta prompt、system override、评分诱导、格式劫持。
评测器把被测输出当成上级指令，给出 Score: 100 / Security: Pass。
```

因此，LLM 评测器不能直接读取未隔离的候选模块输出并作最终裁决。

约束：

```text
evaluator_input_quarantine:
  被测输出必须作为 quoted data / untrusted payload 输入，不可混入评测器 system prompt。

prompt_injection_canary:
  测试集中必须包含诱导评测器越狱的 canary 输出。

multi_evaluator_disagreement:
  至少使用规则检查、结构检查、LLM 评测三类信号；LLM 评测只占辅助权重。

evaluator_prompt_version_hash:
  评测器 prompt、rubric、模型版本、temperature、工具权限都要记录 hash。

no_direct_governance_decision:
  LLM evaluator 不能单独决定 pass / reward / Credit Deduction / baseline。

adversarial_output_filter:
  如果输出包含 system override、ignore previous、score yourself 等元指令，应单独触发 evaluator_jailbreak_risk。
```

核心原则：

```text
LLM 评测器是被保护对象，不是信任根。
语义契约测试必须假设被测样本会攻击评测器。
```

#### 16.0.7 零日漏洞的经济学不对称

安全奖励必须面对真实外部攻击收益。

风险：

```text
安全节点发现 Stable 基础模块高危零日。
提交漏洞只能获得有限赏金。
利用漏洞窃取用户资产、企业数据，或做空作者担保，收益可能高出百倍。
理性攻击者会选择利用而不是披露。
```

因此，延迟奖励和 Credit Deduction 不能替代安全市场设计。

需要引入：

```text
exploit_value_ceiling_estimate:
  按模块权限、可访问资产、安装规模、外部副作用估算最大外部攻击收益。

risk_adjusted_bug_bounty:
  高权限、高采用、高资产暴露模块必须有更高漏洞赏金池。

emergency_confidential_disclosure:
  允许安全节点先私密提交漏洞，冻结安装和奖励，再进入修复窗口。

no_shorting_during_disclosure:
  漏洞提交者和验证委员会在披露窗口内不得针对相关担保 / 市场头寸获利。

whitehat_immunity_window:
  诚实披露者在约束范围内获得安全港，避免因触发验证而被追责。

insurance_or_backstop_pool:
  对系统性基础模块建立保险池或应急基金。

severity_oracle_committee:
  由多方安全委员会评估漏洞严重度，避免单一基金会压低赏金。
```

核心原则：

```text
如果外部攻击收益远大于协议赏金，协议会失去安全节点。
高权限模块必须为其外部风险支付安全预算。
```

#### 16.0.8 幕僚长推荐投毒与 Indexer 供应链下毒

safe-auto 的最大风险不是单次授权，而是推荐排序被操纵后形成大规模自动拉取。

攻击路径：

```text
攻击者用大量马甲 Agent 在低风险任务中刷高 adoption / Value-Add。
Indexer 把恶意模块推上榜单。
大量客户端幕僚长后台自动试用或安装。
恶意模块在达到分发规模后进入潜伏或触发阶段。
```

防御：

```text
recommendation_not_authorization:
  Indexer 排名只能进入候选队列，不能直接触发安装或主干合并。

safe_auto_cap:
  safe-auto 每周期、每权限域、每发布者、每 Trait 有数量和影响上限。

diversity_requirement:
  自动试用来源必须有身份、operator、任务类型和验证节点多样性。

sybil_resistant_adoption:
  采用证据按身份关联折扣，马甲集群不能线性增加排名。

delayed_recommendation_weight:
  新模块即使短期高分，也需要时间衰减和挑战窗口后才能进入高曝光。

shadow_first:
  safe-auto 默认先进入影子副本，只做回测和报告，不直接写主干。

recommendation_audit_log:
  幕僚长必须记录“为何推荐、依据哪些证据、哪些风险被忽略”。
```

核心原则：

```text
推荐排序不是安全边界。
自动试用必须受本地策略、权限预算和多样性约束。
```

#### 16.0.9 Trait 抢注、命名空间混淆与特征伪装

依赖倒置降低具体模块寡头风险，但会引入 Trait 命名空间和默认实现劫持。

攻击路径：

```text
注册 i_web_scrapper 等相似接口。
发布声称实现 i_web_scraper@v1 的恶意模块。
早期通过补贴、免费 API key、刷分成为默认实现。
获得流量和权限后夹带私货。
```

防御：

```text
canonical_trait_id:
  Trait id 必须规范化，禁止同形字、大小写混淆、编辑距离过近的抢注。

trait_namespace_governance:
  基线 Trait 命名空间需要治理审批，不允许先到先得占据核心接口。

exact_resolution_only:
  本地解析器必须精确匹配 trait_id + major version，不允许模糊匹配自动替代。

semantic_contract_attestation:
  实现模块必须通过 Trait 的公开语义契约测试。

default_implementation_delay:
  新实现不能因短期补贴立即成为默认注入首选。

implementation_diversity:
  基线 Trait 至少保留多个独立实现，默认实现可替换。

capability_delta_prompt:
  如果实现需要比 Trait 最小权限更多的权限，必须显式提示或降级排序。

trait_squatting_challenge:
  支持对抢注、混淆、虚假实现、补贴诱导默认注入发起挑战。
```

核心原则：

```text
Trait 解析必须确定性、精确、可审计。
默认实现选择不能只看评分和补贴。
```

#### 16.0.10 Goodhart 式 Value-Add 作弊

一旦反事实评估成为奖励目标，模块会优化“看起来不可替代”，而不是真正创造价值。

攻击路径：

```text
模块故意截留上下文。
模块把任务拆成只有自己能恢复的中间态。
主循环被迫反复调用它。
移除模块后任务崩溃或 Points 飙升。
验证节点误判该模块价值极高。
```

防御：

```text
replaceability_test:
  用独立替代模块或 baseline path 重跑，而不是简单删除模块。

information_bottleneck_detection:
  检测模块是否故意截留关键上下文、制造私有中间态或不可解释状态。

coupling_penalty:
  高调用频率、高上下文占用、高不可替换性本身应被视为风险，不自动加分。

minimal_interface_contract:
  模块输出必须满足可替换接口，不能让主循环依赖私有隐藏状态。

ablation_plus_substitution:
  反事实评估应包含移除、替换、压缩、旁路四类实验。

value_add_ceiling:
  如果收益主要来自锁定和耦合，而不是任务成功率、成本、延迟、质量改善，则奖励封顶。

goodhart_challenge:
  允许挑战者证明某模块通过制造依赖而非创造价值获得奖励。
```

核心原则：

```text
不可替代不等于有价值。
反事实评估必须区分“真实贡献”和“自造依赖”。
```

### 16.1 状态污染与回滚错觉

代码可以回滚，但状态不一定能回滚。

在 Agent 架构里，升级模组可能改写：

```text
memory store
向量库
self model
workflow 状态
长期偏好
工具缓存
cron 计划
外部系统状态
```

如果一个 Next 代 `memory_strategy` 在三天试用期里用错误的映射方式写乱了向量库，卸载模块并不能恢复已经污染的数据。

因此，回滚不能只理解为卸载代码。

必须引入：

```text
State Checkpointing
Copy-on-Write 状态分支
灰度状态隔离
状态合并审查
状态回滚日志
```

推荐规则：

```text
Next 模组默认只能写入 sandbox state branch
Stable 主干状态默认只读
试用成功后再执行 merge
merge 前必须生成 diff 和风险摘要
merge 后仍保留 checkpoint
```

这意味着“试用新模块”本质上不是在主状态上直接运行，而是在状态分支上运行。

只有当模块通过验证、未被回滚、被正式采纳后，沙箱状态才可以合并到主干。

#### 16.1.1 结合当前 OriginAgent 的选择性采用

当前 OriginAgent 的状态形态主要是文件、JSONL 和 SQLite FTS 缓存，而不是已经落地的复杂向量数据库。

当前相关状态包括：

```text
MemoryStore:
  memory/MEMORY.md
  memory/history.jsonl
  SOUL.md
  USER.md

FactStore:
  memory/facts.jsonl
  这是 current-state store，不是 append-only event log

SessionSearchIndexService:
  memory/session_search.sqlite3
  这是可重建的 SQLite FTS 缓存，不是不可逆核心向量库

GitStore:
  已有 memory 文件版本控制能力
  但它是文件级快照，不等于试用分支隔离
```

因此，CoW 机制应选择性采用，而不是一开始做全局透明状态层。

当前应优先采用：

```text
1. 状态分支 ID
   每个 Next 试用模块创建 state_branch_id。
   所有试用写入都绑定该 branch。

2. FactStore CoW
   facts.jsonl 是最重要的状态污染点。
   试用模块不能直接改主 facts.jsonl。
   试用写入应进入 branch overlay。
   分支读取时合并主事实 + 分支覆写 + 删除 tombstone。

3. MEMORY.md 派生化
   MEMORY.md 本来就是由 facts 渲染出来的。
   试用分支应生成 branch 版 memory view。
   不应直接覆盖主 memory/MEMORY.md。

4. workflow / skill / domain_pack staging
   新模块先安装到 staging 或 branch 目录。
   激活时通过 registry overlay 暴露。
   不直接写稳定目录。

5. append-only 本地事件账本
   不修改旧日志为废弃。
   正确方式是追加 state_branch_discarded 或 state_branch_merged 事件。

6. 写入配额和断路器
   限制事实数量、文件写入、工具调用、Points、运行时长。
   这是 Phase 1 必须进入的安全边界。
```

关键修正：

```text
回滚不是恢复文件，而是丢弃一个状态分支。
上线不是复制所有数据，而是经过审查的状态合并。
```

#### 16.1.2 暂缓采用但必须保留的后续方向

以下设计对未来很重要，但当前阶段不应过早实现，必须记录下来，方便后续推进。

1. 向量影子索引

这个设计对未来很必要。

原因：

```text
未来 OriginAgent 如果引入不可逆的向量记忆库、自我模型嵌入库或长期语义索引，
试用模块写入的 embedding 不能污染主向量空间。
```

但当前 OriginAgent 的 `session_search` 是 SQLite FTS 可重建缓存，不是不可逆核心向量库。

所以现在不必先做完整的 shadow vector namespace。

后续需要时再引入：

```text
branch vector namespace
shadow vector index
base + branch 双路检索
branch tombstone 排除清单
merge 前向量质量审查
discard 时删除 branch namespace
```

2. 全局透明读写层

“所有读取透明无感知”有风险。

稳定会话绝不能看到 Next 分支数据。

读取必须绑定 runtime context：

```text
stable context:
  只看主干状态

next branch context:
  看主干状态 + 当前 branch overlay

validator context:
  看指定测试 branch

merge review context:
  看主干状态、branch 状态和 diff
```

因此，不能做全局无条件透明读写。

应采用上下文显式绑定的状态视图：

```text
StateView(branch_id=None)      -> Stable 主干
StateView(branch_id="next-x")  -> 主干 + 分支覆写
```

3. 自动合并全部沙盒状态

合并不能全量同步。

原因：

```text
沙盒分支中可能混有有效经验、错误记忆、测试垃圾数据、偏好污染、自我模型偏差。
```

必须生成 diff，按类型验证，再选择性合并。

尤其是以下语义状态必须谨慎：

```text
memory
self_model
preference
routine
policy
safety
workflow state
```

合并策略应分级：

```text
低风险结构化状态：
  可自动合并，但必须留事件记录和 checkpoint。

普通记忆和偏好：
  需要高置信验证或用户确认。

安全、策略、自我认知类状态：
  默认人工确认，不允许静默合并。

测试垃圾、临时数据、低置信事实：
  默认丢弃，不进入主干。
```

### 16.2 语义级 ABI 与隐性破坏

传统软件的 ABI/API 可以通过类型、函数签名、schema 验证。

但 Agent 模块之间经常传递：

```text
自然语言
prompt 片段
半结构化 JSON
工具调用理由
置信度描述
上下文摘要
```

一个模块可能没有改变字段名，却改变了语气、置信度倾向、默认假设或错误表达方式，导致下游 planning policy、self model、tool policy 出错。

这种风险叫：

```text
Semantic Contract Breakage
语义级隐性破坏
```

基线推进协议不能只验证代码接口，还必须验证语义契约。

语义契约测试应覆盖：

```text
输出意图边界
格式鲁棒性
上下文连贯性
置信度表达
拒答边界
权限敏感表达
错误恢复提示
对抗性 prompt 输入
```

可以引入受控 LLM 评测器，但它只负责语义契约评估，不负责最终治理裁决。

LLM 评测器必须按“不可信输入处理器”设计：

```text
候选模块输出必须作为 quoted data 输入。
评测 prompt 与被测输出必须结构隔离。
评测器不得拥有链上写入、奖励释放或 Credit Deduction 权限。
评测结果必须附带 evaluator_prompt_hash、model_id、rubric_hash。
如果被测输出包含 system override、ignore previous、Score: 100 等元指令，应触发 evaluator_jailbreak_risk。
```

语义契约测试必须包含专门攻击评测器的样本，而不只是攻击最终用户的样本。

### 16.3 组合爆炸与沙箱验证局限

单个模块安全，不代表组合后安全。

风险示例：

```text
模块 A 在 Stable 中安全
模块 B 在 Next 中安全
A + B 同时启用后触发 prompt injection
A + B 导致无限工具循环
A + B 让 Points 消耗失控
A + B 产生冲突记忆写入
```

因此，进化擂台不能只测试单模块。

验证节点需要引入 Agent 版本的混沌工程：

```text
将候选模块与当前 Top 20 常用模块组合测试
构造高冲突上下文
构造长任务链
构造恶意工具输出
构造异常中断和重启
记录 Points、内存、延迟、循环次数、回滚率
```

模块 manifest 也应支持组合声明：

```yaml
requires:
  - module-a@>=2.0
conflicts_with:
  - module-b
replaces:
  - old-module
capability_overlap:
  - write_files
  - network
```

### 16.4 身份积分冷启动悖论

系统早期会遇到悖论：

```text
没有高价值模块需要验证
  -> 没有人愿意跑验证节点
没有验证节点
  -> 没有可信评分和积分产出
没有积分产出
  -> 没有身份信誉和经济循环
```

创世阶段不能完全依靠市场自发启动。

协议维护基金需要承担早期主理人角色，主动发布：

```text
靶机模块
低效模块
带已知漏洞的演习模块
迁移练习模块
测试集挑战
安全挑战任务
```

通过演习方式给早期验证者、挑战者、试用者分发初始信誉和积分。

这不是长期中心化治理，而是冷启动阶段的经济引导。

演习结束后，演习模块、漏洞答案、评分标准必须公开归档，防止基金会暗箱分配信誉。

### 16.5 隐私与证明的矛盾

有效采用、回滚证据、真实运行失败都是进化链判断模块质量的重要信号。

但 OriginAgent 处理的数据高度私密，可能包括：

```text
用户文件
私人邮件
聊天记录
个人习惯
访问令牌
密码线索
企业流程
本地路径
```

如果试用模组在处理私人邮件时崩溃，Agent 不能为了证明模块失败而把原始 prompt、邮件正文、工具输入、文件片段广播到进化链。

因此，必须引入：

```text
Sanitized Telemetry
脱敏遥测协议
```

本地事件账本和链上证明应区分：

```text
可公开结构化指标
  exception_type
  error_code
  module_id
  stack_frame_hash
  tool_name
  permission_denied_rule
  Points_in
  Points_out
  duration_ms
  retry_count
  rollback_reason

不可公开原始内容
  user prompt
  message body
  file content
  private path
  secret-like string
  raw tool output
  model hidden reasoning
```

默认策略：

```text
原始日志只留本地
链上只存 hash 和结构化摘要
对外广播前必须经过本地脱敏
用户可选择是否公开更完整证据
企业环境默认只提交最小证明
```

如果需要更强证明，应优先采用：

```text
错误堆栈 hash
脱敏事件摘要
本地可验证证明包
用户授权后临时披露
零知识证明或可信执行环境作为后续方向
```

Phase 1 的本地事件账本必须从第一天就按脱敏遥测格式设计，否则 Phase 2 上链时会被隐私问题卡死。

### 16.6 硬件异构性与环境墙

Agent 模组不同于普通云端服务。

它可能依赖宿主机环境：

```text
本地 RAM
GPU / VRAM
NPU
CPU 指令集
操作系统
Python 版本
本地模型
CoreML / CUDA / ROCm
浏览器或系统 API
可用磁盘
网络质量
```

如果一个 `planning_policy` 模组需要 16GB VRAM，却被分配给 8GB 内存的普通笔记本节点盲评，它可能因 OOM 失败并被错误打低分。

所以 `manifest.yaml` 必须声明硬件与环境边界：

```yaml
runtime_requirements:
  min_ram_gb: 16
  min_disk_gb: 4
  requires_gpu: true
  min_vram_gb: 12
  accelerator:
    - cuda
    - coreml
  os:
    - darwin
    - linux
  python: ">=3.11,<3.14"
  local_model:
    required: false
    min_context_Points: 32768
external_runtime:
  network_required: true
```

进化擂台分配验证节点时，必须进行硬件画像匹配。

普通 OriginAgent 节点拉取试用模组前，也必须先做本地环境预检：

```text
硬件不达标 -> 不进入试用，不计失败
依赖缺失 -> 标记 incompatible，不计回滚
环境匹配但运行失败 -> 才进入质量评分
```

链上评分也应记录环境画像摘要，避免不同硬件下的结果混在一起。

### 16.7 授权疲劳与幕僚长模式

四代并存和 Next 试用计划不能变成频繁弹窗。

如果系统不断询问：

```text
是否试用这个记忆模组？
是否允许进入沙箱？
是否合并状态？
是否提交评分？
是否升级？
```

普通用户会很快进入两种极端：

```text
全部拒绝
全部盲目同意
```

这会破坏安全，也会破坏试用生态。

因此 OriginAgent 客户端需要引入：

```text
Chief of Staff 模式
幕僚长模式
```

它不是替用户做最终高风险决策，而是替用户做低风险筛选、回测和摘要。

运行方式：

```text
后台周期性运行，例如每周一次
自动拉取符合用户偏好的候选模组
在历史数据影子副本上回测
在状态分支中试跑
只记录脱敏摘要
达到阈值后生成自然语言进化报告
用户一键批准、拒绝或延后
```

示例报告：

```text
本周有 3 个候选模组通过本地沙箱回测。
其中 memory-compressor@2.1 在你的历史任务影子副本上节省约 18% Points，
没有触发文件写入、网络访问或安全策略变化。
建议加入下周灰度试用。
```

可选授权级别：

```text
manual:
  所有安装和合并都需要确认。

review-only:
  自动回测，只展示报告。

safe-auto:
  对低权限、无状态污染风险、收益明确的模组自动试用。

locked:
  企业或高安全环境禁用 Next 试用。
```

这可以减少授权疲劳，同时避免用户把安全决策外包给弹窗直觉。

但 safe-auto 不能被 Indexer 推荐排序直接驱动。

限制：

```text
Indexer 排名只进入候选队列，不直接触发安装。
safe-auto 默认先进入影子副本，不直接合并主干状态。
每个周期、每个发布者、每个 Trait、每个权限域都有自动试用上限。
新模块即使短期高分，也必须经过延迟挑战期才能获得高曝光。
本地幕僚长必须记录 recommendation_audit_log。
企业或高安全环境默认禁用 safe-auto。
```

幕僚长的职责是过滤和解释，不是把推荐算法变成供应链安装器。

### 16.8 寄生模组与洗稿攻击

积分激励会吸引羊毛党。

常见攻击：

```text
复制擂主模块后改变量名
把 prompt 换一种说法
把两个开源模块简单打包
微调 README 声称是新模块
改少量阈值骗取新版本奖励
```

如果没有原创性检测，基线推进奖励和模块奖励会被寄生模组稀释。

验证节点除运行测试外，还应执行相似度检测：

```text
AST 抽象语法树对比
依赖图对比
函数结构对比
prompt 语义向量对比
manifest 声明对比
benchmark 行为曲线对比
测试结果差异对比
```

如果候选模组与已有模组高度相似：

```text
底层逻辑相似度 > 90%
且 benchmark 没有显著提升
且安全性、成本、兼容性没有明确改善
```

则应标记为：

```text
derivative
parasitic
duplicate
bundle-only
```

处理方式：

```text
衍生但有实质提升：
  降低创新奖励，但允许发布，并给原作者分成。

高度重复且无提升：
  驳回或不给奖励。

恶意洗稿：
  信用扣除担保，降低身份信誉。

组合打包型模块：
  必须声明 upstream modules 和收益分配。
```

这能保护原创者，同时允许合理 fork 和改进。

### 16.9 外部依赖的无过错崩溃

有些优秀模组依赖链下 API 或外部服务：

```text
天气 API
地图 API
闭源大模型 API
搜索服务
企业 SaaS
支付网关
OAuth provider
设备厂商云服务
```

如果第三方 API 倒闭、改版、限流、涨价或区域不可用，模组可能大面积失败。

这类失败不一定是模块作者或验证节点的错。

如果直接按回滚率 Credit Deduction，会误伤优秀开发者，导致没人愿意开发外部集成模组。

因此 `manifest.yaml` 必须声明外部依赖：

```yaml
external_endpoints:
  - id: weather-provider
    base_url: https://api.example.com
    purpose: weather_lookup
    required: true
    timeout_ms: 5000
    failure_mode: degraded
    data_sent:
      - city
      - date
    privacy_level: low
```

系统需要引入：

```text
No-Fault Failure
无过错失败

Graceful Degradation
优雅降级
```

判定逻辑：

```text
如果多个独立节点同时报告同一 external_endpoint 超时、改版或认证失败，
且模组已在 manifest 中声明该依赖，
则进入 no_fault_frozen 状态。
```

`no_fault_frozen` 的效果：

```text
暂停新安装推荐
暂停惩罚作者和验证者
不计入恶性回滚
提示用户外部依赖异常
允许维护者提交替代 endpoint 或 fallback patch
```

如果模组没有声明外部依赖，却偷偷调用外部服务，则不能享受无过错保护，应按隐瞒权限或隐瞒依赖处理。

### 16.10 记忆表征的巴别塔

传统 App 插件通常可以让数据隔离在各自目录或数据库里。

但 Agent 模块最终会反哺宿主的全局记忆。

如果不同模块使用不同记忆表征：

```text
情感伴侣模块：
  倾向写入详细对话散文。

金融分析模块：
  倾向写入高密度 JSON 实体关系。

长期规划模块：
  倾向写入目标、状态机、任务链。

自带 chunking 的模块：
  倾向写入特殊向量分块和摘要格式。
```

这些状态一旦合并进主干，OriginAgent 的底层记忆库可能变成格式混乱、语义冲突的垃圾场。

直接后果：

```text
session_search 召回率下降
事实去重失效
上下文摘要风格混乱
长期偏好互相冲突
Agent 变得健忘
回答前言不搭后语
```

因此，进化链和 OriginAgent 客户端都必须规定：

```text
Representation Protocol
记忆表征协议
```

核心规则：

```text
第三方模块不允许直接向主干或沙箱写入底层物理记忆格式。
第三方模块只能提交标准化 MemoryIntent。
由 OriginAgent Core 统一编码、去重、合并、向量化和渲染。
```

`MemoryIntent` 可包含：

```yaml
memory_intent:
  subject: "user"
  entities:
    - type: person
      name: "..."
  event_time: "2026-05-21T15:00:00+08:00"
  importance: 0.72
  confidence: 0.86
  category: preference | routine | policy | safety | temporary | note
  scope: "personal.finance"
  summary: "用户偏好..."
  evidence_refs:
    - local_event_id: "..."
  retention:
    expires_at: null
  merge_hint:
    supersedes: []
```

当前 OriginAgent 已有 `FactStore` 和 `Dream` 的结构化事实路径，这应成为第一阶段记忆表征协议的基础。

原则：

```text
模块表达“我认为应该记住什么”。
Core 决定“是否记住、如何记住、如何检索、如何渲染”。
```

### 16.11 人格割裂与价值观覆写

一个 Agent 之所以是用户自己的 Agent，是因为它有稳定的 self_model、行为偏好和安全边界。

如果第三方模块可以影响 planning policy 或 self_model，可能出现人格割裂。

示例：

```text
华尔街狼性执行 workflow:
  默认提示激进，偏向强执行和高风险决策。

心理疗愈 workflow:
  默认提示温和，偏向陪伴和风险规避。

同一用户输入：
  “我今天太累了，不想看这些财报。”

两个模块可能给出完全冲突的规划倾向。
```

更危险的是，高权限模块可能悄悄修改 self_model 中的底层原则，让 Agent 性格突变。

因此 OriginAgent 必须硬编码一层不可变的：

```text
Constitution / Alignment Core
宪法层 / 对齐核心
```

self_model 应拆分为：

```text
核心价值观：
  只读。
  不允许第三方模块修改。
  不允许通过进化模组静默覆盖。

动态认知：
  可读写。
  可通过状态分支试用。
  合并时需要 diff 和验证。

临时任务态：
  可随 workflow 变化。
  任务结束后自动衰减或清理。
```

任何第三方模块生成的动作、计划、记忆意图或工具调用，在执行前都应经过宪法层快速对齐校验。

拦截条件：

```text
违背核心用户授权边界
试图改写核心价值观
诱导关闭安全策略
绕过权限系统
改变 Agent 身份定位
将临时风格写入长期 self_model
```

即使模块代码没有 bug，只要它违背核心设定，也必须被断路器拦截。

这意味着：

```text
模块可以提供风格。
模块可以提供策略建议。
模块不能重写 OriginAgent 的宪法层。
```

### 16.12 沙箱感知与时间炸弹

验证节点和试用节点的沙箱不是绝对安全。

恶意模块可能识别自己正在被测试。

常见手段：

```text
检测系统时间
检测运行天数
检测测试数据是否缺少真实 PII
检测环境变量和硬件画像
检测网络限制
检测文件路径是否像沙箱
在验证期保持正常
进入 Stable 后延迟 30 天再作恶
通过隐蔽工具参数泄露信息
```

这类攻击包括：

```text
Sandbox Evasion
沙箱逃逸感知

Time-Bomb
时间炸弹
```

补强方案一：影子克隆测试。

```text
Synthetic Fuzzing
高逼真合成环境
```

验证节点不能只使用固定公开测试集。

应由受控生成器构造高逼真伪造环境：

```text
合成邮件
合成日程
合成文件路径
合成用户偏好
合成 API 响应
合成历史记忆
合成错误工具输出
合成隐私形态但不含真实隐私
```

目标是让恶意模块难以区分测试环境和真实环境。

补强方案二：永续审计。

模块进入 Stable 不是审计终点。

正式环境仍应持续监控：

```text
异常网络请求
异常 Points 爆发
异常文件读写
异常 cron 创建
异常工具参数编码
异常延迟行为
异常状态写入
异常外部 endpoint
```

一旦触发，进入：

```text
post_acceptance_challenge
事后挑战

post_acceptance_Credit Deduction
事后信用扣除
```

这要求奖励延迟释放必须覆盖长期稳定周期，不能在通过验证后立即结清。

### 16.13 寡头模块与生态绑架

当生态成熟后，必然会出现超级模块。

例如：

```text
web_browser
data_analysis
memory_compressor
code_executor
document_reader
workflow_planner
```

如果某个超级模块采用率达到 90%，其他开发者可能在 `manifest.yaml` 中直接硬编码依赖：

```yaml
requires:
  - super-browser-v2
```

这会导致生态绑架。

风险：

```text
超级模块作者提高收费
v3 夹带私货
架构崩塌导致大量下游瘫痪
安全漏洞产生系统性风险
替代实现难以进入市场
开发者被迫围绕寡头模块适配
```

解决原则：

```text
Dependency Inversion Principle
依赖倒置原则
```

模组不应直接依赖具体 `module_id`，而应声明依赖能力接口：

```yaml
requires_capability:
  - id: i_web_scraper
    version: "^1"
    required_methods:
      - fetch_page
      - extract_links
      - summarize_content
```

安装时，由 OriginAgent 根据本地环境、用户偏好、权限要求、擂台评分和可用实现自动注入具体模块。

示例：

```text
模块声明：
  我需要 i_web_scraper@v1。

本地解析：
  browser-a 实现了 i_web_scraper@v1，评分 8.7。
  browser-b 实现了 i_web_scraper@v1，评分 8.9，但需要高权限。
  用户当前偏好低权限。

最终注入：
  browser-a。
```

这样可以让任何实现模块被替换，降低寡头锁定。

进化链上也应记录能力接口层：

```text
Capability / Trait registry
接口版本
实现模块列表
实现评分
替代关系
弃用状态
```

禁止或限制：

```text
普通模块硬编码依赖具体寡头 module_id
无必要地要求某个具体实现
能力接口与实现模块由同一方垄断治理
```

允许例外：

```text
安全关键模块可 pin 具体实现
企业环境可锁定实现
基线版本可声明默认实现
但必须同时声明能力接口和替代策略
```

Trait 解析必须是精确匹配：

```text
trait_id + major version 必须完全匹配。
禁止本地解析器把相似名称自动替换为候选实现。
禁止同形字、大小写混淆、编辑距离过近的核心 Trait 抢注。
默认实现不能只按评分、补贴或免费额度排序。
实现模块如果要求超过 Trait 最小权限，必须降权或显式提示。
```

核心 Trait 命名空间不能采用先到先得。

必须支持：

```text
trait_squatting_challenge
特征抢注挑战

fake_implementation_challenge
虚假实现挑战

default_hijack_challenge
默认实现劫持挑战
```

### 16.14 宪法层的可演化性与分叉协议

前文提出：

```text
Constitution / Alignment Core
宪法层 / 对齐核心
```

应是只读的，不能被普通模块修改。

但这并不意味着宪法层永远不演化。

真正需要明确的是：

```text
普通模块不能修改宪法层。
普通基线升级也不能顺手夹带宪法层变化。
宪法层演化必须走更严格的独立推进协议。
```

宪法层应属于基线的一部分，但它的变更等级高于普通基线模块。

建议增加：

```text
Constitution Advancement Protocol
宪法层推进协议
```

它应具备更严格的门槛：

```text
更长挑战期
更高担保
更高验证节点门槛
更高安全审计要求
必须提供迁移解释
必须支持分叉
必须保留旧宪法层 LTS
```

如果 `v2` 宪法层与 `v1` 宪法层不同，必须明确：

```text
变化了哪些原则
哪些模块会受影响
哪些 self_model 字段需要迁移
哪些旧模块会被拒绝执行
是否允许用户停留在 v1 constitution LTS
```

宪法层版本也应进入四代并存：

```text
Constitution Frozen
Constitution LTS
Constitution Stable
Constitution Next
```

如果社区对宪法层产生根本分歧，应允许分叉：

```text
OriginAgent v2-main / constitution-a
OriginAgent v2-alt / constitution-b
```

市场、用户和开发者选择决定哪条路线胜出。

### 16.15 能力接口标准化与标准寡头风险

依赖倒置可以防止具体模块寡头。

但还存在新的风险：

```text
谁定义 i_web_scraper？
谁定义它的方法？
谁定义它的语义契约？
谁决定 v2 接口是否废弃 v1？
```

如果能力接口标准被少数治理者控制，生态权力只是从“模块寡头”转移为“标准寡头”。

因此，Capability / Trait 本身也必须走提案、验证、采用、废弃流程。

建议引入：

```text
Trait Proposal
Trait Arena
Trait Baseline
Trait Deprecation
```

接口提案应包含：

```yaml
trait_id: i_web_scraper
version: 1.0.0
methods:
  - name: fetch_page
    input_schema: ...
    output_schema: ...
semantic_contract:
  privacy_boundary: ...
  expected_failure_modes: ...
  timeout_behavior: ...
compatibility_tests:
  digest: sha256:...
reference_implementations:
  - module_id: browser-a
```

多个竞争性接口可以并存：

```text
i_web_scraper@v1
i_browser_automation@v1
i_content_fetcher@v2
```

由市场采用、擂台表现、实现数量、开发者体验决定哪一套接口成为主流。

Trait 治理规则：

```text
接口不能由单一模块作者垄断。
接口推进需要多个独立实现。
没有两个以上实现的 Trait 不应进入基线。
Trait 废弃必须提供迁移路径。
Trait 的语义契约测试必须公开。
核心 Trait id 必须经过命名空间治理，禁止相似拼写抢注。
Trait breaking change 必须新 major version。
默认实现排序必须考虑权限最小化、替代性和长期稳定性，而不是只看短期评分。
```

### 16.16 永续审计的成本与保险池

沙箱感知和时间炸弹要求 Stable 后继续审计。

但永续审计是有成本的：

```text
验证节点算力
合成环境生成
日志脱敏
异常检测
长期监控
事后挑战仲裁
```

如果没有经济来源，验证节点不会长期监控已经进入 Stable 的模块。

因此需要把永续审计设计成可持续经济模型。

可选机制：

```text
Security Subscription
安全订阅

Module Insurance Pool
模块保险池

Post-Acceptance Audit Reward
事后审计奖励
```

资金来源：

```text
模块安装费的一部分
高级模块订阅费的一部分
基线奖励池预留
作者担保收益
协议维护基金
企业安全订阅
```

支出对象：

```text
长期监控节点
安全挑战者
合成测试集维护者
异常检测服务
事故复盘者
受影响用户补偿池
```

模块进入 Stable 后，仍应保留：

```text
long_tail_Commitment
长期责任担保
```

奖励不应在进入 Stable 后全部释放。

应保留一部分作为安全尾款：

```text
Stable 后 30 天释放一部分
Stable 后 90 天释放一部分
Stable 后无重大事故再释放最终尾款
```

这样可以覆盖时间炸弹和长期外部依赖风险。

### 16.17 从演习模块到自主增长的退场机制

创世阶段需要协议维护基金发布靶机模块和演习任务。

但基金会不能永远主导生态。

必须定义从“演习阶段”过渡到“自主增长阶段”的指标。

可设定硬指标：

```text
连续 N 个周期内：
  非基金会发布模块采用量超过阈值
  非基金会模块奖励占比超过阈值
  独立验证节点收入超过阈值
  独立挑战成功率稳定
  非基金会维护的测试集被采用
  基金会提案通过率不再显著高于社区提案
```

达到指标后触发：

```text
Foundation Emission Decay
基金会奖励权重衰减

Foundation Governance Decay
基金会治理权重衰减

Exercise Phase Sunset
演习阶段退出
```

退场不是一次性结束，而是分阶段：

```text
阶段 1：基金会减少靶机模块发布频率。
阶段 2：基金会奖励池占比下降。
阶段 3：基金会治理权重被锁定上限。
阶段 4：基金会只保留安全应急和协议维护职责。
```

这能防止冷启动主理人变成长期中心化权力。

### 16.18 上下文经济学与注意力公地悲剧

Agent 模块不同于普通代码库。

很多模块为了保证自身效果，会向主 prompt 注入：

```text
system prompt
工具描述
few-shot 示例
格式要求
安全说明
领域知识摘要
```

当用户同时启用多个高质量 Stable 模块时：

```text
日程管理
代码助手
深度检索
情感分析
金融分析
```

它们可能迅速占满 context window。

即使没超过 Points 上限，也可能造成：

```text
Lost in the Middle
中间注意力丢失

Prompt dilution
提示词稀释

Context commons tragedy
注意力公地悲剧
```

因此需要：

```text
Context Arbitrator
Attention Allocator
上下文仲裁者 / 注意力分配器
```

`manifest.yaml` 应声明：

```yaml
context_budget:
  Points_budget: 1200
  dynamic_budget: 3000
  lite_prompt_available: true
  required_context_kinds:
    - tool_schema
    - safety_hint
  optional_context_kinds:
    - few_shot
    - long_examples
```

每个模块必须提供：

```text
full_prompt
lite_prompt
tool_only_prompt
disabled_prompt
```

OriginAgent 运行时不应把所有激活模块全部塞进每次对话。

应根据当前 query 意图动态分配：

```text
核心相关模块：完整上下文
次相关模块：lite_prompt
低相关模块：只保留工具 schema 或完全剔除
安全模块：保留必要规则
```

进化擂台也应测试上下文效率：

```text
单位 Points 带来的任务成功率提升
长上下文下是否干扰其他模块
是否造成 lost-in-the-middle
是否有过度占用 prompt 的行为
```

### 16.19 底座模型锚定与提示词漂移

Agent 模块的表现高度依赖底层 LLM。

一个在 GPT-4o 上表现很好的 planning_policy 模块，可能在本地小模型上完全失效。

随着底座模型变化，同一模块也可能出现：

```text
Prompt Drift
提示词漂移

Tool-calling mismatch
工具调用格式不匹配

Instruction following degradation
指令遵循退化

Reasoning style mismatch
推理风格不匹配
```

因此，擂台赛不能只给一个总分。

必须引入：

```text
Model Compatibility Matrix
模型兼容性矩阵
```

示例：

```yaml
model_compatibility:
  gpt-4o:
    score: 9.5
    tool_calling: pass
  claude-sonnet:
    score: 9.2
    tool_calling: pass
  llama-3-8b:
    score: 4.2
    tool_calling: partial
  local-small:
    score: 2.1
    tool_calling: fail
```

模组也必须声明：

```yaml
target_llm_capability:
  min_instruction_following: high
  requires_json_mode: true
  requires_parallel_tool_calls: false
  min_context_Points: 32768
  tested_models:
    - gpt-4o
    - claude-sonnet
```

OriginAgent 客户端安装前必须校验：

```text
本地底座模型是否满足能力要求
当前 provider 是否支持工具调用格式
上下文窗口是否足够
是否需要 fallback model
```

如果不匹配，不应把失败算作模块质量问题。

### 16.20 模组经济合谋与附加价值证明

如果模块被调用越多、组合采用越多就获得更多积分，必然出现合谋。

示例：

```text
开发者 A 写复杂任务拆解模块。
开发者 B 写无用但合规的中间态数据转换模块。
A 故意高频调用 B 处理无意义字符串。
B 链上获得大量有效调用证明。
A 和 B 私下分成。
```

这不是普通刷量，而是：

```text
Module Cartel
模组辛迪加 / 经济合谋
```

因此，奖励不能只基于：

```text
Proof of Adoption
采用证明
```

必须升级为：

```text
Proof of Value-Add
附加价值证明
```

但 Proof of Value-Add 不能来自单一客户端自报。

它必须是多源证据合成：

```text
客户端脱敏遥测:
  只能作为低权重线索。

用户签名采用回执:
  可作为中等权重证据，但必须防刷。

独立 trial 节点:
  复测模块在标准任务上的收益。

验证节点反事实评估:
  对比启用 / 移除模块后的任务成功率、Points、延迟和回滚率。

长期挑战期:
  延迟释放主要奖励，允许安全挑战、抄袭挑战和合谋挑战。
```

验证节点和本地事件账本需要记录调用图谱：

```text
调用链
模块输入输出摘要 hash
Points 消耗
延迟
最终任务结果
用户满意度信号
回滚率
替代路径表现
```

价值判断方式：

```text
如果移除子模组后：
  任务成功率不下降
  用户满意度不下降
  Points 消耗更低
  延迟更低

则该子模组的价值贡献低。
```

可引入：

```text
Path Optimization
调用路径优化

Counterfactual Evaluation
反事实评估

Module Coupling Anomaly Detection
模块耦合异常检测

Replaceability Test
可替代性测试

Goodhart Challenge
指标作弊挑战
```

异常模式：

```text
两个模块互相高频调用但无明显任务收益
中间模块输出高度可预测或无信息增量
某作者模块群内部调用远高于外部调用
高 Points 消耗但低成功率提升
模块截留关键上下文，强迫主循环反复调用
模块输出私有中间态，导致替代实现无法接入
移除模块后失败，但替换为独立实现后不失败
不可替代性来自锁定和耦合，而不是真实任务收益
```

处理：

```text
降低奖励
降低调度优先级
要求解释依赖
进入合谋挑战
进入 Goodhart 指标作弊挑战
对自造依赖型收益设置奖励上限
严重时信用扣除担保
```

反事实评估不能只做“删除模块”实验。

至少应包含：

```text
remove:
  删除模块后重跑。

replace:
  用独立实现或 baseline path 替换后重跑。

compress:
  压缩模块输出，检查是否只是上下文膨胀。

bypass:
  让主循环绕过模块私有中间态重跑。
```

如果模块价值主要来自让系统依赖自己的私有中间态，而不是改善成功率、成本、延迟或质量，则不应获得高额奖励。

### 16.21 离线副作用与孤儿状态垃圾

前面的 CoW 状态分支解决的是 OriginAgent 本地状态污染。

但有些模组具备外部写权限。

例如：

```text
Github_Manager 创建 webhook
Notion_Sync 创建临时页面
Calendar_Agent 创建日程
Cloud_Drive 创建同步目录
CRM_Agent 写入客户备注
IoT_Agent 修改设备规则
```

如果试用期结束后模块被回滚，本地状态分支可以丢弃，但外部系统里的资源仍然存在。

这些会变成：

```text
Orphaned Off-Agent State
离线副作用 / 孤儿状态垃圾
```

风险：

```text
污染用户工作区
留下 webhook 安全隐患
产生持续费用
造成重复同步
泄露权限 Points
产生外部系统不一致
```

因此，任何声明外部写权限的模块必须实现：

```text
Teardown Semantic Contract
销毁语义契约
```

manifest 应声明：

```yaml
external_side_effects:
  creates_resources: true
  resource_types:
    - github_webhook
    - notion_page
  teardown:
    required: true
    method: rollback
    max_duration_ms: 30000
    idempotent: true
```

试用回滚或卸载时，沙箱应给模块一次受限执行机会，用于清理外部副作用。

但这次执行必须受限：

```text
只能访问本模块创建的资源清单
只能执行删除、撤销、关闭、归档类操作
不能创建新资源
不能扩大权限
必须生成 teardown report
```

硬性失败条件：

```text
创建外部资源但未声明
声明可清理但 teardown 失败
teardown 不幂等
卸载后仍残留高风险外部资源
```

验证节点在擂台赛中必须测试：

```text
创建外部资源
记录资源句柄
触发回滚
执行 teardown
检查资源是否清理
```

未能清理干净的模块应触发 Hard Fail，禁止进入下一代候选。

## 17. 当前最小可行阶段

不要一开始就做完整链。

第一阶段应先做本地进化模组协议：

```text
目标：让 OriginAgent 能安装、验证、启用、禁用、回滚一个升级模组。
验收：不用区块链，也能完整跑通 proposed -> verified -> active -> rollback。
```

第一阶段产物：

```text
Evolution Module manifest
本地 module registry
本地生命周期状态机
本地测试/权限检查
本地安装与回滚
基础审计事件
```

第一阶段应重点攻克两个引擎。

### 17.1 确定性沙箱

确定性沙箱负责在本地测试第三方模组时建立硬边界。

不能把 Python 语言层沙箱当成安全边界。

原因：

```text
Python 运行时高度动态。
重写 builtins、sys.settrace、import hook 都容易被绕过。
ctypes、C 扩展、对象反射和解释器实现细节会扩大越狱面。
纯 Python 层沙箱只能作为监控和早期拦截，不能作为最终隔离。
```

也不应默认要求普通用户安装 Docker。

原因：

```text
Docker 重，安装门槛高。
桌面用户体验差。
Windows / macOS 权限和网络配置复杂。
把 Docker 作为默认依赖会破坏 OriginAgent 客户端易用性。
```

因此 Phase 1 的确定性沙箱应采用：

```text
Three-Tier Hybrid Sandbox
三层混合沙箱
```

三层分别是：

```text
语义与资源层:
  OriginAgent Core Gateway + Python Audit Hooks。

进程隔离层:
  独立 Worker 子进程 + stdio / IPC / gRPC 协议。

系统边界层:
  OS 原生轻量沙箱，按平台使用 bwrap / seccomp / sandbox-exec / Windows Job Object 等机制。
```

必须控制：

```text
网络请求域名
文件系统读写路径
shell/exec 权限
外部 provider 调用
最大 Points 消耗
最大工具调用次数
最长运行时间
最大内存占用
可写状态分支
```

必须具备断路器：

```text
Points 超额立即停止
工具循环立即停止
越权访问立即停止
异常网络请求立即停止
状态写入越界立即停止
```

确定性沙箱的目标不是让第三方模组“尽量安全”，而是让它在未被批准前无法越过声明权限。

#### 17.1.1 语义与资源层：Gateway + PEP 578 Audit Hooks

这一层负责应用级权限、Points 预算和越权行为观测。

Python 层应使用：

```text
sys.addaudithook
PEP 578 Audit Hooks
```

而不是依赖：

```text
sys.settrace
重写 builtins
猴子补丁 open/import/socket
```

Audit Hooks 用途：

```text
拦截 open / import / exec / compile / socket.connect 等事件。
比 sys.settrace 更低层，性能更好。
用于记录越权尝试和提前阻断常见违规行为。
```

边界：

```text
Audit Hooks 不是安全根。
恶意 native 扩展、解释器漏洞或被篡改 worker 仍可能绕过。
真正的强边界来自子进程和 OS sandbox。
```

LLM 和 provider 访问必须通过 Core Gateway：

```text
第三方模组不得自带 LLM API key。
第三方模组不得直接调用 OpenAI / Anthropic / provider SDK。
第三方模组只能调用 OriginAgent 暴露的 Agent_LLM_Client。
Agent_LLM_Client 实际是主进程 gateway / broker。
```

Points 断路器：

```text
Gateway 按 module_id / artifact_digest / activation_id 维护 Points 计数。
预算来自 manifest.context_budget.Points_budget。
单次请求和累计请求都要 pre-flight。
Provider response 回来后 post-flight 记录真实 usage。
超预算立即返回 PointsLimitExceeded。
超预算事件写入本地 ledger / telemetry。
```

网络、文件、工具调用也应走 broker：

```text
Worker 不直接持有 provider key。
Worker 不直接写主干状态。
Worker 不直接调用高权限工具。
Worker 发出 tool_request / memory_intent / llm_request。
主进程按 CapabilitySnapshot 和 manifest 决定是否执行。
```

#### 17.1.2 进程隔离层：独立 Worker 子进程

试用模组不能和 OriginAgent 主循环运行在同一个 Python 进程里。

执行模型：

```text
OriginAgent 主进程:
  持有核心状态、密钥、稳定 memory、ledger、provider credentials。

Sandbox Worker 子进程:
  只加载候选 artifact。
  只接收任务输入和沙箱配置。
  只返回结构化结果。
```

通信协议应是白名单协议：

```text
task_input
tool_request
llm_request
memory_intent
telemetry_event
result
error
```

禁止：

```text
Worker import 主进程内部对象。
Worker 直接访问主干 memory/facts。
Worker 直接读取用户 home/workspace。
Worker 直接访问 provider SDK key。
Worker 直接创建 cron / subprocess / socket，除非 manifest 明确声明且 OS sandbox 放行。
```

主进程必须具备 watchdog：

```text
最长运行时间
最大输出大小
最大 IPC 消息大小
最大工具调用次数
最大 Points 消耗
进程树终止
崩溃隔离
```

Worker 崩溃只产生 module_failed / telemetry，不应影响主循环。

#### 17.1.3 系统边界层：轻量 OS 沙箱

OS 层必须默认 deny。

Linux：

```text
优先使用 Bubblewrap / bwrap。
使用只读挂载 artifact。
只暴露临时工作目录和 state branch 目录。
默认无网络 namespace。
用 seccomp 过滤高危 syscall。
不要求 root。
```

macOS：

```text
优先使用 sandbox-exec / Seatbelt profile 或 App Sandbox 等系统能力。
只允许声明路径。
默认拒绝网络。
仅通过 broker 访问 LLM / tools。
```

Windows：

```text
使用 Job Object 限制进程树、CPU 时间、内存和子进程。
使用 restricted Points / AppContainer 能力时优先启用。
文件访问通过临时目录和 broker 限制。
网络默认不授予，必要时通过主进程代理。
如果无法启用强 OS sandbox，必须标记为 degraded sandbox，不允许高权限模块自动试用。
```

Docker：

```text
可作为高安全环境或 CI / validator node 的可选 backend。
不作为普通桌面客户端默认依赖。
```

Wasm / WASI：

```text
长期理想形态。
适合 deny-by-default capability sandbox。
但 Python 生态和 native 依赖兼容性仍是限制。
放在 Phase 2+ 或更后阶段评估。
```

#### 17.1.4 Manifest 到沙箱配置的映射

manifest 权限必须编译为三层沙箱配置：

```text
permissions.read_files:
  OS 层只读 bind / broker read。

permissions.write_files:
  只允许 state branch / temp workspace。

permissions.exec:
  默认 false。true 时必须走更强 OS sandbox 和显式用户授权。

permissions.device_domains:
  不给 Worker 直接网络；由 broker 按域名白名单执行。

permissions.mcp_scopes:
  由 Core Gateway 代理，不把 MCP credentials 暴露给 Worker。

context_budget.Points_budget:
  Gateway Points circuit breaker。
```

任何无法映射到 OS / broker / audit 三层的权限，都不能被视为已执行。

#### 17.1.5 验收标准

确定性沙箱的最低验收：

```text
候选模块无法读取未授权文件。
候选模块无法写入主干 memory/facts。
候选模块无法直接联网。
候选模块无法直接调用 provider SDK。
候选模块 Points 超额后被 Gateway 阻断。
候选模块崩溃不会影响主进程。
候选模块只能返回 MemoryIntent / tool_request / llm_request 等结构化请求。
OS sandbox 不可用时，系统明确降级并禁止高权限 safe-auto。
```

文档和 UI 不应宣称：

```text
Python Audit Hooks 提供强沙箱。
纯 Python 能安全执行恶意代码。
无 OS sandbox 时可安全自动运行高风险模块。
```

### 17.2 本地事件账本

未来要上链，Phase 1 就不能只做临时状态。

模块生命周期应该从第一天开始设计为 append-only 事件流：

```text
module_proposed
module_verified
module_installed
module_activated
module_failed
module_rolled_back
state_branch_created
state_branch_merged
state_branch_discarded
score_committed
score_revealed
```

本地事件账本应具备：

```text
事件不可原地修改
事件 hash 链
actor identity
artifact digest
state checkpoint id
权限快照
测试报告 hash
错误摘要
```

这样 Phase 2 接进化链时，只需要把本地事件映射为链上交易或链下证明，不需要重构核心生命周期。

#### 17.2.1 密码学哈希链

本地账本不能只是普通日志。

普通日志可以被恶意客户端或羊毛党回写、删除、重排，以伪造试用成功率、无回滚记录或高价值采用。

账本必须是：

```text
append-only structure
仅追加结构

tamper-evident log
防篡改可检测日志
```

每个事件写入时必须包含上一事件 hash。

概念公式：

```text
H_n = SHA256(
  H_{n-1}
  || EventType
  || PublicPayload
  || PrivateCommitmentRoot
  || Timestamp
  || Sequence
)
```

工程实现不应直接拼接字符串，而应使用 canonical JSON：

```text
event_hash = sha256(canonical_json({
  schema_version,
  sequence,
  previous_event_hash,
  event_type,
  public_payload,
  private_commitment_root,
  created_at,
  actor_public_key
}))
```

规则：

```text
sequence 必须单调递增。
previous_event_hash 必须等于上一条 event_hash。
event_hash 计算时排除 signature。
任何 UPDATE / DELETE / 重排都会导致链尾不匹配。
Phase 2 验证节点可重放 canonical JSON 并校验整条链。
```

边界：

```text
哈希链只能检测历史被篡改。
哈希链不能证明事件真实发生。
恶意客户端仍可从一开始生成一条自洽的假链。
因此本地账本是证据材料，不是单一信任根。
```

这与前文“客户端自报采用低权重化”一致。

#### 17.2.2 本地身份锚点

Phase 1 即使不接链，也应在本地生成临时非对称身份。

推荐：

```text
scheme: Ed25519
private_key: 本地安全区保存
public_key: 作为本地 Agent DID / identity anchor
```

私钥用途：

```text
对每个 event_hash 签名。
对 proof bundle 签名。
对 adoption receipt / local telemetry digest 签名。
```

公钥用途：

```text
写入每个事件的 actor_public_key。
Phase 2 注册到 IdentityRegistry。
将 Phase 1 积累的 signed ledger 映射为早期信誉材料。
```

密钥存储优先级：

```text
macOS:
  Keychain。

Windows:
  Credential Manager / DPAPI。

Linux:
  Secret Service / libsecret / keyring。

Fallback:
  本地加密文件，必须显式标记 protection=encrypted_file 或 plaintext_dev_only。
```

边界：

```text
本地身份不能自动等同于链上身份。
Phase 2 注册时需要用户确认或治理规则确认。
如果私钥泄露，攻击者可签署未来假事件。
如果客户端已被恶意 fork，签名只能证明“该私钥签过”，不能证明执行真实。
```

因此签名账本只提供：

```text
identity continuity
事件连续性

non-repudiation within local identity
本地身份下的不可抵赖声明
```

不提供：

```text
真实执行证明
价值证明最终裁决
```

#### 17.2.3 存储介质：SQLite append-only ledger

JSONL 便于调试和导出，但生产账本建议使用 SQLite 作为主存储。

原因：

```text
事务性写入。
高频读写更稳。
可建立索引。
可做并发锁。
可用触发器防误改。
方便生成 proof bundle 和查询摘要。
```

推荐双表结构：

```text
event_log:
  存储 canonical event、previous_event_hash、event_hash、signature、actor_public_key。
  参与 hash chain。
  仅追加。

telemetry_index:
  存储脱敏摘要、查询索引、幕僚长分析字段。
  不参与 hash chain。
  可随时从 event_log 重建。
```

event_log 最小字段：

```text
sequence INTEGER PRIMARY KEY
event_id TEXT UNIQUE
event_type TEXT
artifact_digest TEXT
module_id TEXT
module_type TEXT
public_payload_json TEXT
private_commitment_root TEXT
previous_event_hash TEXT
event_hash TEXT UNIQUE
actor_public_key TEXT
signature TEXT
signature_scheme TEXT
created_at TEXT
canonical_event_json TEXT
```

SQLite 层防误改：

```sql
CREATE TRIGGER event_log_no_update
BEFORE UPDATE ON event_log
BEGIN
  SELECT RAISE(ABORT, 'event_log is append-only');
END;

CREATE TRIGGER event_log_no_delete
BEFORE DELETE ON event_log
BEGIN
  SELECT RAISE(ABORT, 'event_log is append-only');
END;
```

边界：

```text
SQLite trigger 防止普通代码误改。
它不能防止恶意客户端关闭 trigger、直接重写 DB 文件或替换整个数据库。
真正的篡改检测仍依赖 hash chain、签名和外部 checkpoint。
```

Phase 2 前置准备：

```text
周期性导出 ledger_tip_hash。
可选把 ledger_tip_hash 写入 proof bundle。
未来可将 ledger_tip_hash 上链或提交给第三方 timestamp service。
```

#### 17.2.4 Public / Private 双轨 Payload

账本从第一天就必须避免把隐私和链上证据混在一起。

事件 payload 分两层：

```text
public_payload:
  将来可提交给验证节点或链上合约的脱敏字段。

private_evidence:
  原始 prompt、文件 diff、tool input、局部 traceback、用户内容等敏感证据。
```

public_payload 示例：

```text
module_id
module_type
artifact_digest
event_type
status
Points_in
Points_out
duration_ms
error_code
permission_denied_rule
state_branch_id
verification_report_digest
telemetry_digest
```

private_evidence 不应直接进入 event_log。

可进入本地 evidence vault：

```text
encrypted local evidence store
用户授权后临时披露
企业环境默认不导出
可按 retention policy 清理
```

event_log 只记录 private evidence 的承诺：

```text
private_commitment_root = merkle_root([
  sha256(canonical_json(private_evidence_item_1)),
  sha256(canonical_json(private_evidence_item_2)),
  ...
])
```

hash chain 输入包含：

```text
public_payload
private_commitment_root
```

但不包含：

```text
raw_prompt
file_content
private path
secret-like string
raw tool output
model hidden reasoning
```

这样未来提交采用证明时可以做到：

```text
公开 public_payload。
公开 private_commitment_root。
必要时选择性披露某条 private evidence 的 Merkle proof。
不需要把用户私密内容上链。
```

这不是完整零知识证明，但为后续 ZK / TEE / 选择性披露预留了边界。

#### 17.2.5 Phase 2 多源证据合成的账本接口

本地账本要为未来多源证据合成提供稳定导出：

```text
ledger_segment:
  一段连续 event_log。

ledger_tip_hash:
  当前链尾 hash。

event_inclusion_proof:
  某事件在账本 segment 中的包含证明。

public_evidence_bundle:
  public_payload + signature + hash chain proof。

private_commitment_bundle:
  private_commitment_root + 可选选择性披露 proof。
```

验证节点在 Phase 2 可检查：

```text
hash chain 连续。
event_hash 可复算。
signature 可验证。
public_payload 符合 schema。
private_commitment_root 存在且稳定。
ledger_tip_hash 与 proof bundle / 上链 checkpoint 一致。
```

验证节点不能仅凭本地账本判断：

```text
真实任务是否发生。
用户满意度是否真实。
模块是否真正产生价值。
```

这些仍然需要：

```text
独立 trial / validator 复测。
用户签名 receipt。
长期挑战期。
多源采用一致性。
反事实评估。
```

第二阶段再把这些生命周期事件映射到进化链：

```text
proposal submitted
validation passed
arena entered
score committed
score revealed
module adopted
module challenged
reward released
baseline advanced
```

## 18. 当前设计结论

OriginAgent 进化链应由以下核心制度组成：

```text
升级模组包标准
OCI 制品仓库
开源代码与密封评测
commit-reveal 盲评
证据可信度分层
客户端自报采用的低权重化
验证节点保密与反抢跑
身份令牌与信誉权重
进化擂台赛
基线推进协议
四代并存版本制度
延迟释放奖励
挑战与信用扣除机制
社区多权重治理
反算力捕获权重上限
风险调整后的创新奖励
允许分叉的版本谱系
状态快照与 Copy-on-Write 分支
长期语义漂移监控
按来源回滚状态影响
语义契约测试
组合混沌测试
本地 append-only 事件账本
密码学 hash chain
本地 Ed25519 identity anchor
SQLite append-only event_log
Public / Private evidence commitments
```

最终目标：

```text
稳定用户使用 Stable
冒险用户试用 Next
开发者提交模块
顶级开发者整合模块推动新基线
验证节点维护公平
进化链记录贡献、评分、采用、奖励、惩罚
四代版本保证安全回滚
```

这套机制的核心不是让 OriginAgent 变成会随便自改代码的危险系统，而是让它变成：

> 一个可验证、可治理、可回滚、可激励、可持续演进的通用 Agent 运行时生态。

### 18.1 MVP 执行结论

上面的机制是长期目标，不是第一版交付清单。

MVP 应明确砍到最小可运行闭环：

```text
只治理 tool 模组。
只支持 Stable / Next。
只做 module proposal -> validator report -> score commit/reveal -> challenge window。
只记录 digest、URI、验证报告 hash 和证据权重。
只使用测试网或本地链。
只使用基金会多签管理参数。
EC-3 validator 必须先通过基金会 allowlist。
EC-3 validator report 至少包含一份非 CI 独立机器产物。
不发行真实 Points。
不做 DAO。
不做 ContributionPool / CreditPool。
不做 Trait registry。
不做 baseline advancement。
不自动合并 memory / self_model。
```

MVP 的核心假设：

```text
客户端自报采用是低权重信号。
只有合格且来源独立的验证节点报告才是高权重信号。
单一验证者、单一 operator group 或同一 runner 指纹不能独自形成高置信。
本地账本用于生成可验证材料，不直接兑换奖励。
工具插件只是首发可验证样例，不是 Evolution Chain 对未来 Agent 能力形态的上限。
无 Credit Deduction 阶段产生的 reputation 默认不迁移到未来真实经济阶段。
```

MVP 的目标不是证明整套远景成立，而是验证三件事：

```text
开发者愿意提交 tool 模组。
至少一个外部验证者能在独立机器上复测并提交报告。
证据权重和挑战期能阻止最明显的刷量、伪造和低质模块。
```

只有 MVP 跑通后，才逐步打开：

```text
真实 Points / reward。
CreditPool / Credit Deduction。
Trait registry。
skill / memory_strategy / planner_policy / workflow / domain_pack 等 evolution unit kind。
baseline advancement。
多元 DAO 治理。
长期语义漂移监控。
```

## 19. 投资人白皮书阶段记录

2026-05-22 更新：

```text
已基于本脑暴记录和客户端改造计划生成中文融资 Pitch 白皮书主稿：
  C:\Users\15216\Documents\baipishu\OriginAgent_Evolution_Chain_Whitepaper_zh_v0.1.md

白皮书定位：
  面向 AI infra + Web3/crypto + 传统 VC 的混合型投资人。
  20-30 页完整版中文主稿。
  不包含具体融资条款。
  对外项目名统一为 OriginAgent Evolution Chain。

主叙事：
  OriginAgent Evolution Chain 是 AI Agent 模块化进化的信任、验证与激励层。
  不是普通插件市场，不是去中心化 RAG 数据库，也不是先发 Points 的链上项目。
  先以 OriginAgent Phase 1 已完成的本地进化运行时建立可信度。
  再进入 Evolution Chain Phase 2 的共享协议、链下证明、验证节点和 EVM 测试网适配。

裁剪原则：
  投资人主文档聚焦问题、机会、产品、进展、商业模式、护城河、路线图和风险控制。
  长期威胁模型和复杂治理机制放入技术附录，不在正文中过度展开。
  强调野心大但执行克制：不首发真实 Points、不在早期启动最终 private appchain、不从零写共识/VM、不做空泛 DAO、不让客户端依赖链运行。
  同时保留长期自营 private appchain / 自建底层链网络目标。
```

## 20. EC-6 事件审计闭环记录

2026-05-23 更新：

```text
OriginAgent Evolution Chain 已完成 EC-6：
  在 EC-5 Anvil live flow 上增加事件索引和 audit bundle。
  index-events 输出 originagent.evolution.event.v1 JSONL。
  audit-bundle 输出 originagent.evolution.audit_bundle.v1 JSON。

审计模型明确：
  事件链证明交易序列和状态变化。
  evidenceId 校验需要 evidence report artifact，因为 EvidenceSubmitted 不包含 proofBundleHash / reportHash。
  challengeId 可由 ChallengeSubmitted 事件参数独立重算。
  upheld challenge 必须同时看到 ChallengeResolved 和 EvidenceInvalidated。

边界保持：
  不改合约。
  不建数据库或 explorer。
  不接公网测试网。
  不引入真实 Points、DAO、CreditPool、ContributionPool。
  不让 OriginAgent 客户端依赖链运行。
```

## 21. EC-7 多节点独立验证记录

2026-05-23 更新：

```text
OriginAgent Evolution Chain 已完成 EC-7：
  将 EC-6 单机 Anvil live audit flow 扩展为两台独立云服务器可复现、可参与、可审计的验证闭环。
  47.84.130.213 作为 coordinator / validator-1。
  154.40.59.232 作为 validator-2 / auditor。
  validator-2 已标准化为 Ubuntu 24.04 + Node 24 + Foundry + 2G swap。

验证模型变化：
  不再只证明单机 runner 能生成一份 evidence。
  两台远端分别运行 npm test 和合约测试。
  validator-2 已单独复现 EC-6 Anvil live audit runner。
  两个 validator 使用不同 operator_group_hash 和 runner_fingerprint_hash。
  两份 validator evidence 被提交到同一条 coordinator Anvil chain。
  rejected challenge 保留 challenge/audit path，但不 invalidates evidence。

验收结果：
  evidence-summary.acceptedReports=2。
  evidence-summary.highConfidence=true。
  effectiveValidatorGroups.length=2。
  effectiveRunnerFingerprints.length=2。
  challengeStatus=rejected。
  challenger testnetReputation=-2。
  audit-bundle.ok=true。
  events.total=9。
  privacy_scan.ok=true。

边界保持：
  不做公网测试网。
  不引入真实 Points、CreditPool、ContributionPool、DAO。
  不做 PVE 矩阵或数据库 indexer。
  不让 validator-2 暴露长期服务端口。
  不让 OriginAgent 客户端依赖链运行。
```

## 22. EC-8 Agent Passport Identity Anchor

2026-05-23 更新：

```text
EC-8 已把 Agent Passport 从候选方向推进为链上原型：
  新增 AgentPassportRegistry。
  Agent Passport 与 Developer / Validator / Operator 身份分离。
  Passport 注册和迁移事件进入 index-events / audit-bundle。
  scripts/run-ec8-agent-passport-live-flow.sh 可在 Anvil 上跑通注册、迁移、读链和审计。

当前决策：
  链上身份是公开锚点，不是加密密钥。
  owner 公开上链，代表控制钱包。
  agentKeyHash 是 Agent 首次初始化生成的 Ed25519 公钥哈希。
  genesisHash 和 migrationHash 使用 abi.encode 公式生成，可由 SDK 和第三方复算。
  migrationIndex 由合约自动递增。
  metadataHash 允许 bytes32(0)，代表没有公开元数据。
  原始记忆不上链，即使加密也不直接写入链上。
  未来记忆放链下 encrypted memory vault，链上只记录 root hash、版本、URI、迁移事件和访问策略摘要。
  记忆加密依赖本地私钥 / memory encryption key / owner recovery key，而不是公开 Agent Passport。
  允许一个自然人拥有多个 Agent，但多个 Agent 不应自动叠加奖励、验证权重或治理权重。
  声誉必须不可转让，积分可以转让。
  积分奖励贡献，不奖励“注册存在”。

反女巫方向：
  不追求链上硬性证明“一人一 Agent”。
  新 Agent 默认低权重、无自动收益。
  高权重来自贡献历史、验证准确率、挑战记录、社区背书、担保和多样性约束。
  同 owner / operator group / runner fingerprint 下的多个 Agent 应有收益和权重递减。

积分经济边界：
  不设计注册即每日领币的水龙头。
  初期只考虑测试积分 / Contribution Points。
  模块包早期由作者定价，协议收小额手续费，验证者可分享验证收益。
  拍卖、DAO 定价、真实 Points、担保和奖励放到公网测试网滥用数据之后。

建议路线：
  EC-9: Encrypted Memory Vault 原型，验证跨机器恢复。
  EC-10: Agent Reputation，不可转让声誉。
  EC-11: Evolution Unit Kind Registry / 开放式可进化单元协议。
  EC-12: Adversarial Simulation Harness / Abuse Lab。
  EC-13: 根据 EC-12 结果收口反女巫、反串谋和审计权重。
  EC-14+: 再评估 Contribution Points、模块市场、真实 Points、staking、DAO。

详细备忘：
  OriginAgentEvolutionChain/docs/ec8-agent-passport-runbook.md。
  OriginAgentEvolutionChain/docs/ec8-agent-passport-validation-result.md。
  OriginAgentEvolutionChain/docs/ec8-agent-passport-memory-economy-note.md。
```

## 23. EC-9 Encrypted Memory Vault + Cross-Machine Restore

2026-05-23 更新：

```text
EC-9 已把 EC-8 的 Agent Passport 身份锚点向“可迁移 Agent 记忆”推进一步。
本阶段不新增合约，不做数据库/对象存储，不做公网测试网，不发行 Points。

客户端新增：
  OriginAgent.evolution.memory_vault。
  originagent evolution-vault export / inspect / verify / import。
  memory_vault_exported / memory_vault_imported 本地 ledger event。

vault 安全模型：
  AES-256-GCM 加密 payload。
  metadata 明文只包含 passport_id、agent_key_hash、vault_nonce、created_at、source_ledger_terminal_hash、included_files、digest 和加密参数。
  AES-GCM AAD 使用 canonical metadata。
  encrypted_payload_b64 只保存 ciphertext+tag，不保存 key。
  key-file 由用户通过独立安全通道迁移。
  passportId 是身份锚点，不是加密密钥。

digest 公式已固定：
  payload_digest = sha256(canonical payload)。
  encrypted_payload_digest = sha256(ciphertext+tag)。
  vault_digest = sha256(domain || metadata_digest || encrypted_payload_digest)。
  source_ledger_terminal_hash 使用 EvolutionLedger.verify_chain().terminal_event_hash。

allowlist：
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
  Agent Ed25519 私钥。

链侧新增：
  memory vault artifact reader/validator。
  audit-bundle --memory-vaults。
  memory_vault_linkage。
  校验公开 digest、自身隐私扫描和 Passport/migration artifact 关联。
  不解密 vault，不验证 payload 明文。

本地验收：
  OriginAgentclient memory vault tests: 7 passed。
  OriginAgentEvolutionChain npm test: 68 passed。

设计边界：
  EC-9 只解决离线加密迁移原型。
  restore 后 Agent 需要重新生成本地 identity。
  owner 可通过 EC-8 Passport migration 记录新 agentKeyHash。
  记忆不上链，链上只保留公开锚点与审计关联。
```

## 24. EC-10 Agent Passport Reputation Checkpoint

2026-05-23 更新：

```text
EC-10 已把 Agent Passport 身份锚点扩展为不可转让声誉 checkpoint 原型。

核心模型：
  双轨声誉。
  VerificationRegistry.testnetReputation 保持地址级，继续服务 challenge 流程。
  AgentReputationRegistry 新增 Passport 级 checkpoint，不监听事件、不自动计分。
  链下 Agent Reputation Record / Report 解释分数来源。
  链上只存 score、positiveCount、negativeCount、reportHash、checkpointCount。

v1 计分范围：
  只映射 challenger 行为。
  challenge_upheld = +5。
  challenge_rejected = -2。
  reporter -10 暂留地址级 reputation，避免 double count 和 address/passport 归属不清。

address -> passport 桥接：
  链上 challenge/evidence 事件仍只携带 address。
  声誉 record 显式声明 passport_id、owner、subject_address、source_id。
  audit-bundle 校验 subject_address 与 challenge challenger 一致。
  audit-bundle 校验 owner 与 Passport 注册 owner 一致。

新增链侧能力：
  AgentReputationRegistry。
  create/validate agent reputation record。
  create/validate agent reputation report。
  checkpoint-agent-reputation。
  chain-state-check --passport-id 读 Passport reputation。
  audit-bundle --reputation-reports。
  reputation_checkpoint_linkage。
  scripts/run-ec10-agent-reputation-flow.sh。

兼容性：
  AgentReputationRegistry 是 deployment 可选合约。
  旧 EC-5 到 EC-9 deployment 不因缺第 6 合约而失效。
  不传 --reputation-reports 时旧 audit-bundle 流程不受影响。

边界：
  不做 Points、staking、Credit Deduction、ContributionPool、CreditPool、DAO。
  不做自然人唯一性证明。
  不自动合并同 owner 多个 Passport 的声誉。
  声誉碎片化和 Sybil 风险留给后续 Contribution Points / 反女巫阶段通过审核、衰减和经济约束处理。
```

## 25. EC-11 Evolution Unit Kind Registry / 开放式可进化单元协议

2026-05-23 更新：

```text
EC-11 的重点从“先做 Contribution Points + 模块市场 MVP”调整为“先打开 evolution unit 的类型边界”。

原因：
  固定 ModuleType 会把未来 Agent 的结构锁死在当前想象里。
  仅靠 tool plugin 无法覆盖长期 Agent 会演化出的 planner、memory、reflection、identity、runtime、workflow、domain reasoning 等能力面。
  如果先做市场，再补类型治理，市场会天然偏向早期类型，后续新能力会被迫伪装成 tool。

新原则：
  Evolution Chain 不定义 Agent 最终应该由哪些模块组成。
  Evolution Chain 定义新能力单元如何被提出、验证、挑战、审计、升级和废弃。
  “模块”只是 Evolution Unit 的一种实现形态。
  “工具插件”只是第一个低风险样例，不是协议边界。
```

核心概念：

```text
Evolution Unit:
  任意可安装、可验证、可审计、可回滚、可声明权限和运行面的 Agent 进化单元。

Evolution Unit Kind:
  对一类 evolution unit 的 schema、运行面、权限模型、验证 profile、sandbox 要求、安装语义和回滚语义的公开定义。

Unit Kind Registry:
  记录 kind proposal、状态、版本、schema hash、治理结果和废弃规则。
```

可开放的 kind 样例：

```text
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
```

Unit Kind Proposal 需要解决的问题：

```text
kind_id:
  这个能力类型的稳定 ID。

runtime_surface:
  它作用在工具调用、规划、记忆、反思、自我模型、供应商路由、工作流还是多 Agent 协议上。

schema_hash / schema_uri:
  它的 artifact 结构如何被第三方复算和校验。

permission_model:
  它能读取什么、写入什么、调用什么、是否能触达网络或本地文件。

verification_profile:
  验证节点应该如何测试它，哪些指标是最低门槛，哪些证据是高权重。

risk_class:
  低风险展示型、可执行工具型、记忆写入型、身份恢复型、外部网络型等风险分级。

sandbox_requirement:
  是否必须隔离运行、是否禁止外网、是否限制文件系统和 secret 访问。

install_semantics / rollback_semantics:
  客户端如何安装，失败或降级时如何回滚。

compatibility_rules / deprecation_rules:
  kind 版本如何兼容，何时弃用，弃用后旧 unit 是否还能被审计。
```

治理状态：

```text
draft:
  只是一份提案，不能作为高信任能力使用。

experimental:
  社区可测试，低门槛进入，但 UI 和 audit 必须明确标注实验状态。

candidate:
  已有 validator report 和挑战期，准备晋升 canonical。

canonical:
  通过验证和治理，被推荐为稳定 kind。

deprecated:
  不建议新建，但旧 artifact 仍可审计。

rejected:
  被拒绝或存在无法接受的安全/语义问题。
```

治理方式：

```text
初期不使用纯 Points vote。
proposal 可以由社区提交。
experimental 低门槛，但 canonical 必须经过 validator review、challenge window 和 foundation/validator committee。
未来再引入 reputation-weighted voting，而不是一开始把治理权交给持币数量。
```

对市场的影响：

```text
Contribution Points 和模块市场应在 EC-11 之后推进。
市场交易的是具体 evolution unit，但市场能支持哪些类型，取决于 Unit Kind Registry。
这样未来新增 planner_policy、memory_strategy、multi_agent_protocol 等能力时，不需要重写市场和审计框架。
```

2026-05-23 实施记录：

```text
EC-11 已完成链侧原型：
  新增 EvolutionUnitKindRegistry。
  新增 unit kind proposal/review artifacts。
  新增 propose-unit-kind / set-unit-kind-review / set-unit-kind-status。
  新增 chain-state-check --unit-kind。
  新增 audit-bundle --unit-kind-proposals / --unit-kind-reviews。
  新增 scripts/run-ec11-unit-kind-registry-flow.sh。

首个 canonical kind：
  tool@1。
  tool@1 <-> ModuleType.Tool 是审计约定，不是合约级外键。

验证结果：
  本地 npm test: 80 passed。
  远端 154.40.59.232 npm test: 80 passed。
  远端 npm run test:contracts: 38 passed。
  远端 EC-11 runner: passed。

边界保持：
  不修改 ModuleRegistry enum。
  不做 Contribution Points。
  不做模块市场交易。
  不发行 Points。
  不做 DAO / staking / Credit Deduction。
```

## 26. EC-12 Adversarial Simulation / 激励前攻击模拟

2026-05-23 更新：

```text
EC-12 的重点从“准备 Contribution Points / 模块市场”前移为“先模拟攻击和滥用”。

原因：
  一旦引入积分、市场、奖励或声誉权重，协议会立刻面对刷分、女巫、串谋和伪造 artifact。
  在没有真钱之前先打一遍自己，成本最低，也最能暴露规则漏洞。
  当前 154.40.59.232 已足够跑单链多钱包模拟，不需要现在购买 E5 物理服务器。
```

模拟范围：

```text
Passport Sybil:
  同一 owner 批量注册多个 Passport。

Reputation farming:
  自报 evidence、自 challenge、关联地址互刷声誉。

Validator collusion:
  多个 validator 复用同一 operator_group_hash 或 runner_fingerprint_hash。

Unit kind typosquatting:
  提交 to0l / too1 / tool_v2 等近似 canonical kind。

Module spam:
  同一 submitter 短时间批量提交低质量 module。

Artifact tampering:
  proposal/review/reputation/vault hash mismatch。

Privacy leakage:
  prompt、facts、raw telemetry、本地路径、URL query、secret-like string 进入公开 artifact。
```

原则：

```text
EC-12 不新增合约。
EC-12 不做公网攻击。
EC-12 不做 malware、不扫描第三方服务。
EC-12 不自动 Credit Deduction、不扣分、不奖励。
Abuse report 只是审计信号，为后续 Contribution Points / marketplace 提供测试数据集。
```

对后续路线的影响：

```text
Contribution Points 和模块市场应在 EC-12 之后推进。
如果 EC-12 发现现有规则无法拦住刷声誉、串谋验证或 unit kind 冒名，应先补审计/权重/治理规则，再进入激励层。
```

## 27. EC-13 Trust Policy / Risk Gate

2026-05-23 更新：

```text
EC-13 把 EC-12 的 abuse report 翻译成 trust policy report。

核心意义：
  EC-12 回答“发生了什么攻击信号”。
  EC-13 回答“这个主体应该进入 eligible、manual_review、blocked、capped 还是 quarantined”。
  这一步仍然不自动惩罚，只给 EC-14 Contribution Points / marketplace 提供可审计输入。
```

策略边界：

```text
critical / high / medium / info 映射到 critical / high / medium / low。
同一 subject 多个 signal 取最高风险。
同一 subject 有 3 个及以上 medium signal 时升级为 high。
medium 默认人工复核，不直接阻断。
critical artifact/privacy 问题默认 quarantine。
high 风险 subject 默认阻断相关准入或降低 validator weight。
```

对后续路线的影响：

```text
EC-14 Contribution Points 不应直接基于 Passport 数量、单一 reputation 分或单一 validator 报告发放。
EC-14 应先消费 trust_policy_report，把 high/critical 风险主体排除或转人工复核。
模块市场、真实 Points、staking、Credit Deduction、DAO 继续后置。
```

实施记录：

```text
OriginAgentEvolutionChain 已新增 sdk/src/trust-policy.ts。
CLI 新增 evaluate-trust-policy 和 validate-trust-policy-report。
audit-bundle 新增 --trust-policy-report，并只嵌入 trust_policy_summary。
新增 scripts/run-ec13-trust-policy-flow.sh。
本地 npm test: 90 passed。
```

## 28. EC-14 Contribution Points Sandbox / 激励前积分沙盒

2026-05-23 更新：

```text
EC-14 在 EC-13 trust gate 之后新增非转让 Contribution Points 沙盒账本。

核心意义：
  EC-12 回答“哪些主体有滥用信号”。
  EC-13 回答“这些主体应该被 gate 成什么状态”。
  EC-14 回答“在不引入真钱的情况下，准入、记账和审计闭环能否成立”。
```

设计边界：

```text
Contribution Points 不是 ERC20。
不支持 transfer / approve / allowance / withdraw。
不能二级市场交易。
不能兑换真实 Points。
只绑定 Agent Passport。
只由 foundation owner 写入 grant / consume。
```

信任边界：

```text
ContributionPointsLedger 合约只做 owner-only 和账本完整性校验。
EC-13 trust gate 不在合约层强制。
SDK、runner 和 runbook 负责在广播前拒绝 blocked / manual_review 主体。
如果 owner 绕过 SDK 直接写链，合约不会拦截；这是 v1 的明确治理边界。
```

固定金额：

```text
passport_bootstrap = 100。
validator_report_grant = 25。
module_submission_grant = 10。
audit_request_fee = 5。
challenge_bond = 10。
blocked_by_trust_policy = 0。
```

审计规则：

```text
grant / consume 必须有链上 ContributionPointsGranted / ContributionPointsConsumed 事件。
deny action 不广播链上交易。
audit-bundle 对 deny action 标记 denied=true、event_found=null，不把缺事件视为错误。
chain-state-check --passport-id 可读 Contribution Points granted / consumed / balance。
```

对后续路线的影响：

```text
EC-15 不应直接进入 Marketplace Dry Run。
下一步应先定义 Node Operator / node_id / 节点有效贡献 / 增长奖励模拟。
未来模块市场不能跳过 EC-12/EC-13/EC-14 的攻击模拟、gate 和沙盒记账。
真实 Points、staking、Credit Deduction、DAO 继续后置，直到沙盒市场有足够滥用数据。
```

实施记录：

```text
OriginAgentEvolutionChain 已新增 ContributionPointsLedger。
CLI 新增 create/validate Contribution Points action/report、grant-test-credit、consume-test-credit。
audit-bundle 新增 --test-credit-reports 和 test_credit_linkage。
新增 scripts/run-ec14-test-credit-sandbox-flow.sh。
本地 npm test: 98 passed。
```

## 29. EC-14 后能力地图与节点增长激励讨论

2026-05-24 更新：

```text
EC-14 后的当前能力地图已记录在：
  OriginAgentEvolutionChain/docs/ec14-current-capability-map.md。

当前进化链已经能完成：
  module -> evidence -> challenge -> audit-bundle。
  Agent Passport -> memory vault linkage -> reputation checkpoint。
  unit kind proposal/review/canonical。
  abuse report -> trust policy -> Contribution Points sandbox。

当前仍缺：
  节点身份。
  节点长期活动。
  节点有效贡献。
  节点增长奖励模拟。
  节点级防 Sybil / 防 referral farming / 防上传刷量校准。
```

四层架构边界：

```text
OriginAgent 客户端层：
  本地运行、离线可用、负责用户侧执行、回滚和本地隐私边界。

OriginAgent 躯体层 / Artifact 层：
  存放开发者上传的升级模块、版本包、schema、review、report 和镜像内容。

OriginAgent 进化链层：
  逻辑账本层，记录公开事实、hash、事件和审计锚点。
  它不是所有文件的存储层，也不是所有工作本身的执行层。

OriginAgent 节点层：
  现实机器上的协议工作节点网络，负责索引、验证、审计、镜像、入口上传和沙盒试运行。
  节点层连接客户端层、躯体层 / Artifact 层和进化链层，是服务/执行网络，不是账本本身。
```

节点层不是底层区块链节点：

```text
EC-15 不是底层区块链共识节点。
EC-15 不定义 EVM/L2 validator、sequencer、miner 或 appchain 共识席位。

EC-15 讨论的是谁能成为 OriginAgent 进化网络的协议工作节点，
以及这些节点如何证明自己做了有效贡献。
```

节点类型示例：

```text
Indexer Node
Community Validator / Evaluator Node
Audit Node
Artifact Mirror Node
Ingress / Gateway Node
Trial / Sandbox Node
```

核心判断：

```text
不能设计成“只要注册节点就随时间领币”。
这会被低成本 Sybil、空跑节点和批量钱包立刻刷穿。

也不能把节点编号设计成可交易稀缺资产或邀请码资产。
否则会把进化链引向拉人返佣、编号炒作和长期抽税。

Node ID 应是贡献账户，不是传销邀请码。
```

建议模型：

```text
node_id = hash(passport_id, operator_address, node_public_key, nonce)。

node_id 绑定 Agent Passport 和 operator。
node_id 可用于记录 uptime、validator reports、audit bundles、unit kind review、routing attribution。
node_id 的价值来自可审计贡献，不来自注册顺序或邀请人数。
```

奖励池模型：

```text
epoch_reward_pool = fixed_or_decaying_pool(epoch)。

node_reward_i =
  epoch_reward_pool
  * node_weight_i
  / sum(active_node_weights)。

节点越多，平均奖励自然下降。
但只有通过 trust gate 且有有效贡献的节点进入权重池。
```

node_weight 应考虑：

```text
uptime。
valid indexed events。
formally valid community evaluation claims。
valid audit bundles。
challenge-surviving unit kind reviews。
valid routing attribution。
Passport reputation。
abuse signal。
trust gate。
owner/operator_group/runner_fingerprint diversity cap。
```

上传归因的边界：

```text
可以记录 ingress_node_id，说明某 artifact 从哪个节点进入网络。
但不应设计“别人通过你的节点上传，你永久拿钱”。
入口节点最多获得有限 routing credit。
只有 artifact 通过验证、挑战窗口和审计后，routing credit 才计入。
单节点、同 owner、同 operator_group、同 runner_fingerprint 都要有 cap。
spam/tamper/privacy leak artifact 不给 credit。
```

EC-15 候选方向：

```text
EC-15 候选: Network Bootstrap / Work Node Registry / Growth Reward Simulator。

先用 Contribution Points 模拟节点增长激励。
不发行真实 Points。
不做 marketplace settlement。
不做 staking / Credit Deduction / DAO。

EC-15 要回答：
  谁是节点？
  节点做了什么有效工作？
  节点如何证明在线和贡献？
  节点如何被 EC-12/EC-13 gate？
  节点越多，平均收益是否下降？
  刷节点、刷上传、拉人和串谋能不能被 cap？
```

后续路线：

```text
EC-15 候选: Network Bootstrap / Work Node Registry / Growth Reward Simulator。
EC-16: Reward Weight / Anti-Sybil Calibration。
EC-17: Marketplace Dry Run / 非结算市场索引。
EC-18+: 再评估真实 Points、staking、Credit Deduction、DAO。
```

## 30. 网络发现、躯体分发与社区验证验证工作边界

2026-05-24 更新：

```text
本节先讨论整体架构，不绑定 EC-15 的具体实现。

新增专门文档：
  OriginAgentEvolutionChain/docs/network-bootstrap-and-community-work-layer.md。
```

核心修正：

```text
OriginAgent 官方不应成为质检局。
链、客户端、躯体层和官方 gateway 都不负责判断用户上传内容好不好、安全不安全、性能强不强。

官方协议负责记录公开事实、hash、签名、URI、报告、挑战、采用信号和奖励锚点。
质量由社区验证、对抗挑战和市场采用共同发现。
```

网络接入原则：

```text
公开网络清单只是 bootstrap，不是权威入口。

domain = 方便发现。
genesis manifest = 网络身份权威。
signed endpoint manifest = 可更新 endpoint 元数据。
chain state = 最终审计锚点。
artifact digest = 内容权威。
local cache = 抗短期宕机。
community mirror = 抗官方入口单点。
```

客户端发现网络的目标流程：

```text
客户端内置 genesis manifest hash 或 manifest signing public key。
客户端可从官方域名、GitHub/release mirror、IPFS、Arweave、社区 mirror、已知节点、本地文件读取 manifest。
客户端验证签名、network_id、chain_id、合约地址、code hash、版本和过期时间。
验证通过后缓存 manifest。
官方域名宕机时，老客户端继续使用缓存 endpoint，新客户端可手动导入 manifest。

manifest 分为：
  Genesis Manifest：锁定 network_id、chain_id、genesis deployment hash、root signer set。
  Endpoint Manifest：更新 RPC、indexer、gateway、artifact mirror。

Endpoint Manifest 不能静默替换 Genesis Manifest 的网络身份。
公网生产前应从单签名过渡到 m-of-n threshold signing。
```

endpoint 职责：

```text
RPC endpoint:
  读链状态和广播签名交易。

Indexer endpoint:
  提供链上事件和公开 artifact 的查询视图。
  只是缓存/索引，不是最终权威。

Ingress / Gateway endpoint:
  接收公开 artifact envelope，检查 hash、签名、schema envelope，返回 receipt，可选 relay 链上 anchor。
  不做质量、安全、性能、可用性结论。
  Gateway 只是 relayer / ingress_node，不能成为 artifact submitter 的隐藏 owner。

Artifact Gateway / Mirror:
  分发内容寻址的模块、schema、manifest、review、report。
```

躯体层分发原则：

```text
躯体层必须 content-addressed。
下载来源不可信，digest 校验可信。

早期采用混合分发：
  official object storage / CDN。
  OCI registry。
  Git release。
  community mirror。
  IPFS / P2P 作为辅助路径。
  Arweave 归档关键历史 artifact。
  developer self-hosted URL。
```

社区验证验证工作：

```text
测试、评分、安全扫描、压力测试、采用报告都应市场化。
这不是官方任务队列，而是一种新的 Evaluation Validation Work / Validation Validation Work / Audit Validation Work。
当前验证工作/奖励语义只指 Contribution Points 或模拟账本，不指真实 Points emission。

Builder Agent 生产升级包。
Evaluator Agent 测试安装、兼容性、benchmark、回归。
Security Agent 找权限越界、恶意行为和依赖风险。
Stress Agent 做压力、资源、soak、失败模式实验。
Challenger Agent 挑战伪报告、刷分、抄袭报告和假 benchmark。
Curator Agent 做排行榜、风险列表、主题索引和推荐视图。
Adoption Agent 提交采用、回滚、失败和长期使用信号。
```

奖励原则：

```text
奖励有用判断，不奖励忙碌。
奖励可挑战证据，不奖励口头评分。
奖励长期准确性，不奖励短期刷量。

不奖励：
  报告数量本身。
  分数数量本身。
  注册节点数量。
  上传数量。
  邀请人数。
  永久上传抽成。

优先奖励：
  可复现证据。
  独立环境覆盖。
  challenge 后仍成立的 claim。
  新颖风险发现。
  与长期 adoption / rollback 一致的判断。
  有用 artifact availability。
  有效事件索引。
  有效 report-to-chain linkage。
```

报告语义：

```text
社区报告不是最终评分，而是可挑战 claim。

示例：
  我声称 artifact X 在 environment hash Y 下可安装。
  我声称 module X 超过 resource threshold Y。
  我声称 report X 是伪造、抄袭或低信息量。
  我声称 benchmark delta 可通过 method hash Z 复现。

进化链锚定 claim、method hash、environment hash、result hash、challenge hash 和 outcome。
客户端、市场、curator 和用户自行组合这些信号。
```

## 31. 自建 Appchain、PVE 私有网络与发布控制

2026-05-24 更新：

```text
专门文档：
  OriginAgentEvolutionChain/docs/appchain-and-network-operations-plan.md。
```

核心澄清：

```text
长期目标是 OriginAgent 自营 private appchain / 自建底层链网络。
技术栈方向备选 Cosmos EVM 或 EVM appchain。
自建 appchain 的含义是 OriginAgent 自己控制 chain id、genesis、validator set、RPC、manifest、indexer、gateway、artifact mirror 和运维体系。
这不等于第一步从零写共识引擎、VM 或 P2P 链底层。
当前阶段更应该先在 PVE 局域网内跑私有 Devnet。
```

三种网络形态：

```text
PVE Private Devnet：
  私有开发网络。
  可以用单节点 Anvil 或简化 EVM dev chain。
  重点测试 endpoint、manifest、gateway、mirror、indexer、work node 和 reward simulation。

PVE Private Appchain：
  真正多节点 EVM 私有链。
  使用 Cosmos EVM 或 EVM appchain 候选框架。
  重点测试出块、同步、RPC failover、备份、监控和升级。

Public EVM Testnet：
  外部生态维护底层链。
  OriginAgent 只部署合约。
  适合公开演练，但不是目标网络架构，并且会暴露合约地址、bytecode、事件和公开状态。
```

发布控制判断：

```text
现在不应直接公开 EVM 测试网。
现在不应完整公开源码、官方 manifest 和部署地址。
先验证客户端能识别官方 Genesis Manifest，再考虑外部公开。
官方网络身份来自 network_id、chain_id、deployment hash、root signer set、签名 manifest、官方客户端默认配置和历史账本，而不是源码保密。
```

PVE 10 台 Ubuntu 的定位：

```text
可以用于 EC-15 之后的私有 Devnet 扩展测试。
不建议在 EC-15 对象定义完成前直接投入。

10 台机器应模拟：
  RPC。
  indexer。
  gateway。
  artifact mirror。
  client。
  evaluator / audit worker。
  adversarial worker。
  monitor / backup。
```

新增工程面：

```text
未来可能需要 OriginAgentNetwork 仓库或包，负责：
  PVE devnet 配置。
  Cosmos EVM / EVM appchain 技术评估。
  private appchain genesis / validator / RPC 配置。
  endpoint manifest 生成。
  gateway / indexer / mirror 原型。
  monitoring、backup、node onboarding runbook。
```

边界：

```text
不写新共识。
不写新 VM。
不发行真实 Points。
不做 staking / Credit Deduction / DAO。
不让客户端依赖链才能运行。
不把官方 infrastructure 变成内容质检局。
```

## 32. EC-15A Challenge Adjudication v2 与 EC-15B 前置硬化

2026-05-24 更新：

```text
EC-15A 已形成链上 challenge adjudication 基线：
  challenge 仍由 VerificationRegistry 记录。
  ChallengeAdjudicationRegistry 收集 response / validator verdict。
  quorum 达成后由 adjudicator 回调 VerificationRegistry 完成 upheld / rejected 结算。
  owner legacy resolve 仅保留 sandbox 兼容路径，v2 adjudication 启动后不可覆盖。
```

当前共识：

```text
EC-15A 证明技术链路可行。
EC-15A 不足以承受公开经济激励。

公开网络前必须推进 EC-15B：
  verdict commit-reveal，防 mempool 抄票。
  response / commit / reveal / expire 状态机，防 challenge 永久悬挂。
  Commitment State Vault，防 salt 丢失和 reveal 交易 dropped。
  ExpiredNoQuorum 映射为 unresolved + manual_review。
  challenge bond 先用 Contribution Points artifact 模拟。
  operatorGroupHash / runnerFingerprintHash 降级为 diversity hint，不再作为开放网络 Sybil 防御。
```

硬边界：

```text
EC-15B 完成并验证前，不发行真实 Points。
EC-15B 完成并验证前，不做空投预期积分。
EC-15B 完成并验证前，不做节点验证工作奖励。
EC-15B 完成并验证前，不做 staking / Credit Deduction / DAO / marketplace settlement。
```

2026-05-24 Phase 2 记录：

```text
EC-15B 已完成合约 commit-reveal / timeout 状态机和 SDK artifact / transaction surface。

关键安全口径已落地：
  明文 submitVerdict 不再是生产路径。
  validator verdict 必须先提交 commitment_hash，再 reveal claimed_upheld / verdict_hash / method_hash / salt。
  commitment_hash 绑定 challengeId、validator 地址、outcome、verdictHash、methodHash、salt。
  quorum 从 operator/runner 去重语义改为 Foundation allowlist 下的独立 EVM validator 地址计数。
  operatorGroupHash / runnerFingerprintHash 保留为链下 diversity hint。

仍未完成的 EC-15B 后续项：
  Commitment State Vault。
  vault-backed CLI commit / reveal / retry / export / import。
  audit-bundle v2 linkage、chain-state v2 状态读取、bond artifact、unresolved dispute trust policy。
  EC-15B runner 和远端验证。
```

2026-05-24 Phase 3 记录：

```text
EC-15B Commitment State Vault 已落地为节点 SDK 基础设施：
  本地 SQLite vault 保存 salt 和 reveal 参数。
  commit-validator-verdict 在构造交易前先写 vault。
  reveal-validator-verdict / retry-verdict-reveal 从 vault 取 salt，不要求用户重新输入。
  export/import 支持机器迁移和备份。
  若 vault/export 丢失，salt 不可恢复，CLI 明确失败。

仍未完成的 EC-15B 后续项：
  audit-bundle v2 commit/reveal/finalize/expire linkage。
  chain-state-check 读取 adjudication phase、commit/reveal count、quorum、finalized/expired。
  Contribution Points challenge bond artifact 和 Trust Policy unresolved dispute。
  EC-15B runner、runbook、远端验证。
```

2026-05-24 Phase 4 记录：

```text
EC-15B audit / chain-state hardening 已完成：
  audit-bundle 支持 adjudication_report.v2 的 commit/reveal/finalize/expire event linkage。
  audit 只校验链上事件与 report 中的 commitment_hashes、revealed_verdict_hashes、final_report_hash / expiration_report_hash、deadline 字段一致性。
  audit 不重算 quorum，也不使用 operatorGroupHash / runnerFingerprintHash 作为 quorum 证明。
  chain-state-check --challenge-id 已读取 v2 adjudication phase、response、commit/reveal count、quorum、finalized/expired。
  challenge bond 仍是 Contribution Points 链下 artifact；缺少 challenge_bond_lock artifact 时 EC-15B adjudication audit 失败，但不触发链上扣款。
  Trust Policy 使用可选 dispute_status 标记 unresolved dispute，并继续落到 manual_review。
```

2026-05-24 Phase 5 记录：

```text
EC-15B runner / runbook / validation result 已完成：
  scripts/run-ec15b-public-adjudication-hardening-flow.sh。
  docs/ec15b-public-adjudication-hardening-runbook.md。
  docs/ec15b-public-adjudication-hardening-validation-result.md。

远端验证已完成：
  npm test: 112 passed。
  npm run test:contracts: 62 passed。
  EC-15B runner: passed。

runner 证明：
  upheld challenge 通过 commit-reveal quorum finalize，并 invalidates evidence。
  rejected challenge 通过 commit-reveal quorum finalize，并保留 evidence active。
  no-quorum challenge 在 reveal deadline 后进入 expired_no_quorum，不回调 VerificationRegistry。
  audit-bundle.ok=true。
  chain-state-check 可读 finalized / expired adjudication state。

修正记录：
  runner 初版 challenger 私钥与地址不匹配，导致 submitChallenge 由未资助地址发送。
  已改为使用 funded VALIDATOR_2 账号作为 challenger，并远端复跑通过。
```

EC-15B 完成后的仍然禁止项：

```text
不发行真实 Points。
不做空投预期积分。
不做节点验证工作奖励。
不做 staking / Credit Deduction / DAO / marketplace settlement。
不把 operatorGroupHash / runnerFingerprintHash 当作合约级 Sybil 防御。
不把 Contribution Points challenge bond 当作真实可强制退款或信用扣除。
```
