// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentPassportRegistry} from "./AgentPassportRegistry.sol";

contract AgentReputationRegistry {
    string public constant VERSION = "ec10.0.0";

    struct ReputationCheckpoint {
        int32 score;
        uint32 positiveCount;
        uint32 negativeCount;
        bytes32 reportHash;
        uint32 checkpointCount;
        bool exists;
    }

    AgentPassportRegistry public immutable agentPassportRegistry;
    address public immutable owner;

    mapping(bytes32 passportId => ReputationCheckpoint checkpoint) public reputations;

    event AgentReputationCheckpointed(
        bytes32 indexed passportId,
        int32 score,
        uint32 positiveCount,
        uint32 negativeCount,
        bytes32 reportHash,
        uint32 checkpointIndex
    );

    error EmptyReportHash();
    error NotOwner(address caller);
    error PassportNotFound(bytes32 passportId);

    constructor(AgentPassportRegistry agentPassportRegistry_) {
        agentPassportRegistry = agentPassportRegistry_;
        owner = msg.sender;
    }

    function checkpointReputation(
        bytes32 passportId,
        int32 score,
        uint32 positiveCount,
        uint32 negativeCount,
        bytes32 reportHash
    ) external onlyOwner returns (uint32) {
        if (reportHash == bytes32(0)) {
            revert EmptyReportHash();
        }
        (,,,,,, bool exists) = agentPassportRegistry.passports(passportId);
        if (!exists) {
            revert PassportNotFound(passportId);
        }

        ReputationCheckpoint storage checkpoint = reputations[passportId];
        checkpoint.score = score;
        checkpoint.positiveCount = positiveCount;
        checkpoint.negativeCount = negativeCount;
        checkpoint.reportHash = reportHash;
        checkpoint.checkpointCount += 1;
        checkpoint.exists = true;

        emit AgentReputationCheckpointed(
            passportId,
            score,
            positiveCount,
            negativeCount,
            reportHash,
            checkpoint.checkpointCount
        );
        return checkpoint.checkpointCount;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert NotOwner(msg.sender);
        }
        _;
    }
}
