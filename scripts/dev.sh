#!/usr/bin/env bash
set -euo pipefail

# Overmind process manager wrapper for dev servers.
# Builds workspace packages first (via Turbo), then starts API + Web via Overmind.

# Check for required binaries
if ! command -v tmux &>/dev/null; then
  echo "Error: tmux is required but not installed."
  echo "  Ubuntu/Debian: sudo apt install tmux"
  echo "  macOS: brew install tmux"
  exit 1
fi

if ! command -v overmind &>/dev/null; then
  echo "Error: overmind is required but not installed."
  echo "  Install: https://github.com/DarthSim/overmind#installation"
  echo "  Ubuntu/Debian: sudo apt install overmind (or download binary from releases)"
  echo "  macOS: brew install overmind"
  exit 1
fi

# Clean up stale processes from previous sessions
bash scripts/dev-clean.sh 2>/dev/null || true

# Build workspace packages (not apps) so dist/ exports resolve
echo "Building workspace packages..."
pnpm exec turbo run build --filter='./packages/*'

# Start dev servers via Overmind (exec replaces shell for clean signal handling)
exec overmind start -f Procfile.dev
