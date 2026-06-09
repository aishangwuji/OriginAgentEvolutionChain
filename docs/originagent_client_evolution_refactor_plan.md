# OriginAgent 客户端进化适配改造计划

日期：2026-05-21
更新：2026-05-22（Phase 1-H 已完成，下一步进入 Phase 2 共享协议与链下证明适配）

## 1. 基本判断

OriginAgent 与 OriginAgent Evolution Chain 是两个项目。

当前推进顺序应固定为：

```text
先推进 OriginAgent 客户端
后搭建 OriginAgent Evolution Chain
```

原因：

```text
进化链记录的是客户端真实发生的进化事件。
如果 OriginAgent 客户端没有本地模组协议、沙箱、状态分支、回滚和事件账本，
链上就只能记录概念，而不是工程事实。
```

因此，OriginAgent 第一阶段的目标不是接链、发币或 DAO 治理，而是成为：

> 一个可验证、可回滚、可审计、可试用升级模组的本地 Agent 运行时。

当前权威路线以 `originagent_evolution_chain_implementation_plan.md` 的“当前权威路线（2026-05-24）”为准：

```text
EC-15 候选：Network Bootstrap / Work Node Registry / Growth Reward Simulator。
EC-16 候选：Reward Weight / Anti-Sybil Calibration。
EC-17 候选：Marketplace Dry Run / 非结算市场索引。
EC-18+：再评估真实 token、staking、slash、DAO、RewardVault、StakeVault。
```

网络发布控制路线（2026-05-24 补充）：

```text
当前不要求客户端连接公共 EVM 测试网。
当前不要求客户端依赖完整公开的官方源码、manifest 或部署地址。

链侧推荐路线：
  Local Anvil
  -> PVE Private Devnet
  -> PVE Private Appchain
  -> Closed Public Network
  -> Public Testnet Or Public Appchain
  -> Production Network。

客户端适配原则：
  先支持离线运行和本地 proof。
  后续再支持 Genesis Manifest / Endpoint Manifest 验证。
  不因 PVE devnet、appchain 或公共测试网而自动上传 prompt、facts、memory、API key、session 或本地日志。
```

## 2. 改造总原则

1. OriginAgent 必须保持离线可运行。
2. 进化链能力必须是可选增强，不能成为运行前提。
3. 第一阶段只做本地进化运行时，不做真实链集成。
4. 第一阶段不碰核心 `AgentLoop` 热替换。
5. 第一阶段不允许第三方模块静默改写核心记忆、self_model、权限系统。
6. 所有第三方升级模组必须先进入 staging / sandbox / branch。
7. 回滚不是恢复文件，而是丢弃状态分支。
8. 上线不是全量合并沙盒状态，而是经过 diff 审查后的选择性合并。
9. 本地生命周期事件从第一天开始设计为 append-only，未来直接映射到链上。

## 3. 当前 OriginAgent 已有基础

OriginAgent 当前已经具备适配进化链的良好基础。

可复用能力：

```text
skills:
  已有技能加载与生命周期管理。

tools:
  已有 ToolRegistry、ToolLoader、entry point 插件发现。

domain_packs:
  已有领域包 manifest、runtime contribution、工具声明和治理。

workflow_artifacts:
  已有工作流制品写入、校验、摘要。

skill_lifecycle:
  已有 proposed / verified / active / deprecated / rejected 的本地治理雏形。

domain_pack_governance:
  已有领域包安装、启用、验证、事件记录。

security capability:
  已有工具权限快照、能力边界和审计基础。

MemoryStore / FactStore:
  已有结构化事实、MEMORY.md 派生渲染和 Dream 整理流程。

SessionSearchIndexService:
  已有可重建的 SQLite FTS 检索索引。

GitStore:
  已有部分 memory 文件版本控制能力。
```

这些能力说明 OriginAgent 不需要推倒重来。

第一阶段应在现有能力上新增一个更高层的 `evolution` 模块，把分散的生命周期和治理能力统一起来。

## 4. 第一阶段范围

第一阶段只覆盖低风险升级模组：

```text
skills
workflows
domain_packs
tools
```

暂不覆盖：

```text
AgentLoop
memory core
self_model core
security policy core
provider core
channel core
```

原因：

```text
skills / workflows / domain_packs / tools 已经具备相对清晰的边界。
核心循环、记忆核心、自我模型和安全策略一旦出错，会造成系统级事故。
```

## 5. 建议新增模块边界

建议新增目录：

```text
OriginAgent/evolution/
  __init__.py
  manifest.py
  events.py
  ledger.py
  manager.py
  sandbox.py
  state_branch.py
  telemetry.py
  validators.py
  package.py
```

各文件职责：

```text
manifest.py:
  Evolution Module manifest schema。
  校验 module_id、module_type、version、permissions、runtime_requirements。

events.py:
  本地事件类型定义。
  未来映射链上事件。

ledger.py:
  append-only 本地事件账本。
  负责写入、读取、hash chain、actor、artifact digest。

manager.py:
  EvolutionModuleManager。
  统一安装、验证、激活、回滚升级模组。

sandbox.py:
  确定性沙箱。
  限制网络、文件、shell、token、工具调用次数、运行时长。

state_branch.py:
  状态分支、CoW overlay、diff、merge、discard。

telemetry.py:
  脱敏遥测。
  生成可公开摘要和本地私有日志。

validators.py:
  manifest、权限、依赖、硬件、语义契约、本地测试校验。

package.py:
  本地模组包解压、digest 校验、签名校验预留。
```

## 6. Evolution Module Manifest

第一阶段需要定义本地 manifest。

最小字段：

```yaml
module_id: example-module
module_type: skill | workflow | domain_pack | tool
version: 1.0.0
display_name: Example Module
description: "..."
target_originagent: ">=0.1.5,<0.2.0"
target_module_api: "1"
source: local
entry:
  path: module/
permissions:
  read_files: false
  write_files: false
  network: false
  exec: false
  create_cron: false
runtime_requirements:
  min_ram_gb: 4
  os:
    - windows
    - linux
    - darwin
context_budget:
  token_budget: 800
  dynamic_budget: 2000
external_endpoints: []
external_side_effects:
  creates_resources: false
tests:
  path: tests/
```

第一阶段只需要本地校验，不需要上链字段。

但应预留字段：

```yaml
artifact_digest: ""
signature: ""
sbom_digest: ""
test_report_digest: ""
```

## 7. 本地事件账本

本地事件账本是未来接进化链的地基。

建议路径：

```text
memory/evolution_events.jsonl
```

事件必须 append-only。

权威事件目录：

```text
Phase 1-A:
module_proposed
module_manifest_validated
module_installed_staging
module_failed

Phase 1-C/D/E:
module_permission_checked
module_verified
module_activated
module_deprecated
state_branch_created
state_branch_merged
state_branch_discarded
module_rollback_started
module_rollback_succeeded
module_rollback_failed
dirty_rollback
teardown_started
teardown_succeeded
teardown_failed
module_force_clean_requested
module_force_clean_succeeded
external_side_effect_abandoned

Phase 2+:
telemetry_recorded
score_committed
score_revealed
```

说明：

```text
score_committed / score_revealed 属于 Phase 2+ 预留。
Phase 1-A 不实现评分系统。
第 7 节是事件类型的唯一权威目录。
第 17.3 / 18.4 只解释对应事件的语义，不再另行定义事件集合。
```

事件字段：

```json
{
  "schema_version": "originagent.evolution.event.v1",
  "event_id": "...",
  "event_type": "module_verified",
  "created_at": "...",
  "actor": "user",
  "actor_public_key": "...",
  "module_id": "...",
  "module_version": "...",
  "module_type": "...",
  "source_event_stream": "evolution",
  "source_event_id": "...",
  "artifact_digest": "...",
  "state_branch_id": "...",
  "capability_snapshot": {},
  "result": {},
  "previous_event_hash": "...",
  "event_hash": "...",
  "signature": "...",
  "signature_scheme": "ed25519"
}
```

桥接规则：

```text
EvolutionEvent 对外统一使用 event_type。
现有 SkillLifecycleEvent / DomainPackEvent 使用 action 字段。
events.py 必须提供 normalize_event_type()，将 action / event_type 映射为规范事件类型。
桥接旧事件时必须记录 source_event_stream 和 source_event_id。
允许的 source_event_stream:
  skill_lifecycle
  domain_pack
  evolution
```

原则：

```text
不修改旧事件。
废弃、回滚、失败都通过新事件表达。
未来上链时，只需提交事件 hash、digest 和摘要。
```

## 8. 确定性沙箱

确定性沙箱负责在本地测试第三方模组时建立硬边界。

第一阶段必须限制：

```text
文件读写路径
网络域名
shell/exec 权限
外部 provider 调用
最大 token 消耗
最大工具调用次数
最长运行时间
最大状态写入数量
```

断路器：

```text
token pre-flight 超额：调用前拒绝
token post-flight 超额：冻结后续调用并记账
工具循环立即停止
越权访问立即停止
异常网络请求立即停止
状态写入越界立即停止
```

可复用现有能力：

```text
CapabilitySnapshot
ToolRegistry._assert_capability
Tool audit
ExecTool sandbox
filesystem allowed_dir
network SSRF policy
```

需要新增：

```text
模组级 capability profile
模组级预算
模组级审计上下文
试用 branch 写入限制
```

## 9. 状态分支与 CoW

第一阶段不做全局透明读写层。

应采用显式上下文状态视图：

```text
StateView(branch_id=None):
  Stable 主干状态。

StateView(branch_id="next-x"):
  主干状态 + 当前 branch overlay。
```

优先覆盖：

```text
FactStore CoW
MEMORY.md 派生视图
skills/workflows/domain_packs staging
可重建搜索索引隔离
```

### 9.1 FactStore CoW

`facts.jsonl` 是重要污染点。

试用模块不能直接写主 `facts.jsonl`。

建议：

```text
memory/evolution_branches/<branch_id>/facts_overlay.jsonl
memory/evolution_branches/<branch_id>/facts_tombstones.jsonl
```

读取：

```text
Stable:
  主 facts.jsonl

Next branch:
  主 facts.jsonl + overlay - tombstones
```

写入：

```text
只写 overlay。
删除写 tombstone。
```

合并：

```text
生成 diff。
按 category、confidence、risk 分级。
policy/safety/self_model 相关事实默认需要人工确认。
```

### 9.2 MEMORY.md 派生视图

`MEMORY.md` 是 facts 渲染结果，不应被试用模块直接覆盖。

Next branch 应生成：

```text
memory/evolution_branches/<branch_id>/MEMORY.preview.md
```

合并成功后，再由主 facts 渲染主 `MEMORY.md`。

### 9.3 staging 安装

试用模块不直接进入稳定目录。

建议路径：

```text
.originagent/evolution/staging/<module_id>/<version>/
```

或工作区内：

```text
memory/evolution_modules/staging/<module_id>/<version>/
```

稳定启用后再进入：

```text
skills/
workflows/
domain_packs/
```

或通过 registry overlay 暴露，而不是复制。

## 10. 脱敏遥测

第一阶段就要避免把隐私日志设计进事件账本。

可公开摘要：

```text
exception_type
error_code
module_id
tool_name
permission_denied_rule
token_in
token_out
duration_ms
retry_count
rollback_reason
stack_frame_hash
```

不可公开：

```text
user prompt
message body
file content
private path
secret-like string
raw tool output
model hidden reasoning
```

原则：

```text
原始日志只留本地。
事件账本写结构化摘要。
未来链上只提交 hash 和最小证明。
```

## 11. 用户模式

客户端应明确运行模式。

```text
stable:
  默认模式。
  只运行稳定模块。

next:
  用户主动加入试用计划。
  允许沙箱试用候选模块。

chief_of_staff:
  幕僚长模式。
  后台周期性拉取候选模块，在影子状态上回测，生成摘要报告。

locked:
  企业或高安全环境。
  禁止自动试用和升级。
```

第一阶段可先实现配置字段，不必完整实现自动回测。

## 12. 与现有模块的关系

### 12.1 Skills

现有 `SkillsLoader` 和 `SkillLifecycleStore` 可作为第一批适配对象。

改造方向：

```text
workspace skill proposal -> evolution module proposal
skill lifecycle event -> evolution event
skill activation -> module activation
```

激活规则：

```text
EvolutionModuleManager 激活 skill 时，必须委托 SkillLifecycleStore.transition()。
不能直接复制文件并伪造 active 状态。
```

### 12.2 Domain Packs

现有 `DomainPackManager` 和 `DomainPackGovernanceService` 很接近目标形态。

改造方向：

```text
domain_pack.yaml -> evolution manifest 子集
domain pack eval -> module validation
domain pack governance event -> evolution event
```

激活规则：

```text
EvolutionModuleManager 激活 domain_pack 时，必须委托 DomainPackGovernanceService。
不能绕开现有 domain pack 治理状态机。
```

### 12.3 Tools

现有 `ToolLoader` 支持 entry point 插件。

第一阶段应增加：

```text
tool module manifest
tool permission declaration
tool sandbox profile
tool conflict detection
```

不允许插件覆盖核心工具。

### 12.4 Workflows

现有 workflow artifacts 可接入 evolution lifecycle。

第一阶段重点：

```text
workflow manifest validation
workflow permission inference
workflow staging
workflow rollback
```

### 12.5 Memory / Facts

第一阶段不替换记忆核心。

只新增：

```text
FactStore branch overlay
MemoryIntent 预留
MEMORY preview
state branch diff
```

## 13. 不做事项

第一阶段明确不做：

```text
真实区块链集成
真实代币
DAO 治理
公开模组市场
验证节点网络
完整向量影子索引
全局透明读写层
自动合并全部沙盒状态
核心 AgentLoop 热替换
核心 self_model 覆写
核心安全策略升级
```

这些内容放到第二阶段或更后。

## 14. 推荐实施阶段（客户端与进化链对齐版）

本节是当前权威实施路线。它吸收 `originagent_evolution_chain_brainstorm.md` 的边界判断：

```text
OriginAgent 客户端负责本地运行、安装、验证、试用、回滚和审计。
Evolution Chain 负责跨节点记录、共识、激励、挑战、baseline 推进和社区治理。
二者通过共享 spec / SDK / proof bundle 对接，客户端不能依赖链才能运行。
```

### Phase 1：OriginAgent 本地进化运行时

目标：

```text
不上链。
不发真实代币。
不做 DAO。
先把本地 proposed -> staged -> verified -> branched -> active -> rollback 跑通。
本地事件、digest、报告和脱敏遥测从第一天开始按未来可映射到链的格式记录。
```

#### Phase 1-A：manifest、event、ledger 骨架（已完成）

产物：

```text
OriginAgent/evolution/manifest.py
OriginAgent/evolution/events.py
OriginAgent/evolution/ledger.py
tests/evolution/test_manifest.py
tests/evolution/test_ledger.py
```

验收：

```text
manifest schema 可校验。
事件类型可规范化。
本地 evolution_events.jsonl append-only 写入。
canonical JSON 和 hash chain 可验证。
```

#### Phase 1-B：本地 module staging（已完成）

产物：

```text
OriginAgent/evolution/package.py
OriginAgent/evolution/manager.py
tests/evolution/test_package.py
tests/evolution/test_manager.py
```

验收：

```text
本地目录 package 可读取、校验、计算 artifact_digest。
artifact 复制到 memory/evolution_staging/<artifact_digest>/artifact。
Stable skills/domain_packs/workflows 不变化。
ledger 记录 module_proposed / module_manifest_validated / module_installed_staging。
```

#### Phase 1-C：静态验证门禁（已完成）

产物：

```text
OriginAgent/evolution/verifier.py
tests/evolution/test_verifier.py
```

验收：

```text
staging metadata、artifact digest、manifest 对齐可验证。
permissions、external_endpoints、token_budget 可静态检查。
domain_pack 复用 DomainPackValidator，只读校验，不安装。
ledger 记录 module_permission_checked / module_verified / module_failed。
```

#### Phase 1-D：本地 CoW facts 状态分支（已完成）

产物：

```text
OriginAgent/evolution/state_branch.py
tests/evolution/test_state_branch.py
```

验收：

```text
verified artifact 可创建 state branch。
branch overlay / tombstone 不污染 stable facts。
merge preview 能列出 added / modified / deprecated / conflicts。
无冲突 merge 写回 facts.jsonl 并重建 MEMORY.md。
冲突 merge 拒绝写回。
```

#### Phase 1-E：本地 skill / domain_pack 激活与回滚（已完成）

产物：

```text
OriginAgent/evolution/activation.py
tests/evolution/test_activation.py
```

验收：

```text
verified skill 可激活到 skills/<module_id>，并委托 SkillLifecycleStore。
verified domain_pack 可通过 DomainPackGovernanceService install / set_active。
rollback 可本地撤销 active 状态。
workflow / tool 暂不激活，返回 unsupported。
```

#### Phase 1-F：运行时 Capability Gate 接入（已完成）

产物：

```text
OriginAgent/evolution/capability_gate.py
OriginAgent/agent/tools/domain_loader.py
OriginAgent/agent/tools/registry.py
tests/evolution/test_capability_gate.py
```

验收：

```text
active evolution module 的 manifest permissions 可转换为 CapabilitySnapshot。
active evolution domain_pack 的 domain tool 执行时受 module snapshot 与 runtime snapshot 交集约束。
非 evolution domain_pack 行为保持不变。
```

#### Phase 1-G：脱敏遥测、token 预算与本地 proof bundle（已完成）

目标：

```text
新增 telemetry.py。
记录白名单摘要，而不是原始 prompt、文件内容、私有路径、secret-like 字符串。
实现 token budget pre-flight / post-flight 预算边界。
生成本地 proof bundle，为 Phase 2 上链或提交验证节点准备。
```

proof bundle 最小字段：

```text
schema_version
artifact_digest
module_id
module_type
verification_event_hash
activation_event_hash
verification_report_digest
capability_snapshot_digest
telemetry_digest
state_branch_digest
ledger_tip_hash
created_at
actor_public_key
signature
```

验收：

```text
错误、拒绝、回滚和 token 超额只记录脱敏摘要。
token 预算超额能阻断执行路径并写入结构化事件。
proof bundle 可以离线复算 digest，不依赖链。
proof bundle 不包含本地绝对路径和私密内容。
```

#### Phase 1-H：dirty rollback、teardown、身份签名与账本运维（已完成）

目标：

```text
补齐 teardown / dirty_rollback / force clean 状态。
新增本地 Ed25519 identity，稳定 actor_public_key / signature / signature_scheme。
启动时暴露 ledger chain_integrity 状态。
定义 ledger segment / rotation，避免无限重算。
补齐同 module_id 重装、active branch、rollback 悬空时的状态约束。
```

验收：

```text
外部副作用未清理时不误报 clean rollback。
dirty rollback 会阻断同 module_id 自动重装，直到用户显式 force clean。
事件签名可验证本地身份，私钥丢失策略明确。
ledger 损坏不阻止启动，但状态中明确标记 broken。
```

## 15. 第一阶段完成定义

截至 2026-05-22，代码侧已完成 Phase 1-A 到 Phase 1-H。第一阶段本地运行时闭环已完成，下一步进入 Phase 2 的共享协议、链下证明与 EVM 测试网适配。

Phase 1 完整完成时，OriginAgent 应能做到：

```text
识别 evolution module manifest。
把模块安装到 staging。
按权限和环境进行本地验证。
为试用模块创建状态分支。
试用写入不污染 Stable。
可以生成 diff。
可以激活模块。
可以回滚模块。
可以丢弃分支状态。
运行时 capability gate 能约束 active evolution domain_pack 的工具权限。
可以写入 append-only 本地事件账本。
可以生成脱敏遥测摘要。
可以生成本地 proof bundle。
可以执行 token 预算 pre-flight / post-flight。
可以标记 dirty rollback / teardown 失败状态。
可以用本地身份签名关键 evolution event。
可以暴露 ledger chain_integrity 状态。
```

不要求：

```text
链上提交。
代币奖励。
公开市场。
自动基线推进。
验证节点网络。
workflow / tool 模组激活。
强隔离容器级沙箱。
```

## 16. 关键风险

1. 改造过大，侵入核心循环。
2. 过早接链，导致客户端基础不稳。
3. 状态分支设计不清，造成回滚假象。
4. 权限声明只检查 manifest，没有运行时强制。
5. 事件账本记录隐私。
6. 用户确认过多，造成授权疲劳。
7. 为未来扩展过度抽象，拖慢第一阶段落地。
8. 事件哈希计算不确定，导致未来链上无法验证本地账本。
9. 把应用逻辑级沙箱误认为强隔离安全沙箱。
10. teardown 失败后没有脏回滚状态，造成外部副作用悬空。
11. manifest 和 event 缺少显式 schema version，导致长期账本不可解析。
12. CoW 状态分支缺少合并冲突处理，导致 Stable 主干与 Next 分支发生基线漂移。
13. token 预算只做事后统计，导致恶意或失控模块在拦截前已经产生外部 Provider 成本。
14. 本地账本只有 hash 没有签名，无法证明事件由哪个本地身份产生。
15. dirty_rollback 没有解除机制，导致模块长期卡死或权限长期悬空。
16. append-only 账本无限膨胀，启动校验和 hash chain 重算成本过高。
17. 脱敏遥测直接记录原始异常消息，导致 token、URL、私有路径或用户输入泄漏。
18. event_type 与现有 action 字段缺少规范映射，导致桥接事件语义不一致。
19. 事件目录分散在多节，导致实现者无法确认权威事件集合。
20. 本地身份私钥存储未定义，导致签名机制无法落地。
21. token pre-flight tokenizer 策略不明确，导致预算估算偏差。
22. EvolutionLedger 缺少启动时 hash chain 完整性校验。
23. EvolutionModuleManager 激活模块时绕过现有状态机，导致文件状态与生命周期事件不一致。

应对原则：

```text
窄范围
先本地
强边界
少侵入
可测试
可回滚
可审计
```

## 17. 编码前工程硬约束

以下约束必须在 `manifest.py`、`events.py`、`ledger.py` 第一轮实现时同步落地，不能作为后续优化。

### 17.1 确定性序列化与哈希

本地事件账本会包含：

```text
previous_event_hash
event_hash
```

即使 Phase 1 不上链，一旦开始计算 hash，就必须保证序列化确定性。

风险：

```text
不同 Python 版本
不同 dict 键顺序
不同空格
不同 ensure_ascii 策略
不同浮点表示
不同 null / 缺省字段处理
```

都可能导致同一个事件对象生成不同 hash。

实现要求：

```text
ledger.py 第一版必须实现 canonical serialization。
优先遵循 Canonical JSON / RFC 8785。
如果第一阶段不完整实现 RFC 8785，也必须强制 sort_keys、固定 separators、UTF-8、禁止非规范浮点。
hash 输入必须是 bytes，不允许直接 hash Python dict。
```

测试要求：

```text
同一事件不同键顺序 -> event_hash 一致。
同一事件多次序列化 -> bytes 完全一致。
修改任一字段 -> event_hash 改变。
previous_event_hash 变化 -> event_hash 改变。
```

### 17.2 沙箱边界必须区分软硬

Phase 1 的确定性沙箱应明确定位为：

```text
应用逻辑级沙箱
Soft Sandbox
```

它主要防止：

```text
状态误写
权限误用
工具越权
预算超支
网络域名越界
文件路径越界
```

它不能承诺防住：

```text
恶意 Python 字节码
ctypes 绕过
解释器级逃逸
sys.modules 操作
native extension 恶意行为
操作系统级侧信道
```

工程策略：

```text
第一阶段不与 Python 解释器底层恶意逃逸对抗。
第一阶段只承诺应用层边界、权限边界、预算边界和状态分支边界。
后续若要运行不可信代码，应引入进程级、容器级或虚拟机级 Hard Sandbox。
```

文档和 CLI 输出都应避免暗示 Phase 1 沙箱是强隔离安全容器。

### 17.3 脏回滚状态

本地状态分支可以丢弃，但外部副作用不一定能干净撤销。

例如：

```text
teardown 超时
teardown 崩溃
网络中断
外部 API 拒绝删除资源
权限已过期
部分资源清理成功、部分失败
```

因此生命周期不能只有：

```text
module_rolled_back
```

必须增加：

```text
module_rollback_started
module_rollback_succeeded
module_rollback_failed
dirty_rollback
teardown_started
teardown_succeeded
teardown_failed
```

`dirty_rollback` 含义：

```text
本地代码和本地状态已回滚或已隔离，
但存在未确认清理完成的外部副作用或残留资源。
```

处理规则：

```text
dirty_rollback 必须进入事件账本。
Runtime status / CLI / WebUI 应能提示用户。
幕僚长模式可以定期尝试受限清理。
dirty_rollback 不应被误报为 clean rollback。
```

### 17.4 显式 schema version

`manifest.yaml` 和 `evolution_events.jsonl` 在早期会高频变化。

因此第一版就必须强制版本字段。

Manifest 必须包含：

```yaml
schema_version: "originagent.evolution.module.v1"
```

Event 必须包含：

```json
{
  "schema_version": "originagent.evolution.event.v1"
}
```

规则：

```text
缺少 schema_version 的 manifest 直接拒绝。
缺少 schema_version 的 event 不能写入账本。
未知 schema_version 不能静默解析。
schema 变更必须提供迁移或兼容策略。
测试样例必须覆盖未知版本、缺失版本、旧版本。
```

这样本地跑了很久的事件账本，未来才不会变成无法解析的脏数据。

## 18. 代码实施前补充约束

以下是第二批必须在设计阶段记录的工程约束。它们不一定都在 Phase 1-A 立刻完整实现，但不能从协议和数据结构中遗漏。

### 18.1 CoW 状态分支合并冲突

风险：

```text
Stable 主干可能在 Next 分支试用期间继续发生变化。
如果 Stable 修改了 Fact A，Next branch 也修改或删除了 Fact A，
合并时会发生 Baseline Drift / Merge Conflict。
```

设计要求：

```text
overlay 写入时必须记录 base_version 或 base_event_hash。
合并时必须执行 CAS（Compare-And-Swap）校验。
如果主干版本与分支基线不一致，不能静默合并。
```

默认冲突策略：

```text
Stable Wins:
  主干优先，分支变更进入冲突报告，等待人工或幕僚长处理。

Branch Wins:
  只允许在低风险、可重建、非语义核心状态上显式启用。

Manual Review:
  memory / self_model / preference / facts 等语义状态必须默认进入人工或高置信验证。
```

Phase 1 建议：

```text
先实现 base_event_hash 字段。
先拒绝冲突合并，不做复杂自动冲突解决。
生成 diff + conflict report 即可。
```

`base_event_hash` 定义：

```text
记录位置：
  state_branch_created 事件的 result.base_event_hash 字段。

取值：
  分支创建时 EvolutionLedger 的 terminal event_hash。

CAS 校验：
  合并时读取当前 EvolutionLedger terminal event_hash。
  与 branch 的 base_event_hash 比较。
  不一致则拒绝自动合并，并生成 conflict report。
```

补充：

```text
后续可以为 overlay 每条记录增加 base_fact_version。
Phase 1 先用 branch-level base_event_hash 建立粗粒度 CAS。
```

### 18.2 Token 预算控制的物理延迟

风险：

```text
LLM Provider 的精确 token 消耗通常是后验统计。
Streaming 场景下，实际 token 可能到 chunk 返回后才知道。
如果模块一次性提交超长 prompt，费用可能在应用层拦截前已经发生。
```

因此 token 控制必须拆分为两层：

```text
Pre-flight Check:
  调用 Provider 前估算 prompt / tool payload / attachment 的 token 数。
  超过预算或单次请求上限时直接拒绝。

Post-flight Accounting:
  Provider 返回后按真实 token 记账。
  若超出累计预算，立即冻结该模块后续调用，并写入事件账本。
```

工程要求：

```text
外部 Provider 调用前必须经过 tokenizer 或保守估算器。
manifest 的 token_budget 不只是报告字段，必须参与运行时熔断。
单次请求上限和累计预算上限要分开记录。
```

Phase 1 token 估算策略：

```text
不做 per-provider 精准 tokenizer。
使用保守估算器：
  ceil(char_count / 3.5)

如果 Provider 提供 token counting API：
  优先使用 Provider 官方计数。

Provider 返回后：
  从 API response usage 字段读取真实 token 并记账。
```

预算规则：

```text
累计预算：
  manifest.context_budget.token_budget

单次请求上限：
  manifest.context_budget.token_budget * 0.8

超过 pre-flight 上限：
  调用前拒绝。

超过 post-flight 累计预算：
  冻结模块后续 Provider 调用，并写入事件账本。
```

实现位置：

```text
evolution/capability_gate.py:
  estimate_tokens()
  preflight_check_provider_payload()
  record_postflight_usage()
```

### 18.3 本地身份与事件签名

风险：

```text
event_hash 只能证明事件内容没有变化，不能证明是谁产生了事件。
如果 Phase 1 只有 actor: "user" 这类明文字段，
未来接链时无法建立不可否认性，也无法区分真实本地事件和伪造事件。
```

设计方向：

```text
OriginAgent 初始化本地进化运行时时，生成 Local Ephemeral Identity。
本地身份包含 public_key / private_key。
每个 event_hash 由本地 private_key 签名。
event 记录 actor_public_key、signature、signature_scheme。
```

边界：

```text
Phase 1 的本地身份不等于链上身份。
Phase 1 不要求代币钱包、不要求 DID、不要求 KYC。
但事件结构要为未来链上身份绑定预留迁移路径。
```

最低要求：

```text
events.py 第一版必须保留 signature 结构字段。
ledger.py 可以先支持 unsigned / signed 两种模式。
测试中至少覆盖 event_hash 与 signature payload 的确定性。
```

Phase 1 本地身份实现细节：

```text
存储路径：
  ~/.originagent/evolution_identity.json

格式：
  {
    "public_key": "...",
    "private_key": "...",
    "created_at": "...",
    "scheme": "ed25519"
  }

保护方式：
  Phase 1 明文存储，并明确标记为不安全。
  Phase 2+ 再考虑口令加密或 OS keychain。

丢失策略：
  重新初始化会生成新身份。
  旧事件保留旧 actor_public_key。
  文档提示用户备份 evolution_identity.json。

签名算法：
  优先 Ed25519。
```

边界补充：

```text
allow_unsigned_events 可以作为开发模式存在。
默认模式应提示未签名事件的风险。
本地身份不等于链上钱包，不持有代币。
```

### 18.4 Dirty Rollback 的解除机制

风险：

```text
dirty_rollback 表示本地代码和本地状态已隔离或回滚，
但外部副作用未确认清理完成。
如果没有解除机制，模块可能永久卡在半悬空状态。
```

进入 dirty_rollback 后的行为：

```text
锁定该模块的 active 权限。
阻止同 module_id 的自动重新 staging。
保留只读诊断能力。
允许受限 teardown 重试。
Runtime status / CLI / WebUI 必须明确提示 dirty 状态。
```

强制解除机制：

```text
提供 force-clean / force-purge 概念。
用户可以将无法撤销的外部副作用标记为 abandoned。
本地解除状态锁，但账本永久记录 abandoned 事实。
```

事件建议：

```text
module_force_clean_requested
module_force_clean_succeeded
external_side_effect_abandoned
```

原则：

```text
force-clean 不是伪装成 clean rollback。
它只能解除本地死锁，不能抹除外部副作用曾经失败的事实。
```

### 18.5 Append-only 账本膨胀

风险：

```text
evolution_events.jsonl 长期只追加会持续膨胀。
如果每次启动都完整重算 hash chain，I/O 和 CPU 成本会越来越高。
```

设计要求：

```text
Phase 1 就要定义 ledger segment / rotation 的数据结构。
即使第一版只写单文件，也不能把文件名和校验逻辑写死。
```

建议策略：

```text
按时间切片：
  evolution_events_202605.jsonl
  evolution_events_202606.jsonl

每个新 segment 的第一条记录包含 previous_terminal_hash。
每个 segment 结束时生成 terminal_hash。
```

可选快照：

```text
ledger_snapshot:
  segment_id
  terminal_event_hash
  terminal_event_index
  created_at
  event_count
```

Phase 1 最低要求：

```text
ledger.py 的接口不要假设只有一个永久 jsonl 文件。
事件 hash chain 要支持跨 segment 串联。
EvolutionLedger 初始化时必须执行 verify_chain()。
verify_chain() 从第一条事件开始重算并比对 event_hash。
如果 hash chain 断裂，不阻止 OriginAgent 启动，但标记 chain_integrity: broken。
CLI / WebUI / Runtime status 应提示账本完整性异常。
test_ledger.py 必须覆盖篡改事件后校验失败。
```

### 18.6 脱敏遥测的异常清洗边界

风险：

```text
Python 第三方库的 Exception Message 可能包含 URL、token、路径、用户输入或请求参数。
如果直接写入公开遥测摘要，会造成隐私泄漏。
```

规则：

```text
公开遥测禁止记录原生 exception message。
公开遥测只允许白名单字段。
异常详情只保留本地私有日志，并受用户权限保护。
```

公开字段建议：

```text
exception_type
error_code
sanitized_category
stack_frame_hash
module_id
tool_name
duration_ms
token_in
token_out
```

清洗策略：

```text
先做白名单映射。
再做正则擦除。
最后只写结构化摘要。
```

需要擦除的典型内容：

```text
URL query token
Authorization header
Bearer token
本地绝对路径
邮箱
手机号
用户输入片段
原始 prompt
工具原始输出
```

Phase 1 最低要求：

```text
telemetry.py 不接收裸 Exception 直接序列化。
必须通过 sanitize_exception(exc) 生成公开摘要。
测试样例必须覆盖 URL token、Bearer token、本地路径和用户输入片段。
```

## 19. 代码库审查反馈

以下内容来自一次针对当前 OriginAgent 代码库的结构审查。该审查的目标是验证本改造计划是否贴合现有代码，而不是重新设计进化链。

### 19.1 审查目标

```text
为 OriginAgent 新增本地进化运行时模块 OriginAgent/evolution/。
统一管理 skills、workflows、domain_packs、tools 四类低风险升级模组。
提供可验证、可回滚、可审计的本地模组治理能力。
为后续 OriginAgent Evolution Chain 链上集成打地基。
第一阶段只做本地，不接真实链。
```

### 19.2 代码现状摘要

审查结论：

```text
OriginAgent 已经具备计划中描述的大部分基础能力。
现有工程质量较高。
新增 evolution 模块不应该推倒重来，而应该统一、桥接和约束已有能力。
```

现有能力与位置：

| 能力 | 实际代码位置 | 成熟度 | 备注 |
|---|---|---|---|
| Skill 生命周期 | `OriginAgent/agent/skill_lifecycle.py` | 高 | 已有 proposed / verified / active / deprecated / rejected，append-only JSONL、FileLock、状态机转换、幂等保护 |
| Domain Pack 治理 | `OriginAgent/agent/domain_pack_governance.py` | 高 | 已有 staging 目录、备份、回滚、append-only JSONL 事件、严格校验 |
| ToolRegistry 权限校验 | `OriginAgent/agent/tools/registry.py` | 高 | 已集成 CapabilitySnapshot、域名工具权限、策略拒绝检测 |
| ToolLoader 插件发现 | `OriginAgent/agent/tools/loader.py` | 中 | 支持 pkgutil 扫描和 entry_points，插件不能覆盖核心工具 |
| CapabilitySnapshot | `OriginAgent/security/capabilities.py` | 高 | frozen dataclass，已有 user_turn / cron / subagent 预设 |
| FactStore / MEMORY.md | `OriginAgent/agent/facts.py` | 高 | 结构化事实、upsert、冲突检测、高风险分类 |
| GitStore | `OriginAgent/utils/gitstore.py` | 中 | 支持 init / commit / log / revert / line_ages |
| SessionSearchIndex | `OriginAgent/session/search_index.py` | 高 | SQLite FTS，可重建，多源索引 |
| Workflow artifacts 校验 | `OriginAgent/agent/workflow_artifacts.py` | 高 | schema 校验、不安全短语检测、secret 检测 |
| MessageBus | `OriginAgent/bus/events.py` | 中 | InboundMessage / OutboundMessage dataclass |
| shell 命令沙箱 | `OriginAgent/agent/tools/sandbox.py` | 低 | 只覆盖 exec 工具的 bubblewrap 命令级沙箱，不等同于 evolution 应用逻辑沙箱 |

关键发现：

```text
现有模块已经各自维护独立事件流：
  memory/skill_lifecycle_events.jsonl
  memory/domain_pack_events.jsonl

如果新增：
  memory/evolution_events.jsonl

就会形成三套并行账本。
这是客户端改造计划中必须优先定义的集成点。
```

### 19.3 严重问题 C1：三套事件账本并存

涉及文件：

```text
OriginAgent/agent/skill_lifecycle.py
OriginAgent/agent/domain_pack_governance.py
```

现有事件流：

```text
memory/skill_lifecycle_events.jsonl
memory/domain_pack_events.jsonl
```

计划新增：

```text
memory/evolution_events.jsonl
```

风险：

```text
当用户通过 evolution 模块安装 skill 模组时，事件应写入哪里？
只写 evolution_events 会让 SkillLifecycleStore 变成孤立系统。
同时写多个账本又会带来对账和一致性问题。
未来上链时无法确认哪个事件源是权威来源。
```

决策建议：

```text
Phase 1 不把 evolution_events 直接定义为唯一权威源。
Phase 1 应将 evolution_events 定义为桥接账本 / 上层治理账本。
具体 skill/domain_pack 的现有事件流继续保留。
EvolutionLedger 记录跨模块生命周期、artifact digest、state branch、评分、回滚、签名等统一事实。
现有 SkillLifecycleStore / DomainPackGovernanceService 继续记录各自领域内的兼容事件。
```

后续可选方向：

```text
方向 A：桥接长期保留。
  evolution_events 作为全局索引和链上投影源。
  领域事件流作为本地兼容和调试源。

方向 B：evolution_events 逐步成为唯一权威源。
  需要迁移 skill_lifecycle_events 和 domain_pack_events。
  需要兼容旧数据。
  不适合 Phase 1。
```

Phase 1 结论：

```text
采用方向 A。
先桥接，不迁移。
不废弃现有事件流。
编码时必须明确事件路由策略。
```

### 19.4 严重问题 C2：FactStore 不是 append-only

涉及文件：

```text
OriginAgent/agent/facts.py
```

现状：

```text
facts.jsonl 是 current-state store，不是 append-only event log。
坏 JSON 行在读取时会被忽略，并在下一次重写时被丢弃。
FactStore 写入时会重写当前状态文件。
```

风险：

```text
计划中 append-only 约束只适用于事件账本，不适用于 facts.jsonl。
如果文档口径不清，会误以为 facts 本身也具备事件溯源能力。
```

修正口径：

```text
事件账本 append-only。
事实存储 current-state。
CoW overlay 是在 current-state 存储上模拟分支隔离。
CoW overlay 不能被描述为在 append-only facts 上追加事件。
```

Phase 1 结论：

```text
保留 FactStore 当前 current-state 设计。
不要为了 evolution 强行改造成事件溯源数据库。
StateBranch 需要围绕 overlay / tombstone / base_event_hash 工作。
事件账本只记录状态变更事实和 hash，不替代 facts.jsonl。
```

### 19.5 中等问题 M1：Evolution Manifest 与 domain_pack.yaml 重叠

涉及文件：

```text
OriginAgent/agent/domain_packs.py
```

现有能力：

```text
DomainPackValidator.validate_pack 已经校验 domain_pack.yaml。
domain_pack.yaml 已包含 pack_id、skills、workflows、tools、permissions、evals 等结构。
```

重叠字段：

```text
evolution.module_id ~= domain_pack.pack_id
evolution.module_type ~= domain_pack 内部 contribution 类型
evolution.permissions ~= domain pack tool permissions
evolution.tests.path ~= domain pack evals
```

风险：

```text
如果 evolution manifest 从零定义，会复制 domain_pack.yaml 的职责。
后续同一模块会出现两个 manifest，且语义可能冲突。
```

决策建议：

```text
evolution manifest 是治理包装层，不替代 domain_pack.yaml。
对于 module_type == "domain_pack"，必须复用 DomainPackValidator。
evolution manifest 只增加 evolution 特有字段：
  schema_version
  artifact_digest
  signature
  target_originagent
  target_module_api
  runtime_requirements
  context_budget
  state_branch_policy
  sandbox_config
  telemetry_policy
```

Phase 1 结论：

```text
不要重复实现 domain_pack 校验。
manifest.py 应采用组合模式，先校验 evolution 包装层，再委托现有 validator。
```

### 19.6 中等问题 M2：沙箱命名与层级

涉及文件：

```text
OriginAgent/agent/tools/sandbox.py
```

现状：

```text
现有 sandbox.py 是 shell / exec 命令级 bubblewrap 包装器。
它不是 module sandbox，也不是应用逻辑沙箱。
```

风险：

```text
新增 OriginAgent/evolution/sandbox.py 会与 agent/tools/sandbox.py 命名混淆。
两者安全边界不同，不能让维护者误以为它们是同一层。
```

命名建议：

```text
将 evolution/sandbox.py 改名为：
  evolution/capability_gate.py

或：
  evolution/module_sandbox.py
```

决策建议：

```text
Phase 1 推荐 evolution/capability_gate.py。
它表达的是应用逻辑级权限门、预算门、工具门。
agent/tools/sandbox.py 保持不动，不在本阶段重命名。
```

### 19.7 中等问题 M3：StateView 必须复用 FactStore 锁

涉及文件：

```text
OriginAgent/agent/memory.py
OriginAgent/agent/facts.py
```

风险：

```text
StateView(branch_id) 需要组合主 facts.jsonl、overlay、tombstones。
如果 evolution 在 FactStore 外部独立拼接文件，会绕开现有 FileLock。
并发读写时可能破坏一致性。
```

决策建议：

```text
CoW overlay 的 facts 读写应进入 FactStore 内部方法。
例如后续新增：
  read_all_with_overlay_unlocked(branch_id)

这些方法应复用现有锁语义。
不要让 evolution/state_branch.py 直接无锁读取和拼接 facts.jsonl。
```

Phase 1 结论：

```text
阶段 D 才做状态分支。
进入阶段 D 前必须先设计 FactStore 内部 overlay 接口。
```

### 19.8 中等问题 M4：缺少 config schema 扩展

涉及文件：

```text
OriginAgent/config/schema.py
```

计划中提到的模式：

```text
stable
next
chief_of_staff
locked
```

风险：

```text
如果没有配置 schema，运行模式只能散落在 CLI 参数或隐式默认值中。
后续用户授权、后台回测和企业锁定模式会缺乏统一入口。
```

建议：

```text
新增 EvolutionConfig。
字段可包括：
  enabled
  mode
  ledger_path
  allow_unsigned_events
  max_staging_modules
  default_token_budget
```

Phase 1 取舍：

```text
阶段 A 可以先不接完整配置系统。
但文档必须记录 config/schema.py 是后续集成点。
```

### 19.9 轻微问题 L1：canonical serialization 与现有事件流不一致

涉及文件：

```text
OriginAgent/agent/skill_lifecycle.py
OriginAgent/agent/domain_pack_governance.py
```

现状：

```text
现有事件流使用 json.dumps(event, ensure_ascii=False)。
未强制 sort_keys。
未固定 separators。
```

风险：

```text
evolution ledger 要求 canonical serialization。
如果桥接现有事件流，不能直接拿旧事件 JSON 字符串作为可验证 payload。
```

决策：

```text
EvolutionLedger 独立实现 canonical serialization。
桥接旧事件时，将旧事件作为 event_payload 重新 canonicalize 后再计算 evolution event_hash。
不要求 Phase 1 改写旧事件流。
```

### 19.10 轻微问题 L2：memory 目录文件增长

现状与计划新增：

```text
memory/skill_lifecycle_events.jsonl
memory/domain_pack_events.jsonl
memory/evolution_events.jsonl
memory/evolution_branches/<branch_id>/facts_overlay.jsonl
memory/evolution_branches/<branch_id>/facts_tombstones.jsonl
```

风险：

```text
memory/ 会逐渐变成事件、状态、分支、索引的混杂目录。
```

建议：

```text
后续可考虑：
  memory/events/evolution.jsonl
  memory/events/skills.jsonl
  memory/events/domain_packs.jsonl

但这属于迁移型清理，不进入 Phase 1-A。
```

### 19.11 轻微问题 L3：evolution 包公共 API 缺失

建议：

```python
from OriginAgent.evolution.manifest import EvolutionManifest, validate_manifest
from OriginAgent.evolution.events import EvolutionEvent, EventType
from OriginAgent.evolution.ledger import EvolutionLedger
```

Phase 1 取舍：

```text
__init__.py 应只导出稳定公共 API。
不要过早导出 manager / state_branch / telemetry 等未稳定模块。
```

### 19.12 风险 R1：沙箱测试不能过度依赖 mock

涉及文件：

```text
OriginAgent/agent/tools/registry.py
```

风险：

```text
真实权限链包含：
  manifest permissions
  CapabilitySnapshot
  domain_tool_permissions
  module capability profile
  ToolRegistry._assert_capability

如果测试只 mock manifest 或 capability gate，可能漏掉真实越权路径。
```

要求：

```text
阶段 C 的集成测试必须使用真实 ToolRegistry + CapabilitySnapshot。
不能只测试 manifest 解析。
```

### 19.13 风险 R2：状态分支 merge 规则必须前置定义

风险：

```text
Stable 与 Next 同时修改同一 fact 时，如果没有规则，会出现隐性覆盖。
```

结论：

```text
默认拒绝冲突合并。
生成 conflict report。
语义状态进入人工或高置信验证。
不要使用 last-write-wins。
```

### 19.14 逻辑谬误

审查结论：

```text
未发现根本逻辑谬误。
计划整体自洽。
主要问题是实现层面的权威源、复用边界和接口位置需要补齐。
```

### 19.15 埋雷点 B1：schema_version 命名空间与未知版本处理

风险：

```text
如果未来 schema_version 从 originagent.evolution.module.v1 升级到 v2，
旧客户端不能静默降级解析。
```

规则：

```text
manifest.py 对未知 schema_version 必须显式拒绝。
错误消息应提示需要升级 OriginAgent。
不能采用静默 fallback。
```

### 19.16 埋雷点 B2：MemoryWorkspaceSnapshot 覆盖范围

涉及文件：

```text
OriginAgent/agent/memory.py
```

风险：

```text
MemoryWorkspaceSnapshot 当前追踪 SOUL.md、USER.md、MEMORY.md、facts.jsonl、skills/ 等。
如果 evolution branch overlay 文件放在 memory/evolution_branches/ 下，
Dream snapshot.restore() 可能不会清理脏 overlay 文件。
```

建议：

```text
实现 state branch 后，必须决定：
  将 overlay 文件加入 MemoryWorkspaceSnapshot 追踪范围；
或：
  明确 overlay 不属于 Dream snapshot，由 EvolutionStateBranch 独立清理。
```

Phase 1 倾向：

```text
不要让 Dream snapshot 隐式管理 evolution branches。
由 evolution/state_branch.py 负责分支生命周期。
但必须避免 Dream restore 后留下可见脏状态。
```

### 19.17 增加 Bug 点 AB1：搜索索引回滚残留

涉及文件：

```text
OriginAgent/session/search_index.py
```

风险：

```text
SessionSearchIndexService 是可重建 SQLite FTS 索引。
如果试用模块写入了可搜索内容，回滚模块后索引可能残留试用内容。
```

决策建议：

```text
阶段 D 必须增加 search index 隔离。
试用模块写入要么不进入主 FTS；
要么进入 branch-scoped index；
要么在回滚时触发重建。
```

Phase 1 取舍：

```text
当前 session search 是可重建缓存，不是不可逆核心向量库。
不做完整 shadow vector namespace。
但必须禁止 Next 分支数据污染 Stable 搜索结果。
```

### 19.18 假设点 H1：tool 模组动态加载能力

现状：

```text
ToolLoader 当前支持 pkgutil.iter_modules 扫描和 entry_points(group="originagent.tools")。
不等于支持任意文件路径动态加载 tool 模组。
domain_pack runtime contribution 有类似能力，但边界不同。
```

风险：

```text
如果 evolution module_type == "tool" 直接假设可以从上传代码文件加载，
会超出现有 ToolLoader 能力。
```

Phase 1 结论：

```text
tool 模组应优先通过 domain_pack 或 entry_point 机制接入。
不要第一阶段支持任意路径 Python tool 热加载。
```

### 19.19 假设点 H2：chief_of_staff 后台回测基础设施

可能复用：

```text
OriginAgent/cron/service.py
```

风险：

```text
计划中 chief_of_staff 模式不是简单开关。
它需要周期调度、预算、授权摘要、回测数据隔离和用户确认。
```

Phase 1 结论：

```text
chief_of_staff 只作为模式预留。
不进入 Phase 1-A / B。
后续若实现，应复用 cron 基础设施。
```

### 19.20 阶段 A 调整建议

阶段 A 应明确包含：

```text
OriginAgent/evolution/__init__.py
OriginAgent/evolution/manifest.py
OriginAgent/evolution/events.py
OriginAgent/evolution/ledger.py
tests/evolution/test_manifest.py
tests/evolution/test_ledger.py
```

阶段 A 暂不包含：

```text
manager.py
capability_gate.py
state_branch.py
telemetry.py
config/schema.py 完整接入
```

但阶段 A 的数据结构必须预留：

```text
schema_version
artifact_digest
signature
signature_scheme
actor_public_key
previous_event_hash
event_hash
base_event_hash
event_payload
source_event_stream
```

### 19.21 阶段 C 调整建议

阶段 C 做 capability gate 时，必须满足：

```text
走真实 ToolRegistry._assert_capability。
走真实 CapabilitySnapshot。
不要只 mock manifest permissions。
测试覆盖越权读写、网络、exec、provider、token budget。
```

命名建议：

```text
使用 evolution/capability_gate.py。
不使用 evolution/sandbox.py 作为第一选择。
```

### 19.22 阶段 D 调整建议

阶段 D 做 StateBranch 时，必须满足：

```text
FactStore 内部提供 overlay 读写接口。
复用现有 FileLock。
overlay 写入记录 base_event_hash 或 base_version。
合并时 CAS 校验。
冲突默认拒绝自动合并。
搜索索引不能被 Next 分支污染。
```

### 19.23 阶段 F 调整建议

遥测模块应满足：

```text
不直接序列化裸 Exception。
复用或参考 memory.py 中已有 redact_memory_text 能力。
但遥测脱敏规则应更偏向 secret / URL / path / token / prompt 泄漏。
公开摘要只写结构化字段。
原始日志只留本地私有区域。
```

### 19.24 最终评估

审查结论：

```text
计划整体质量良好。
对现有系统的理解基本准确。
主要问题不是方向错误，而是三个实现前必须明确的问题：
  1. 三套事件账本的整合策略。
  2. FactStore current-state 与事件账本 append-only 的边界。
  3. Evolution manifest 与 domain_pack.yaml 的关系。
```

本计划的修正决策：

```text
C1:
  Phase 1 采用桥接账本，不废弃现有 skill/domain_pack 事件流。

C2:
  明确 facts.jsonl 是 current-state store。
  append-only 只用于 evolution ledger。

M1:
  evolution manifest 是治理包装层。
  domain_pack 模块必须复用 DomainPackValidator。
```

进入编码前的门槛：

```text
只有 C1 / C2 / M1 在文档和数据结构中明确后，才进入 Phase A 实施。
```

## 20. 第二轮代码库审查反馈

第二轮审查重点不是重新阅读全部代码，而是将更新后的计划与当前代码再次交叉校验，确认上一轮问题是否真正解决，并寻找新增章节 16-19 引入的新风险。

说明：

```text
本节记录第二轮审查发现的问题、判断和决策。
C3 / C4 / M5 / M6 / AB2 已同步修正到前文第 7、12、14、18 节。
本节中出现的“审查时第 7 节列出”等表述，指第二轮审查当时的文档状态。
```

### 20.1 目标概述

```text
为 OriginAgent 新增 OriginAgent/evolution/ 本地进化运行时模块。
统一管理 skills、workflows、domain_packs、tools 四类低风险升级模组。
覆盖安装、沙箱验证、状态分支、激活、回滚的完整生命周期。
建立 append-only 事件账本，为后续 OriginAgent Evolution Chain 链上集成打地基。
第一阶段只做本地，不接真实链。
```

### 20.2 现有事件结构差异

经代码核对，现有事件结构与计划中的 EvolutionEvent 存在明显差异。

| 字段 | SkillLifecycleEvent | DomainPackEvent | 计划 EvolutionEvent |
|---|---|---|---|
| event_id | 有 | 有 | 有 |
| schema_version | 无 | 无 | 有，强制 |
| event_hash | 无 | 无 | 有，强制 |
| previous_event_hash | 无 | 无 | 有，强制 |
| signature | 无 | 无 | 预留 |
| actor | `"user"` | `"user"` | `"user"` |
| 类型字段名 | `action` | `action` | `event_type` |

关键发现：

```text
EvolutionEvent 的结构比现有事件丰富得多。
hash chain、signature、schema_version 是正确方向。
但旧事件缺少这些字段，不能直接作为 evolution event 的有效 payload。
桥接旧事件流时必须 normalize，而不能原样搬运。
```

### 20.3 旧问题验证

上一轮审查的以下问题已经在第 19 节全部得到决策回应：

```text
C1 / C2
M1 / M2 / M3 / M4
L1 / L2 / L3
R1 / R2
B1 / B2
AB1
H1 / H2
```

结论：

```text
第 19 节不是简单标注风险，而是逐项给出了 Phase 1 取舍方案。
旧问题原则上已解决。
第二轮新增问题主要集中在事件 schema、路径、身份、token 估算、状态机委托等更细的工程细节。
```

### 20.4 严重问题 C3：事件类型字段命名与现有事件流不兼容

涉及计划位置：

```text
第 7 节：事件字段定义
第 19.3 节：桥接策略
```

计划中的 EvolutionEvent 使用：

```json
{
  "event_type": "module_verified"
}
```

现有两个事件流使用：

```text
SkillLifecycleEvent.action
DomainPackEvent.action
```

风险：

```text
如果 EvolutionLedger 需要桥接或引用现有事件，
桥接代码必须执行 action -> event_type 的字段映射。
如果 events.py 第一版不定义映射规则，
后续维护者会困惑同一个概念为什么存在 action 和 event_type 两种字段名。
```

决策：

```text
EvolutionEvent 对外统一使用 event_type。
桥接旧事件时必须写 source_event_stream。
events.py 必须提供 normalize_event_type()。
normalize_event_type() 负责将来源事件中的 action / event_type 映射到规范事件类型枚举。
```

建议字段：

```json
{
  "source_event_stream": "skill_lifecycle",
  "source_event_id": "...",
  "event_type": "module_activated"
}
```

允许的 source_event_stream：

```text
skill_lifecycle
domain_pack
evolution
```

Phase 1 要求：

```text
events.py 第一版必须包含字段映射策略。
不要让 ledger.py 自己临时判断 action / event_type。
```

### 20.5 严重问题 C4：事件目录不一致

涉及计划位置：

```text
第 7 节
第 17.3 节
第 18.4 节
```

不一致点：

```text
第 7 节列出：
  module_rolled_back

第 17.3 节扩展为：
  module_rollback_started
  module_rollback_succeeded
  module_rollback_failed
  dirty_rollback
  teardown_started
  teardown_succeeded
  teardown_failed

第 18.4 节又增加：
  module_force_clean_requested
  module_force_clean_succeeded
  external_side_effect_abandoned
```

风险：

```text
第 7 节如果继续作为事件列表出现，但没有同步扩展，
读者无法从单一位置获取完整事件目录。
```

决策：

```text
第 7 节应升级为唯一权威事件目录。
事件目录按实现阶段分组。
第 17.3 / 18.4 可以保留解释，但不能成为额外散落的事件定义源。
```

修正后的事件目录应为：

```text
Phase 1-A:
  module_proposed
  module_manifest_validated
  module_installed_staging
  module_failed

Phase 1-C/D/E:
  module_permission_checked
  module_verified
  module_activated
  module_deprecated
  state_branch_created
  state_branch_merged
  state_branch_discarded
  module_rollback_started
  module_rollback_succeeded
  module_rollback_failed
  dirty_rollback
  teardown_started
  teardown_succeeded
  teardown_failed
  module_force_clean_requested
  module_force_clean_succeeded
  external_side_effect_abandoned

Phase 2+:
  score_committed
  score_revealed
  telemetry_recorded
```

Phase 1 取舍：

```text
score_committed / score_revealed 不进入 Phase 1-A。
它们属于后续评分系统或进化链阶段。
telemetry_recorded 可先作为预留事件，不要求阶段 A 实现。
```

### 20.6 中等问题 M5：事件路径不统一

涉及计划位置：

```text
第 7 节：memory/evolution_events.jsonl
第 19.10 节：memory/events/evolution.jsonl
```

风险：

```text
两个路径同时出现，实施者不知道应该创建哪个文件。
```

决策：

```text
Phase 1 统一使用：
  memory/evolution_events.jsonl
```

理由：

```text
与现有 memory/skill_lifecycle_events.jsonl 和 memory/domain_pack_events.jsonl 风格一致。
避免第一阶段引入目录迁移。
```

后续可选：

```text
未来可以迁移到 memory/events/ 子目录。
该迁移不进入 Phase 1。
```

### 20.7 中等问题 M6：本地身份私钥存储未定义

涉及计划位置：

```text
第 18.3 节
```

风险：

```text
Local Ephemeral Identity 包含 public_key / private_key。
但如果不定义存储路径、保护方式和丢失策略，
事件签名会成为无法落地的概念。

Ephemeral 一词暗示可随时重新生成。
但用于事件签名后，私钥丢失意味着新旧事件无法在同一身份下验证。
```

Phase 1 身份实现细节：

```text
存储路径：
  ~/.originagent/evolution_identity.json

格式：
  {
    "public_key": "...",
    "private_key": "...",
    "created_at": "...",
    "scheme": "ed25519"
  }

保护方式：
  Phase 1 明文存储，并明确标记为不安全。
  Phase 2+ 再考虑口令加密或 OS keychain。

丢失策略：
  重新初始化会生成新身份。
  旧事件保留旧 actor_public_key。
  文档提示用户备份 evolution_identity.json。

签名算法：
  优先 Ed25519。
```

决策：

```text
Phase 1 不引入链上钱包。
Local Identity 只用于本地事件不可否认性的结构预演。
allow_unsigned_events 可以作为开发模式存在，但默认应提示风险。
```

### 20.8 中等问题 M7：Token pre-flight tokenizer 未指定

涉及计划位置：

```text
第 18.2 节
```

现状：

```text
现有 memory.py 中使用 tiktoken.get_encoding("cl100k_base")。
该方案更接近 OpenAI 模型，不适用于所有 Provider。
Anthropic、Google、DeepSeek、本地模型的 tokenizer 都可能不同。
```

风险：

```text
使用错误 tokenizer 估算 token，可能导致预算偏差。
恶意模块可能利用偏差发起过长请求。
```

Phase 1 决策：

```text
不做 per-provider 精准 tokenizer。
使用保守估算器。
```

建议策略：

```text
estimate_tokens(text):
  ceil(char_count / 3.5)

如果 Provider 提供 token counting API：
  优先使用 Provider 官方计数。

Post-flight:
  Provider 返回后，从 response usage 字段读取真实 token 并记账。
```

预算规则：

```text
累计预算：
  manifest.context_budget.token_budget

单次请求上限：
  manifest.context_budget.token_budget * 0.8

超过 pre-flight 上限：
  调用前拒绝。

超过 post-flight 累计预算：
  冻结模块后续 Provider 调用，并写入事件账本。
```

实现位置：

```text
evolution/capability_gate.py:
  estimate_tokens()
  preflight_check_provider_payload()
  record_postflight_usage()
```

### 20.9 中等问题 M8：base_event_hash 字段位置不明确

涉及计划位置：

```text
第 18.1 节
```

候选位置：

```text
overlay 文件 header
每条 overlay 记录
state_branch_created 事件
```

决策：

```text
base_event_hash 记录在 state_branch_created 事件的 result.base_event_hash 字段。
值为分支创建时 EvolutionLedger 的 terminal event_hash。
```

CAS 校验：

```text
分支合并时读取当前 EvolutionLedger terminal event_hash。
与 branch 的 base_event_hash 比较。
如果不一致，拒绝自动合并并生成 conflict report。
```

补充说明：

```text
后续可以为 overlay 每条记录增加 base_fact_version。
但 Phase 1 先用 branch-level base_event_hash 建立粗粒度 CAS。
```

### 20.10 轻微问题 L4：评分事件缺少评分系统定义

涉及计划位置：

```text
第 7 节
```

问题：

```text
score_committed / score_revealed 已出现在事件列表。
但 Phase 1 不做评分系统。
```

决策：

```text
score_committed / score_revealed 标注为 Phase 2+ 预留。
不进入 Phase 1-A 实现。
```

### 20.11 轻微问题 L5：崩溃后残留 staging 目录

涉及计划位置：

```text
第 9.3 节
第 14 节阶段 B
```

现有模式：

```text
domain_pack_governance.py 的 staging 清理依赖 try/finally。
如果进程崩溃、OOM、kill -9 或断电，临时 staging 目录仍可能残留。
```

风险：

```text
进化模块的 staging 机制也会面临同样问题。
残留 staging 目录可能造成重复安装、误判或磁盘膨胀。
```

建议：

```text
manager.py 启动时扫描 stale staging 目录。
超过 TTL 的 staging 目录写入 module_staging_abandoned 或 module_failed 事件。
清理必须只针对 evolution 管理的 staging 命名空间。
```

Phase 1 取舍：

```text
阶段 B 必须实现 _cleanup_stale_staging()。
阶段 A 只需在事件类型中预留失败状态。
```

### 20.12 轻微问题 L6：events.py 与 bus/events.py 命名混淆

涉及计划位置：

```text
第 5 节
```

现状：

```text
计划新增 OriginAgent/evolution/events.py。
现有 OriginAgent/bus/events.py 已存在。
```

风险：

```text
包路径不同，技术上没有冲突。
但讨论和 import 中可能产生认知混淆。
```

决策：

```text
可以保留 evolution/events.py。
但模块 docstring 必须说明：
  Evolution lifecycle events, not MessageBus events.
  MessageBus events live in OriginAgent/bus/events.py.
```

可选命名：

```text
evolution/event_types.py
evolution/evolution_events.py
```

Phase 1 倾向：

```text
保留 evolution/events.py，减少命名冗长。
通过 docstring 降低混淆。
```

### 20.13 风险 R3：权限决策链过长

涉及文件：

```text
OriginAgent/security/capabilities.py
OriginAgent/agent/tools/registry.py
```

当前权限链：

```text
CapabilitySnapshot
ToolRegistry._assert_capability
domain_tool_permissions
```

加入 evolution 后：

```text
EvolutionManifest.permissions
ModuleCapabilityProfile
CapabilitySnapshot
ToolRegistry._assert_capability
domain_tool_permissions
```

风险：

```text
权限链变成五层。
如果某一层返回 False 但原因不透明，调试困难。
用户也无法判断是 manifest 拒绝、runtime profile 拒绝，还是全局 CapabilitySnapshot 拒绝。
```

缓解：

```text
capability_gate.py 拒绝时必须生成结构化 denial_chain。
denial_chain 写入 event.result 或 telemetry 摘要。
```

示例：

```json
{
  "denial_chain": [
    "manifest.read_files=false",
    "module_profile.read_files=false",
    "capability_snapshot.fs_read_roots=[]"
  ]
}
```

### 20.14 埋雷点 B3：Event Hash Chain 缺少启动时完整性校验

涉及计划位置：

```text
第 17.1 节
第 18.5 节
```

风险：

```text
计划定义了 hash chain 的生成。
但如果启动时不校验，外部编辑器改坏一行不会被发现。
直到未来尝试上链才会暴露。
```

决策：

```text
EvolutionLedger 初始化时执行 verify_chain()。
从第一条事件开始重算 event_hash。
断裂时不阻止 OriginAgent 启动。
但必须标记 chain_integrity: broken。
CLI / WebUI / Runtime status 应提示。
```

Phase 1-A 要求：

```text
ledger.py 第一版实现 verify_chain()。
test_ledger.py 覆盖篡改事件后校验失败。
```

### 20.15 埋雷点 B4：CoW overlay 与 Dream 并发运行竞争

涉及文件：

```text
OriginAgent/agent/memory.py
Dream.run
FactStore.apply_fact_proposals_and_rebuild_memory
```

风险：

```text
Dream 后台运行会重写 facts.jsonl 和 MEMORY.md。
如果同时存在 active state branch，Dream 写入只影响主干，不会进入 overlay。
Next 分支模块可能基于过期事实运行。
```

Phase 1 策略：

```text
存在 active branch 时，不要求 Dream 同步写入 overlay。
但 branch merge 必须依赖 base_event_hash / terminal hash 检查发现主干漂移。
如果主干漂移，拒绝自动合并。
```

可选更保守策略：

```text
当存在 active branch 时，Dream 跳过写入或只读运行。
该策略更安全，但可能影响正常记忆整理。
不作为 Phase 1 默认。
```

决策：

```text
Phase 1 使用 CAS 检测主干漂移，不冻结 Dream。
如果后续冲突率高，再考虑 branch 存在时限制 Dream 写入。
```

### 20.16 增加 Bug 点 AB2：Module activation 可能绕过现有状态机

涉及计划位置：

```text
第 12.1 节
第 14 节阶段 E
```

现有能力：

```text
SkillLifecycleStore.transition() 已有严格状态机。
DomainPackGovernanceService 已有 domain pack 治理与激活流程。
```

风险：

```text
如果 EvolutionModuleManager.activate() 直接复制文件并标记 active，
会绕过现有状态机。
SkillsLoader 可能依赖 lifecycle 事件计算 lifecycle_status。
直接操作文件会造成文件状态与生命周期事件不一致。
```

决策：

```text
EvolutionModuleManager.activate() 必须委托现有状态机。
```

规则：

```text
module_type == "skill":
  调用 SkillLifecycleStore.transition(action="activate")。
  不直接绕过 skill lifecycle。

module_type == "domain_pack":
  委托 DomainPackGovernanceService.set_active() 或对应激活方法。
  不直接复制并伪造 active。

module_type == "workflow":
  复用现有 workflow artifact 校验和写入路径。

module_type == "tool":
  优先通过 domain_pack 或 entry_point 机制接入。
```

Phase 1-A 影响：

```text
events.py / ledger.py 需要能记录 delegated_to 字段。
manager.py 后续实现时必须走委托路径。
```

### 20.17 假设点

第二轮未发现新增未验证假设。

第 19.18 / 19.19 已处理：

```text
H1:
  tool 模组不假设任意路径热加载。

H2:
  chief_of_staff 模式后续可复用 cron，但不进入 Phase 1-A。
```

### 20.18 Section 7 修正要求

第 7 节必须修改为分阶段事件目录。

建议目录：

```text
Phase 1-A:
  module_proposed
  module_manifest_validated
  module_installed_staging
  module_failed

Phase 1-D/E:
  module_permission_checked
  module_verified
  module_activated
  module_deprecated
  state_branch_created
  state_branch_merged
  state_branch_discarded
  module_rollback_started
  module_rollback_succeeded
  module_rollback_failed
  dirty_rollback
  teardown_started
  teardown_succeeded
  teardown_failed
  module_force_clean_requested
  module_force_clean_succeeded
  external_side_effect_abandoned

Phase 2+:
  score_committed
  score_revealed
  telemetry_recorded
```

### 20.19 Section 18.3 修正要求

第 18.3 节必须补充：

```text
Phase 1 身份实现细节：
  存储路径: ~/.originagent/evolution_identity.json
  格式: {"public_key": "...", "private_key": "...", "created_at": "...", "scheme": "ed25519"}
  保护: Phase 1 明文存储，并标记不安全；Phase 2+ 加口令加密或 OS keychain。
  丢失: 重新初始化生成新身份；旧事件保留旧 public_key；提示用户备份。
  签名算法: Ed25519。
```

### 20.20 Section 18.2 修正要求

第 18.2 节必须补充：

```text
Token pre-flight 估算：
  Phase 1 不使用 per-provider tokenizer。
  使用保守估算器 ceil(char_count / 3.5)。
  Provider 返回后使用真实 token count 记账。
  累计预算来自 manifest.context_budget.token_budget。
  单次请求上限默认为 manifest.context_budget.token_budget * 0.8。
```

### 20.21 Section 18.1 修正要求

第 18.1 节必须补充：

```text
base_event_hash 定义：
  记录在 state_branch_created 事件的 result.base_event_hash 字段。
  值是分支创建时 evolution ledger 的当前 terminal event_hash。
  CAS 校验时比较当前 terminal event_hash 与 branch 的 base_event_hash。
  不一致则拒绝合并并生成 conflict report。
```

### 20.22 命名清理

| 当前 | 决策 | 原因 |
|---|---|---|
| `evolution/sandbox.py` | 使用 `evolution/capability_gate.py` | 避免与 `agent/tools/sandbox.py` 混淆 |
| `memory/evolution_events.jsonl` | 保持 | 与现有 `memory/skill_lifecycle_events.jsonl` 风格统一 |
| `score_committed` / `score_revealed` | 移出 Phase 1-A 实现 | Phase 1 不做评分系统 |

### 20.23 执行后预期结果

按第二轮修正执行后，Phase 1 完成时系统应达到：

```text
1. OriginAgent/evolution/ 包含核心模块，公共 API 通过 __init__.py 导出。
2. EvolutionLedger 写入 memory/evolution_events.jsonl。
3. EvolutionLedger 使用 append-only、canonical JSON、hash chain。
4. EvolutionLedger 启动时校验完整性。
5. EvolutionLedger 支持未来跨 segment 串联。
6. EvolutionEvent 包含 schema_version、event_hash、signature、source_event_stream。
7. EvolutionModuleManager.activate() 对 skill 委托 SkillLifecycleStore.transition()。
8. EvolutionModuleManager.activate() 对 domain_pack 委托 DomainPackGovernanceService。
9. CapabilityGate 的拒绝结果包含 denial_chain。
10. StateBranch 在 state_branch_created 中记录 result.base_event_hash。
11. StateBranch 合并时执行 CAS 校验。
12. Telemetry 使用白名单字段与保守擦除，不直接序列化裸 Exception。
13. config/schema.py 预留 EvolutionConfig 接口。
14. 现有 SkillsLoader、DomainPackManager、ToolRegistry、FactStore、Dream 不被破坏。
```

### 20.24 最终评估

| 维度 | 评估 |
|---|---|
| 逻辑自洽 | 通过。新增第 18-19 节补齐了上一轮缺口 |
| 解决目标问题 | 通过。仍保持窄范围、先本地、强边界、少侵入、可测试、可回滚、可审计 |
| 不破坏现有功能 | 通过。新增模块应通过桥接和委托与现有系统协作 |
| 旧问题解决 | 全部解决。C1/C2/M1-M4/L1-L3/R1-R2/B1-B2/AB1/H1-H2 均有明确决策 |
| 新增问题 | C3/C4、M5-M8、L4-L6、R3、B3-B4、AB2 |
| 标注问题替代解决问题 | 未发现。每个条目都给出了具体决策和取舍 |

第二轮指出的编码前阻断项，以及当前处理状态：

```text
C3:
  事件类型字段统一，定义 normalize_event_type() 和 source_event_stream。
  状态：已同步到第 7 节。

C4:
  合并第 7 节事件目录，让其成为唯一权威事件目录。
  状态：已同步到第 7 节。

M5:
  统一 Phase 1 账本路径为 memory/evolution_events.jsonl。
  状态：已同步到第 7 节和第 14 节。

M6:
  定义本地身份私钥存储、保护方式和丢失策略。
  状态：已同步到第 18.3 节。

AB2:
  明确 activate() 必须委托现有 SkillLifecycleStore / DomainPackGovernanceService 状态机。
  状态：已同步到第 12 节和第 14 阶段 E。
```

其余问题处理节奏：

```text
M7 / M8:
  进入 capability_gate / state_branch 前必须补齐。

L4 / L5 / L6:
  可在对应阶段实现前处理。

R3 / B3 / B4:
  属于阶段 C/D 的测试和运行时防线。
```

第二轮结论：

```text
计划可以进入 Phase A 实施。
但进入编码前，必须先修正 C3、C4、M5、M6、AB2。
```

## 21. 下一步建议

下一步不应直接接进化链。

当前代码已经完成 Phase 1-A 到 Phase 1-H。下一步应推进：

```text
Phase 2：共享协议、链下证明与 EVM 测试网适配。
```

2026-05-22 更新：

```text
Phase 2 的链侧工作已拆到独立项目 D:\Demo\OpenHome\OriginAgentEvolutionChain。
客户端继续保持离线可用，不把链 SDK 放入 AgentLoop / Provider / tool runtime。
链侧 EC-1 只消费客户端导出的 proof bundle，并记录公开 digest / hash / URI。
```

原因：

```text
1. Phase 1 已完成本地 manifest、staging、verification、state branch、activation、capability gate、telemetry/proof、dirty recovery 和签名账本。
2. 进化链脑暴中明确 Phase 2 应抽出 originagent-evolution-spec / originagent-evolution-sdk，而不是直接把链 SDK 塞进核心运行路径。
3. 本地 proof bundle、artifact_digest、verification_report_digest、telemetry_digest 和 signed event 已具备映射到链下验证节点或测试网合约的基础。
4. 下一步应先定义跨客户端/验证节点/合约共享的数据结构和 proof adapter，再考虑真实交易提交。
```

Phase 2 完成前仍不应要求 OriginAgent 客户端依赖链才能运行。

2026-05-22 白皮书阶段更新：

```text
已在 C:\Users\15216\Documents\baipishu 生成中文融资 Pitch 白皮书主稿：
  OriginAgent_Evolution_Chain_Whitepaper_zh_v0.1.md

白皮书对外统一项目名为 OriginAgent Evolution Chain。
主叙事采用“Agent 能力供应链的信任、验证与激励层”，而不是“先发链”。
客户端 Phase 1 已完成能力作为投资人可信度核心证据：
  manifest / staging / verification / state branch / rollback /
  capability gate / telemetry-proof / dirty rollback / signed ledger。

客户端路线在白皮书中保持明确边界：
  OriginAgent 离线可用。
  链是增强层，不是运行前提。
  客户端不把链 SDK 放进 AgentLoop / Provider / tool runtime。
  客户端自报采用只作为低权重线索，不直接形成高置信或奖励凭证。
```

2026-05-23 EC-6 链侧审计闭环更新：

```text
OriginAgentEvolutionChain 已完成 event indexer + audit bundle。
这增强的是链侧可审计性，不改变客户端运行边界。

客户端后续对接原则不变：
  客户端只导出 proof bundle / evidence artifact。
  链侧 index-events / audit-bundle 复核链上事件与链下 artifact。
  客户端不需要内置链上 indexer，也不依赖 audit-bundle 才能本地 activate / rollback。
```

2026-05-23 EC-7 链侧多节点验证更新：

```text
OriginAgentEvolutionChain 已完成两台远端服务器的多节点独立验证闭环。
coordinator / validator-1 运行在 47.84.130.213。
validator-2 / auditor 运行在 154.40.59.232。

链侧新增能力：
  远端节点标准化脚本。
  双节点远端 npm test / 合约测试。
  validator-2 单节点复现 EC-6 Anvil live audit runner。
  两份独立 validator evidence 提交到同一条 Anvil chain。
  rejected challenge 保留 audit path 且不 invalidates evidence。
  audit-bundle 复核两份 evidence、challenge 和事件链。

客户端边界不变：
  OriginAgent 仍只需要导出 proof bundle / evidence artifact。
  客户端不需要知道 validator-2 的服务器拓扑。
  客户端不需要运行 Anvil、index-events 或 audit-bundle 才能本地 activate / rollback。
  多节点高置信是链侧/验证网络能力，不改变客户端离线可用原则。
```

2026-05-23 EC-8 Agent Passport 原型记录：

```text
OriginAgent Evolution Chain 已实现 Agent Passport 链上身份锚点原型。

对客户端的影响：
  OriginAgent 可在未来为每个长期 Agent 生成或绑定一个 Agent Passport。
  Agent Passport 是公开身份和生命周期锚点，不是记忆加密密钥。
  EC-8 只把 owner、agentKeyHash、genesisHash、metadataHash 和迁移 hash 写入链上。
  agentKeyHash 来自 Agent 首次初始化生成的 Ed25519 公钥哈希。
  genesisNonce / migrationNonce 是公开随机值，不是秘密。
  客户端本地私钥 / recovery key 负责记忆解密和迁移授权。
  原始 memory、facts、prompt、telemetry 不上链。
  后续 EC-9 才考虑 encrypted memory vault root、版本和迁移摘要。

边界不变：
  OriginAgent 离线可用。
  链上身份和 memory vault 是增强能力，不是运行前提。
  EC-8 不要求客户端接入链，不改变本地 activate / rollback / sandbox 机制。
  如果 owner 丢失私钥或 recovery material，加密记忆应不可恢复；后续必须设计恢复 UX。
  客户端不能把 token 余额当成 trust，也不能把 transferable token 当成 reputation。

详细备忘：
  OriginAgentEvolutionChain/docs/ec8-agent-passport-runbook.md。
  OriginAgentEvolutionChain/docs/ec8-agent-passport-validation-result.md。
  OriginAgentEvolutionChain/docs/ec8-agent-passport-memory-economy-note.md。
```

2026-05-23 EC-9 Encrypted Memory Vault 原型记录：

```text
OriginAgentclient 已新增离线加密 memory vault 原型，用于跨机器迁移 Agent 的 allowlisted 记忆文件。

客户端新增能力：
  OriginAgent.evolution.memory_vault。
  originagent evolution-vault export / inspect / verify / import。
  EventType.MEMORY_VAULT_EXPORTED。
  EventType.MEMORY_VAULT_IMPORTED。

EC-9 vault 只导出：
  SOUL.md。
  USER.md。
  memory/MEMORY.md。
  memory/facts.jsonl。
  memory/evolution_events.jsonl。

明确排除：
  history.jsonl。
  sessions。
  provider config。
  API key / token。
  .originagent/evolution_identity.json 私钥。

安全边界：
  AES-256-GCM key-file 不写入 vault。
  key-file 传输由用户通过独立安全通道完成。
  Passport ID 是公开身份锚点，不是加密密钥。
  EC-9 不迁移 Agent Ed25519 私钥。
  restore 后需要重新初始化本地 identity，并可由 owner 钱包记录 EC-8 migration。
  import 默认 dry-run，只有 --apply 才写目标 workspace。
  --replace 只覆盖 vault 中同路径冲突文件，不删除目标 workspace 里的其他文件。

链侧新增能力：
  audit-bundle --memory-vaults。
  memory_vault_linkage。
  只校验公开 digest、隐私扫描和 Passport/migration artifact 关联。
  不解密 vault，不验证明文 payload。

本地验证：
  OriginAgentclient tests/evolution/test_memory_vault.py: 7 passed。
  OriginAgentEvolutionChain npm test: 68 passed。

边界不变：
  OriginAgent 离线可用。
  encrypted memory vault 是迁移增强能力，不是启动前提。
  原始 memory / facts / prompt / telemetry 不上链。
```

## 22. Phase 2+：与 OriginAgent Evolution Chain 的适配路线图

本路线图来自 `originagent_evolution_chain_brainstorm.md` 的核心结论，并适配到当前客户端工程。原则不变：

```text
OriginAgent 不依赖链才能运行。
进化链不存代码、不读用户私有状态、不直接执行第三方模块。
链上只记录治理事实、结算事实和可验证 digest。
完整代码、报告、遥测明细和搜索索引留在链下。
```

### 22.1 客户端本地事实到链侧事实的映射

| OriginAgent 本地事实 | Phase 2+ 映射 | 说明 |
|---|---|---|
| `artifact_digest` | `package_digest` / OCI digest | 代码不进链，优先使用 OCI Artifact Registry，IPFS / object storage 作为镜像或归档 |
| `evolution_manifest.yaml` | manifest schema in `originagent-evolution-spec` | 客户端、验证节点、市场使用同一 schema |
| `evolution_events.jsonl` hash chain | proof bundle / report hash | 链上记录摘要，链下保存完整本地账本片段 |
| `module_proposed` | `ModuleRegistry.submitModule` | 提交 digest、storage_uri、module metadata |
| `module_verified` | `VerificationRegistry.submitReportHash` | 提交验证报告 hash，不提交用户私密日志 |
| `module_activated` / rollback | adoption / rollback evidence | 可作为采用率、回滚率、挑战依据 |
| `module_failed` / dirty rollback | challenge / risk signal | 失败原因只上链摘要或 hash |
| `module_permission_checked` | permission profile hash | 用于市场展示和验证节点复核 |
| state branch merge preview | trial/adoption evidence | 只提交摘要，不泄露 facts 原文 |
| sanitized telemetry | telemetry digest + selected public counters | token、latency、failure class 等可公开字段进入报告 |
| `score_committed` / `score_revealed` | `ScoreCommitReveal` | Phase 2+ 实现盲评，Phase 1 只预留事件类型 |

### 22.2 Phase 2：共享协议、链下证明与 EVM 测试网

目标：

```text
抽出 originagent-evolution-spec / originagent-evolution-sdk。
把 Phase 1 proof bundle 固化为跨客户端、验证节点、链上合约都能解析的格式。
在 Anvil / PVE Private Devnet 跑通最小 EVM 合约闭环，不在早期启动最终 private appchain，不发行真实代币。
```

2026-05-24 修正：

```text
这里的 EVM 测试网是早期路线描述。
当前更保守的网络发布路线是先在 PVE Private Devnet 内验证 Genesis Manifest、Endpoint Manifest、artifact 分发、gateway、indexer 和 work node report。
公共 EVM 测试网应后置到客户端能验证官方网络身份之后。
长期目标不是依赖外部公共 EVM 测试网，而是 OriginAgent 自营 private appchain / 自建底层链网络。
技术栈方向备选 Cosmos EVM 或 EVM appchain。
```

最小合约 / 协议组件：

```text
IdentityRegistry:
  记录开发者、社区评估者、Agent 运营者身份。

ModuleRegistry:
  记录 module_id、module_type、version、package_digest、storage_uri、状态。

VerificationRegistry:
  记录 verification_report_hash / evaluation_claim_hash、capability_profile_hash、telemetry_digest。

ScoreCommitReveal:
  处理盲评分数 commit / reveal，避免早期评分被跟票和操纵。

TestCreditLedger / SimulatedBond:
  只做 Test Credit 或模拟 bond 记账。
  不做真实质押、罚没、提现或可转让资产。
```

客户端改造边界：

```text
新增 export proof bundle / submit proof adapter。
不把链 SDK 放进核心运行路径。
链提交失败不影响本地 activate / rollback。
```

验收：

```text
同一个 artifact_digest 的 proof bundle 可被 SDK 校验。
本地 module_verified 可映射为测试网 verification report hash。
链上不出现 prompt、文件内容、私有路径、facts 原文。
```

### 22.3 Phase 3：社区评估节点、试用节点与链下索引

目标：

```text
把单机 proof 扩展成多节点验证。
建立链下 indexer / marketplace，用链上 digest、链下报告、挑战历史和采用信号组合展示社区质量发现。
先在 Anvil / PVE Private Devnet 上验证，后续迁移到 OriginAgent 自营 private appchain。
不把外部成熟 EVM L2 或公共测试网作为目标网络架构。
```

组件：

```text
Community Validator / Evaluator Node:
  拉取 artifact，复算 digest，运行静态验证和受控试验，提交可挑战 evaluation claim hash。
  该 claim 不是官方质检结论。

Trial Node:
  在授权环境中试用模块，提交 adoption / rollback / failure 摘要。

Indexer / Marketplace:
  聚合 ModuleRegistry、VerificationRegistry、ScoreCommitReveal、adoption evidence。

Artifact Storage:
  以 OCI Artifact Registry 为主，IPFS / object storage 为镜像，Arweave 只归档重要历史版本。
```

验收：

```text
不同验证节点对同一 digest 能给出可比较 report。
市场不依赖单个中心化数据库才能恢复模块状态。
恶意刷下载不能直接等同于有效采用。
```

### 22.4 Phase 4：Test Credit 激励模拟、信誉与挑战机制

目标：

```text
在测试网或 L2 上验证 Test Credit 奖励模拟、身份信誉权重、挑战结果和社区 claim 质量是否能形成正反馈。
不引入真实 token、真实质押、真实 slash、RewardVault 或 StakeVault。
```

组件：

```text
TestCreditLedger:
  记录非转让 Test Credit grant / consume / deny。

GrowthRewardReport:
  记录 epoch reward pool、node weights、Test Credit grants 和 capped / blocked reasons。

ChallengeRecord:
  记录 module、unit kind、evaluation claim 或 adoption signal 的挑战关系和 outcome hash。

Reputation:
  结合身份、历史 claim 准确率、challenge-surviving ratio、采用相关性和 abuse/trust gate。
```

验收：

```text
commit-reveal 能减少评分跟票。
挑战成功能影响模块状态、Test Credit eligibility、reputation 和后续展示权重。
长期稳定运行、低回滚率、真实任务收益比单次高分更重要。
不产生真实 token、staking、slash 或 marketplace settlement。
```

### 22.5 Phase 5：baseline advancement、四代版本与 trait registry

目标：

```text
建立 OriginAgent Baseline Advancement Protocol。
支持 Stable/current、Next/trial、older supported、deprecated 四代并存。
把 capability / trait 接口标准纳入治理，避免模块市场只治理实现、不治理接口。
```

组件：

```text
BaselineRegistry:
  记录 baseline candidate、parent baseline、trial window、adoption threshold、rollback threshold。

Baseline Advancement Notice:
  发布客户端可读的升级公告，不强制客户端升级。

Trait Registry:
  记录能力接口层、兼容性、权限边界和测试集。
```

验收：

```text
客户端可以读取 baseline notice，但用户仍可选择不升级。
新 baseline 必须有足够验证、采用和低回滚证据。
trait/capability 标准变更需要独立治理，不被单个模块作者垄断。
```

### 22.6 Phase 6：自营 private appchain 准备

当前口径：

```text
长期目标是 OriginAgent 自营 private appchain / 自建底层链网络。
技术栈方向备选 Cosmos EVM 或 EVM appchain。
自建 appchain 不等于第一步从零写共识引擎、VM 或 P2P 链底层。
客户端不应关心底层承载是 Anvil、PVE Private Devnet、PVE Private Appchain、公共测试网还是未来正式网络；
客户端只应验证 Genesis Manifest、Endpoint Manifest、chain_id、network_id、contract addresses、code/deployment hash 和签名。
```

可评估方向：

```text
PVE Private Devnet：
  先验证客户端 endpoint discovery、manifest cache、artifact digest 校验和 gateway receipt 展示。

PVE Private Appchain：
  后续使用 Cosmos EVM 或 EVM appchain 候选框架验证 chain id、genesis、validator set、多节点出块、RPC failover 和 indexer recovery。

Public Testnet Or Public Appchain：
  只有网络身份、manifest、多 endpoint、artifact 分发、abuse gate 和节点工作报告稳定后再公开。
  公共测试网是公开演练选项，不是目标网络架构。
```

明确不做：

```text
在 Phase 1 或 Phase 2 启动最终 private appchain。
从零开发共识、VM 或 P2P 链底层。
为了概念完整而提前发真实代币。
把 OriginAgent 客户端运行能力绑定到任意链。
把公共测试网、Test Credit 或 Node ID 当成本地安全保证。
```

## 23. EC-10 Agent Passport Reputation 对客户端的影响

2026-05-23 更新：

```text
OriginAgentEvolutionChain 已新增 EC-10 Agent Passport Reputation Checkpoint。

对客户端的直接影响：
  无需改动 OriginAgent 运行时。
  客户端仍保持离线可用。
  客户端不需要依赖 AgentReputationRegistry 才能启动、恢复、activate、rollback 或导出 proof bundle。

对未来适配的影响：
  客户端可以把本地可公开的 challenge/adoption/trial 摘要导出为 reputation record 的输入材料。
  完整 Passport 级 reputation report 仍由链侧 SDK/audit flow 生成和归档。
  客户端不应自行把 token 余额、owner 地址或单次 checkpoint 当成可信度最终裁决。
  客户端 UI 未来可以展示 Passport reputation，但必须标注来源为链上 checkpoint + 链下 report。

边界：
  EC-10 不迁移 Agent 私钥。
  EC-10 不读取 memory vault 明文。
  EC-10 不把 facts、prompt、history、raw telemetry 或本地路径写入链上 artifacts。
  同 owner 多 Passport 的声誉碎片化不是客户端本地逻辑能解决的问题，后续应交给链侧审核、衰减和反女巫机制。
```

## 24. EC-11 Evolution Unit Kind Registry 对客户端的影响

2026-05-23 更新：

```text
EC-11 方向已从“Test Credit + 模块市场 MVP”前移为“Evolution Unit Kind Registry / 开放式可进化单元协议”。

核心影响：
  OriginAgent 客户端不应把当前 ModuleType、tool plugin 或任何固定枚举当成 Agent 未来能力宇宙。
  客户端仍保持离线可用，不能依赖链上 registry 才能启动、activate、rollback 或恢复。
  链侧 registry 提供的是公开类型定义、验证 profile 和审计锚点，不是客户端运行时的强制中心。

客户端 manifest 的未来方向：
  支持 unit_kind。
  支持 runtime_surface。
  支持 verification_profile。
  支持 risk_class。
  支持 permission_model。
  支持 sandbox_requirement。
  支持 install_semantics。
  支持 rollback_semantics。
  支持 schema_hash / schema_uri。

兼容策略：
  tool / skill / workflow / domain_pack 只是首批样例。
  memory_strategy、planner_policy、reflection_policy、provider_router、multi_agent_protocol 等后续类型不应被迫伪装成 tool。
  客户端可以先把未知 unit_kind 作为不可自动执行、只可审计/展示的对象处理。
  对高风险 kind，客户端默认要求显式用户确认、本地 sandbox 约束和可回滚安装记录。

边界：
  EC-11 不要求客户端接入真实 token、staking、DAO 或公网测试网。
  EC-11 不把任何链上 kind 状态等同于本地安全保证。
  canonical 只表示“协议层推荐/可审计”，不代表用户必须安装。

实施记录：
  OriginAgentEvolutionChain 已完成 EC-11 链侧原型。
  tool@1 已作为首个 canonical kind 跑通 proposal -> review -> on-chain status -> audit-bundle。
  客户端本阶段无需改动，仍保持离线可用。
  后续客户端如适配 Evolution Unit，应优先读取 unit_kind/schema_hash/permission_model/risk_class/sandbox_requirement，而不是继续扩展固定 ModuleType 枚举。
```

## 25. EC-12 Adversarial Simulation 对客户端的影响

2026-05-23 更新：

```text
EC-12 链侧阶段先做攻击模拟和滥用识别，不要求 OriginAgent 客户端改动。

对客户端的直接影响：
  客户端仍保持离线可用。
  客户端不需要依赖 abuse report 才能启动、恢复、activate 或 rollback。
  客户端不应把 abuse signal 当作本地自动封禁或自动卸载依据。

对未来适配的影响：
  客户端未来展示链侧模块、unit kind、Passport 或 reputation 时，应能显示 abuse signal / audit warning。
  对存在 high / critical abuse signal 的 unit 或 Passport，客户端 UI 应默认降权展示、要求人工确认，并保留本地回滚路径。
  客户端导出的公开 artifact 仍必须避免 prompt、facts、raw telemetry、本地路径、URL query、secret-like string。

边界：
  EC-12 不做真实攻击、不扫描公网、不引入 token / staking / DAO。
  EC-12 不会把客户端本地 memory、history、session 或 API key 上传到链侧。
  Abuse report 是审计输入，不是运行时强制策略。
```

## 26. EC-13 Trust Policy 对客户端的影响

2026-05-23 更新：

```text
EC-13 链侧阶段把 abuse signal 翻译成 trust gate，不要求 OriginAgent 客户端改动。

对客户端的直接影响：
  客户端仍保持离线可用。
  客户端不需要依赖 trust policy report 才能启动、恢复、activate 或 rollback。
  客户端不应把 trust gate 当成本地自动卸载、自动封禁或删除记忆的依据。

对未来适配的影响：
  客户端未来展示链侧 Passport、unit kind、module 或 validator 时，可以显示 trust policy 的 gate 摘要。
  high / critical 风险主体应默认降权展示、要求显式用户确认，并保留本地 rollback。
  medium 风险应显示为 manual review，而不是直接当成恶意。
  trust policy report 只能解释公开 artifact 和链上事件，不能成为读取本地 prompt、facts、history、session 或 API key 的理由。

边界：
  EC-13 不新增合约、不引入 token / staking / slash / DAO。
  EC-13 不修改客户端运行时安全模型。
  Trust gate 是审计建议，不是客户端强制策略。
```

## 27. EC-14 Test Credit Sandbox 对客户端的影响

2026-05-23 更新：

```text
EC-14 链侧阶段新增非转让 Test Credit 沙盒账本，不要求 OriginAgent 客户端改动。

对客户端的直接影响：
  客户端仍保持离线可用。
  客户端不需要依赖 TestCreditLedger 才能启动、恢复、activate、rollback 或导出 proof bundle。
  客户端不应把 Test Credit 当成真实余额、真实 token 或自动信任凭证。

对未来适配的影响：
  客户端未来展示链侧模块、Passport 或 marketplace dry-run 状态时，可以显示 Test Credit eligibility / balance 摘要。
  Test Credit 只表示沙盒准入和审计状态，不代表真实经济权益。
  对 blocked / manual_review 主体，客户端 UI 应解释为“链侧沙盒准入受限”，而不是自动删除本地模块或记忆。
  客户端如生成可用于 Test Credit 的 adoption / audit_request artifact，仍必须避免 prompt、facts、raw telemetry、本地路径、URL query、secret-like string。

边界：
  Test Credit 不可转让。
  不支持提现、交易、质押或 slash。
  EC-14 不修改客户端运行时安全模型。
  EC-14 的 trust gate 在 SDK/runner 层执行，不是客户端本地强制策略。
```

## 28. 候选网络 Bootstrap / Work Node Registry 对客户端的影响

2026-05-24 更新：

```text
EC-14 后的链侧能力地图已记录在：
  OriginAgentEvolutionChain/docs/ec14-current-capability-map.md。

下一阶段候选方向从直接 Marketplace Dry Run 调整为：
  Network Bootstrap / Work Node Registry / Growth Reward Simulator。

核心原因：
  进化链已经有 audit、abuse report、trust gate 和 Test Credit sandbox。
  但还没有 genesis/endpoint manifest、endpoint discovery、first-class node_id、节点活动、节点有效贡献和节点增长奖励模拟。
  如果直接做“注册节点随时间拿 token”，会诱导 Sybil、空跑节点、刷上传和 referral farming。
```

对客户端的直接影响：

```text
在四层架构中，OriginAgent 客户端层仍是本地运行层。
客户端仍保持离线可用。
客户端层不依赖 OriginAgent 节点层才能运行。
客户端不需要依赖 node_id、NodeOperatorRegistry 或 GrowthRewardReport 才能启动、恢复、activate、rollback 或导出 proof bundle。
客户端不应把节点奖励、Test Credit 或未来 token 当作本地安全保证。
```

对未来适配的影响：

```text
客户端未来可以展示“通过哪个节点上传 / 索引 / 审计”的公开 attribution。
客户端如果展示节点，应展示贡献摘要、trust gate、abuse warning 和 Test Credit sandbox 状态，而不是只展示注册时间或邀请人数。
客户端可以显示节点 attribution，但不能把节点奖励、Test Credit 或 Node ID 当成本地安全保证。
客户端如生成 adoption、audit_request、routing attribution 等 artifact，仍必须避免 prompt、facts、raw telemetry、本地路径、URL query、secret-like string。
```

节点机制边界：

```text
Node ID 是贡献账户，不是邀请码。
Node ID 不应被客户端表达为可交易资产。
节点奖励不应来自注册本身。
入口节点只应获得有限 routing credit，不应获得永久上传抽成。
EC-15 仍只应使用 Test Credit 模拟，不引入真实 token、staking、slash 或 DAO。
EC-15 不会让客户端自动上传 prompt、facts、memory、API key 或本地日志。
```

## 29. 网络发现、躯体分发和社区验证对客户端的影响

2026-05-24 更新：

```text
链侧新增架构记录：
  OriginAgentEvolutionChain/docs/network-bootstrap-and-community-work-layer.md。

本节讨论整体网络架构，不绑定具体 EC-15 实施。
```

客户端网络发现原则：

```text
客户端不应硬依赖单个 OriginAgent 官方域名或单个服务器 IP。
公开网络清单只是 bootstrap，不是权威入口。

客户端应区分 Genesis Manifest 和 Endpoint Manifest。
Genesis Manifest 锁定 network_id、chain_id、genesis deployment hash 和 root signer set。
Endpoint Manifest 只更新 RPC、indexer、gateway、artifact mirror endpoint。
Endpoint Manifest 不能静默替换网络身份。
公网生产前应从单签名过渡到 m-of-n threshold signing。
客户端应缓存最近有效 manifest。
官方域名不可用时，已接入客户端应继续使用缓存 endpoint。
新客户端应支持手动导入 manifest。
```

客户端未来可支持的 endpoint 类型：

```text
RPC endpoint:
  读链状态和广播签名交易。

Indexer endpoint:
  查询链上事件和公开 artifact 索引。
  客户端不能把 indexer 结果当作最终权威。

Ingress / Gateway endpoint:
  上传公开 artifact envelope，获得 digest / URI / receipt。
  Gateway 不代表官方质检结论。

Artifact Gateway / Mirror:
  下载模块、schema、manifest、review、report。
  客户端必须用 digest 校验内容，不信任下载来源。
```

客户端质量判断边界：

```text
OriginAgent 客户端不承担全网质检职责。
客户端可以做本地安装、沙箱、权限、回滚和用户策略检查，但这些是本地自保，不是协议级质量认证。

客户端可以展示社区 Evaluator / Security / Stress / Challenger / Curator / Adoption Agent 的报告。
这些报告是可挑战 claim，不是最终评分。
```

隐私边界：

```text
网络发现、artifact 下载、社区报告和验证挖矿都不能成为上传本地 prompt、facts、memory、API key、session 或本地日志的理由。
客户端导出的公开 claim / adoption / failure / audit_request 仍只能包含公开 digest、hash、环境摘要和脱敏结果。
```

## 30. EC-15A / EC-15B Challenge Adjudication 对客户端的影响

2026-05-24 更新：

```text
EC-15A 链侧新增 ChallengeAdjudicationRegistry。
它让 challenge 从 owner sandbox resolve 走向 validator committee finalize。
客户端不需要因此改变本地运行、恢复、activate、rollback 或 proof bundle 生成流程。
```

客户端显示边界：

```text
客户端未来可以展示 challenge adjudication 状态：
  submitted。
  finalized_upheld。
  finalized_rejected。
  expired_no_quorum / unresolved。

客户端不能把 EC-15A verdict 当作最终质量保证。
客户端不能把 Test Credit、未来 bond、validator 地址或 Node ID 当成本地安全保证。
```

EC-15B 对客户端的影响：

```text
Commitment State Vault 属于节点 SDK / validator 工具，不属于普通 OriginAgent 客户端安全根。
普通客户端不应保存 validator reveal salt。
普通客户端不应自动参与公开验证挖矿。
普通客户端如展示 unresolved dispute，应默认提示 manual_review，而不是自动安装或自动拒绝。
```

2026-05-24 Phase 2 记录：

```text
EC-15B 合约 commit-reveal 与 SDK artifact / transaction surface 已完成。
客户端侧仍不需要接入 validator vault。
未来客户端只消费链侧/indexer 输出的 finalized_upheld、finalized_rejected、expired_no_quorum/unresolved 状态。
客户端不得把 operatorGroupHash / runnerFingerprintHash 当成本地安全证明；它们只可作为链下 diversity hint 展示。
```

2026-05-24 Phase 3 记录：

```text
EC-15B Commitment State Vault 已在链侧 SDK 实现。
该 vault 只属于 validator / node CLI，负责保存 salt、commitment 和 reveal 参数。
普通 OriginAgent 客户端不保存、不导入、不展示 validator salt。
客户端未来如展示 adjudication 状态，只展示链上/indexer 汇总结果，不读取节点本地 vault。
```

2026-05-24 Phase 4 记录：

```text
EC-15B audit-bundle 和 chain-state-check 已支持 v2 adjudication 状态。
客户端未来可消费 indexer/chain-state 汇总出来的 phase、commit/reveal count、quorum、finalized_upheld、finalized_rejected、expired_no_quorum/unresolved。
客户端不应读取 operatorGroupHash / runnerFingerprintHash 作为安全证明；这些字段只可作为链下 diversity hint 展示。
challenge bond 仍是 Test Credit 链下 artifact，不是客户端真实余额或退款保证。
unresolved dispute 仍应展示为 manual_review，不新增客户端 admission gate。
```

2026-05-24 Phase 5 记录：

```text
EC-15B runner、runbook 和 validation result 已完成。
远端验证确认三条 adjudication 路径均可被链侧 SDK / indexer / audit-bundle 闭环读取：
  finalized_upheld。
  finalized_rejected。
  expired_no_quorum / unresolved。

客户端影响不变：
  普通 OriginAgent 客户端只消费链侧/indexer 汇总状态。
  普通客户端不保存 validator salt。
  普通客户端不导入、不导出、不恢复 Commitment State Vault。
  expired_no_quorum 仍应落为 manual_review 展示，不应自动安装或自动拒绝。
  Test Credit challenge bond 仍不是客户端余额、真实退款或真实罚没。
```

隐私边界：

```text
EC-15B 不允许客户端自动上传 prompt、facts、memory、API key、本地日志或 raw telemetry。
客户端导出的公开 challenge/evidence/adjudication 相关 artifact 仍只能包含 digest、hash、公开地址、公开环境摘要和脱敏结果。
```
