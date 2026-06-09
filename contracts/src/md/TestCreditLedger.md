// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentPassportRegistry} from "./AgentPassportRegistry.sol";

contract TestCreditLedger {
    string public constant VERSION = "ec14.0.0";

    struct CreditAccount {
        uint64 granted;
        uint64 consumed;
        uint64 balance;
        uint32 operationCount;
        bool exists;
    }

    AgentPassportRegistry public immutable agentPassportRegistry;
    address public immutable owner;

    mapping(bytes32 passportId => CreditAccount account) public credits;
    mapping(bytes32 actionHash => bool used) public usedActionHashes;

    event TestCreditGranted(
        bytes32 indexed passportId,
        uint64 amount,
        bytes32 actionHash,
        bytes32 trustPolicyReportHash,
        uint32 operationIndex
    );
    event TestCreditConsumed(
        bytes32 indexed passportId,
        uint64 amount,
        bytes32 actionHash,
        bytes32 trustPolicyReportHash,
        uint32 operationIndex
    );

    error EmptyHash();
    error InvalidAmount();
    error InsufficientBalance(bytes32 passportId, uint64 balance, uint64 requested);
    error NotOwner(address caller);
    error PassportNotFound(bytes32 passportId);
    error ActionAlreadyUsed(bytes32 actionHash);

    constructor(AgentPassportRegistry agentPassportRegistry_) {
        agentPassportRegistry = agentPassportRegistry_;
        owner = msg.sender;
    }

    function grantCredit(
        bytes32 passportId,
        uint64 amount,
        bytes32 actionHash,
        bytes32 trustPolicyReportHash
    ) external onlyOwner returns (uint32) {
        _validateOperation(passportId, amount, actionHash, trustPolicyReportHash);

        CreditAccount storage account = credits[passportId];
        account.granted += amount;
        account.balance += amount;
        account.operationCount += 1;
        account.exists = true;
        usedActionHashes[actionHash] = true;

        emit TestCreditGranted(passportId, amount, actionHash, trustPolicyReportHash, account.operationCount);
        return account.operationCount;
    }

    function consumeCredit(
        bytes32 passportId,
        uint64 amount,
        bytes32 actionHash,
        bytes32 trustPolicyReportHash
    ) external onlyOwner returns (uint32) {
        _validateOperation(passportId, amount, actionHash, trustPolicyReportHash);

        CreditAccount storage account = credits[passportId];
        if (account.balance < amount) {
            revert InsufficientBalance(passportId, account.balance, amount);
        }

        account.consumed += amount;
        account.balance -= amount;
        account.operationCount += 1;
        account.exists = true;
        usedActionHashes[actionHash] = true;

        emit TestCreditConsumed(passportId, amount, actionHash, trustPolicyReportHash, account.operationCount);
        return account.operationCount;
    }

    function _validateOperation(
        bytes32 passportId,
        uint64 amount,
        bytes32 actionHash,
        bytes32 trustPolicyReportHash
    ) private view {
        if (amount == 0) {
            revert InvalidAmount();
        }
        if (actionHash == bytes32(0) || trustPolicyReportHash == bytes32(0)) {
            revert EmptyHash();
        }
        if (usedActionHashes[actionHash]) {
            revert ActionAlreadyUsed(actionHash);
        }
        (,,,,,, bool exists) = agentPassportRegistry.passports(passportId);
        if (!exists) {
            revert PassportNotFound(passportId);
        }
    }

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert NotOwner(msg.sender);
        }
        _;
    }
}
