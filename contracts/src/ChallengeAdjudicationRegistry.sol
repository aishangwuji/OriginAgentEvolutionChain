// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IdentityRegistry} from "./IdentityRegistry.sol";
import {VerificationRegistry} from "./VerificationRegistry.sol";

contract ChallengeAdjudicationRegistry {
    string public constant VERSION = "ec15b.0.0";
    uint256 public constant MIN_QUORUM = 2;
    uint256 public constant MAX_QUORUM = 15;
    uint256 public constant RESPONSE_PERIOD = 1 days;
    uint256 public constant COMMIT_PERIOD = 3 days;
    uint256 public constant REVEAL_PERIOD = 1 days;

    enum AdjudicationPhase {
        Unknown,
        ResponseOpen,
        CommitOpen,
        RevealOpen,
        Finalized,
        ExpiredNoQuorum
    }

    struct CommitmentRecord {
        bytes32 challengeId;
        address validator;
        bytes32 commitmentHash;
        uint64 committedAt;
        bool revealed;
        bool exists;
    }

    struct VerdictRecord {
        bytes32 challengeId;
        address validator;
        bool claimedUpheld;
        bytes32 verdictHash;
        bytes32 methodHash;
        bytes32 operatorGroupHash;
        bytes32 runnerFingerprintHash;
        uint64 revealedAt;
        bool exists;
    }

    struct AdjudicationState {
        bytes32 responseHash;
        address respondent;
        uint64 responseSubmittedAt;
        uint32 responseCount;
        uint32 commitmentCount;
        uint32 revealCount;
        bool finalized;
        bool expired;
        bool outcome;
        uint32 effectiveVerdictCount;
        bytes32 finalReportHash;
        bytes32 expirationReportHash;
        uint64 finalizedAt;
        uint64 expiredAt;
        bool phaseStartedEmitted;
    }

    VerificationRegistry public immutable verificationRegistry;
    IdentityRegistry public immutable identityRegistry;
    address public immutable owner;
    uint256 public quorum = 3;

    mapping(bytes32 challengeId => bool started) public adjudicationStarted;
    mapping(bytes32 challengeId => AdjudicationState state) private _adjudications;
    mapping(bytes32 challengeId => bytes32[] hashes) public responseHashes;
    mapping(bytes32 challengeId => mapping(bytes32 responseHash => bool submitted)) public responseHashSubmitted;
    mapping(bytes32 challengeId => mapping(address validator => CommitmentRecord commitment)) private _commitments;
    mapping(bytes32 challengeId => mapping(address validator => VerdictRecord verdict)) private _verdicts;
    mapping(bytes32 challengeId => address[] validators) public validatorsByChallenge;

    event ChallengeResponseSubmitted(
        bytes32 indexed challengeId,
        bytes32 indexed evidenceId,
        address indexed respondent,
        bytes32 responseHash,
        uint64 responseSubmittedAt
    );
    event AdjudicationPhaseStarted(
        bytes32 indexed challengeId,
        uint64 commitStart,
        uint64 responseBy,
        uint64 commitBy,
        uint64 revealBy
    );
    event ValidatorVerdictCommitted(
        bytes32 indexed challengeId,
        address indexed validator,
        bytes32 commitmentHash
    );
    event ValidatorVerdictRevealed(
        bytes32 indexed challengeId,
        address indexed validator,
        bool claimedUpheld,
        bytes32 verdictHash,
        bytes32 methodHash,
        bytes32 operatorGroupHash,
        bytes32 runnerFingerprintHash
    );
    event ChallengeAdjudicationFinalized(
        bytes32 indexed challengeId,
        bool claimedUpheld,
        bytes32 finalReportHash,
        address indexed finalizer,
        uint32 effectiveVerdictCount
    );
    event ChallengeAdjudicationExpiredNoQuorum(
        bytes32 indexed challengeId,
        bytes32 expirationReportHash,
        address indexed expirer
    );
    event ChallengeAdjudicationSplitVote(bytes32 indexed challengeId, uint32 upheldCount, uint32 rejectedCount);
    event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum);

    error ChallengeAlreadyFinalized(bytes32 challengeId);
    error ChallengeAlreadyExpired(bytes32 challengeId);
    error ChallengeNotSubmitted(bytes32 challengeId);
    error DuplicateResponse(bytes32 challengeId, bytes32 responseHash);
    error DuplicateCommitment(bytes32 challengeId, address validator);
    error CommitmentNotFound(bytes32 challengeId, address validator);
    error CommitmentAlreadyRevealed(bytes32 challengeId, address validator);
    error CommitmentMismatch(bytes32 expected, bytes32 actual);
    error EmptyHash();
    error InvalidPhase(bytes32 challengeId, AdjudicationPhase currentPhase);
    error InvalidQuorum(uint256 quorum);
    error NotEvidenceReporter(address caller, address reporter);
    error NotOwner(address caller);
    error NotQualifiedValidator(address validator);
    error QuorumMet(bytes32 challengeId, uint32 upheldCount, uint32 rejectedCount, uint256 quorum);
    error QuorumNotMet(bytes32 challengeId, bool claimedUpheld, uint256 effectiveVerdictCount, uint256 quorum);

    constructor(VerificationRegistry verificationRegistry_) {
        verificationRegistry = verificationRegistry_;
        identityRegistry = verificationRegistry_.identityRegistry();
        owner = msg.sender;
    }

    function setQuorum(uint256 newQuorum) external onlyOwner {
        if (newQuorum < MIN_QUORUM || newQuorum > MAX_QUORUM) {
            revert InvalidQuorum(newQuorum);
        }
        uint256 oldQuorum = quorum;
        quorum = newQuorum;
        emit QuorumUpdated(oldQuorum, newQuorum);
    }

    function submitResponse(bytes32 challengeId, bytes32 responseHash) external {
        if (responseHash == bytes32(0)) {
            revert EmptyHash();
        }
        bytes32 evidenceId = _requireSubmittedChallenge(challengeId);
        AdjudicationState storage state = _adjudications[challengeId];
        _requireOpen(challengeId, state);
        if (_currentPhase(challengeId, state) != AdjudicationPhase.ResponseOpen) {
            revert InvalidPhase(challengeId, _currentPhase(challengeId, state));
        }
        address reporter = verificationRegistry.evidenceReporter(evidenceId);
        if (msg.sender != reporter || reporter == address(0)) {
            revert NotEvidenceReporter(msg.sender, reporter);
        }
        if (responseHashSubmitted[challengeId][responseHash]) {
            revert DuplicateResponse(challengeId, responseHash);
        }

        adjudicationStarted[challengeId] = true;
        responseHashSubmitted[challengeId][responseHash] = true;
        responseHashes[challengeId].push(responseHash);
        state.responseHash = responseHash;
        state.respondent = msg.sender;
        state.responseSubmittedAt = uint64(block.timestamp);
        state.responseCount += 1;
        emit ChallengeResponseSubmitted(challengeId, evidenceId, msg.sender, responseHash, state.responseSubmittedAt);
    }

    function commitVerdict(bytes32 challengeId, bytes32 commitmentHash) external {
        if (commitmentHash == bytes32(0)) {
            revert EmptyHash();
        }
        _requireSubmittedChallenge(challengeId);
        AdjudicationState storage state = _adjudications[challengeId];
        _requireOpen(challengeId, state);
        if (_currentPhase(challengeId, state) != AdjudicationPhase.CommitOpen) {
            revert InvalidPhase(challengeId, _currentPhase(challengeId, state));
        }
        _qualifiedValidatorProfile(msg.sender);
        if (_commitments[challengeId][msg.sender].exists) {
            revert DuplicateCommitment(challengeId, msg.sender);
        }

        adjudicationStarted[challengeId] = true;
        _emitPhaseStarted(challengeId, state);
        _commitments[challengeId][msg.sender] = CommitmentRecord({
            challengeId: challengeId,
            validator: msg.sender,
            commitmentHash: commitmentHash,
            committedAt: uint64(block.timestamp),
            revealed: false,
            exists: true
        });
        validatorsByChallenge[challengeId].push(msg.sender);
        state.commitmentCount += 1;
        emit ValidatorVerdictCommitted(challengeId, msg.sender, commitmentHash);
    }

    function revealVerdict(
        bytes32 challengeId,
        bool claimedUpheld,
        bytes32 verdictHash,
        bytes32 methodHash,
        bytes32 salt
    ) external {
        if (verdictHash == bytes32(0) || methodHash == bytes32(0) || salt == bytes32(0)) {
            revert EmptyHash();
        }
        _requireSubmittedChallenge(challengeId);
        _requirePhase(challengeId, AdjudicationPhase.RevealOpen);
        _markCommitmentRevealed(challengeId, claimedUpheld, verdictHash, methodHash, salt);
        _recordVerdict(challengeId, claimedUpheld, verdictHash, methodHash);
        _adjudications[challengeId].revealCount += 1;
    }

    function finalizeChallenge(bytes32 challengeId, bool claimedUpheld, bytes32 finalReportHash) external {
        if (finalReportHash == bytes32(0)) {
            revert EmptyHash();
        }
        _requireSubmittedChallenge(challengeId);
        AdjudicationState storage state = _adjudications[challengeId];
        _requireOpen(challengeId, state);
        uint32 targetVerdictCount = _effectiveVerdictCount(challengeId, claimedUpheld);
        if (targetVerdictCount < quorum) {
            revert QuorumNotMet(challengeId, claimedUpheld, targetVerdictCount, quorum);
        }

        uint32 upheldCount = _effectiveVerdictCount(challengeId, true);
        uint32 rejectedCount = _effectiveVerdictCount(challengeId, false);
        if (upheldCount >= quorum && rejectedCount >= quorum) {
            emit ChallengeAdjudicationSplitVote(challengeId, upheldCount, rejectedCount);
        }

        state.finalized = true;
        state.outcome = claimedUpheld;
        state.effectiveVerdictCount = targetVerdictCount;
        state.finalReportHash = finalReportHash;
        state.finalizedAt = uint64(block.timestamp);
        emit ChallengeAdjudicationFinalized(challengeId, claimedUpheld, finalReportHash, msg.sender, targetVerdictCount);
        verificationRegistry.resolveChallengeFromAdjudicator(challengeId, claimedUpheld, finalReportHash);
    }

    function expireChallengeNoQuorum(bytes32 challengeId, bytes32 expirationReportHash) external {
        if (expirationReportHash == bytes32(0)) {
            revert EmptyHash();
        }
        _requireSubmittedChallenge(challengeId);
        AdjudicationState storage state = _adjudications[challengeId];
        _requireOpen(challengeId, state);
        (,, uint64 revealBy) = adjudicationDeadlines(challengeId);
        if (block.timestamp <= revealBy) {
            revert InvalidPhase(challengeId, _currentPhase(challengeId, state));
        }

        uint32 upheldCount = _effectiveVerdictCount(challengeId, true);
        uint32 rejectedCount = _effectiveVerdictCount(challengeId, false);
        if (upheldCount >= quorum || rejectedCount >= quorum) {
            revert QuorumMet(challengeId, upheldCount, rejectedCount, quorum);
        }

        state.expired = true;
        state.expirationReportHash = expirationReportHash;
        state.expiredAt = uint64(block.timestamp);
        emit ChallengeAdjudicationExpiredNoQuorum(challengeId, expirationReportHash, msg.sender);
    }

    function computeCommitmentHash(
        bytes32 challengeId,
        address validator,
        bool claimedUpheld,
        bytes32 verdictHash,
        bytes32 methodHash,
        bytes32 salt
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(challengeId, validator, claimedUpheld, verdictHash, methodHash, salt));
    }

    function adjudicationPhase(bytes32 challengeId) external view returns (AdjudicationPhase) {
        return _currentPhase(challengeId, _adjudications[challengeId]);
    }

    function adjudicationDeadlines(bytes32 challengeId) public view returns (
        uint64 responseBy,
        uint64 commitBy,
        uint64 revealBy
    ) {
        (,,,,, uint64 submittedAt,,,) = verificationRegistry.challenges(challengeId);
        responseBy = uint64(uint256(submittedAt) + RESPONSE_PERIOD);
        uint64 commitStart = _adjudications[challengeId].responseSubmittedAt != 0
            ? _adjudications[challengeId].responseSubmittedAt
            : responseBy;
        commitBy = uint64(uint256(commitStart) + COMMIT_PERIOD);
        revealBy = uint64(uint256(commitBy) + REVEAL_PERIOD);
    }

    function responseHashCount(bytes32 challengeId) external view returns (uint256) {
        return responseHashes[challengeId].length;
    }

    function validatorCount(bytes32 challengeId) external view returns (uint256) {
        return validatorsByChallenge[challengeId].length;
    }

    function effectiveVerdictCount(bytes32 challengeId, bool claimedUpheld) external view returns (uint32) {
        return _effectiveVerdictCount(challengeId, claimedUpheld);
    }

    function adjudicationResponse(bytes32 challengeId) external view returns (
        bytes32 responseHash,
        address respondent,
        uint64 responseSubmittedAt
    ) {
        AdjudicationState storage state = _adjudications[challengeId];
        return (state.responseHash, state.respondent, state.responseSubmittedAt);
    }

    function adjudicationCounters(bytes32 challengeId) external view returns (
        uint32 responseCount,
        uint32 commitmentCount,
        uint32 revealCount
    ) {
        AdjudicationState storage state = _adjudications[challengeId];
        return (state.responseCount, state.commitmentCount, state.revealCount);
    }

    function adjudicationResult(bytes32 challengeId) external view returns (
        bool finalized,
        bool expired,
        bool outcome,
        uint32 effectiveVerdictCount_,
        bytes32 finalReportHash,
        bytes32 expirationReportHash,
        uint64 finalizedAt,
        uint64 expiredAt
    ) {
        AdjudicationState storage state = _adjudications[challengeId];
        return (
            state.finalized,
            state.expired,
            state.outcome,
            state.effectiveVerdictCount,
            state.finalReportHash,
            state.expirationReportHash,
            state.finalizedAt,
            state.expiredAt
        );
    }

    function commitmentOf(bytes32 challengeId, address validator) external view returns (
        bytes32 commitmentHash,
        uint64 committedAt,
        bool revealed,
        bool exists
    ) {
        CommitmentRecord storage commitment = _commitments[challengeId][validator];
        return (commitment.commitmentHash, commitment.committedAt, commitment.revealed, commitment.exists);
    }

    function verdictOf(bytes32 challengeId, address validator) external view returns (
        bool claimedUpheld,
        bytes32 verdictHash,
        bytes32 methodHash,
        bytes32 operatorGroupHash,
        bytes32 runnerFingerprintHash,
        uint64 revealedAt,
        bool exists
    ) {
        VerdictRecord storage verdict = _verdicts[challengeId][validator];
        return (
            verdict.claimedUpheld,
            verdict.verdictHash,
            verdict.methodHash,
            verdict.operatorGroupHash,
            verdict.runnerFingerprintHash,
            verdict.revealedAt,
            verdict.exists
        );
    }

    function _requireSubmittedChallenge(bytes32 challengeId) private view returns (bytes32 evidenceId) {
        (
            bytes32 storedChallengeId,
            bytes32 storedEvidenceId,
            ,
            ,
            ,
            ,
            ,
            ,
            VerificationRegistry.ChallengeStatus status
        ) = verificationRegistry.challenges(challengeId);
        if (storedChallengeId != challengeId || status != VerificationRegistry.ChallengeStatus.Submitted) {
            revert ChallengeNotSubmitted(challengeId);
        }
        return storedEvidenceId;
    }

    function _qualifiedValidatorProfile(address validator) private view returns (
        bytes32 operatorGroupHash,
        bytes32 runnerFingerprintHash
    ) {
        bool allowed;
        bool profileExists;
        (operatorGroupHash, runnerFingerprintHash, allowed, profileExists) = verificationRegistry.validatorProfiles(validator);
        (IdentityRegistry.IdentityRole role,,, bool identityExists) = identityRegistry.identities(validator);
        if (
            !profileExists ||
            !allowed ||
            !identityExists ||
            role != IdentityRegistry.IdentityRole.Validator ||
            operatorGroupHash == bytes32(0) ||
            runnerFingerprintHash == bytes32(0)
        ) {
            revert NotQualifiedValidator(validator);
        }
    }

    function _markCommitmentRevealed(
        bytes32 challengeId,
        bool claimedUpheld,
        bytes32 verdictHash,
        bytes32 methodHash,
        bytes32 salt
    ) private {
        CommitmentRecord storage commitment = _commitments[challengeId][msg.sender];
        if (!commitment.exists) {
            revert CommitmentNotFound(challengeId, msg.sender);
        }
        if (commitment.revealed) {
            revert CommitmentAlreadyRevealed(challengeId, msg.sender);
        }
        bytes32 expected = computeCommitmentHash(challengeId, msg.sender, claimedUpheld, verdictHash, methodHash, salt);
        if (expected != commitment.commitmentHash) {
            revert CommitmentMismatch(expected, commitment.commitmentHash);
        }
        commitment.revealed = true;
    }

    function _requirePhase(bytes32 challengeId, AdjudicationPhase expectedPhase) private view {
        AdjudicationState storage state = _adjudications[challengeId];
        _requireOpen(challengeId, state);
        AdjudicationPhase currentPhase = _currentPhase(challengeId, state);
        if (currentPhase != expectedPhase) {
            revert InvalidPhase(challengeId, currentPhase);
        }
    }

    function _recordVerdict(
        bytes32 challengeId,
        bool claimedUpheld,
        bytes32 verdictHash,
        bytes32 methodHash
    ) private {
        (bytes32 operatorGroupHash, bytes32 runnerFingerprintHash) = _qualifiedValidatorProfile(msg.sender);
        _verdicts[challengeId][msg.sender] = VerdictRecord({
            challengeId: challengeId,
            validator: msg.sender,
            claimedUpheld: claimedUpheld,
            verdictHash: verdictHash,
            methodHash: methodHash,
            operatorGroupHash: operatorGroupHash,
            runnerFingerprintHash: runnerFingerprintHash,
            revealedAt: uint64(block.timestamp),
            exists: true
        });
        emit ValidatorVerdictRevealed(
            challengeId,
            msg.sender,
            claimedUpheld,
            verdictHash,
            methodHash,
            operatorGroupHash,
            runnerFingerprintHash
        );
    }

    function _currentPhase(
        bytes32 challengeId,
        AdjudicationState storage state
    ) private view returns (AdjudicationPhase) {
        if (state.finalized) {
            return AdjudicationPhase.Finalized;
        }
        if (state.expired) {
            return AdjudicationPhase.ExpiredNoQuorum;
        }
        (uint64 responseBy, uint64 commitBy, uint64 revealBy) = adjudicationDeadlines(challengeId);
        if (block.timestamp <= responseBy && state.responseSubmittedAt == 0) {
            return AdjudicationPhase.ResponseOpen;
        }
        if (block.timestamp <= commitBy) {
            return AdjudicationPhase.CommitOpen;
        }
        if (block.timestamp <= revealBy) {
            return AdjudicationPhase.RevealOpen;
        }
        return AdjudicationPhase.Unknown;
    }

    function _effectiveVerdictCount(bytes32 challengeId, bool claimedUpheld) private view returns (uint32) {
        address[] storage validators = validatorsByChallenge[challengeId];
        uint32 count = 0;
        for (uint256 index = 0; index < validators.length; index += 1) {
            VerdictRecord storage verdict = _verdicts[challengeId][validators[index]];
            if (verdict.exists && verdict.claimedUpheld == claimedUpheld) {
                count += 1;
            }
        }
        return count;
    }

    function _emitPhaseStarted(bytes32 challengeId, AdjudicationState storage state) private {
        if (state.phaseStartedEmitted) {
            return;
        }
        (uint64 responseBy, uint64 commitBy, uint64 revealBy) = adjudicationDeadlines(challengeId);
        uint64 commitStart = state.responseSubmittedAt != 0 ? state.responseSubmittedAt : responseBy;
        state.phaseStartedEmitted = true;
        emit AdjudicationPhaseStarted(challengeId, commitStart, responseBy, commitBy, revealBy);
    }

    function _requireOpen(bytes32 challengeId, AdjudicationState storage state) private view {
        if (state.finalized) {
            revert ChallengeAlreadyFinalized(challengeId);
        }
        if (state.expired) {
            revert ChallengeAlreadyExpired(challengeId);
        }
    }

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert NotOwner(msg.sender);
        }
        _;
    }
}
