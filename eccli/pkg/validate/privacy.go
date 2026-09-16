package validate

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
)

// forbiddenPrivacyKeys mirrors the TypeScript SDK FORBIDDEN_KEYS set.
//
// Business Rule: chain artifacts must never carry prompts, file contents, raw
// facts, raw tool output, tracebacks, hidden reasoning, or private telemetry.
var forbiddenPrivacyKeys = map[string]struct{}{
	"raw_prompt":        {},
	"prompt":            {},
	"file_content":      {},
	"file_contents":     {},
	"raw_tool_output":   {},
	"facts":             {},
	"facts_raw":         {},
	"facts_text":        {},
	"traceback":         {},
	"hidden_reasoning":  {},
	"private_telemetry": {},
}

var (
	// windowsPathRe follows the boundary-anchored form in sdk/src/evidence.ts
	// (the SDK's canonical collectPrivacyErrors), NOT the unanchored copy in
	// sdk/src/proof.ts. The unanchored form matches the "s://" inside any
	// "https://..." URL and would false-positive on ordinary URLs.
	windowsPathRe      = regexp.MustCompile(`(?:^|[^A-Za-z0-9])[A-Za-z]:[\\/][^\s"'<>]+`)
	unixPrivatePathRe  = regexp.MustCompile(`(?:/Users/|/home/)[^\s"'<>]+`)
	urlQueryRe         = regexp.MustCompile(`https?://[^\s"'<>?]+\?[^\s"'<>]+`)
	secretAssignmentRe = regexp.MustCompile(`(?i)\b(?:api[_-]?key|secret|password|authorization|bearer)\b\s*[:=]\s*["']?[^"',;\s<>]+`)
)

// CollectPrivacyErrors recursively scans a decoded JSON value (objects, arrays,
// and strings) for forbidden private fields, local absolute paths, URL query
// strings, and secret-like strings.
//
// Reason: this is the protocol privacy red line; the Go port must reject the
// same payloads as the TypeScript SDK so that no runtime drifts into leaking
// private data on-chain.
func CollectPrivacyErrors(value any) []string {
	var errs []string
	scanPrivacy(value, "$", &errs)
	return errs
}

func scanPrivacy(value any, path string, errs *[]string) {
	switch v := value.(type) {
	case []any:
		for i, item := range v {
			scanPrivacy(item, fmt.Sprintf("%s[%d]", path, i), errs)
		}
	case map[string]any:
		for _, key := range sortedKeys(v) {
			if _, forbidden := forbiddenPrivacyKeys[strings.ToLower(key)]; forbidden {
				*errs = append(*errs, fmt.Sprintf("forbidden private field: %s.%s", path, key))
			}
			scanPrivacy(v[key], path+"."+key, errs)
		}
	case string:
		if windowsPathRe.MatchString(v) || unixPrivatePathRe.MatchString(v) {
			*errs = append(*errs, fmt.Sprintf("local absolute path detected at %s", path))
		}
		if urlQueryRe.MatchString(v) {
			*errs = append(*errs, fmt.Sprintf("URL query string detected at %s", path))
		}
		if secretAssignmentRe.MatchString(v) {
			*errs = append(*errs, fmt.Sprintf("secret-like string detected at %s", path))
		}
	}
}

func sortedKeys(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
