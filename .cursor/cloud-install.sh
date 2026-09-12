#!/usr/bin/env bash
# Idempotent Cloud Agent install: refresh workspace dependencies after checkout.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=/dev/null
source "${ROOT}/.cursor/cloud-env.sh"

install_node_24() {
  local node_major
  node_major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
  if (( node_major >= 24 )); then
    return
  fi

  if [[ ! -s "${HOME}/.nvm/nvm.sh" ]]; then
    echo "Company OS requires Node.js 24+. nvm is not installed, and current node is: $(command -v node) $(node -v 2>/dev/null || echo missing)" >&2
    exit 1
  fi

  # Cursor's exec-daemon Node 22 often wins PATH; install 24 into nvm and prepend it.
  # shellcheck source=/dev/null
  . "${HOME}/.nvm/nvm.sh"
  nvm install 24
  nvm alias default 24
  use_nvm_node_24

  node_major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
  if (( node_major < 24 )); then
    echo "Company OS requires Node.js 24+. Current: $(command -v node) $(node -v 2>/dev/null || echo missing)" >&2
    exit 1
  fi
}

install_postgres_18() {
  if command -v psql >/dev/null 2>&1 && psql --version 2>/dev/null | grep -qE ' 18\.'; then
    return
  fi

  echo "Installing PostgreSQL 18 (required for Cloud Agent start and db:reset)..."
  export DEBIAN_FRONTEND=noninteractive
  sudo apt-get update -qq
  sudo apt-get install -y -qq curl ca-certificates gnupg lsb-release
  sudo install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc |
    sudo tee /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc >/dev/null
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" |
    sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq postgresql-18 postgresql-contrib-18 postgresql-18-pgvector postgresql-client-18
}

install_node_24

if ! command -v pnpm >/dev/null 2>&1 || ! pnpm -v 2>/dev/null | grep -qE '^11\.'; then
  # Corepack can reject package.json version ranges; install an exact pnpm 11.
  npm install -g pnpm@11.3.0
  hash -r
fi

install_postgres_18

echo "node $(node -v) · pnpm $(pnpm -v) · $(psql --version | head -1)"
pnpm install --frozen-lockfile
