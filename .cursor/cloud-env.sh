#!/usr/bin/env bash
# Shared Cloud Agent PATH: prefer nvm Node 24 over Cursor's Node 22 shim.
# Sourced by cloud-install.sh, cloud-start.sh, and cloud-dev.sh.

use_nvm_node_24() {
  local latest_node=""
  if [[ -d "${HOME}/.nvm/versions/node" ]]; then
    latest_node="$(ls -1d "${HOME}/.nvm/versions/node"/v24* 2>/dev/null | sort -V | tail -1 || true)"
  fi
  if [[ -n "${latest_node}" ]]; then
    export PATH="${latest_node}/bin:${PATH}"
  fi
}

use_nvm_node_24
