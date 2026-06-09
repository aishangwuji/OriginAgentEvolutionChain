#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT/out/ec7-multi-node-validation}"

EC7_SSH_KEY="${EC7_SSH_KEY:-}"
EC7_NODE_HOST="${EC7_NODE_HOST:-}"
EC7_NODE_ROLE="${EC7_NODE_ROLE:-}"
EC7_NODE_NAME="${EC7_NODE_NAME:-}"
EC7_NODE_USER="${EC7_NODE_USER:-root}"

if [[ -z "$EC7_SSH_KEY" || -z "$EC7_NODE_HOST" || -z "$EC7_NODE_ROLE" || -z "$EC7_NODE_NAME" ]]; then
  echo "usage: EC7_SSH_KEY=<key> EC7_NODE_HOST=<host> EC7_NODE_ROLE=<role> EC7_NODE_NAME=<name> scripts/bootstrap-ec7-node.sh" >&2
  exit 1
fi

case "$EC7_NODE_ROLE" in
  coordinator|validator-1|validator-2|auditor) ;;
  *)
    echo "EC7_NODE_ROLE must be coordinator, validator-1, validator-2, or auditor" >&2
    exit 1
    ;;
esac

ssh_target="$EC7_NODE_HOST"
if [[ "$ssh_target" != *@* ]]; then
  ssh_target="$EC7_NODE_USER@$ssh_target"
fi

role_dir="$OUT_DIR/$EC7_NODE_ROLE"
mkdir -p "$role_dir"

ssh_args=(
  -i "$EC7_SSH_KEY"
  -o PreferredAuthentications=publickey
  -o PasswordAuthentication=no
  -o StrictHostKeyChecking=accept-new
)

ssh "${ssh_args[@]}" "$ssh_target" "EC7_NODE_ROLE='$EC7_NODE_ROLE' EC7_NODE_NAME='$EC7_NODE_NAME' bash -s" <<'REMOTE' > "$role_dir/server-standardization.json"
set -euo pipefail
exec 3>&1
exec 1>&2

export DEBIAN_FRONTEND=noninteractive

if command -v hostnamectl >/dev/null 2>&1; then
  hostnamectl set-hostname "$EC7_NODE_NAME" || true
fi

wait_for_apt_lock() {
  if ! command -v apt-get >/dev/null 2>&1; then
    return 0
  fi
  for _ in $(seq 1 120); do
    if command -v fuser >/dev/null 2>&1; then
      if ! fuser /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/cache/apt/archives/lock >/dev/null 2>&1; then
        return 0
      fi
    elif ! pgrep -f 'apt-get|/usr/bin/apt |/usr/bin/dpkg|/usr/bin/unattended-upgrade( |$)' >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
  done
  echo "timed out waiting for apt/dpkg lock" >&2
  exit 1
}

if command -v apt-get >/dev/null 2>&1; then
  wait_for_apt_lock
  dpkg --configure -a || true
  apt-get update -y
  apt-get install -y curl git ca-certificates build-essential unzip jq tar xz-utils
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y curl git ca-certificates gcc gcc-c++ make unzip jq tar xz || {
    echo "dnf install failed; continuing with already-installed tools" >&2
  }
elif command -v yum >/dev/null 2>&1; then
  yum install -y curl git ca-certificates gcc gcc-c++ make unzip jq tar xz || {
    echo "yum install failed; continuing with already-installed tools" >&2
  }
else
  echo "unsupported package manager: expected apt-get, dnf, or yum" >&2
  exit 1
fi

if ! swapon --show=NAME --noheadings | grep -qx '/swapfile'; then
  if [[ ! -f /swapfile ]]; then
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  fi
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null 2>&1 || true
  swapon /swapfile 2>/dev/null || true
fi
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v24.* ]]; then
  if command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
    apt-get install -y nodejs
  elif command -v dnf >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_24.x | bash -
    dnf install -y nodejs
  elif command -v yum >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_24.x | bash -
    yum install -y nodejs
  fi
fi

export PATH="$HOME/.foundry/bin:$PATH"
if ! command -v forge >/dev/null 2>&1 || ! command -v anvil >/dev/null 2>&1 || ! command -v cast >/dev/null 2>&1; then
  curl -L https://foundry.paradigm.xyz | bash
  export PATH="$HOME/.foundry/bin:$PATH"
  foundryup
fi
for tool in forge anvil cast chisel; do
  if [[ -x "$HOME/.foundry/bin/$tool" ]]; then
    ln -sf "$HOME/.foundry/bin/$tool" "/usr/local/bin/$tool" || true
  fi
done

exec 1>&3
node --input-type=module <<'NODE'
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function sh(command) {
  try {
    return execFileSync(command, { shell: "/bin/bash", encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

const osRelease = Object.fromEntries(
  readFileSync("/etc/os-release", "utf8")
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => {
      const [key, ...rest] = line.split("=");
      return [key, rest.join("=").replace(/^"|"$/g, "")];
    }),
);

const artifact = {
  schema_version: "originagent.evolution.ec7_server_standardization.v1",
  role: process.env.EC7_NODE_ROLE,
  node_name: process.env.EC7_NODE_NAME,
  hostname: sh("hostname"),
  os: {
    id: osRelease.ID,
    version_id: osRelease.VERSION_ID,
    pretty_name: osRelease.PRETTY_NAME,
    kernel: sh("uname -r"),
    architecture: sh("uname -m"),
  },
  resources: {
    cpu_model: sh("lscpu | awk -F: '/Model name/{gsub(/^[ \\t]+/, \"\", $2); print $2; exit}'"),
    memory: sh("free -h | awk '/Mem:/{print $2}'"),
    swap: sh("free -h | awk '/Swap:/{print $2}'"),
    root_disk: sh("df -h / | awk 'NR==2{print $2}'"),
  },
  tools: {
    node: sh("node -v"),
    npm: sh("npm -v"),
    forge: sh("forge --version | head -n 1"),
    anvil: sh("anvil --version | head -n 1"),
    cast: sh("cast --version | head -n 1"),
    git: sh("git --version"),
  },
  sshd: {
    public_key_authentication: sh("sshd -T 2>/dev/null | awk '/^pubkeyauthentication /{print $2; exit}'"),
    permit_root_login: sh("sshd -T 2>/dev/null | awk '/^permitrootlogin /{print $2; exit}'"),
  },
  generated_at: new Date().toISOString(),
};

console.log(JSON.stringify(artifact, null, 2));
NODE
REMOTE

cp "$role_dir/server-standardization.json" "$OUT_DIR/server-standardization.$EC7_NODE_ROLE.json"
