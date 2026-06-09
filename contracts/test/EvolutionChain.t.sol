// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {AgentPassportRegistry} from "../src/AgentPassportRegistry.sol";
import {AgentReputationRegistry} from "../src/AgentReputationRegistry.sol";
import {ChallengeAdjudicationRegistry} from "../src/ChallengeAdjudicationRegistry.sol";
import {EvolutionUnitKindRegistry} from "../src/EvolutionUnitKindRegistry.sol";
import {ModuleRegistry} from "../src/ModuleRegistry.sol";
import {ScoreCommitReveal} from "../src/ScoreCommitReveal.sol";
import {TestCreditLedger} from "../src/TestCreditLedger.sol";
import {VerificationRegistry} from "../src/VerificationRegistry.sol";

interface Vm {
    function warp(uint256 timestamp) external;
}

contract EvolutionChainTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    IdentityRegistry private identityRegistry;
    AgentPassportRegistry private agentPassportRegistry;
    AgentReputationRegistry private agentReputationRegistry;
    EvolutionUnitKindRegistry private evolutionUnitKindRegistry;
    ModuleRegistry private moduleRegistry;
    VerificationRegistry private verificationRegistry;
    ScoreCommitReveal private scoreCommitReveal;
    TestCreditLedger private testCreditLedger;
    ChallengeAdjudicationRegistry private challengeAdjudicationRegistry;

    bytes32 private constant MODULE_DIGEST = bytes32(uint256(0x1111));
    bytes32 private constant MODULE_ID_HASH = bytes32(uint256(0x2222));
    bytes32 private constant VERSION_HASH = bytes32(uint256(0x3333));
    bytes32 private constant METADATA_HASH = bytes32(uint256(0x4444));
    bytes32 private constant PROOF_BUNDLE_HASH = bytes32(uint256(0x5555));
    bytes32 private constant REPORT_HASH = bytes32(uint256(0x6666));
    bytes32 private constant REPUTATION_REPORT_HASH = bytes32(uint256(0x6667));
    bytes32 private constant CAPABILITY_HASH = bytes32(uint256(0x7777));
    bytes32 private constant TELEMETRY_HASH = bytes32(uint256(0x8888));
    bytes32 private constant REASON_HASH = bytes32(uint256(0x9999));
    bytes32 private constant RESOLUTION_HASH = bytes32(uint256(0x999a));
    bytes32 private constant SALT = bytes32(uint256(0xaaaa));
    bytes32 private constant OPERATOR_GROUP_HASH = bytes32(uint256(0xbbbb));
    bytes32 private constant RUNNER_FINGERPRINT_HASH = bytes32(uint256(0xcccc));
    bytes32 private constant AGENT_KEY_HASH = bytes32(uint256(0xdddd));
    bytes32 private constant NEXT_AGENT_KEY_HASH = bytes32(uint256(0xeeee));
    bytes32 private constant GENESIS_NONCE = bytes32(uint256(0xabcd));
    bytes32 private constant MIGRATION_NONCE = bytes32(uint256(0xabce));
    bytes32 private constant UNIT_KIND_ID_HASH = bytes32(uint256(0xaaa1));
    bytes32 private constant UNIT_KIND_VERSION_HASH = bytes32(uint256(0xaaa2));
    bytes32 private constant UNIT_KIND_SCHEMA_HASH = bytes32(uint256(0xaaa3));
    bytes32 private constant UNIT_KIND_PROPOSAL_HASH = bytes32(uint256(0xaaa4));
    bytes32 private constant UNIT_KIND_REVIEW_HASH = bytes32(uint256(0xaaa5));
    bytes32 private constant TEST_CREDIT_ACTION_HASH = bytes32(uint256(0xaaa6));
    bytes32 private constant TEST_CREDIT_ACTION_HASH_2 = bytes32(uint256(0xaaa7));
    bytes32 private constant TRUST_POLICY_REPORT_HASH = bytes32(uint256(0xaaa8));
    bytes32 private constant RESPONSE_HASH = bytes32(uint256(0xaaa9));
    bytes32 private constant VERDICT_HASH_1 = bytes32(uint256(0xaa10));
    bytes32 private constant VERDICT_HASH_2 = bytes32(uint256(0xaa11));
    bytes32 private constant VERDICT_HASH_3 = bytes32(uint256(0xaa12));
    bytes32 private constant VERDICT_HASH_4 = bytes32(uint256(0xaa13));
    bytes32 private constant METHOD_HASH_1 = bytes32(uint256(0xaa14));
    bytes32 private constant METHOD_HASH_2 = bytes32(uint256(0xaa15));
    bytes32 private constant METHOD_HASH_3 = bytes32(uint256(0xaa16));
    bytes32 private constant METHOD_HASH_4 = bytes32(uint256(0xaa17));
    bytes32 private constant FINAL_REPORT_HASH = bytes32(uint256(0xaa18));

    function setUp() public {
        identityRegistry = new IdentityRegistry();
        agentPassportRegistry = new AgentPassportRegistry();
        agentReputationRegistry = new AgentReputationRegistry(agentPassportRegistry);
        evolutionUnitKindRegistry = new EvolutionUnitKindRegistry();
        moduleRegistry = new ModuleRegistry();
        verificationRegistry = new VerificationRegistry(moduleRegistry, identityRegistry);
        scoreCommitReveal = new ScoreCommitReveal(moduleRegistry);
        testCreditLedger = new TestCreditLedger(agentPassportRegistry);
        challengeAdjudicationRegistry = new ChallengeAdjudicationRegistry(verificationRegistry);
    }

    function testRegisterIdentity() public {
        identityRegistry.registerIdentity(IdentityRegistry.IdentityRole.Developer, METADATA_HASH);
        assert(identityRegistry.isRegistered(address(this)));
    }

    function testRejectDuplicateIdentity() public {
        identityRegistry.registerIdentity(IdentityRegistry.IdentityRole.Developer, METADATA_HASH);
        try identityRegistry.registerIdentity(IdentityRegistry.IdentityRole.Developer, METADATA_HASH) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testRegisterAgentPassportAllowsEmptyMetadataHash() public {
        bytes32 genesisHash = agentPassportRegistry.computeGenesisHash(
            address(this),
            AGENT_KEY_HASH,
            GENESIS_NONCE,
            bytes32(0)
        );
        bytes32 expectedPassportId = agentPassportRegistry.computePassportId(address(this), AGENT_KEY_HASH, genesisHash);
        bytes32 passportId = agentPassportRegistry.registerAgentPassport(AGENT_KEY_HASH, genesisHash, bytes32(0));
        (
            address owner,
            bytes32 currentAgentKeyHash,
            bytes32 storedGenesisHash,
            bytes32 metadataHash,
            ,
            uint32 migrationCount,
            bool exists
        ) = agentPassportRegistry.passports(passportId);

        assert(passportId == expectedPassportId);
        assert(owner == address(this));
        assert(currentAgentKeyHash == AGENT_KEY_HASH);
        assert(storedGenesisHash == genesisHash);
        assert(metadataHash == bytes32(0));
        assert(migrationCount == 0);
        assert(exists);
    }

    function testRejectDuplicateAgentPassport() public {
        bytes32 genesisHash = agentPassportRegistry.computeGenesisHash(
            address(this),
            AGENT_KEY_HASH,
            GENESIS_NONCE,
            METADATA_HASH
        );
        agentPassportRegistry.registerAgentPassport(AGENT_KEY_HASH, genesisHash, METADATA_HASH);
        try agentPassportRegistry.registerAgentPassport(AGENT_KEY_HASH, genesisHash, METADATA_HASH) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testRejectInvalidAgentPassportInputs() public {
        bytes32 genesisHash = agentPassportRegistry.computeGenesisHash(
            address(this),
            AGENT_KEY_HASH,
            GENESIS_NONCE,
            METADATA_HASH
        );
        try agentPassportRegistry.registerAgentPassport(bytes32(0), genesisHash, METADATA_HASH) {
            assert(false);
        } catch {
            assert(true);
        }
        try agentPassportRegistry.registerAgentPassport(AGENT_KEY_HASH, bytes32(0), METADATA_HASH) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testAgentPassportMigrationUpdatesCurrentKeyAndCount() public {
        bytes32 genesisHash = agentPassportRegistry.computeGenesisHash(
            address(this),
            AGENT_KEY_HASH,
            GENESIS_NONCE,
            METADATA_HASH
        );
        bytes32 passportId = agentPassportRegistry.registerAgentPassport(AGENT_KEY_HASH, genesisHash, METADATA_HASH);
        bytes32 migrationHash = agentPassportRegistry.computeMigrationHash(
            passportId,
            AGENT_KEY_HASH,
            NEXT_AGENT_KEY_HASH,
            MIGRATION_NONCE
        );
        uint32 migrationIndex = agentPassportRegistry.recordAgentMigration(
            passportId,
            NEXT_AGENT_KEY_HASH,
            migrationHash
        );
        (, bytes32 currentAgentKeyHash,,,, uint32 migrationCount, bool exists) = agentPassportRegistry.passports(passportId);

        assert(migrationIndex == 1);
        assert(currentAgentKeyHash == NEXT_AGENT_KEY_HASH);
        assert(migrationCount == 1);
        assert(exists);
    }

    function testRejectInvalidAgentPassportMigration() public {
        bytes32 genesisHash = agentPassportRegistry.computeGenesisHash(
            address(this),
            AGENT_KEY_HASH,
            GENESIS_NONCE,
            METADATA_HASH
        );
        bytes32 passportId = agentPassportRegistry.registerAgentPassport(AGENT_KEY_HASH, genesisHash, METADATA_HASH);
        bytes32 migrationHash = agentPassportRegistry.computeMigrationHash(
            passportId,
            AGENT_KEY_HASH,
            NEXT_AGENT_KEY_HASH,
            MIGRATION_NONCE
        );

        try agentPassportRegistry.recordAgentMigration(bytes32(uint256(0xdead)), NEXT_AGENT_KEY_HASH, migrationHash) {
            assert(false);
        } catch {
            assert(true);
        }
        try agentPassportRegistry.recordAgentMigration(passportId, bytes32(0), migrationHash) {
            assert(false);
        } catch {
            assert(true);
        }
        try agentPassportRegistry.recordAgentMigration(passportId, NEXT_AGENT_KEY_HASH, bytes32(0)) {
            assert(false);
        } catch {
            assert(true);
        }
        try agentPassportRegistry.recordAgentMigration(passportId, AGENT_KEY_HASH, migrationHash) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testRejectAgentPassportMigrationFromNonOwner() public {
        bytes32 genesisHash = agentPassportRegistry.computeGenesisHash(
            address(this),
            AGENT_KEY_HASH,
            GENESIS_NONCE,
            METADATA_HASH
        );
        bytes32 passportId = agentPassportRegistry.registerAgentPassport(AGENT_KEY_HASH, genesisHash, METADATA_HASH);
        bytes32 migrationHash = agentPassportRegistry.computeMigrationHash(
            passportId,
            AGENT_KEY_HASH,
            NEXT_AGENT_KEY_HASH,
            MIGRATION_NONCE
        );
        PassportCaller caller = new PassportCaller();
        try caller.recordAgentMigration(agentPassportRegistry, passportId, NEXT_AGENT_KEY_HASH, migrationHash) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testOwnerCanCheckpointAgentReputation() public {
        bytes32 passportId = _registerAgentPassport();

        uint32 checkpointIndex = agentReputationRegistry.checkpointReputation(
            passportId,
            3,
            1,
            1,
            REPUTATION_REPORT_HASH
        );
        (
            int32 score,
            uint32 positiveCount,
            uint32 negativeCount,
            bytes32 reportHash,
            uint32 checkpointCount,
            bool exists
        ) = agentReputationRegistry.reputations(passportId);

        assert(checkpointIndex == 1);
        assert(score == int32(3));
        assert(positiveCount == 1);
        assert(negativeCount == 1);
        assert(reportHash == REPUTATION_REPORT_HASH);
        assert(checkpointCount == 1);
        assert(exists);
    }

    function testRejectAgentReputationCheckpointFromNonOwner() public {
        bytes32 passportId = _registerAgentPassport();
        ReputationCaller caller = new ReputationCaller();

        try caller.checkpointReputation(agentReputationRegistry, passportId, 3, 1, 1, REPUTATION_REPORT_HASH) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testRejectAgentReputationCheckpointForUnknownPassport() public {
        try agentReputationRegistry.checkpointReputation(bytes32(uint256(0xdead)), 3, 1, 1, REPUTATION_REPORT_HASH) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testAgentReputationCheckpointCanBeOverwritten() public {
        bytes32 passportId = _registerAgentPassport();

        agentReputationRegistry.checkpointReputation(passportId, 5, 1, 0, REPUTATION_REPORT_HASH);
        uint32 checkpointIndex = agentReputationRegistry.checkpointReputation(
            passportId,
            3,
            1,
            1,
            bytes32(uint256(0x6668))
        );
        (
            int32 score,
            uint32 positiveCount,
            uint32 negativeCount,
            bytes32 reportHash,
            uint32 checkpointCount,
            bool exists
        ) = agentReputationRegistry.reputations(passportId);

        assert(checkpointIndex == 2);
        assert(score == int32(3));
        assert(positiveCount == 1);
        assert(negativeCount == 1);
        assert(reportHash == bytes32(uint256(0x6668)));
        assert(checkpointCount == 2);
        assert(exists);
    }

    function testProposeEvolutionUnitKind() public {
        bytes32 kindVersionKey = evolutionUnitKindRegistry.proposeKind(
            UNIT_KIND_ID_HASH,
            UNIT_KIND_VERSION_HASH,
            UNIT_KIND_SCHEMA_HASH,
            UNIT_KIND_PROPOSAL_HASH
        );
        (
            bytes32 kindIdHash,
            bytes32 versionHash,
            bytes32 schemaHash,
            bytes32 proposalHash,
            bytes32 reviewReportHash,
            EvolutionUnitKindRegistry.KindStatus status,
            address submitter,
            uint64 registeredAt,
            uint64 updatedAt
        ) = evolutionUnitKindRegistry.kinds(kindVersionKey);

        assert(kindVersionKey == evolutionUnitKindRegistry.kindVersionKey(UNIT_KIND_ID_HASH, UNIT_KIND_VERSION_HASH));
        assert(kindIdHash == UNIT_KIND_ID_HASH);
        assert(versionHash == UNIT_KIND_VERSION_HASH);
        assert(schemaHash == UNIT_KIND_SCHEMA_HASH);
        assert(proposalHash == UNIT_KIND_PROPOSAL_HASH);
        assert(reviewReportHash == bytes32(0));
        assert(status == EvolutionUnitKindRegistry.KindStatus.Draft);
        assert(submitter == address(this));
        assert(registeredAt > 0 || updatedAt >= registeredAt);
        assert(evolutionUnitKindRegistry.kindExists(UNIT_KIND_ID_HASH, UNIT_KIND_VERSION_HASH));
    }

    function testRejectDuplicateEvolutionUnitKind() public {
        evolutionUnitKindRegistry.proposeKind(
            UNIT_KIND_ID_HASH,
            UNIT_KIND_VERSION_HASH,
            UNIT_KIND_SCHEMA_HASH,
            UNIT_KIND_PROPOSAL_HASH
        );
        try evolutionUnitKindRegistry.proposeKind(
            UNIT_KIND_ID_HASH,
            UNIT_KIND_VERSION_HASH,
            UNIT_KIND_SCHEMA_HASH,
            UNIT_KIND_PROPOSAL_HASH
        ) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testRejectInvalidEvolutionUnitKindInputs() public {
        try evolutionUnitKindRegistry.proposeKind(
            bytes32(0),
            UNIT_KIND_VERSION_HASH,
            UNIT_KIND_SCHEMA_HASH,
            UNIT_KIND_PROPOSAL_HASH
        ) {
            assert(false);
        } catch {
            assert(true);
        }
        try evolutionUnitKindRegistry.proposeKind(
            UNIT_KIND_ID_HASH,
            bytes32(0),
            UNIT_KIND_SCHEMA_HASH,
            UNIT_KIND_PROPOSAL_HASH
        ) {
            assert(false);
        } catch {
            assert(true);
        }
        try evolutionUnitKindRegistry.proposeKind(
            UNIT_KIND_ID_HASH,
            UNIT_KIND_VERSION_HASH,
            bytes32(0),
            UNIT_KIND_PROPOSAL_HASH
        ) {
            assert(false);
        } catch {
            assert(true);
        }
        try evolutionUnitKindRegistry.proposeKind(
            UNIT_KIND_ID_HASH,
            UNIT_KIND_VERSION_HASH,
            UNIT_KIND_SCHEMA_HASH,
            bytes32(0)
        ) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testOwnerCanSetEvolutionUnitKindReviewAndStatus() public {
        bytes32 kindVersionKey = evolutionUnitKindRegistry.proposeKind(
            UNIT_KIND_ID_HASH,
            UNIT_KIND_VERSION_HASH,
            UNIT_KIND_SCHEMA_HASH,
            UNIT_KIND_PROPOSAL_HASH
        );

        evolutionUnitKindRegistry.setReviewReport(UNIT_KIND_ID_HASH, UNIT_KIND_VERSION_HASH, UNIT_KIND_REVIEW_HASH);
        evolutionUnitKindRegistry.setKindStatus(
            UNIT_KIND_ID_HASH,
            UNIT_KIND_VERSION_HASH,
            EvolutionUnitKindRegistry.KindStatus.Experimental
        );
        evolutionUnitKindRegistry.setKindStatus(
            UNIT_KIND_ID_HASH,
            UNIT_KIND_VERSION_HASH,
            EvolutionUnitKindRegistry.KindStatus.Candidate
        );
        evolutionUnitKindRegistry.setKindStatus(
            UNIT_KIND_ID_HASH,
            UNIT_KIND_VERSION_HASH,
            EvolutionUnitKindRegistry.KindStatus.Canonical
        );
        evolutionUnitKindRegistry.setKindStatus(
            UNIT_KIND_ID_HASH,
            UNIT_KIND_VERSION_HASH,
            EvolutionUnitKindRegistry.KindStatus.Deprecated
        );
        evolutionUnitKindRegistry.setKindStatus(
            UNIT_KIND_ID_HASH,
            UNIT_KIND_VERSION_HASH,
            EvolutionUnitKindRegistry.KindStatus.Rejected
        );

        (
            ,
            ,
            ,
            ,
            bytes32 reviewReportHash,
            EvolutionUnitKindRegistry.KindStatus status,
            ,
            ,
        ) = evolutionUnitKindRegistry.kinds(kindVersionKey);
        assert(reviewReportHash == UNIT_KIND_REVIEW_HASH);
        assert(status == EvolutionUnitKindRegistry.KindStatus.Rejected);
    }

    function testRejectEvolutionUnitKindUpdatesFromNonOwner() public {
        evolutionUnitKindRegistry.proposeKind(
            UNIT_KIND_ID_HASH,
            UNIT_KIND_VERSION_HASH,
            UNIT_KIND_SCHEMA_HASH,
            UNIT_KIND_PROPOSAL_HASH
        );
        UnitKindCaller caller = new UnitKindCaller();

        try caller.setReviewReport(
            evolutionUnitKindRegistry,
            UNIT_KIND_ID_HASH,
            UNIT_KIND_VERSION_HASH,
            UNIT_KIND_REVIEW_HASH
        ) {
            assert(false);
        } catch {
            assert(true);
        }
        try caller.setKindStatus(
            evolutionUnitKindRegistry,
            UNIT_KIND_ID_HASH,
            UNIT_KIND_VERSION_HASH,
            EvolutionUnitKindRegistry.KindStatus.Canonical
        ) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testRejectEvolutionUnitKindUpdatesForUnknownKind() public {
        try evolutionUnitKindRegistry.setReviewReport(
            UNIT_KIND_ID_HASH,
            UNIT_KIND_VERSION_HASH,
            UNIT_KIND_REVIEW_HASH
        ) {
            assert(false);
        } catch {
            assert(true);
        }
        try evolutionUnitKindRegistry.setKindStatus(
            UNIT_KIND_ID_HASH,
            UNIT_KIND_VERSION_HASH,
            EvolutionUnitKindRegistry.KindStatus.Canonical
        ) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testRejectEvolutionUnitKindNoneStatus() public {
        evolutionUnitKindRegistry.proposeKind(
            UNIT_KIND_ID_HASH,
            UNIT_KIND_VERSION_HASH,
            UNIT_KIND_SCHEMA_HASH,
            UNIT_KIND_PROPOSAL_HASH
        );
        try evolutionUnitKindRegistry.setKindStatus(
            UNIT_KIND_ID_HASH,
            UNIT_KIND_VERSION_HASH,
            EvolutionUnitKindRegistry.KindStatus.None
        ) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testOwnerCanGrantAndConsumeTestCredit() public {
        bytes32 passportId = _registerAgentPassport();

        uint32 grantIndex = testCreditLedger.grantCredit(
            passportId,
            100,
            TEST_CREDIT_ACTION_HASH,
            TRUST_POLICY_REPORT_HASH
        );
        uint32 consumeIndex = testCreditLedger.consumeCredit(
            passportId,
            5,
            TEST_CREDIT_ACTION_HASH_2,
            TRUST_POLICY_REPORT_HASH
        );
        (uint64 granted, uint64 consumed, uint64 balance, uint32 operationCount, bool exists) =
            testCreditLedger.credits(passportId);

        assert(grantIndex == 1);
        assert(consumeIndex == 2);
        assert(granted == 100);
        assert(consumed == 5);
        assert(balance == 95);
        assert(operationCount == 2);
        assert(exists);
    }

    function testRejectTestCreditFromNonOwner() public {
        bytes32 passportId = _registerAgentPassport();
        testCreditLedger.grantCredit(passportId, 100, TEST_CREDIT_ACTION_HASH, TRUST_POLICY_REPORT_HASH);
        TestCreditCaller caller = new TestCreditCaller();

        try caller.grantCredit(testCreditLedger, passportId, 1, TEST_CREDIT_ACTION_HASH_2, TRUST_POLICY_REPORT_HASH) {
            assert(false);
        } catch {
            assert(true);
        }
        try caller.consumeCredit(testCreditLedger, passportId, 1, TEST_CREDIT_ACTION_HASH_2, TRUST_POLICY_REPORT_HASH) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testRejectTestCreditForUnknownPassport() public {
        try testCreditLedger.grantCredit(
            bytes32(uint256(0xdead)),
            100,
            TEST_CREDIT_ACTION_HASH,
            TRUST_POLICY_REPORT_HASH
        ) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testRejectInvalidTestCreditInputs() public {
        bytes32 passportId = _registerAgentPassport();

        try testCreditLedger.grantCredit(passportId, 0, TEST_CREDIT_ACTION_HASH, TRUST_POLICY_REPORT_HASH) {
            assert(false);
        } catch {
            assert(true);
        }
        try testCreditLedger.grantCredit(passportId, 100, bytes32(0), TRUST_POLICY_REPORT_HASH) {
            assert(false);
        } catch {
            assert(true);
        }
        try testCreditLedger.grantCredit(passportId, 100, TEST_CREDIT_ACTION_HASH, bytes32(0)) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testRejectTestCreditOverConsume() public {
        bytes32 passportId = _registerAgentPassport();
        testCreditLedger.grantCredit(passportId, 5, TEST_CREDIT_ACTION_HASH, TRUST_POLICY_REPORT_HASH);

        try testCreditLedger.consumeCredit(passportId, 6, TEST_CREDIT_ACTION_HASH_2, TRUST_POLICY_REPORT_HASH) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testTestCreditActionHashDedupIsShared() public {
        bytes32 passportId = _registerAgentPassport();
        testCreditLedger.grantCredit(passportId, 100, TEST_CREDIT_ACTION_HASH, TRUST_POLICY_REPORT_HASH);

        try testCreditLedger.consumeCredit(passportId, 5, TEST_CREDIT_ACTION_HASH, TRUST_POLICY_REPORT_HASH) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testTestCreditLedgerHasNoTokenInterface() public {
        (bool transferOk,) = address(testCreditLedger).call(abi.encodeWithSignature("transfer(address,uint256)", address(this), 1));
        (bool approveOk,) = address(testCreditLedger).call(abi.encodeWithSignature("approve(address,uint256)", address(this), 1));
        (bool allowanceOk,) = address(testCreditLedger).call(
            abi.encodeWithSignature("allowance(address,address)", address(this), address(this))
        );

        assert(!transferOk);
        assert(!approveOk);
        assert(!allowanceOk);
    }

    function testSubmitModuleAndVerificationReport() public {
        _submitModule();
        verificationRegistry.submitReport(
            MODULE_DIGEST,
            PROOF_BUNDLE_HASH,
            REPORT_HASH,
            CAPABILITY_HASH,
            TELEMETRY_HASH
        );
        assert(moduleRegistry.moduleExists(MODULE_DIGEST));
        assert(verificationRegistry.moduleEvidenceCount(MODULE_DIGEST) == 1);
    }

    function testRejectVerificationForUnknownModule() public {
        try verificationRegistry.submitReport(
            MODULE_DIGEST,
            PROOF_BUNDLE_HASH,
            REPORT_HASH,
            CAPABILITY_HASH,
            TELEMETRY_HASH
        ) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testQualifiedValidatorEvidenceUsesAllowlistProfile() public {
        _submitModule();
        identityRegistry.registerIdentity(IdentityRegistry.IdentityRole.Validator, METADATA_HASH);
        verificationRegistry.setValidatorProfile(address(this), OPERATOR_GROUP_HASH, RUNNER_FINGERPRINT_HASH, true);

        bytes32 evidenceId = verificationRegistry.submitEvidence(
            MODULE_DIGEST,
            PROOF_BUNDLE_HASH,
            REPORT_HASH,
            VerificationRegistry.EvidenceType.ValidatorReport,
            bytes32(0),
            bytes32(0),
            100
        );

        assert(verificationRegistry.evidenceTypeOf(evidenceId) == VerificationRegistry.EvidenceType.ValidatorReport);
        assert(verificationRegistry.moduleEvidenceCount(MODULE_DIGEST) == 1);
    }

    function testUnqualifiedValidatorEvidenceIsExplicitlyDowngraded() public {
        _submitModule();
        bytes32 evidenceId = verificationRegistry.submitEvidence(
            MODULE_DIGEST,
            PROOF_BUNDLE_HASH,
            REPORT_HASH,
            VerificationRegistry.EvidenceType.ValidatorReport,
            OPERATOR_GROUP_HASH,
            RUNNER_FINGERPRINT_HASH,
            100
        );

        assert(verificationRegistry.evidenceTypeOf(evidenceId) == VerificationRegistry.EvidenceType.UnqualifiedValidatorReport);
    }

    function testOnlyOwnerCanSubmitFoundationSeedReport() public {
        _submitModule();
        EvidenceCaller caller = new EvidenceCaller();
        try caller.submitEvidence(
            verificationRegistry,
            MODULE_DIGEST,
            PROOF_BUNDLE_HASH,
            REPORT_HASH,
            VerificationRegistry.EvidenceType.FoundationSeedReport,
            OPERATOR_GROUP_HASH,
            RUNNER_FINGERPRINT_HASH,
            100
        ) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testInvalidateEvidenceMarksStatus() public {
        _submitModule();
        bytes32 evidenceId = verificationRegistry.submitEvidence(
            MODULE_DIGEST,
            PROOF_BUNDLE_HASH,
            REPORT_HASH,
            VerificationRegistry.EvidenceType.LocalClientReport,
            bytes32(0),
            bytes32(0),
            100
        );

        verificationRegistry.invalidateEvidence(evidenceId, REASON_HASH);
        assert(verificationRegistry.evidenceStatus(evidenceId) == VerificationRegistry.ReportStatus.Invalidated);
    }

    function testRejectChallengeForUnknownEvidence() public {
        EvidenceCaller caller = new EvidenceCaller();
        try caller.submitChallenge(verificationRegistry, bytes32(uint256(0xdead)), REASON_HASH) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testRejectChallengeForInvalidatedEvidence() public {
        _submitModule();
        bytes32 evidenceId = _submitLocalEvidence(REPORT_HASH);
        verificationRegistry.invalidateEvidence(evidenceId, REASON_HASH);

        EvidenceCaller caller = new EvidenceCaller();
        try caller.submitChallenge(verificationRegistry, evidenceId, REASON_HASH) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testRejectChallengeAfterChallengeWindow() public {
        _submitModule();
        bytes32 evidenceId = verificationRegistry.submitEvidence(
            MODULE_DIGEST,
            PROOF_BUNDLE_HASH,
            REPORT_HASH,
            VerificationRegistry.EvidenceType.LocalClientReport,
            bytes32(0),
            bytes32(0),
            uint64(block.timestamp + 10)
        );

        vm.warp(block.timestamp + 11);

        try verificationRegistry.submitChallenge(evidenceId, REASON_HASH) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testZeroChallengeWindowRemainsChallengeableForLegacyEvidence() public {
        _submitModule();
        bytes32 evidenceId = verificationRegistry.submitEvidence(
            MODULE_DIGEST,
            PROOF_BUNDLE_HASH,
            REPORT_HASH,
            VerificationRegistry.EvidenceType.LocalClientReport,
            bytes32(0),
            bytes32(0),
            0
        );

        verificationRegistry.submitChallenge(evidenceId, REASON_HASH);
    }

    function testRejectEmptyChallengeHashes() public {
        _submitModule();
        bytes32 evidenceId = _submitLocalEvidence(REPORT_HASH);

        try verificationRegistry.submitChallenge(evidenceId, bytes32(0)) {
            assert(false);
        } catch {
            assert(true);
        }

        bytes32 challengeId = verificationRegistry.submitChallenge(evidenceId, REASON_HASH);
        try verificationRegistry.resolveChallenge(challengeId, true, bytes32(0)) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testRejectDuplicateChallenge() public {
        _submitModule();
        bytes32 evidenceId = _submitLocalEvidence(REPORT_HASH);
        verificationRegistry.submitChallenge(evidenceId, REASON_HASH);

        try verificationRegistry.submitChallenge(evidenceId, REASON_HASH) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testOnlyOwnerCanResolveChallenge() public {
        _submitModule();
        bytes32 evidenceId = _submitLocalEvidence(REPORT_HASH);
        bytes32 challengeId = verificationRegistry.submitChallenge(evidenceId, REASON_HASH);

        EvidenceCaller caller = new EvidenceCaller();
        try caller.resolveChallenge(verificationRegistry, challengeId, true, RESOLUTION_HASH) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testUpholdChallengeInvalidatesEvidenceAndUpdatesReputation() public {
        _submitModule();
        bytes32 evidenceId = _submitLocalEvidence(REPORT_HASH);
        EvidenceCaller caller = new EvidenceCaller();

        bytes32 challengeId = caller.submitChallenge(verificationRegistry, evidenceId, REASON_HASH);
        verificationRegistry.resolveChallenge(challengeId, true, RESOLUTION_HASH);

        assert(verificationRegistry.evidenceStatus(evidenceId) == VerificationRegistry.ReportStatus.Invalidated);
        assert(verificationRegistry.testnetReputation(address(caller)) == int32(5));
        assert(verificationRegistry.testnetReputation(address(this)) == int32(-10));
    }

    function testSecondUpheldChallengeDoesNotRepeatReputationAfterInvalidation() public {
        _submitModule();
        bytes32 evidenceId = _submitLocalEvidence(REPORT_HASH);
        EvidenceCaller firstCaller = new EvidenceCaller();
        EvidenceCaller secondCaller = new EvidenceCaller();

        bytes32 firstChallengeId = firstCaller.submitChallenge(verificationRegistry, evidenceId, REASON_HASH);
        bytes32 secondChallengeId = secondCaller.submitChallenge(verificationRegistry, evidenceId, REASON_HASH);

        verificationRegistry.resolveChallenge(firstChallengeId, true, RESOLUTION_HASH);
        verificationRegistry.resolveChallenge(secondChallengeId, true, RESOLUTION_HASH);

        assert(verificationRegistry.evidenceStatus(evidenceId) == VerificationRegistry.ReportStatus.Invalidated);
        assert(verificationRegistry.testnetReputation(address(firstCaller)) == int32(5));
        assert(verificationRegistry.testnetReputation(address(secondCaller)) == int32(0));
        assert(verificationRegistry.testnetReputation(address(this)) == int32(-10));
    }

    function testRejectChallengeLeavesEvidenceActiveAndPenalizesChallenger() public {
        _submitModule();
        bytes32 evidenceId = _submitLocalEvidence(REPORT_HASH);
        EvidenceCaller caller = new EvidenceCaller();

        bytes32 challengeId = caller.submitChallenge(verificationRegistry, evidenceId, REASON_HASH);
        verificationRegistry.resolveChallenge(challengeId, false, RESOLUTION_HASH);

        assert(verificationRegistry.evidenceStatus(evidenceId) == VerificationRegistry.ReportStatus.Active);
        assert(verificationRegistry.testnetReputation(address(caller)) == int32(-2));
        assert(verificationRegistry.testnetReputation(address(this)) == int32(0));
    }

    function testResolveAfterLegacyInvalidateDoesNotRevert() public {
        _submitModule();
        bytes32 evidenceId = _submitLocalEvidence(REPORT_HASH);
        EvidenceCaller caller = new EvidenceCaller();

        bytes32 challengeId = caller.submitChallenge(verificationRegistry, evidenceId, REASON_HASH);
        verificationRegistry.invalidateEvidence(evidenceId, REASON_HASH);
        verificationRegistry.resolveChallenge(challengeId, true, RESOLUTION_HASH);

        assert(verificationRegistry.evidenceStatus(evidenceId) == VerificationRegistry.ReportStatus.Invalidated);
        assert(verificationRegistry.testnetReputation(address(caller)) == int32(0));
        assert(verificationRegistry.testnetReputation(address(this)) == int32(0));
    }

    function testSelfChallengeUpheldNetReputationIsNegativeFive() public {
        _submitModule();
        EvidenceCaller caller = new EvidenceCaller();
        bytes32 evidenceId = caller.submitEvidence(
            verificationRegistry,
            MODULE_DIGEST,
            PROOF_BUNDLE_HASH,
            REPORT_HASH,
            VerificationRegistry.EvidenceType.LocalClientReport,
            bytes32(0),
            bytes32(0),
            100
        );

        bytes32 challengeId = caller.submitChallenge(verificationRegistry, evidenceId, REASON_HASH);
        verificationRegistry.resolveChallenge(challengeId, true, RESOLUTION_HASH);

        assert(verificationRegistry.testnetReputation(address(caller)) == int32(-5));
    }

    function testAdjudicatorOwnerConfirmFlow() public {
        try verificationRegistry.confirmAdjudicator() {
            assert(false);
        } catch {
            assert(true);
        }
        try verificationRegistry.proposeAdjudicator(address(0)) {
            assert(false);
        } catch {
            assert(true);
        }

        verificationRegistry.proposeAdjudicator(address(challengeAdjudicationRegistry));
        try verificationRegistry.confirmAdjudicator() {
            assert(false);
        } catch {
            assert(true);
        }
        vm.warp(block.timestamp + verificationRegistry.ADJUDICATOR_CONFIRMATION_DELAY() + 1);
        verificationRegistry.confirmAdjudicator();

        assert(verificationRegistry.adjudicator() == address(challengeAdjudicationRegistry));
    }

    function testEvidenceReporterReturnsZeroForUnknownEvidence() public {
        assert(verificationRegistry.evidenceReporter(bytes32(uint256(0xdead))) == address(0));
    }

    function testOnlyEvidenceReporterCanSubmitResponse() public {
        (EvidenceCaller reporter, , bytes32 challengeId) = _submitChallengeFixture();
        _confirmAdjudicator();
        EvidenceCaller stranger = new EvidenceCaller();

        try stranger.submitResponse(challengeAdjudicationRegistry, challengeId, RESPONSE_HASH) {
            assert(false);
        } catch {
            assert(true);
        }

        reporter.submitResponse(challengeAdjudicationRegistry, challengeId, RESPONSE_HASH);
        assert(challengeAdjudicationRegistry.adjudicationStarted(challengeId));
        assert(challengeAdjudicationRegistry.responseHashCount(challengeId) == 1);
        (,, uint64 revealBy) = challengeAdjudicationRegistry.adjudicationDeadlines(challengeId);
        assert(revealBy > block.timestamp);
    }

    function testRejectInvalidAdjudicationInputsAndNonValidator() public {
        (, , bytes32 challengeId) = _submitChallengeFixture();
        _confirmAdjudicator();
        AdjudicationCaller caller = new AdjudicationCaller();
        bytes32 commitment = challengeAdjudicationRegistry.computeCommitmentHash(
            challengeId,
            address(caller),
            true,
            VERDICT_HASH_1,
            METHOD_HASH_1,
            SALT
        );

        try challengeAdjudicationRegistry.setQuorum(1) {
            assert(false);
        } catch {
            assert(true);
        }
        try challengeAdjudicationRegistry.setQuorum(16) {
            assert(false);
        } catch {
            assert(true);
        }
        _warpToCommitPhase(challengeId);
        try caller.commitVerdict(challengeAdjudicationRegistry, challengeId, commitment) {
            assert(false);
        } catch {
            assert(true);
        }
        try challengeAdjudicationRegistry.finalizeChallenge(challengeId, true, bytes32(0)) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testCommitRevealRejectsDuplicateAndInvalidInputs() public {
        (, , bytes32 challengeId) = _submitChallengeFixture();
        _confirmAdjudicator();
        AdjudicationCaller validator = new AdjudicationCaller();
        _registerValidator(validator, bytes32(uint256(0x1001)), bytes32(uint256(0x2001)));
        bytes32 commitment = _commitmentFor(validator, challengeId, true, VERDICT_HASH_1, METHOD_HASH_1, SALT);

        try validator.commitVerdict(challengeAdjudicationRegistry, challengeId, bytes32(0)) {
            assert(false);
        } catch {
            assert(true);
        }
        try validator.revealVerdict(challengeAdjudicationRegistry, challengeId, true, VERDICT_HASH_1, METHOD_HASH_1, SALT) {
            assert(false);
        } catch {
            assert(true);
        }

        _warpToCommitPhase(challengeId);
        validator.commitVerdict(challengeAdjudicationRegistry, challengeId, commitment);
        try validator.commitVerdict(challengeAdjudicationRegistry, challengeId, commitment) {
            assert(false);
        } catch {
            assert(true);
        }
        _warpToRevealPhase(challengeId);
        try validator.revealVerdict(
            challengeAdjudicationRegistry,
            challengeId,
            true,
            VERDICT_HASH_1,
            METHOD_HASH_1,
            bytes32(uint256(0xaaab))
        ) {
            assert(false);
        } catch {
            assert(true);
        }
        validator.revealVerdict(challengeAdjudicationRegistry, challengeId, true, VERDICT_HASH_1, METHOD_HASH_1, SALT);
        try validator.revealVerdict(challengeAdjudicationRegistry, challengeId, true, VERDICT_HASH_1, METHOD_HASH_1, SALT) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testResponseAllowsEarlyCommit() public {
        (EvidenceCaller reporter, , bytes32 challengeId) = _submitChallengeFixture();
        _confirmAdjudicator();
        AdjudicationCaller validator = new AdjudicationCaller();
        _registerValidator(validator, bytes32(uint256(0x1001)), bytes32(uint256(0x2001)));

        reporter.submitResponse(challengeAdjudicationRegistry, challengeId, RESPONSE_HASH);
        validator.commitVerdict(
            challengeAdjudicationRegistry,
            challengeId,
            _commitmentFor(validator, challengeId, true, VERDICT_HASH_1, METHOD_HASH_1, SALT)
        );

        assert(challengeAdjudicationRegistry.validatorCount(challengeId) == 1);
    }

    function testNoResponseCommitWaitsForResponseDeadline() public {
        (, , bytes32 challengeId) = _submitChallengeFixture();
        _confirmAdjudicator();
        AdjudicationCaller validator = new AdjudicationCaller();
        _registerValidator(validator, bytes32(uint256(0x1001)), bytes32(uint256(0x2001)));
        bytes32 commitment = _commitmentFor(validator, challengeId, true, VERDICT_HASH_1, METHOD_HASH_1, SALT);

        try validator.commitVerdict(challengeAdjudicationRegistry, challengeId, commitment) {
            assert(false);
        } catch {
            assert(true);
        }

        _warpToCommitPhase(challengeId);
        validator.commitVerdict(challengeAdjudicationRegistry, challengeId, commitment);
        assert(challengeAdjudicationRegistry.validatorCount(challengeId) == 1);
    }

    function testQuorumUpheldFinalizesAndInvalidatesEvidence() public {
        (EvidenceCaller reporter, EvidenceCaller challenger, bytes32 challengeId) = _submitChallengeFixture();
        bytes32 evidenceId = _challengeEvidenceId(challengeId);
        _confirmAdjudicator();
        _submitThreeVerdicts(challengeId, true);

        challengeAdjudicationRegistry.finalizeChallenge(challengeId, true, FINAL_REPORT_HASH);

        assert(verificationRegistry.evidenceStatus(evidenceId) == VerificationRegistry.ReportStatus.Invalidated);
        assert(verificationRegistry.testnetReputation(address(challenger)) == int32(5));
        assert(verificationRegistry.testnetReputation(address(reporter)) == int32(-10));
    }

    function testQuorumRejectedFinalizesAndKeepsEvidenceActive() public {
        (, EvidenceCaller challenger, bytes32 challengeId) = _submitChallengeFixture();
        bytes32 evidenceId = _challengeEvidenceId(challengeId);
        _confirmAdjudicator();
        _submitThreeVerdicts(challengeId, false);

        challengeAdjudicationRegistry.finalizeChallenge(challengeId, false, FINAL_REPORT_HASH);

        assert(verificationRegistry.evidenceStatus(evidenceId) == VerificationRegistry.ReportStatus.Active);
        assert(verificationRegistry.testnetReputation(address(challenger)) == int32(-2));
    }

    function testOperatorAndRunnerHintsDoNotAffectQuorum() public {
        (, , bytes32 challengeId) = _submitChallengeFixture();
        _confirmAdjudicator();
        AdjudicationCaller first = new AdjudicationCaller();
        AdjudicationCaller second = new AdjudicationCaller();
        AdjudicationCaller third = new AdjudicationCaller();
        _registerValidator(first, bytes32(uint256(0x1001)), bytes32(uint256(0x2001)));
        _registerValidator(second, bytes32(uint256(0x1001)), bytes32(uint256(0x2001)));
        _registerValidator(third, bytes32(uint256(0x1001)), bytes32(uint256(0x2001)));

        _warpToCommitPhase(challengeId);
        first.commitVerdict(
            challengeAdjudicationRegistry,
            challengeId,
            _commitmentFor(first, challengeId, true, VERDICT_HASH_1, METHOD_HASH_1, SALT)
        );
        second.commitVerdict(
            challengeAdjudicationRegistry,
            challengeId,
            _commitmentFor(second, challengeId, true, VERDICT_HASH_2, METHOD_HASH_2, bytes32(uint256(0xaaab)))
        );
        third.commitVerdict(
            challengeAdjudicationRegistry,
            challengeId,
            _commitmentFor(third, challengeId, true, VERDICT_HASH_3, METHOD_HASH_3, bytes32(uint256(0xaaac)))
        );
        _warpToRevealPhase(challengeId);
        first.revealVerdict(challengeAdjudicationRegistry, challengeId, true, VERDICT_HASH_1, METHOD_HASH_1, SALT);
        second.revealVerdict(
            challengeAdjudicationRegistry,
            challengeId,
            true,
            VERDICT_HASH_2,
            METHOD_HASH_2,
            bytes32(uint256(0xaaab))
        );
        third.revealVerdict(
            challengeAdjudicationRegistry,
            challengeId,
            true,
            VERDICT_HASH_3,
            METHOD_HASH_3,
            bytes32(uint256(0xaaac))
        );

        challengeAdjudicationRegistry.finalizeChallenge(challengeId, true, FINAL_REPORT_HASH);
    }

    function testFinalizeLocksChallengeAndLegacyResolveCannotOverrideStartedAdjudication() public {
        (, , bytes32 challengeId) = _submitChallengeFixture();
        _confirmAdjudicator();
        _submitThreeVerdicts(challengeId, true);

        try verificationRegistry.resolveChallenge(challengeId, false, RESOLUTION_HASH) {
            assert(false);
        } catch {
            assert(true);
        }

        challengeAdjudicationRegistry.finalizeChallenge(challengeId, true, FINAL_REPORT_HASH);
        try challengeAdjudicationRegistry.finalizeChallenge(challengeId, true, FINAL_REPORT_HASH) {
            assert(false);
        } catch {
            assert(true);
        }
        AdjudicationCaller validator = new AdjudicationCaller();
        _registerValidator(validator, bytes32(uint256(0x1010)), bytes32(uint256(0x2010)));
        try validator.commitVerdict(
            challengeAdjudicationRegistry,
            challengeId,
            _commitmentFor(validator, challengeId, true, VERDICT_HASH_4, METHOD_HASH_4, SALT)
        ) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testExpireNoQuorumDoesNotResolveChallenge() public {
        (EvidenceCaller reporter, EvidenceCaller challenger, bytes32 challengeId) = _submitChallengeFixture();
        bytes32 evidenceId = _challengeEvidenceId(challengeId);
        _confirmAdjudicator();
        AdjudicationCaller validator = new AdjudicationCaller();
        _registerValidator(validator, bytes32(uint256(0x1001)), bytes32(uint256(0x2001)));
        _warpToCommitPhase(challengeId);
        validator.commitVerdict(
            challengeAdjudicationRegistry,
            challengeId,
            _commitmentFor(validator, challengeId, true, VERDICT_HASH_1, METHOD_HASH_1, SALT)
        );
        _warpToRevealPhase(challengeId);
        validator.revealVerdict(challengeAdjudicationRegistry, challengeId, true, VERDICT_HASH_1, METHOD_HASH_1, SALT);
        _warpPastRevealPhase(challengeId);

        challengeAdjudicationRegistry.expireChallengeNoQuorum(challengeId, RESOLUTION_HASH);

        assert(verificationRegistry.evidenceStatus(evidenceId) == VerificationRegistry.ReportStatus.Active);
        assert(verificationRegistry.testnetReputation(address(challenger)) == int32(0));
        assert(verificationRegistry.testnetReputation(address(reporter)) == int32(0));
    }

    function testExpireNoQuorumRejectedWhenQuorumMet() public {
        (, , bytes32 challengeId) = _submitChallengeFixture();
        _confirmAdjudicator();
        _submitThreeVerdicts(challengeId, true);
        _warpPastRevealPhase(challengeId);

        try challengeAdjudicationRegistry.expireChallengeNoQuorum(challengeId, RESOLUTION_HASH) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testAdjudicatorOnlyResolveCannotBeCalledDirectly() public {
        (, , bytes32 challengeId) = _submitChallengeFixture();
        AdjudicationCaller caller = new AdjudicationCaller();

        try caller.resolveChallengeFromAdjudicator(verificationRegistry, challengeId, true, FINAL_REPORT_HASH) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testCommitAndRevealScore() public {
        _submitModule();
        bytes32 commitHash = scoreCommitReveal.computeCommitHash(88, REASON_HASH, SALT);
        scoreCommitReveal.commitScore(MODULE_DIGEST, commitHash);
        scoreCommitReveal.revealScore(MODULE_DIGEST, 88, REASON_HASH, SALT);
    }

    function testRejectWrongRevealSalt() public {
        _submitModule();
        bytes32 commitHash = scoreCommitReveal.computeCommitHash(88, REASON_HASH, SALT);
        scoreCommitReveal.commitScore(MODULE_DIGEST, commitHash);
        try scoreCommitReveal.revealScore(MODULE_DIGEST, 88, REASON_HASH, bytes32(uint256(0xbbbb))) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testRejectDuplicateReveal() public {
        _submitModule();
        bytes32 commitHash = scoreCommitReveal.computeCommitHash(88, REASON_HASH, SALT);
        scoreCommitReveal.commitScore(MODULE_DIGEST, commitHash);
        scoreCommitReveal.revealScore(MODULE_DIGEST, 88, REASON_HASH, SALT);
        try scoreCommitReveal.revealScore(MODULE_DIGEST, 88, REASON_HASH, SALT) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function testRejectScoreForUnknownModule() public {
        bytes32 commitHash = scoreCommitReveal.computeCommitHash(88, REASON_HASH, SALT);
        try scoreCommitReveal.commitScore(MODULE_DIGEST, commitHash) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    function _submitModule() private {
        moduleRegistry.submitModule(
            MODULE_DIGEST,
            MODULE_ID_HASH,
            ModuleRegistry.ModuleType.Tool,
            VERSION_HASH,
            "oci://registry.example/originagent/demo-skill@sha256:1111"
        );
    }

    function _submitLocalEvidence(bytes32 reportHash) private returns (bytes32) {
        return verificationRegistry.submitEvidence(
            MODULE_DIGEST,
            PROOF_BUNDLE_HASH,
            reportHash,
            VerificationRegistry.EvidenceType.LocalClientReport,
            bytes32(0),
            bytes32(0),
            100
        );
    }

    function _submitChallengeFixture() private returns (EvidenceCaller reporter, EvidenceCaller challenger, bytes32 challengeId) {
        _submitModule();
        reporter = new EvidenceCaller();
        challenger = new EvidenceCaller();
        bytes32 evidenceId = reporter.submitEvidence(
            verificationRegistry,
            MODULE_DIGEST,
            PROOF_BUNDLE_HASH,
            REPORT_HASH,
            VerificationRegistry.EvidenceType.LocalClientReport,
            bytes32(0),
            bytes32(0),
            uint64(block.timestamp + 7200)
        );
        challengeId = challenger.submitChallenge(verificationRegistry, evidenceId, REASON_HASH);
    }

    function _confirmAdjudicator() private {
        verificationRegistry.proposeAdjudicator(address(challengeAdjudicationRegistry));
        vm.warp(block.timestamp + verificationRegistry.ADJUDICATOR_CONFIRMATION_DELAY() + 1);
        verificationRegistry.confirmAdjudicator();
    }

    function _registerValidator(AdjudicationCaller validator, bytes32 operatorGroupHash, bytes32 runnerFingerprintHash) private {
        validator.registerIdentity(identityRegistry, IdentityRegistry.IdentityRole.Validator, METADATA_HASH);
        verificationRegistry.setValidatorProfile(address(validator), operatorGroupHash, runnerFingerprintHash, true);
    }

    function _submitThreeVerdicts(bytes32 challengeId, bool claimedUpheld) private {
        AdjudicationCaller first = new AdjudicationCaller();
        AdjudicationCaller second = new AdjudicationCaller();
        AdjudicationCaller third = new AdjudicationCaller();
        _registerValidator(first, bytes32(uint256(0x1001)), bytes32(uint256(0x2001)));
        _registerValidator(second, bytes32(uint256(0x1002)), bytes32(uint256(0x2002)));
        _registerValidator(third, bytes32(uint256(0x1003)), bytes32(uint256(0x2003)));
        bytes32 salt2 = bytes32(uint256(0xaaab));
        bytes32 salt3 = bytes32(uint256(0xaaac));
        _warpToCommitPhase(challengeId);
        first.commitVerdict(
            challengeAdjudicationRegistry,
            challengeId,
            _commitmentFor(first, challengeId, claimedUpheld, VERDICT_HASH_1, METHOD_HASH_1, SALT)
        );
        second.commitVerdict(
            challengeAdjudicationRegistry,
            challengeId,
            _commitmentFor(second, challengeId, claimedUpheld, VERDICT_HASH_2, METHOD_HASH_2, salt2)
        );
        third.commitVerdict(
            challengeAdjudicationRegistry,
            challengeId,
            _commitmentFor(third, challengeId, claimedUpheld, VERDICT_HASH_3, METHOD_HASH_3, salt3)
        );
        _warpToRevealPhase(challengeId);
        first.revealVerdict(challengeAdjudicationRegistry, challengeId, claimedUpheld, VERDICT_HASH_1, METHOD_HASH_1, SALT);
        second.revealVerdict(challengeAdjudicationRegistry, challengeId, claimedUpheld, VERDICT_HASH_2, METHOD_HASH_2, salt2);
        third.revealVerdict(challengeAdjudicationRegistry, challengeId, claimedUpheld, VERDICT_HASH_3, METHOD_HASH_3, salt3);
    }

    function _commitmentFor(
        AdjudicationCaller validator,
        bytes32 challengeId,
        bool claimedUpheld,
        bytes32 verdictHash,
        bytes32 methodHash,
        bytes32 salt
    ) private view returns (bytes32) {
        return challengeAdjudicationRegistry.computeCommitmentHash(
            challengeId,
            address(validator),
            claimedUpheld,
            verdictHash,
            methodHash,
            salt
        );
    }

    function _warpToCommitPhase(bytes32 challengeId) private {
        (uint64 responseBy,,) = challengeAdjudicationRegistry.adjudicationDeadlines(challengeId);
        if (block.timestamp <= responseBy) {
            vm.warp(uint256(responseBy) + 1);
        }
    }

    function _warpToRevealPhase(bytes32 challengeId) private {
        (, uint64 commitBy,) = challengeAdjudicationRegistry.adjudicationDeadlines(challengeId);
        if (block.timestamp <= commitBy) {
            vm.warp(uint256(commitBy) + 1);
        }
    }

    function _warpPastRevealPhase(bytes32 challengeId) private {
        (,, uint64 revealBy) = challengeAdjudicationRegistry.adjudicationDeadlines(challengeId);
        if (block.timestamp <= revealBy) {
            vm.warp(uint256(revealBy) + 1);
        }
    }

    function _challengeEvidenceId(bytes32 challengeId) private view returns (bytes32) {
        (, bytes32 evidenceId,,,,,,,) = verificationRegistry.challenges(challengeId);
        return evidenceId;
    }

    function _registerAgentPassport() private returns (bytes32) {
        bytes32 genesisHash = agentPassportRegistry.computeGenesisHash(
            address(this),
            AGENT_KEY_HASH,
            GENESIS_NONCE,
            METADATA_HASH
        );
        return agentPassportRegistry.registerAgentPassport(AGENT_KEY_HASH, genesisHash, METADATA_HASH);
    }
}

contract EvidenceCaller {
    function submitEvidence(
        VerificationRegistry verificationRegistry,
        bytes32 moduleDigest,
        bytes32 proofBundleHash,
        bytes32 reportHash,
        VerificationRegistry.EvidenceType evidenceType,
        bytes32 operatorGroupHash,
        bytes32 runnerFingerprintHash,
        uint64 challengeWindowEnd
    ) external returns (bytes32) {
        return verificationRegistry.submitEvidence(
            moduleDigest,
            proofBundleHash,
            reportHash,
            evidenceType,
            operatorGroupHash,
            runnerFingerprintHash,
            challengeWindowEnd
        );
    }

    function submitChallenge(
        VerificationRegistry verificationRegistry,
        bytes32 evidenceId,
        bytes32 reasonHash
    ) external returns (bytes32) {
        return verificationRegistry.submitChallenge(evidenceId, reasonHash);
    }

    function resolveChallenge(
        VerificationRegistry verificationRegistry,
        bytes32 challengeId,
        bool upheld,
        bytes32 resolutionHash
    ) external {
        verificationRegistry.resolveChallenge(challengeId, upheld, resolutionHash);
    }

    function submitResponse(
        ChallengeAdjudicationRegistry challengeAdjudicationRegistry,
        bytes32 challengeId,
        bytes32 responseHash
    ) external {
        challengeAdjudicationRegistry.submitResponse(challengeId, responseHash);
    }
}

contract AdjudicationCaller {
    function registerIdentity(
        IdentityRegistry identityRegistry,
        IdentityRegistry.IdentityRole role,
        bytes32 metadataHash
    ) external {
        identityRegistry.registerIdentity(role, metadataHash);
    }

    function submitResponse(
        ChallengeAdjudicationRegistry challengeAdjudicationRegistry,
        bytes32 challengeId,
        bytes32 responseHash
    ) external {
        challengeAdjudicationRegistry.submitResponse(challengeId, responseHash);
    }

    function commitVerdict(
        ChallengeAdjudicationRegistry challengeAdjudicationRegistry,
        bytes32 challengeId,
        bytes32 commitmentHash
    ) external {
        challengeAdjudicationRegistry.commitVerdict(challengeId, commitmentHash);
    }

    function revealVerdict(
        ChallengeAdjudicationRegistry challengeAdjudicationRegistry,
        bytes32 challengeId,
        bool claimedUpheld,
        bytes32 verdictHash,
        bytes32 methodHash,
        bytes32 salt
    ) external {
        challengeAdjudicationRegistry.revealVerdict(challengeId, claimedUpheld, verdictHash, methodHash, salt);
    }

    function finalizeChallenge(
        ChallengeAdjudicationRegistry challengeAdjudicationRegistry,
        bytes32 challengeId,
        bool claimedUpheld,
        bytes32 finalReportHash
    ) external {
        challengeAdjudicationRegistry.finalizeChallenge(challengeId, claimedUpheld, finalReportHash);
    }

    function resolveChallengeFromAdjudicator(
        VerificationRegistry verificationRegistry,
        bytes32 challengeId,
        bool upheld,
        bytes32 resolutionHash
    ) external {
        verificationRegistry.resolveChallengeFromAdjudicator(challengeId, upheld, resolutionHash);
    }
}

contract PassportCaller {
    function recordAgentMigration(
        AgentPassportRegistry agentPassportRegistry,
        bytes32 passportId,
        bytes32 newAgentKeyHash,
        bytes32 migrationHash
    ) external returns (uint32) {
        return agentPassportRegistry.recordAgentMigration(passportId, newAgentKeyHash, migrationHash);
    }
}

contract ReputationCaller {
    function checkpointReputation(
        AgentReputationRegistry agentReputationRegistry,
        bytes32 passportId,
        int32 score,
        uint32 positiveCount,
        uint32 negativeCount,
        bytes32 reportHash
    ) external returns (uint32) {
        return agentReputationRegistry.checkpointReputation(
            passportId,
            score,
            positiveCount,
            negativeCount,
            reportHash
        );
    }
}

contract UnitKindCaller {
    function setReviewReport(
        EvolutionUnitKindRegistry evolutionUnitKindRegistry,
        bytes32 kindIdHash,
        bytes32 versionHash,
        bytes32 reviewReportHash
    ) external {
        evolutionUnitKindRegistry.setReviewReport(kindIdHash, versionHash, reviewReportHash);
    }

    function setKindStatus(
        EvolutionUnitKindRegistry evolutionUnitKindRegistry,
        bytes32 kindIdHash,
        bytes32 versionHash,
        EvolutionUnitKindRegistry.KindStatus status
    ) external {
        evolutionUnitKindRegistry.setKindStatus(kindIdHash, versionHash, status);
    }
}

contract TestCreditCaller {
    function grantCredit(
        TestCreditLedger testCreditLedger,
        bytes32 passportId,
        uint64 amount,
        bytes32 actionHash,
        bytes32 trustPolicyReportHash
    ) external returns (uint32) {
        return testCreditLedger.grantCredit(passportId, amount, actionHash, trustPolicyReportHash);
    }

    function consumeCredit(
        TestCreditLedger testCreditLedger,
        bytes32 passportId,
        uint64 amount,
        bytes32 actionHash,
        bytes32 trustPolicyReportHash
    ) external returns (uint32) {
        return testCreditLedger.consumeCredit(passportId, amount, actionHash, trustPolicyReportHash);
    }
}
