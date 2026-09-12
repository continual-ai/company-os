#!/usr/bin/env bash
# Cloud VMs have no init system. Locally, PostgreSQL is already a user service.
set -euo pipefail

if pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
  exit 0
fi

sudo pg_ctlcluster 18 main start

for _ in $(seq 1 30); do
  if pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done

echo "PostgreSQL did not become ready on 127.0.0.1:5432" >&2
exit 1
