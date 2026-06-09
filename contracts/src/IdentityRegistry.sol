// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract IdentityRegistry {
    enum IdentityRole {
        Unknown,
        Developer,
        Validator,
        Operator
    }

    struct Identity {
        IdentityRole role;
        bytes32 metadataHash;
        uint64 registeredAt;
        bool exists;
    }

    mapping(address subject => Identity identity) public identities;

    event IdentityRegistered(address indexed subject, IdentityRole role, bytes32 metadataHash);

    error AlreadyRegistered(address subject);
    error InvalidRole(uint8 role);
    error EmptyMetadataHash();

    function registerIdentity(IdentityRole role, bytes32 metadataHash) external {
        if (identities[msg.sender].exists) {
            revert AlreadyRegistered(msg.sender);
        }
        if (role == IdentityRole.Unknown || uint8(role) > uint8(IdentityRole.Operator)) {
            revert InvalidRole(uint8(role));
        }
        if (metadataHash == bytes32(0)) {
            revert EmptyMetadataHash();
        }

        identities[msg.sender] = Identity({
            role: role,
            metadataHash: metadataHash,
            registeredAt: uint64(block.timestamp),
            exists: true
        });
        emit IdentityRegistered(msg.sender, role, metadataHash);
    }

    function isRegistered(address subject) external view returns (bool) {
        return identities[subject].exists;
    }
}
