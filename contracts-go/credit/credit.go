// Package credit implements the CreditLedger contract for the OriginAgent Evolution Chain.
// It records non-transferable contribution points (formerly TestCredit) by agent passport.
//
// Compliance: This is NOT an ERC20 token. There is no transfer, approve, allowance,
// withdraw, or market functionality. Points cannot be exchanged for fiat currency.
// Points grant access to platform features only.
//
// ChainMaker migration notes:
//   - Solidity onlyOwner grant/consume → Foundation org + authorized orgs
//   - mapping(bytes32 => CreditAccount) → PutState/GetState with CREDIT prefix
package main

import (
	"encoding/json"
	"fmt"

	"chainmaker.org/chainmaker/contract-sdk-go/v2/sdk"
	protogo "chainmaker.org/chainmaker/pb/protogo"

	"originagent-evolution-chain/contracts-go/common"
)

// CreditAccount stores the contribution point balance for a passport.
type CreditAccount struct {
	PassportID    string `json:"passportId"`
	Owner         string `json:"owner"`
	Granted       uint64 `json:"granted"`
	Consumed      uint64 `json:"consumed"`
	Balance       uint64 `json:"balance"`
	OperationCount uint64 `json:"operationCount"`
	Exists        bool   `json:"exists"`
}

// AuthorizedGrantOrgs lists organization IDs allowed to grant points.
var AuthorizedGrantOrgs = []string{FoundationOrgID}

// FoundationOrgID matches identity contract.
const FoundationOrgID = "originagent-foundation"

type CreditLedger struct{}

func (c *CreditLedger) InitContract() protogo.Response {
	return sdk.Success([]byte("CreditLedger initialized"))
}

func (c *CreditLedger) UpgradeContract() protogo.Response {
	return sdk.Success([]byte("CreditLedger upgraded"))
}

func (c *CreditLedger) InvokeContract(method string) protogo.Response {
	switch method {
	case "grant_points":
		return c.grantPoints()
	case "consume_points":
		return c.consumePoints()
	case "get_balance":
		return c.getBalance()
	case "get_account":
		return c.getAccount()
	default:
		return sdk.Error(fmt.Sprintf("unknown method: %s", method))
	}
}

// grantPoints adds contribution points to a passport account. Authorized orgs only.
// Args: passport_id (64 hex), owner (address string), reason_hash (64 hex), amount (uint64)
func (c *CreditLedger) grantPoints() protogo.Response {
	if err := requireAuthorizedGrantOrg(); err != nil {
		return sdk.Error(err.Error())
	}

	args := sdk.Instance.GetArgs()
	passportID := string(args["passport_id"])
	owner := string(args["owner"])
	reasonHash := string(args["reason_hash"])
	amountStr := string(args["amount"])

	if len(passportID) != 64 {
		return sdk.Error("passport_id must be 64 hex characters")
	}
	if owner == "" {
		return sdk.Error("owner is required")
	}

	var amount uint64
	if _, err := fmt.Sscanf(amountStr, "%d", &amount); err != nil || amount == 0 {
		return sdk.Error("amount must be a positive integer")
	}

	key := common.BuildKey(common.PrefixCredit, passportID)
	existing, _ := sdk.Instance.GetStateFromKey(key)

	var account CreditAccount
	if len(existing) > 0 {
		if err := json.Unmarshal([]byte(existing), &account); err != nil {
			return sdk.Error(fmt.Sprintf("failed to unmarshal account: %v", err))
		}
	} else {
		account = CreditAccount{
			PassportID: passportID,
			Owner:      owner,
			Exists:     true,
		}
	}

	account.Granted += amount
	account.Balance += amount
	account.OperationCount++

	data, err := common.ToJSON(account)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to marshal account: %v", err))
	}

	if err := sdk.Instance.PutStateFromKey(key, string(data)); err != nil {
		return sdk.Error(fmt.Sprintf("failed to store account: %v", err))
	}

	sdk.Instance.EmitEvent("PointsGranted", []string{passportID, owner, reasonHash, amountStr})
	return sdk.Success([]byte(fmt.Sprintf(`{"passport_id":"%s","granted":%d,"balance":%d}`, passportID, amount, account.Balance)))
}

// consumePoints deducts contribution points from a passport account. Authorized orgs only.
// Args: passport_id (64 hex), reason_hash (64 hex), amount (uint64)
func (c *CreditLedger) consumePoints() protogo.Response {
	if err := requireAuthorizedGrantOrg(); err != nil {
		return sdk.Error(err.Error())
	}

	args := sdk.Instance.GetArgs()
	passportID := string(args["passport_id"])
	reasonHash := string(args["reason_hash"])
	amountStr := string(args["amount"])

	if len(passportID) != 64 {
		return sdk.Error("passport_id must be 64 hex characters")
	}

	var amount uint64
	if _, err := fmt.Sscanf(amountStr, "%d", &amount); err != nil || amount == 0 {
		return sdk.Error("amount must be a positive integer")
	}

	key := common.BuildKey(common.PrefixCredit, passportID)
	existing, err := sdk.Instance.GetStateFromKey(key)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to read account: %v", err))
	}
	if len(existing) == 0 {
		return sdk.Error("account not found")
	}

	var account CreditAccount
	if err := json.Unmarshal([]byte(existing), &account); err != nil {
		return sdk.Error(fmt.Sprintf("failed to unmarshal: %v", err))
	}

	if account.Balance < amount {
		return sdk.Error(fmt.Sprintf("insufficient points: balance=%d, required=%d", account.Balance, amount))
	}

	account.Consumed += amount
	account.Balance -= amount
	account.OperationCount++

	data, err := common.ToJSON(account)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to marshal: %v", err))
	}

	if err := sdk.Instance.PutStateFromKey(key, string(data)); err != nil {
		return sdk.Error(fmt.Sprintf("failed to store account: %v", err))
	}

	sdk.Instance.EmitEvent("PointsConsumed", []string{passportID, reasonHash, amountStr})
	return sdk.Success([]byte(fmt.Sprintf(`{"passport_id":"%s","consumed":%d,"balance":%d}`, passportID, amount, account.Balance)))
}

// getBalance returns the current point balance for a passport.
// Args: passport_id (64 hex)
func (c *CreditLedger) getBalance() protogo.Response {
	args := sdk.Instance.GetArgs()
	passportID := string(args["passport_id"])
	if len(passportID) != 64 {
		return sdk.Error("passport_id must be 64 hex characters")
	}

	key := common.BuildKey(common.PrefixCredit, passportID)
	data, err := sdk.Instance.GetStateFromKey(key)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to read: %v", err))
	}
	if len(data) == 0 {
		return sdk.Success([]byte(`{"balance":0}`))
	}
	var account CreditAccount
	if err := json.Unmarshal([]byte(data), &account); err != nil {
		return sdk.Error(fmt.Sprintf("failed to unmarshal: %v", err))
	}
	return sdk.Success([]byte(fmt.Sprintf(`{"passport_id":"%s","balance":%d,"granted":%d,"consumed":%d}`, passportID, account.Balance, account.Granted, account.Consumed)))
}

// getAccount returns the full credit account for a passport.
// Args: passport_id (64 hex)
func (c *CreditLedger) getAccount() protogo.Response {
	args := sdk.Instance.GetArgs()
	passportID := string(args["passport_id"])
	if len(passportID) != 64 {
		return sdk.Error("passport_id must be 64 hex characters")
	}

	key := common.BuildKey(common.PrefixCredit, passportID)
	data, err := sdk.Instance.GetStateFromKey(key)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to read: %v", err))
	}
	if len(data) == 0 {
		return sdk.Success([]byte(`{"exists":false}`))
	}
	return sdk.Success([]byte(data))
}

// requireAuthorizedGrantOrg checks caller org is authorized to modify credit.
func requireAuthorizedGrantOrg() error {
	orgID, err := sdk.Instance.GetSenderOrgId()
	if err != nil {
		return fmt.Errorf("failed to get sender org: %v", err)
	}
	for _, authorized := range AuthorizedGrantOrgs {
		if orgID == authorized {
			return nil
		}
	}
	return fmt.Errorf("unauthorized org for credit operations: %s", orgID)
}

func main() {
	sdk.Instance.Start(new(CreditLedger))
}
