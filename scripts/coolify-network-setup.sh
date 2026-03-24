#!/usr/bin/env bash
# Create the shared Docker network for inter-service communication across Coolify resources.
#
# Usage (on the host directly):
#   bash scripts/coolify-network-setup.sh
#
# Usage (via SSH from local machine):
#   ssh root@staging-host 'bash -s' < scripts/coolify-network-setup.sh
#
# This script is idempotent — safe to run multiple times.

set -euo pipefail

NETWORK_NAME="colophony-net"

if docker network inspect "$NETWORK_NAME" &>/dev/null; then
  echo "Network '$NETWORK_NAME' already exists"
else
  docker network create --driver bridge "$NETWORK_NAME"
  echo "Network '$NETWORK_NAME' created"
fi
