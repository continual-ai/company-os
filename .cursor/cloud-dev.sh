#!/usr/bin/env bash
# Cloud Agent terminal: Company OS Vite on :3002, bound for the remote desktop.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
source "${ROOT}/.cursor/cloud-env.sh"
cd "$ROOT"

exec pnpm turbo run dev --filter=company-os -- --host 0.0.0.0
