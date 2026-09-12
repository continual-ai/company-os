#!/usr/bin/env bash
# Same local flow as README: docker compose up -d. Cloud VMs have no init system,
# so start dockerd first when it is not already running.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! docker info >/dev/null 2>&1; then
  sudo rm -f /var/run/docker.pid
  sudo nohup dockerd </dev/null >/tmp/dockerd.log 2>&1 &
  for _ in $(seq 1 40); do
    if docker info >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

if ! docker info >/dev/null 2>&1; then
  if [ -S /var/run/docker.sock ] && sg docker -c 'docker info' >/dev/null 2>&1; then
    exec sg docker -c 'docker compose up -d --wait'
  fi
  echo "dockerd failed to start:" >&2
  sudo tail -20 /tmp/dockerd.log >&2 || true
  exit 1
fi

docker compose up -d --wait
