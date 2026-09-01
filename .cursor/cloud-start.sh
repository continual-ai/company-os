#!/usr/bin/env bash
# Per-boot Cloud Agent start: ensure PostgreSQL is up, then converge local app state.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -d "${HOME}/.nvm/versions/node" ]]; then
  latest_node="$(ls -1d "${HOME}/.nvm/versions/node"/v24* 2>/dev/null | sort -V | tail -1 || true)"
  if [[ -n "${latest_node}" ]]; then
    export PATH="${latest_node}/bin:${PATH}"
  fi
fi

PG_MAJOR=18
PG_HBA="/etc/postgresql/${PG_MAJOR}/main/pg_hba.conf"

ensure_postgres() {
  if ! command -v psql >/dev/null 2>&1; then
    echo "PostgreSQL client not found. Re-run environment setup with PostgreSQL ${PG_MAJOR}." >&2
    exit 1
  fi

  if [[ -f "${PG_HBA}" ]]; then
    # Local TCP trust matches apps/company-os/.env.example (no password).
    sudo tee "${PG_HBA}" >/dev/null <<EOF
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                peer
local   all             all                                     peer
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
EOF
  fi

  if command -v pg_ctlcluster >/dev/null 2>&1; then
    sudo pg_ctlcluster "${PG_MAJOR}" main start >/dev/null 2>&1 || true
  elif [[ -d "/var/lib/postgresql/${PG_MAJOR}/main" ]]; then
    sudo -u postgres "/usr/lib/postgresql/${PG_MAJOR}/bin/pg_ctl" \
      -D "/var/lib/postgresql/${PG_MAJOR}/main" \
      -l "/tmp/postgresql-${PG_MAJOR}.log" \
      start >/dev/null 2>&1 || true
  fi

  for _ in $(seq 1 30); do
    if pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if ! pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
    echo "PostgreSQL did not become ready on 127.0.0.1:5432" >&2
    exit 1
  fi

  # Role matching the Cloud Agent OS user; CREATEDB is required for database tests.
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

ensure_postgres

echo "PostgreSQL ready · node $(node -v) · pnpm $(pnpm -v)"
pnpm setup
