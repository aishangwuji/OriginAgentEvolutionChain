// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract EvolutionUnitKindRegistry {
    string public constant VERSION = "ec11.0.0";

    enum KindStatus {
        None,
        Draft,
        Experimental,
        Candidate,
        Canonical,
        Deprecated,
        Rejected
    }

    struct UnitKindRecord {
        bytes32 kindIdHash;
        bytes32 versionHash;
        bytes32 schemaHash;
        bytes32 proposalHash;
        bytes32 reviewReportHash;
        KindStatus status;
        address submitter;
        uint64 registeredAt;
        uint64 updatedAt;
    }

    address public immutable owner;

    mapping(bytes32 kindVersionKey => UnitKindRecord record) public kinds;

    event EvolutionUnitKindProposed(
        bytes32 indexed kindVersionKey,
        bytes32 indexed kindIdHash,
        bytes32 versionHash,
        bytes32 schemaHash,
        bytes32 proposalHash,
        address indexed submitter
    );

    event EvolutionUnitKindReviewSet(
        bytes32 indexed kindVersionKey,
        bytes32 indexed kindIdHash,
        bytes32 versionHash,
        bytes32 reviewReportHash
    );

    event EvolutionUnitKindStatusChanged(
        bytes32 indexed kindVersionKey,
        bytes32 indexed kindIdHash,
        bytes32 versionHash,
        KindStatus previousStatus,
        KindStatus newStatus
    );

    error EmptyHash();
    error InvalidStatus(KindStatus status);
    error KindAlreadyProposed(bytes32 kindVersionKey);
    error KindNotFound(bytes32 kindVersionKey);
    error NotOwner(address caller);

    constructor() {
        owner = msg.sender;
    }

    function kindVersionKey(bytes32 kindIdHash, bytes32 versionHash) public pure returns (bytes32) {
        return keccak256(abi.encode(kindIdHash, versionHash));
    }

    function proposeKind(
        bytes32 kindIdHash,
        bytes32 versionHash,
        bytes32 schemaHash,
        bytes32 proposalHash
    ) external returns (bytes32) {
        _requireNonZero(kindIdHash);
        _requireNonZero(versionHash);
        _requireNonZero(schemaHash);
        _requireNonZero(proposalHash);

        bytes32 key = kindVersionKey(kindIdHash, versionHash);
        if (kinds[key].status != KindStatus.None) {
            revert KindAlreadyProposed(key);
        }

        kinds[key] = UnitKindRecord({
            kindIdHash: kindIdHash,
            versionHash: versionHash,
            schemaHash: schemaHash,
            proposalHash: proposalHash,
            reviewReportHash: bytes32(0),
            status: KindStatus.Draft,
            submitter: msg.sender,
            registeredAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp)
        });
        emit EvolutionUnitKindProposed(key, kindIdHash, versionHash, schemaHash, proposalHash, msg.sender);
        return key;
    }

    function setReviewReport(bytes32 kindIdHash, bytes32 versionHash, bytes32 reviewReportHash) external onlyOwner {
        _requireNonZero(reviewReportHash);
        bytes32 key = kindVersionKey(kindIdHash, versionHash);
        UnitKindRecord storage record = _existingKind(key);
        record.reviewReportHash = reviewReportHash;
        record.updatedAt = uint64(block.timestamp);
        emit EvolutionUnitKindReviewSet(key, kindIdHash, versionHash, reviewReportHash);
    }

    function setKindStatus(bytes32 kindIdHash, bytes32 versionHash, KindStatus status) external onlyOwner {
        if (status == KindStatus.None) {
            revert InvalidStatus(status);
        }
        bytes32 key = kindVersionKey(kindIdHash, versionHash);
        UnitKindRecord storage record = _existingKind(key);
        KindStatus previousStatus = record.status;
        record.status = status;
        record.updatedAt = uint64(block.timestamp);
        emit EvolutionUnitKindStatusChanged(key, kindIdHash, versionHash, previousStatus, status);
    }

    function kindExists(bytes32 kindIdHash, bytes32 versionHash) external view returns (bool) {
        return kinds[kindVersionKey(kindIdHash, versionHash)].status != KindStatus.None;
    }

    function _existingKind(bytes32 key) private view returns (UnitKindRecord storage) {
        UnitKindRecord storage record = kinds[key];
        if (record.status == KindStatus.None) {
            revert KindNotFound(key);
        }
        return record;
    }

    function _requireNonZero(bytes32 value) private pure {
        if (value == bytes32(0)) {
            revert EmptyHash();
        }
    }

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert NotOwner(msg.sender);
        }
        _;
    }
}
