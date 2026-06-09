// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AgentPassportRegistry {
    string public constant VERSION = "ec8.0.0";

    struct PassportRecord {
        address owner;
        bytes32 agentKeyHash;
        bytes32 genesisHash;
        bytes32 metadataHash;
        uint64 registeredAt;
        uint32 migrationCount;
        bool exists;
    }

    mapping(bytes32 passportId => PassportRecord passport) public passports;

    event AgentPassportRegistered(
        bytes32 indexed passportId,
        address indexed owner,
        bytes32 agentKeyHash,
        bytes32 genesisHash,
        bytes32 metadataHash
    );
    event AgentPassportMigrationRecorded(
        bytes32 indexed passportId,
        address indexed owner,
        bytes32 oldAgentKeyHash,
        bytes32 newAgentKeyHash,
        bytes32 migrationHash,
        uint32 migrationIndex
    );

    error EmptyAgentKeyHash();
    error EmptyGenesisHash();
    error EmptyMigrationHash();
    error PassportAlreadyRegistered(bytes32 passportId);
    error PassportNotFound(bytes32 passportId);
    error NotPassportOwner(bytes32 passportId, address actor);
    error NoopMigration(bytes32 passportId);

    function computePassportId(
        address owner,
        bytes32 agentKeyHash,
        bytes32 genesisHash
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(owner, agentKeyHash, genesisHash));
    }

    function computeGenesisHash(
        address owner,
        bytes32 agentKeyHash,
        bytes32 genesisNonce,
        bytes32 metadataHash
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(owner, agentKeyHash, genesisNonce, metadataHash));
    }

    function computeMigrationHash(
        bytes32 passportId,
        bytes32 oldAgentKeyHash,
        bytes32 newAgentKeyHash,
        bytes32 migrationNonce
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(passportId, oldAgentKeyHash, newAgentKeyHash, migrationNonce));
    }

    function registerAgentPassport(
        bytes32 agentKeyHash,
        bytes32 genesisHash,
        bytes32 metadataHash
    ) external returns (bytes32) {
        if (agentKeyHash == bytes32(0)) {
            revert EmptyAgentKeyHash();
        }
        if (genesisHash == bytes32(0)) {
            revert EmptyGenesisHash();
        }

        bytes32 passportId = computePassportId(msg.sender, agentKeyHash, genesisHash);
        if (passports[passportId].exists) {
            revert PassportAlreadyRegistered(passportId);
        }

        passports[passportId] = PassportRecord({
            owner: msg.sender,
            agentKeyHash: agentKeyHash,
            genesisHash: genesisHash,
            metadataHash: metadataHash,
            registeredAt: uint64(block.timestamp),
            migrationCount: 0,
            exists: true
        });

        emit AgentPassportRegistered(passportId, msg.sender, agentKeyHash, genesisHash, metadataHash);
        return passportId;
    }

    function recordAgentMigration(
        bytes32 passportId,
        bytes32 newAgentKeyHash,
        bytes32 migrationHash
    ) external returns (uint32) {
        PassportRecord storage passport = passports[passportId];
        if (!passport.exists) {
            revert PassportNotFound(passportId);
        }
        if (passport.owner != msg.sender) {
            revert NotPassportOwner(passportId, msg.sender);
        }
        if (newAgentKeyHash == bytes32(0)) {
            revert EmptyAgentKeyHash();
        }
        if (migrationHash == bytes32(0)) {
            revert EmptyMigrationHash();
        }
        bytes32 oldAgentKeyHash = passport.agentKeyHash;
        if (oldAgentKeyHash == newAgentKeyHash) {
            revert NoopMigration(passportId);
        }

        passport.agentKeyHash = newAgentKeyHash;
        passport.migrationCount += 1;

        emit AgentPassportMigrationRecorded(
            passportId,
            msg.sender,
            oldAgentKeyHash,
            newAgentKeyHash,
            migrationHash,
            passport.migrationCount
        );
        return passport.migrationCount;
    }
}
