# OriginAgent 进化链 → ChainMaker 联盟链 转型设计

日期：2026-06-18
状态：已批准，待实施

## 1. 转型动因

中国区块链监管政策为"技术鼓励，金融禁止"二元模式。项目需要从"公链 + Token 经济"叙事转型为"联盟链 + 无币可信基础设施"，以符合：

- 《区块链信息服务管理规定》备案要求
- 禁止虚拟货币发行（ICO）和公开交易的政策红线
- 国家对"区块链赋能实体经济"的扶持方向

## 2. 核心原则

- **语义不变，平台迁移，叙事合规**
- 8 个注册表的增删改查逻辑、状态转换、事件模型原样保留
- Solidity/EVM 平台 → ChainMaker Go 原生平台
- TypeScript SDK/CLI → Go SDK/CLI（统一技术栈）
- Token 叙事 → 积分/贡献值叙事
- 公链无准入 → 联盟链授权准入

## 3. 保留与剥离

### 保留（逻辑层不变）

| 层 | 内容 | 说明 |
|----|------|------|
| 协议 | `spec/schemas/*.json` | proof bundle、evidence、module 等所有 JSON Schema |
| 测试数据 | `fixtures/*.json` | 所有 valid/invalid 测试夹具 |
| 状态机 | 8 个注册表的增删改查语义 | 事件定义、状态转换逻辑 |
| 审计 | audit-bundle 交叉验证 | 证据-事件-挑战 三方校验逻辑 |
| 隐私规则 | 脱敏遥测协议 | prompt/facts/私钥不入链 |

### 剥离

| 剥离项 | 替代方案 |
|--------|---------|
| Solidity `onlyOwner` | ChainMaker 多组织共识权限 |
| ERC20/Token/Stake/Slash 代码 | 不存在 → 无需剥离 |
| Token 激励叙事 | 贡献积分 + 商业服务收入 |
| 挖矿/Mining 叙事 | 社区验证工作 / 贡献 |
| DAO 去中心化治理叙事 | 多方治理委员会 |
| 公开无准入公链叙事 | 授权准入联盟链 |

## 4. 合约映射：Solidity → ChainMaker Go

每个 Solidity 合约对应一个 ChainMaker Go 合约，结构：

```go
package main

import (
    "chainmaker.org/chainmaker/contract-sdk-go/v2/sdk"
    protogo "chainmaker.org/chainmaker/pb/protogo"
)

type Contract struct{}

func (c *Contract) InitContract() protogo.Response { ... }
func (c *Contract) UpgradeContract() protogo.Response { ... }
func (c *Contract) InvokeContract(method string) protogo.Response {
    switch method {
    case "operation_a": return c.operationA()
    case "operation_b": return c.operationB()
    default: return sdk.Error("unknown method")
    }
}
```

### 4.1 合约列表

| # | Solidity（归档） | ChainMaker Go（新建） | 方法路由 |
|---|-----------------|----------------------|---------|
| 1 | `IdentityRegistry.sol` | `contracts-go/identity/identity.go` | `register_identity`, `get_identity`, `set_role` |
| 2 | `AgentPassportRegistry.sol` | `contracts-go/passport/passport.go` | `register_passport`, `migrate_key`, `get_passport` |
| 3 | `AgentReputationRegistry.sol` | `contracts-go/reputation/reputation.go` | `checkpoint_reputation`, `get_reputation` |
| 4 | `EvolutionUnitKindRegistry.sol` | `contracts-go/unitkind/unitkind.go` | `propose_kind`, `review_kind`, `set_status`, `get_kind` |
| 5 | `ModuleRegistry.sol` | `contracts-go/module/module.go` | `submit_module`, `get_module`, `require_module` |
| 6 | `VerificationRegistry.sol` | `contracts-go/verification/verification.go` | `submit_evidence`, `submit_challenge`, `invalidate_evidence`, `set_validator_profile`, `resolve_challenge` |
| 7 | `ScoreCommitReveal.sol` | `contracts-go/score/score.go` | `commit_score`, `reveal_score` |
| 8 | `TestCreditLedger.sol` | `contracts-go/credit/credit.go` | `grant_credit`, `consume_credit`, `get_balance` |
| 9 | `ChallengeAdjudicationRegistry.sol` | `contracts-go/adjudication/adjudication.go` | `submit_response`, `commit_verdict`, `reveal_verdict`, `finalize`, `expire`, `set_quorum` |

### 4.2 权限模型变化

Solidity 的 `onlyOwner` 修饰符 → ChainMaker 组织级权限：

```go
// Solidity
modifier onlyOwner() { require(msg.sender == owner); _; }

// ChainMaker Go
func requireOrg(orgIDs ...string) error {
    callerOrg, _ := sdk.Instance.GetSenderOrgId()
    for _, org := range orgIDs {
        if callerOrg == org { return nil }
    }
    return fmt.Errorf("unauthorized org: %s", callerOrg)
}
```

- 不再有单一 owner 地址
- 权限由**组织 ID + 角色**控制
- 管理操作需要基金会组织签名（对标原 `onlyOwner`）
- 日常操作开放给已验证组织

### 4.3 状态存储变化

```go
// Solidity
mapping(bytes32 => Record) private records;
function store(bytes32 key, Record memory record) private { records[key] = record; }

// ChainMaker Go
func (c *Contract) storeRecord(prefix string, key string, value []byte) error {
    compositeKey := prefix + ":" + key
    return sdk.Instance.PutStateFromKey(compositeKey, string(value))
}
func (c *Contract) getRecord(prefix string, key string) ([]byte, error) {
    compositeKey := prefix + ":" + key
    return sdk.Instance.GetStateFromKey(compositeKey)
}
```

Key 前缀约定：

| 前缀 | 对应存储 |
|------|---------|
| `IDENTITY:<address>` | 身份注册信息 |
| `PASSPORT:<passportId>` | Agent 护照 |
| `REPUTATION:<passportId>` | 护照信誉 |
| `MODULE:<moduleDigest>` | 模块注册 |
| `EVIDENCE:<evidenceId>` | 证据记录 |
| `CHALLENGE:<challengeId>` | 挑战记录 |
| `SCORE_COMMIT:<moduleDigest>` | 评分承诺 |
| `SCORE_REVEAL:<moduleDigest>` | 评分揭示 |
| `CREDIT:<passportId>` | 积分余额 |
| `UNITKIND:<kindId>:<version>` | 单元种类 |
| `ADJUDICATION:<challengeId>` | 裁决状态 |
| `VALIDATOR:<address>` | 验证者档案 |
| `COMMITMENT:<challengeId>:<validator>` | 裁决承诺 |

### 4.4 事件模型变化

Solidity `emit Event(...)` → ChainMaker `sdk.Instance.EmitEvent(topic, data)`：

```go
// Solidity
emit ModuleSubmitted(moduleDigest, moduleIdHash, moduleType, versionHash, storageUri, msg.sender);

// ChainMaker Go
sdk.Instance.EmitEvent("ModuleSubmitted", []string{
    moduleDigest,
    moduleIdHash,
    fmt.Sprintf("%d", moduleType),
    versionHash,
    storageUri,
    submitter,
})
```

所有事件 topic 名称保持不变，确保审计逻辑可迁移。

## 5. SDK/CLI 迁移：TypeScript → Go

### 5.1 模块映射

| TypeScript 文件 | Go 文件 | 功能 |
|----------------|---------|------|
| `sdk/src/canonical.ts` | `sdk-go/pkg/canonical/canonical.go` | JSON 规范化 + SHA-256 哈希 |
| `sdk/src/artifact.ts` | `sdk-go/pkg/artifact/builder.go` | 工件创建工厂 |
| `sdk/src/score.ts` | `sdk-go/pkg/score/commit_reveal.go` | 评分 Commit-Reveal |
| `sdk/src/cli.ts` | `sdk-go/cmd/eccli/main.go` | CLI 入口 |
| 各验证函数 | `sdk-go/pkg/validate/*.go` | proof/evidence/challenge 校验 |
| 审计包逻辑 | `sdk-go/pkg/audit/bundle.go` | 事件-证据-挑战交叉验证 |
| 链状态读取 | `sdk-go/pkg/state/check.go` | 链上状态查询 |
| 部署信息 | `sdk-go/pkg/deploy/info.go` | 合约地址/网络配置 |

### 5.2 CLI 命令兼容

所有 CLI 子命令名称保持不变：

```
eccli verify-proof <file>
eccli submit-module --proof-bundle <file> --storage-uri <uri>
eccli submit-evidence --report <file>
eccli submit-challenge --evidence-id <id> --reason-hash <hash>
eccli chain-state-check --module-digest <hash> ...
eccli index-events --from-block 0 --to-block latest
eccli audit-bundle --events <file> --evidence-reports <file> ...
eccli grant-credit --action <file>
eccli consume-credit --action <file>
eccli register-passport --owner <addr> --agent-key-hash <hash> ...
eccli create-module-manifest ...
eccli commit-verdict --challenge-id <id> ...
eccli reveal-verdict --challenge-id <id> ...
eccli finalize-adjudication --report <file>
```

### 5.3 技术依赖

```
// contracts-go/go.mod
chainmaker.org/chainmaker/contract-sdk-go/v2 v2.3.8

// sdk-go/go.mod
chainmaker.org/chainmaker/sdk-go v2.3.8
chainmaker.org/chainmaker/pb/protogo v2.3.8
github.com/spf13/cobra v1.8.0
```

## 6. TestCredit → 贡献积分 合规重命名

`TestCreditLedger` 天生合规（非 ERC20，无 transfer/approve/交易），仅叙事调整：

| 原 | 新 |
|----|-----|
| `TestCredit` | `ContributionPoints`（贡献积分） |
| `grantCredit` | `grantPoints` |
| `consumeCredit` | `consumePoints` |
| 合约名 `TestCreditLedger` | `CreditLedger` |
| Test Credit 余额 | 贡献积分余额 |

**合规红线（永不开放）**：
- `transfer` / `approve` / `allowance` 接口
- 积分与法币双向兑换
- 积分在公开市场交易
- 将积分宣传为"代币"或"数字货币"

## 7. 文档叙事替换规则

| 原术语 | 替换为 |
|--------|--------|
| Token / 代币 / 通证 | 积分 / 贡献值 |
| 公链 / 公有链 / Public Chain | 联盟链 / Consortium Chain |
| 挖矿 / Mining | 贡献 / 验证工作 |
| Stake / 质押 | 担保 / 承诺 |
| Slash / 罚没 | 信用扣除 / 资格暂停 |
| 去中心化自治 DAO | 多方治理委员会 |
| 无准入 / Permissionless | 授权准入 / Permissioned |
| Mainnet | 生产网络 |
| RewardVault / StakeVault | 贡献池 / 信用池 |
| Crypto Economy | 贡献经济 / 激励体系 |
| testnet-only / 测试网 | sandbox / 实验网络 |

## 8. 目录结构变化

```
OriginAgentEvolutionChain/
├── contracts/              # 归档 → archives/evm-reference/contracts/
├── sdk/                    # 归档 → archives/ts-sdk-reference/sdk/
├── contracts-go/           # 新建：ChainMaker Go 合约
│   ├── identity/
│   ├── passport/
│   ├── reputation/
│   ├── unitkind/
│   ├── module/
│   ├── verification/
│   ├── score/
│   ├── credit/
│   ├── adjudication/
│   └── go.mod
├── sdk-go/                 # 新建：Go SDK + CLI
│   ├── cmd/eccli/
│   ├── pkg/canonical/
│   ├── pkg/artifact/
│   ├── pkg/score/
│   ├── pkg/audit/
│   ├── pkg/validate/
│   ├── pkg/state/
│   ├── pkg/deploy/
│   └── go.mod
├── spec/                   # 不变
├── fixtures/               # 不变
├── docs/                   # 更新叙事
├── scripts/                # 更新脚本（Bash → Go test + cmc）
└── deployments/            → deployments-go/   ChainMaker 网络配置
```

## 9. 分阶段实施计划

### Phase 1：核心合约迁移（EC-17A）
- 迁移 5 个核心合约：Identity + Module + Verification + Score + Credit
- 合约 Go 测试覆盖
- 本地 ChainMaker 开发网络搭建

### Phase 2：扩展合约 + SDK 基础（EC-17B）
- 迁移 4 个扩展合约：Passport + Reputation + UnitKind + Adjudication
- SDK Go 核心包：canonical + artifact + validate
- CLI 基础命令可用

### Phase 3：CLI 全量 + 审计（EC-17C）
- CLI 所有命令迁移
- audit-bundle 迁移
- chain-state-check 迁移
- 端到端集成测试

### Phase 4：文档合规 + 归档（EC-17D）
- 52 个 .md 文件叙事替换
- Solidity 合约归档到 `archives/`
- TypeScript SDK 归档到 `archives/`
- 区块链信息服务备案准备

## 10. 非目标

- 不改变 8 个注册表的业务逻辑语义
- 不改变 JSON Schema 协议格式
- 不删除现有 Solidity 合约（归档保留）
- 不在本阶段实现新功能（EC-16B/C/D、EC-17 新能力等）
- 不引入真实经济激励或代币发行
- 不开放公开无准入网络
