// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IdentityRegistry} from "./IdentityRegistry.sol";
import {ModuleRegistry} from "./ModuleRegistry.sol";

interface IChallengeAdjudicationRegistry {
    function adjudicationStarted(bytes32 challengeId) external view returns (bool);
}

contract VerificationRegistry {
    string public constant VERSION = "ec4.0.0";
    uint256 public constant ADJUDICATOR_CONFIRMATION_DELAY = 1 hours;

    enum EvidenceType {
        Unknown,
        LocalClientReport,
        UserSignedReceipt,
        ValidatorReport,
        UnqualifiedValidatorReport,
        FoundationSeedReport
    }

    enum ReportStatus {
        Unknown,
        Active,
        Invalidated
    }

    enum ChallengeStatus {
        Unknown,
        Submitted,
        Upheld,
        Rejected
    }

    struct VerificationReport {
        bytes32 moduleDigest;
        bytes32 proofBundleHash;
        bytes32 verificationReportHash;
        bytes32 capabilitySnapshotHash;
        bytes32 telemetryDigest;
        address reporter;
        uint64 submittedAt;
        bool exists;
    }

    struct ValidatorProfile {
        bytes32 operatorGroupHash;
        bytes32 runnerFingerprintHash;
        bool allowed;
        bool exists;
    }

    struct EvidenceRecord {
        bytes32 evidenceId;
        bytes32 moduleDigest;
        bytes32 proofBundleHash;
        bytes32 reportHash;
        EvidenceType evidenceType;
        bytes32 operatorGroupHash;
        bytes32 runnerFingerprintHash;
        address reporter;
        uint64 submittedAt;
        uint64 challengeWindowEnd;
        ReportStatus status;
        bool testnetOnly;
        bool exists;
    }

    struct ChallengeRecord {
        bytes32 challengeId;
        bytes32 evidenceId;
        bytes32 moduleDigest;
        bytes32 reasonHash;
        address challenger;
        uint64 submittedAt;
        uint64 resolvedAt;
        bytes32 resolutionHash;
        ChallengeStatus status;
    }

    ModuleRegistry public immutable moduleRegistry;
    IdentityRegistry public immutable identityRegistry;
    address public immutable owner;
    address public adjudicator;
    address public pendingAdjudicator;
    uint64 public adjudicatorProposedAt;

    mapping(bytes32 moduleDigest => VerificationReport report) public reports;
    mapping(address validator => ValidatorProfile profile) public validatorProfiles;
    mapping(bytes32 evidenceId => EvidenceRecord evidence) private _evidenceRecords;
    mapping(bytes32 moduleDigest => bytes32[] evidenceIds) public moduleEvidenceIds;
    mapping(bytes32 challengeId => ChallengeRecord challenge) public challenges;
    mapping(address subject => int32 reputation) public testnetReputation;

    event VerificationReportSubmitted(
        bytes32 indexed moduleDigest,
        bytes32 proofBundleHash,
        bytes32 verificationReportHash,
        bytes32 capabilitySnapshotHash,
        bytes32 telemetryDigest,
        address indexed reporter
    );
    event ValidatorProfileSet(
        address indexed validator,
        bytes32 operatorGroupHash,
        bytes32 runnerFingerprintHash,
        bool allowed
    );
    event EvidenceSubmitted(
        bytes32 indexed evidenceId,
        bytes32 indexed moduleDigest,
        EvidenceType evidenceType,
        address indexed reporter
    );
    event EvidenceInvalidated(bytes32 indexed evidenceId, bytes32 reasonHash, address indexed actor);
    event ChallengeSubmitted(
        bytes32 indexed challengeId,
        bytes32 indexed evidenceId,
        bytes32 indexed moduleDigest,
        bytes32 reasonHash,
        address challenger
    );
    event ChallengeResolved(
        bytes32 indexed challengeId,
        bytes32 indexed evidenceId,
        bool upheld,
        bytes32 resolutionHash,
        address resolver
    );
    event ChallengeResolvedOnAlreadyInvalidated(bytes32 indexed challengeId, bytes32 indexed evidenceId);
    event AdjudicatorProposed(address indexed pendingAdjudicator, uint64 proposedAt);
    event AdjudicatorConfirmed(address indexed adjudicator);

    error ChallengeAlreadyResolved(bytes32 challengeId);
    error ChallengeAlreadySubmitted(bytes32 challengeId);
    error AdjudicationInProgress(bytes32 challengeId);
    error AdjudicatorConfirmationTooEarly(uint64 proposedAt, uint256 delaySeconds);
    error EmptyHash();
    error EvidenceAlreadySubmitted(bytes32 evidenceId);
    error EvidenceNotActive(bytes32 evidenceId);
    error ChallengeWindowClosed(bytes32 evidenceId, uint64 challengeWindowEnd, uint64 currentTime);
    error InvalidEvidenceType(uint8 evidenceType);
    error NoPendingAdjudicator();
    error NotAdjudicator(address caller);
    error NotOwner(address caller);
    error ReportAlreadySubmitted(bytes32 moduleDigest);
    error ZeroAddress();
    error UnknownChallenge(bytes32 challengeId);
    error UnknownEvidence(bytes32 evidenceId);

    constructor(ModuleRegistry moduleRegistry_, IdentityRegistry identityRegistry_) {
        moduleRegistry = moduleRegistry_;
        identityRegistry = identityRegistry_;
        owner = msg.sender;
    }

    function proposeAdjudicator(address newAdjudicator) external onlyOwner {
        if (newAdjudicator == address(0)) {
            revert ZeroAddress();
        }
        pendingAdjudicator = newAdjudicator;
        adjudicatorProposedAt = uint64(block.timestamp);
        emit AdjudicatorProposed(newAdjudicator, adjudicatorProposedAt);
    }

    function confirmAdjudicator() external onlyOwner {
        if (pendingAdjudicator == address(0)) {
            revert NoPendingAdjudicator();
        }
        if (block.timestamp < uint256(adjudicatorProposedAt) + ADJUDICATOR_CONFIRMATION_DELAY) {
            revert AdjudicatorConfirmationTooEarly(adjudicatorProposedAt, ADJUDICATOR_CONFIRMATION_DELAY);
        }
        adjudicator = pendingAdjudicator;
        pendingAdjudicator = address(0);
        adjudicatorProposedAt = 0;
        emit AdjudicatorConfirmed(adjudicator);
    }

    function setValidatorProfile(
        address validator,
        bytes32 operatorGroupHash,
        bytes32 runnerFingerprintHash,
        bool allowed
    ) external onlyOwner {
        if (operatorGroupHash == bytes32(0) || runnerFingerprintHash == bytes32(0)) {
            revert EmptyHash();
        }
        validatorProfiles[validator] = ValidatorProfile({
            operatorGroupHash: operatorGroupHash,
            runnerFingerprintHash: runnerFingerprintHash,
            allowed: allowed,
            exists: true
        });
        emit ValidatorProfileSet(validator, operatorGroupHash, runnerFingerprintHash, allowed);
    }

    function submitReport(
        bytes32 moduleDigest,
        bytes32 proofBundleHash,
        bytes32 verificationReportHash,
        bytes32 capabilitySnapshotHash,
        bytes32 telemetryDigest
    ) external {
        moduleRegistry.requireModule(moduleDigest);
        if (proofBundleHash == bytes32(0) || verificationReportHash == bytes32(0) || telemetryDigest == bytes32(0)) {
            revert EmptyHash();
        }
        if (reports[moduleDigest].exists) {
            revert ReportAlreadySubmitted(moduleDigest);
        }

        reports[moduleDigest] = VerificationReport({
            moduleDigest: moduleDigest,
            proofBundleHash: proofBundleHash,
            verificationReportHash: verificationReportHash,
            capabilitySnapshotHash: capabilitySnapshotHash,
            telemetryDigest: telemetryDigest,
            reporter: msg.sender,
            submittedAt: uint64(block.timestamp),
            exists: true
        });
        emit VerificationReportSubmitted(
            moduleDigest,
            proofBundleHash,
            verificationReportHash,
            capabilitySnapshotHash,
            telemetryDigest,
            msg.sender
        );
        _recordEvidence(
            moduleDigest,
            proofBundleHash,
            verificationReportHash,
            EvidenceType.LocalClientReport,
            bytes32(0),
            bytes32(0),
            0
        );
    }

    function submitEvidence(
        bytes32 moduleDigest,
        bytes32 proofBundleHash,
        bytes32 reportHash,
        EvidenceType evidenceType,
        bytes32 operatorGroupHash,
        bytes32 runnerFingerprintHash,
        uint64 challengeWindowEnd
    ) external returns (bytes32) {
        moduleRegistry.requireModule(moduleDigest);
        if (proofBundleHash == bytes32(0) || reportHash == bytes32(0)) {
            revert EmptyHash();
        }
        if (evidenceType == EvidenceType.Unknown || uint8(evidenceType) > uint8(EvidenceType.FoundationSeedReport)) {
            revert InvalidEvidenceType(uint8(evidenceType));
        }
        if (evidenceType == EvidenceType.FoundationSeedReport && msg.sender != owner) {
            revert NotOwner(msg.sender);
        }

        if (evidenceType == EvidenceType.ValidatorReport) {
            ValidatorProfile memory profile = validatorProfiles[msg.sender];
            if (_isQualifiedValidator(msg.sender, profile)) {
                return _recordEvidence(
                    moduleDigest,
                    proofBundleHash,
                    reportHash,
                    EvidenceType.ValidatorReport,
                    profile.operatorGroupHash,
                    profile.runnerFingerprintHash,
                    challengeWindowEnd
                );
            }
            return _recordEvidence(
                moduleDigest,
                proofBundleHash,
                reportHash,
                EvidenceType.UnqualifiedValidatorReport,
                operatorGroupHash,
                runnerFingerprintHash,
                challengeWindowEnd
            );
        }

        return _recordEvidence(
            moduleDigest,
            proofBundleHash,
            reportHash,
            evidenceType,
            operatorGroupHash,
            runnerFingerprintHash,
            challengeWindowEnd
        );
    }

    function invalidateEvidence(bytes32 evidenceId, bytes32 reasonHash) external onlyOwner {
        if (reasonHash == bytes32(0)) {
            revert EmptyHash();
        }
        EvidenceRecord storage evidence = _evidenceRecords[evidenceId];
        if (!evidence.exists) {
            revert UnknownEvidence(evidenceId);
        }
        evidence.status = ReportStatus.Invalidated;
        emit EvidenceInvalidated(evidenceId, reasonHash, msg.sender);
    }

    function submitChallenge(bytes32 evidenceId, bytes32 reasonHash) external returns (bytes32) {
        if (reasonHash == bytes32(0)) {
            revert EmptyHash();
        }
        EvidenceRecord storage evidence = _evidenceRecords[evidenceId];
        if (!evidence.exists) {
            revert UnknownEvidence(evidenceId);
        }
        if (evidence.status != ReportStatus.Active) {
            revert EvidenceNotActive(evidenceId);
        }
        if (evidence.challengeWindowEnd != 0 && block.timestamp > evidence.challengeWindowEnd) {
            revert ChallengeWindowClosed(evidenceId, evidence.challengeWindowEnd, uint64(block.timestamp));
        }

        bytes32 challengeId = _computeChallengeId(evidenceId, msg.sender, reasonHash);
        if (challenges[challengeId].status != ChallengeStatus.Unknown) {
            revert ChallengeAlreadySubmitted(challengeId);
        }

        challenges[challengeId] = ChallengeRecord({
            challengeId: challengeId,
            evidenceId: evidenceId,
            moduleDigest: evidence.moduleDigest,
            reasonHash: reasonHash,
            challenger: msg.sender,
            submittedAt: uint64(block.timestamp),
            resolvedAt: 0,
            resolutionHash: bytes32(0),
            status: ChallengeStatus.Submitted
        });
        emit ChallengeSubmitted(challengeId, evidenceId, evidence.moduleDigest, reasonHash, msg.sender);
        return challengeId;
    }

    /// @notice Legacy sandbox-only owner resolution path. Production flows should use ChallengeAdjudicationRegistry.finalizeChallenge.
    function resolveChallenge(bytes32 challengeId, bool upheld, bytes32 resolutionHash) external onlyOwner {
        if (_adjudicationStarted(challengeId)) {
            revert AdjudicationInProgress(challengeId);
        }
        _resolveChallenge(challengeId, upheld, resolutionHash);
    }

    function resolveChallengeFromAdjudicator(bytes32 challengeId, bool upheld, bytes32 resolutionHash) external {
        if (msg.sender != adjudicator) {
            revert NotAdjudicator(msg.sender);
        }
        _resolveChallenge(challengeId, upheld, resolutionHash);
    }

    function evidenceReporter(bytes32 evidenceId) external view returns (address) {
        return _evidenceRecords[evidenceId].reporter;
    }

    function moduleEvidenceCount(bytes32 moduleDigest) external view returns (uint256) {
        return moduleEvidenceIds[moduleDigest].length;
    }

    function evidenceStatus(bytes32 evidenceId) external view returns (ReportStatus) {
        return _evidenceRecords[evidenceId].status;
    }

    function evidenceTypeOf(bytes32 evidenceId) external view returns (EvidenceType) {
        return _evidenceRecords[evidenceId].evidenceType;
    }

    function _resolveChallenge(bytes32 challengeId, bool upheld, bytes32 resolutionHash) private {
        if (resolutionHash == bytes32(0)) {
            revert EmptyHash();
        }
        ChallengeRecord storage challenge = challenges[challengeId];
        if (challenge.status == ChallengeStatus.Unknown) {
            revert UnknownChallenge(challengeId);
        }
        if (challenge.status != ChallengeStatus.Submitted) {
            revert ChallengeAlreadyResolved(challengeId);
        }

        EvidenceRecord storage evidence = _evidenceRecords[challenge.evidenceId];
        if (upheld) {
            bool invalidatedNow = evidence.status == ReportStatus.Active;
            if (evidence.status == ReportStatus.Invalidated) {
                emit ChallengeResolvedOnAlreadyInvalidated(challengeId, challenge.evidenceId);
            } else {
                evidence.status = ReportStatus.Invalidated;
                emit EvidenceInvalidated(challenge.evidenceId, resolutionHash, msg.sender);
            }
            if (invalidatedNow) {
                testnetReputation[challenge.challenger] += int32(5);
                testnetReputation[evidence.reporter] -= int32(10);
            }
            challenge.status = ChallengeStatus.Upheld;
        } else {
            testnetReputation[challenge.challenger] -= int32(2);
            challenge.status = ChallengeStatus.Rejected;
        }
        challenge.resolvedAt = uint64(block.timestamp);
        challenge.resolutionHash = resolutionHash;
        emit ChallengeResolved(challengeId, challenge.evidenceId, upheld, resolutionHash, msg.sender);
    }

    function _recordEvidence(
        bytes32 moduleDigest,
        bytes32 proofBundleHash,
        bytes32 reportHash,
        EvidenceType evidenceType,
        bytes32 operatorGroupHash,
        bytes32 runnerFingerprintHash,
        uint64 challengeWindowEnd
    ) private returns (bytes32) {
        bytes32 evidenceId = keccak256(abi.encode(moduleDigest, proofBundleHash, reportHash, msg.sender, evidenceType));
        if (_evidenceRecords[evidenceId].exists) {
            revert EvidenceAlreadySubmitted(evidenceId);
        }
        EvidenceRecord storage evidence = _evidenceRecords[evidenceId];
        evidence.evidenceId = evidenceId;
        evidence.moduleDigest = moduleDigest;
        evidence.proofBundleHash = proofBundleHash;
        evidence.reportHash = reportHash;
        evidence.evidenceType = evidenceType;
        evidence.operatorGroupHash = operatorGroupHash;
        evidence.runnerFingerprintHash = runnerFingerprintHash;
        evidence.reporter = msg.sender;
        evidence.submittedAt = uint64(block.timestamp);
        evidence.challengeWindowEnd = challengeWindowEnd;
        evidence.status = ReportStatus.Active;
        evidence.testnetOnly = true;
        evidence.exists = true;
        moduleEvidenceIds[moduleDigest].push(evidenceId);
        emit EvidenceSubmitted(evidenceId, moduleDigest, evidenceType, msg.sender);
        return evidenceId;
    }

    function _isQualifiedValidator(address subject, ValidatorProfile memory profile) private view returns (bool) {
        if (!profile.exists || !profile.allowed) {
            return false;
        }
        (IdentityRegistry.IdentityRole role,,, bool exists) = identityRegistry.identities(subject);
        return exists && role == IdentityRegistry.IdentityRole.Validator;
    }

    function _adjudicationStarted(bytes32 challengeId) private view returns (bool) {
        if (adjudicator == address(0)) {
            return false;
        }
        try IChallengeAdjudicationRegistry(adjudicator).adjudicationStarted(challengeId) returns (bool started) {
            return started;
        } catch {
            return false;
        }
    }

    function _computeChallengeId(bytes32 evidenceId, address challenger, bytes32 reasonHash) private pure returns (bytes32) {
        return keccak256(abi.encode(evidenceId, challenger, reasonHash));
    }

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert NotOwner(msg.sender);
        }
        _;
    }
}
