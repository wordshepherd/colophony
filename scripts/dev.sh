#!/usr/bin/env bash
set -euo pipefail

# hivemind process manager wrapper for dev servers.
# Builds workspace packages first (via Turbo), then starts API + Web via hivemind.

# Check for required binary
if ! command -v hivemind &>/dev/null; then
  echo "Error: hivemind is required but not installed."
  echo "  Linux: curl -L https://github.com/DarthSim/hivemind/releases/latest/download/hivemind-v1.1.0-linux-amd64.gz | gunzip > ~/.local/bin/hivemind && chmod +x ~/.local/bin/hivemind"
  echo "  macOS: brew install hivemind"
  exit 1
fi

# Clean up stale processes from previous sessions
bash scripts/dev-clean.sh 2>/dev/null || true

# Build workspace packages (not apps) so dist/ exports resolve
echo "Building workspace packages..."
pnpm exec turbo run build --filter='./packages/*'

# Start dev servers via hivemind (exec replaces shell for clean signal handling)
exec hivemind Procfile.dev
