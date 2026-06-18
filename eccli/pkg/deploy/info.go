// Package deploy provides deployment configuration for the ChainMaker consortium network.
package deploy

import (
	"encoding/json"
	"fmt"
	"os"
)

// NetworkConfig holds deployment information for a consortium network.
type NetworkConfig struct {
	NetworkID  string          `json:"network_id"`
	ChainID    string          `json:"chain_id"`
	Contracts  ContractAddrs   `json:"contracts"`
	Endpoints  EndpointList    `json:"endpoints"`
	SignerOrg  string          `json:"signer_org"`
}

// ContractAddrs maps contract names to their deployment names on ChainMaker.
type ContractAddrs struct {
	Identity     string `json:"identity"`
	Module       string `json:"module"`
	Verification string `json:"verification"`
	Score        string `json:"score"`
	Credit       string `json:"credit"`
	Passport     string `json:"passport"`
	Reputation   string `json:"reputation"`
	UnitKind     string `json:"unit_kind"`
	Adjudication string `json:"adjudication"`
}

// EndpointList holds network endpoints.
type EndpointList struct {
	RPC     []string `json:"rpc"`
	Indexer string   `json:"indexer,omitempty"`
	Gateway string   `json:"gateway,omitempty"`
}

// DefaultContractAddrs returns the default contract names for the consortium network.
func DefaultContractAddrs() ContractAddrs {
	return ContractAddrs{
		Identity:     "identity",
		Module:       "module",
		Verification: "verification",
		Score:        "score",
		Credit:       "credit",
		Passport:     "passport",
		Reputation:   "reputation",
		UnitKind:     "unitkind",
		Adjudication: "adjudication",
	}
}

// LoadNetworkConfig reads a deployment configuration from a JSON file.
func LoadNetworkConfig(path string) (*NetworkConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read network config: %w", err)
	}
	var cfg NetworkConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse network config: %w", err)
	}
	if cfg.Contracts.Identity == "" {
		cfg.Contracts = DefaultContractAddrs()
	}
	return &cfg, nil
}

// SaveNetworkConfig writes a deployment configuration to a JSON file.
func SaveNetworkConfig(path string, cfg *NetworkConfig) error {
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal: %w", err)
	}
	return os.WriteFile(path, data, 0644)
}
