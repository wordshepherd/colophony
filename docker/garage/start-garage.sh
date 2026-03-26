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

# Check if layout needs to be applied (version 0 = never applied)
LAYOUT_VER=$(/garage layout show 2>/dev/null | sed -n 's/.*layout version: \([0-9]*\)/\1/p' | head -1)
LAYOUT_VER=${LAYOUT_VER:-0}
if [ "$LAYOUT_VER" -eq 0 ]; then
  echo "Applying initial layout..."
  NODE_ID=$(/garage status 2>/dev/null | awk '/^[[:space:]]*[0-9a-f]{16}/ { print $1; exit }')
  /garage layout assign -z dc1 -c "${GARAGE_CAPACITY:-1G}" "$NODE_ID" 2>/dev/null
  /garage layout apply --version 1 2>/dev/null
  echo "Layout applied."
else
  echo "Layout already applied, skipping."
fi

# Keep Garage in the foreground
wait $GARAGE_PID
