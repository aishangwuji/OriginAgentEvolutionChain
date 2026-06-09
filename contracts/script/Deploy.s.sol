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
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract Deploy {
    address private constant HEVM_ADDRESS = address(uint160(uint256(keccak256("hevm cheat code"))));

    function run()
        external
        returns (
            IdentityRegistry identityRegistry,
            AgentPassportRegistry agentPassportRegistry,
            AgentReputationRegistry agentReputationRegistry,
            EvolutionUnitKindRegistry evolutionUnitKindRegistry,
            ModuleRegistry moduleRegistry,
            VerificationRegistry verificationRegistry,
            ScoreCommitReveal scoreCommitReveal,
            TestCreditLedger testCreditLedger,
            ChallengeAdjudicationRegistry challengeAdjudicationRegistry
        )
    {
        Vm vm = Vm(HEVM_ADDRESS);
        vm.startBroadcast();
        identityRegistry = new IdentityRegistry();
        agentPassportRegistry = new AgentPassportRegistry();
        agentReputationRegistry = new AgentReputationRegistry(agentPassportRegistry);
        evolutionUnitKindRegistry = new EvolutionUnitKindRegistry();
        moduleRegistry = new ModuleRegistry();
        verificationRegistry = new VerificationRegistry(moduleRegistry, identityRegistry);
        scoreCommitReveal = new ScoreCommitReveal(moduleRegistry);
        testCreditLedger = new TestCreditLedger(agentPassportRegistry);
        challengeAdjudicationRegistry = new ChallengeAdjudicationRegistry(verificationRegistry);
        verificationRegistry.proposeAdjudicator(address(challengeAdjudicationRegistry));
        vm.stopBroadcast();
    }
}
