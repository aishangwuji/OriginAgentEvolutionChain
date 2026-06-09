export interface ParsedOciUri {
  uri: string;
  digest: string;
}

const OCI_URI_RE = /^oci:\/\/[^\s"'<>?]+@sha256:([0-9a-f]{64})$/;

export function parseOciArtifactUri(uri: string): ParsedOciUri {
  const match = OCI_URI_RE.exec(uri);
  if (!match) {
    throw new Error("storageUri must match oci://...@sha256:<64 lowercase hex>");
  }
  return {
    uri,
    digest: match[1],
  };
}

export function assertOciDigestMatchesArtifact(uri: string, artifactDigest: string): ParsedOciUri {
  const parsed = parseOciArtifactUri(uri);
  if (parsed.digest !== artifactDigest) {
    throw new Error("storageUri digest must match proof bundle artifact_digest");
  }
  return parsed;
}
