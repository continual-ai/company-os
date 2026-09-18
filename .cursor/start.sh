#!/usr/bin/env bash
# Same local flow as README: docker compose up -d. Cloud VMs have no init system,
# so start dockerd first when it is not already running.
set -euo pipefail

cd "$(dirname "$0")/.."

docker_ok() {
  docker info >/dev/null 2>&1 && return 0
  sg docker -c 'docker info' >/dev/null 2>&1
}

compose_up() {
  if docker info >/dev/null 2>&1; then
    docker compose up -d --wait
  else
    sg docker -c 'docker compose up -d --wait'
  fi
}

if ! docker_ok; then
  sudo rm -f /var/run/docker.pid
  sudo nohup dockerd </dev/null >/tmp/dockerd.log 2>&1 &
  for _ in $(seq 1 40); do
    docker_ok && break
    sleep 1
  done
fi

if ! docker_ok; then
  echo "dockerd failed to start:" >&2
  sudo tail -20 /tmp/dockerd.log >&2 || true
  exit 1
fi

compose_up
