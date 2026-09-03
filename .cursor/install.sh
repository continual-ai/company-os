#!/usr/bin/env bash
# Idempotent Cloud Agent install: Node 24, pnpm 11, PostgreSQL 18, then workspace deps.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
export NVM_DIR

ensure_node_24() {
  if [[ -s "${NVM_DIR}/nvm.sh" ]]; then
    # shellcheck disable=SC1091
    . "${NVM_DIR}/nvm.sh"
    nvm install 24 >/dev/null
    nvm alias default 24 >/dev/null
    nvm use 24 >/dev/null
    local nvm_bin
    nvm_bin="$(dirname "$(nvm which 24)")"
    export PATH="${nvm_bin}:${PATH}"
    hash -r
  fi

  local node_major
  node_major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
  if ((node_major < 24)); then
    echo "Company OS requires Node.js 24+. Current: $(command -v node) $(node -v 2>/dev/null || echo missing)" >&2
    exit 1
  fi
}

# Cursor Cloud PATH puts /usr/local/cargo/bin and a Node 22 shim ahead of nvm.
# Keep Node 24 and pnpm first for non-login agent shells.
shim_node_tools() {
  local node_dir dest
  node_dir="$(cd "$(dirname "$(command -v node)")" && pwd)"
  mkdir -p "${HOME}/.local/bin"
  for dest in "${HOME}/.local/bin" /usr/local/cargo/bin; do
    [[ -d "${dest}" && -w "${dest}" ]] || continue
    for bin in node npm npx pnpm corepack; do
      if [[ -x "${node_dir}/${bin}" ]]; then
        ln -sfn "${node_dir}/${bin}" "${dest}/${bin}"
      fi
    done
  done
  export PATH="${HOME}/.local/bin:${PATH}"
  hash -r
}

ensure_pnpm_11() {
  local node_prefix
  node_prefix="$(cd "$(dirname "$(command -v node)")/.." && pwd)"
  if ! command -v pnpm >/dev/null 2>&1 || ! pnpm -v 2>/dev/null | grep -qE '^11\.'; then
    # Global npm on this image uses prefix=/; install into the active Node instead.
    npm install -g --prefix "${node_prefix}" pnpm@11.3.0
    hash -r
  fi
}

ensure_postgres_18() {
  if ! command -v pg_ctlcluster >/dev/null 2>&1 || ! dpkg -s postgresql-18 >/dev/null 2>&1; then
    sudo apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates curl postgresql-common
    sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
    sudo apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-18 postgresql-client-18
  fi

  local pg_hba="/etc/postgresql/18/main/pg_hba.conf"
  if [[ -f "${pg_hba}" ]]; then
    sudo tee "${pg_hba}" >/dev/null <<'EOF'
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                peer
local   all             all                                     peer
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
EOF
  fi

  sudo pg_ctlcluster 18 main start >/dev/null 2>&1 || true
  sudo pg_ctlcluster 18 main reload >/dev/null 2>&1 || true

  local i
  for i in $(seq 1 30); do
    if pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if ! pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
    echo "PostgreSQL did not become ready on 127.0.0.1:5432" >&2
    exit 1
  fi

  local role
  role="$(id -un)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${role}') THEN
    CREATE ROLE "${role}" LOGIN SUPERUSER CREATEDB CREATEROLE;
  ELSE
    ALTER ROLE "${role}" WITH LOGIN SUPERUSER CREATEDB CREATEROLE;
  END IF;
END\$\$;
SQL
}

ensure_node_24
ensure_pnpm_11
shim_node_tools
ensure_postgres_18

echo "node $(node -v) · pnpm $(pnpm -v)"
pnpm install --frozen-lockfile
