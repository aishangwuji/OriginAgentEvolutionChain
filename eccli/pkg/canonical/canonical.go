// Package canonical provides JSON canonicalization and SHA-256 hashing,
// matching the TypeScript SDK's canonical.ts exactly.
package canonical

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// CanonicalStringify produces a deterministic JSON representation:
// - UTF-8 encoding
// - Object keys lexicographically sorted
// - No insignificant whitespace
// - Arrays kept in original order
func CanonicalStringify(v any) (string, error) {
	return encodeCanonical(v)
}

// HashJSON returns the SHA-256 hex digest of the canonical JSON of v.
func HashJSON(v any) (string, error) {
	canonical, err := CanonicalStringify(v)
	if err != nil {
		return "", fmt.Errorf("failed to canonicalize: %w", err)
	}
	return Sha256Hex(canonical), nil
}

// Sha256Hex returns the SHA-256 hex digest of a string.
func Sha256Hex(value string) string {
	h := sha256.Sum256([]byte(value))
	return fmt.Sprintf("%x", h[:])
}

// Sha256HexBytes returns the SHA-256 hex digest of bytes.
func Sha256HexBytes(value []byte) string {
	h := sha256.Sum256(value)
	return fmt.Sprintf("%x", h[:])
}

// ToBytes32 validates and normalizes a 32-byte hex string to 0x-prefixed lowercase.
func ToBytes32(value string, fieldName string, allowEmpty bool) (string, error) {
	if value == "" && allowEmpty {
		return "0x" + strings.Repeat("0", 64), nil
	}
	normalized := strings.TrimPrefix(value, "0x")
	if len(normalized) != 64 {
		return "", fmt.Errorf("%s must be a 32-byte hex value", fieldName)
	}
	for _, ch := range normalized {
		if !((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F')) {
			return "", fmt.Errorf("%s contains invalid hex character", fieldName)
		}
	}
	return "0x" + strings.ToLower(normalized), nil
}

// IsValidHex64 checks that a string is exactly 64 lowercase hex characters.
func IsValidHex64(value string) bool {
	if len(value) != 64 {
		return false
	}
	for _, ch := range value {
		if !((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f')) {
			return false
		}
	}
	return true
}

func encodeCanonical(v any) (string, error) {
	switch val := v.(type) {
	case nil:
		return "null", nil
	case string:
		b, err := json.Marshal(val)
		return string(b), err
	case bool:
		if val {
			return "true", nil
		}
		return "false", nil
	case float64:
		if val != val { // NaN
			return "", fmt.Errorf("canonical JSON does not support non-finite numbers")
		}
		return strconv.FormatFloat(val, 'f', -1, 64), nil
	case int:
		return strconv.Itoa(val), nil
	case int64:
		return strconv.FormatInt(val, 10), nil
	case []any:
		parts := make([]string, len(val))
		for i, item := range val {
			encoded, err := encodeCanonical(item)
			if err != nil {
				return "", err
			}
			parts[i] = encoded
		}
		return "[" + strings.Join(parts, ",") + "]", nil
	case map[string]any:
		keys := make([]string, 0, len(val))
		for k := range val {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		parts := make([]string, 0, len(keys))
		for _, k := range keys {
			encoded, err := encodeCanonical(val[k])
			if err != nil {
				return "", err
			}
			keyJSON, _ := json.Marshal(k)
			parts = append(parts, string(keyJSON)+":"+encoded)
		}
		return "{" + strings.Join(parts, ",") + "}", nil
	default:
		// Fallback: use json.Marshal for other types (e.g. structs, complex numbers)
		b, err := json.Marshal(v)
		if err != nil {
			return "", fmt.Errorf("canonical JSON does not support %T: %w", v, err)
		}
		// Re-parse and re-encode for true canonical form.
		var parsed any
		if err := json.Unmarshal(b, &parsed); err != nil {
			return "", fmt.Errorf("failed to re-parse JSON: %w", err)
		}
		return encodeCanonical(parsed)
	}
}
