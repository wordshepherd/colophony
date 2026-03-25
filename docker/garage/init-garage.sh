#!/bin/sh
# Initialize Garage: layout, API key, and buckets.
# Idempotent — safe to re-run on existing data.
#
# Required env vars:
#   GARAGE_ADMIN_URL       - Admin API base URL (e.g., http://garage:3903)
#   GARAGE_ADMIN_TOKEN     - Admin API bearer token
#   GARAGE_S3_ACCESS_KEY   - S3 access key ID to import
#   GARAGE_S3_SECRET_KEY   - S3 secret access key to import

set -e

ADMIN="${GARAGE_ADMIN_URL}"
AUTH="Authorization: Bearer ${GARAGE_ADMIN_TOKEN}"

echo "Waiting for Garage admin API..."
until curl -sf -H "${AUTH}" "${ADMIN}/health" > /dev/null 2>&1; do
  sleep 1
done
echo "Garage is healthy."

# --- Layout ---
# Check if layout is already applied (version > 0)
LAYOUT_VERSION=$(curl -sf -H "${AUTH}" "${ADMIN}/v2/GetClusterLayout" | jq '.version')
if [ "${LAYOUT_VERSION}" = "0" ]; then
  echo "Applying initial layout..."
  NODE_ID=$(curl -sf -H "${AUTH}" "${ADMIN}/v2/GetClusterStatus" | jq -r '.nodes[0].id')
  curl -sf -X POST \
    -H "${AUTH}" -H "Content-Type: application/json" \
    -d "[{\"id\":\"${NODE_ID}\",\"zone\":\"dc1\",\"capacity\":1073741824}]" \
    "${ADMIN}/v2/UpdateClusterLayout" > /dev/null
  curl -sf -X POST \
    -H "${AUTH}" -H "Content-Type: application/json" \
    -d '{"version":1}' \
    "${ADMIN}/v2/ApplyClusterLayout" > /dev/null
  echo "Layout applied."
else
  echo "Layout already applied (version ${LAYOUT_VERSION}), skipping."
fi

# --- API Key ---
# Try to import; if the key already exists, Garage returns 409 — that's fine.
echo "Importing S3 API key..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "${AUTH}" -H "Content-Type: application/json" \
  -d "{\"name\":\"colophony\",\"accessKeyId\":\"${GARAGE_S3_ACCESS_KEY}\",\"secretAccessKey\":\"${GARAGE_S3_SECRET_KEY}\"}" \
  "${ADMIN}/v2/ImportKey")
if [ "${HTTP_CODE}" = "200" ]; then
  echo "API key imported."
elif [ "${HTTP_CODE}" = "409" ]; then
  echo "API key already exists, skipping."
else
  echo "Failed to import API key (HTTP ${HTTP_CODE})."
  exit 1
fi

# --- Buckets ---
for BUCKET_ALIAS in submissions quarantine; do
  echo "Creating bucket '${BUCKET_ALIAS}'..."
  RESULT=$(curl -s -w "\n%{http_code}" -X POST \
    -H "${AUTH}" -H "Content-Type: application/json" \
    -d "{\"globalAlias\":\"${BUCKET_ALIAS}\"}" \
    "${ADMIN}/v2/CreateBucket")
  HTTP_CODE=$(echo "${RESULT}" | tail -1)
  BODY=$(echo "${RESULT}" | sed '$d')

  if [ "${HTTP_CODE}" = "200" ]; then
    BUCKET_ID=$(echo "${BODY}" | jq -r '.id')
    echo "Bucket '${BUCKET_ALIAS}' created (${BUCKET_ID}). Granting access..."
    curl -sf -X POST \
      -H "${AUTH}" -H "Content-Type: application/json" \
      -d "{\"bucketId\":\"${BUCKET_ID}\",\"accessKeyId\":\"${GARAGE_S3_ACCESS_KEY}\",\"permissions\":{\"read\":true,\"write\":true,\"owner\":true}}" \
      "${ADMIN}/v2/AllowBucketKey" > /dev/null
    echo "Access granted."
  elif [ "${HTTP_CODE}" = "409" ]; then
    echo "Bucket '${BUCKET_ALIAS}' already exists, skipping."
  else
    echo "Failed to create bucket '${BUCKET_ALIAS}' (HTTP ${HTTP_CODE})."
    exit 1
  fi
done

echo "Garage setup complete."
