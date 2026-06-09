// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ModuleRegistry} from "./ModuleRegistry.sol";

contract ScoreCommitReveal {
    struct ScoreRecord {
        bytes32 commitHash;
        bytes32 reasonHash;
        bytes32 salt;
        uint8 score;
        bool committed;
        bool revealed;
    }

    ModuleRegistry public immutable moduleRegistry;
    mapping(bytes32 moduleDigest => mapping(address scorer => ScoreRecord record)) public scores;

    event ScoreCommitted(bytes32 indexed moduleDigest, address indexed scorer, bytes32 commitHash);
    event ScoreRevealed(bytes32 indexed moduleDigest, address indexed scorer, uint8 score, bytes32 reasonHash);

    error EmptyHash();
    error ScoreAlreadyCommitted(bytes32 moduleDigest, address scorer);
    error ScoreNotCommitted(bytes32 moduleDigest, address scorer);
    error ScoreAlreadyRevealed(bytes32 moduleDigest, address scorer);
    error InvalidScore(uint8 score);
    error CommitMismatch(bytes32 expected, bytes32 actual);

    constructor(ModuleRegistry moduleRegistry_) {
        moduleRegistry = moduleRegistry_;
    }

    function commitScore(bytes32 moduleDigest, bytes32 commitHash) external {
        moduleRegistry.requireModule(moduleDigest);
        if (commitHash == bytes32(0)) {
            revert EmptyHash();
        }
        if (scores[moduleDigest][msg.sender].committed) {
            revert ScoreAlreadyCommitted(moduleDigest, msg.sender);
        }

        scores[moduleDigest][msg.sender].commitHash = commitHash;
        scores[moduleDigest][msg.sender].committed = true;
        emit ScoreCommitted(moduleDigest, msg.sender, commitHash);
    }

    function revealScore(bytes32 moduleDigest, uint8 score, bytes32 reasonHash, bytes32 salt) external {
        moduleRegistry.requireModule(moduleDigest);
        ScoreRecord storage record = scores[moduleDigest][msg.sender];
        if (!record.committed) {
            revert ScoreNotCommitted(moduleDigest, msg.sender);
        }
        if (record.revealed) {
            revert ScoreAlreadyRevealed(moduleDigest, msg.sender);
        }
        if (score > 100) {
            revert InvalidScore(score);
        }

        bytes32 expected = computeCommitHash(score, reasonHash, salt);
        if (expected != record.commitHash) {
            revert CommitMismatch(expected, record.commitHash);
        }

        record.score = score;
        record.reasonHash = reasonHash;
        record.salt = salt;
        record.revealed = true;
        emit ScoreRevealed(moduleDigest, msg.sender, score, reasonHash);
    }

    function computeCommitHash(uint8 score, bytes32 reasonHash, bytes32 salt) public pure returns (bytes32) {
        return sha256(abi.encodePacked(score, reasonHash, salt));
    }
}
