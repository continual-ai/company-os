#!/usr/bin/env bash
# Idempotent Cloud Agent install: refresh workspace dependencies after checkout.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Prefer the Node 24 toolchain baked into the environment snapshot over
# Cursor's exec-daemon Node shim (often Node 22).
if [[ -d "${HOME}/.nvm/versions/node" ]]; then
  latest_node="$(ls -1d "${HOME}/.nvm/versions/node"/v24* 2>/dev/null | sort -V | tail -1 || true)"
  if [[ -n "${latest_node}" ]]; then
    export PATH="${latest_node}/bin:${PATH}"
  fi
fi

node_major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
if (( node_major < 24 )); then
  echo "Company OS requires Node.js 24+. Current: $(command -v node) $(node -v 2>/dev/null || echo missing)" >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1 || ! pnpm -v 2>/dev/null | grep -qE '^11\.'; then
  # Corepack can reject package.json version ranges; install an exact pnpm 11.
  npm install -g pnpm@11.3.0
  hash -r
fi

echo "node $(node -v) · pnpm $(pnpm -v)"
pnpm install --frozen-lockfile
