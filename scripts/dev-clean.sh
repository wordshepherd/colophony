#!/usr/bin/env bash
set -uo pipefail

# Cleanup script for orphaned dev processes and stale files.
# Idempotent — safe to run even when nothing needs cleaning.

echo "Cleaning up dev environment..."

# Kill processes on dev server ports (lsof + fuser for thorough detection)
for port in 4000 3000; do
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  # fuser catches processes lsof misses (e.g., next-server on 0.0.0.0)
  fuser_pids=$(fuser "$port"/tcp 2>/dev/null | tr -s ' ' '\n' | grep -v '^$' || true)
  all_pids=$(echo "$pids $fuser_pids" | tr ' ' '\n' | sort -u | grep -v '^$' || true)
  if [ -n "$all_pids" ]; then
    echo "Killing processes on port $port: $(echo $all_pids | tr '\n' ' ')"
    echo "$all_pids" | xargs -r kill -9 2>/dev/null || true
  fi
done

# Remove stale Next.js dev lock
if [ -f apps/web/.next/dev/lock ]; then
  echo "Removing stale Next.js lock..."
  rm -f apps/web/.next/dev/lock
fi

echo "Done."
