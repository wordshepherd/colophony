#!/usr/bin/env bash
set -euo pipefail

# Docker Compose wrapper that simplifies profile handling.
#
# Usage:
#   bash scripts/docker-up.sh          # Core infra + Zitadel (default)
#   bash scripts/docker-up.sh --full   # Core infra + Zitadel + ClamAV
#   bash scripts/docker-up.sh --core   # Core infra only (no Zitadel)

PROFILES="--profile auth"

case "${1:-}" in
  --full)
    PROFILES="--profile auth --profile full"
    echo "Starting all services (core + Zitadel + ClamAV)..."
    ;;
  --core)
    PROFILES=""
    echo "Starting core services only (no Zitadel)..."
    ;;
  *)
    echo "Starting core services + Zitadel..."
    ;;
esac

# shellcheck disable=SC2086
docker compose $PROFILES up -d
