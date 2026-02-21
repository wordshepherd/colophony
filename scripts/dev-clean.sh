#!/usr/bin/env bash
set -uo pipefail

# Cleanup script for orphaned dev processes and stale files.
# Idempotent — safe to run even when nothing needs cleaning.

echo "Cleaning up dev environment..."

# Kill processes on dev server ports
for port in 4000 3000; do
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Killing processes on port $port: $pids"
    echo "$pids" | xargs -r kill -9 2>/dev/null || true
  fi
done

# Stop Overmind session (project-scoped via .overmind.sock)
if [ -S .overmind.sock ]; then
  echo "Stopping Overmind session..."
  overmind kill 2>/dev/null || true
  # Remove stale socket if overmind kill didn't clean up
  if [ -S .overmind.sock ]; then
    echo "Removing stale Overmind socket..."
    rm -f .overmind.sock
  fi
fi

# Remove stale Next.js dev lock
if [ -f apps/web/.next/dev/lock ]; then
  echo "Removing stale Next.js lock..."
  rm -f apps/web/.next/dev/lock
fi

echo "Done."
