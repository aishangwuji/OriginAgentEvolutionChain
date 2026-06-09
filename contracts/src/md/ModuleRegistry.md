// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ModuleRegistry {
    enum ModuleType {
        Unknown,
        Skill,
        DomainPack,
        Workflow,
        Tool
    }

    enum ModuleStatus {
        None,
        Submitted
    }

    struct ModuleRecord {
        bytes32 moduleDigest;
        bytes32 moduleIdHash;
        ModuleType moduleType;
        bytes32 versionHash;
        string storageUri;
        address submitter;
        ModuleStatus status;
        uint64 submittedAt;
    }

    mapping(bytes32 moduleDigest => ModuleRecord record) public modules;

    event ModuleSubmitted(
        bytes32 indexed moduleDigest,
        bytes32 indexed moduleIdHash,
        ModuleType moduleType,
        bytes32 versionHash,
        string storageUri,
        address indexed submitter
    );

    error EmptyDigest();
    error EmptyStorageUri();
    error InvalidModuleType(uint8 moduleType);
    error ModuleAlreadySubmitted(bytes32 moduleDigest);
    error UnknownModule(bytes32 moduleDigest);

    function submitModule(
        bytes32 moduleDigest,
        bytes32 moduleIdHash,
        ModuleType moduleType,
        bytes32 versionHash,
        string calldata storageUri
    ) external {
        if (moduleDigest == bytes32(0) || moduleIdHash == bytes32(0) || versionHash == bytes32(0)) {
            revert EmptyDigest();
        }
        if (bytes(storageUri).length == 0) {
            revert EmptyStorageUri();
        }
        if (moduleType == ModuleType.Unknown || uint8(moduleType) > uint8(ModuleType.Tool)) {
            revert InvalidModuleType(uint8(moduleType));
        }
        if (modules[moduleDigest].status != ModuleStatus.None) {
            revert ModuleAlreadySubmitted(moduleDigest);
        }

        modules[moduleDigest] = ModuleRecord({
            moduleDigest: moduleDigest,
            moduleIdHash: moduleIdHash,
            moduleType: moduleType,
            versionHash: versionHash,
            storageUri: storageUri,
            submitter: msg.sender,
            status: ModuleStatus.Submitted,
            submittedAt: uint64(block.timestamp)
        });
        emit ModuleSubmitted(moduleDigest, moduleIdHash, moduleType, versionHash, storageUri, msg.sender);
    }

    function moduleExists(bytes32 moduleDigest) external view returns (bool) {
        return modules[moduleDigest].status != ModuleStatus.None;
    }

    function requireModule(bytes32 moduleDigest) external view {
        if (modules[moduleDigest].status == ModuleStatus.None) {
            revert UnknownModule(moduleDigest);
        }
    }
}
