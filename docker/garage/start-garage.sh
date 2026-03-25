#!/bin/sh
# Start Garage and auto-assign layout on first run.
# Layout must be done via CLI (admin API's UpdateClusterLayout is unreliable in v2.2.0).
# After layout is applied, the /health endpoint returns 200 and the setup sidecar can proceed.

set -e

# Start Garage in the background
/garage server &
GARAGE_PID=$!

# Wait for RPC to be ready (CLI connects via RPC, not admin API)
echo "Waiting for Garage RPC..."
sleep 2
until /garage status > /dev/null 2>&1; do
  sleep 1
done
echo "Garage RPC ready."

# Check if layout needs to be applied
LAYOUT_VER=$(/garage layout show 2>/dev/null | grep -c "NO ROLE ASSIGNED" || true)
if [ "$LAYOUT_VER" -gt 0 ]; then
  echo "Applying initial layout..."
  NODE_ID=$(/garage status 2>/dev/null | grep -oP '^\s*\K[0-9a-f]{16}' | head -1)
  /garage layout assign -z dc1 -c "${GARAGE_CAPACITY:-1G}" "$NODE_ID" 2>/dev/null
  /garage layout apply --version 1 2>/dev/null
  echo "Layout applied."
else
  echo "Layout already applied, skipping."
fi

# Keep Garage in the foreground
wait $GARAGE_PID
