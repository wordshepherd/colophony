#!/bin/sh
# Initialize Garage: API key and buckets via admin HTTP API.
# Layout is handled by start-garage.sh in the main container.
# Idempotent — safe to re-run on existing data.
#
# Required env vars:
#   GARAGE_ADMIN_URL       - Admin API base URL (e.g., http://garage:3903)
#   GARAGE_ADMIN_TOKEN     - Admin API bearer token
#   GARAGE_S3_ACCESS_KEY   - S3 access key ID to import (must be GK + 24 hex chars)
#   GARAGE_S3_SECRET_KEY   - S3 secret access key to import (64 hex chars)

set -e

ADMIN="${GARAGE_ADMIN_URL}"
AUTH="Authorization: Bearer ${GARAGE_ADMIN_TOKEN}"

echo "Waiting for Garage to be healthy..."
until curl -sf http://${GARAGE_ADMIN_URL#http://}/health > /dev/null 2>&1; do
  sleep 1
done
echo "Garage is healthy."

# --- API Key ---
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
    echo "Bucket '${BUCKET_ALIAS}' created (${BUCKET_ID})."
  elif [ "${HTTP_CODE}" = "409" ]; then
    echo "Bucket '${BUCKET_ALIAS}' already exists."
    BUCKET_ID=$(curl -sf -H "${AUTH}" "${ADMIN}/v2/GetBucketInfo?globalAlias=${BUCKET_ALIAS}" | jq -r '.id')
  else
    echo "Failed to create bucket '${BUCKET_ALIAS}' (HTTP ${HTTP_CODE})."
    exit 1
  fi

  # Always grant access (idempotent — handles credential rotation)
  echo "Granting key access to '${BUCKET_ALIAS}'..."
  curl -sf -X POST \
    -H "${AUTH}" -H "Content-Type: application/json" \
    -d "{\"bucketId\":\"${BUCKET_ID}\",\"accessKeyId\":\"${GARAGE_S3_ACCESS_KEY}\",\"permissions\":{\"read\":true,\"write\":true,\"owner\":true}}" \
    "${ADMIN}/v2/AllowBucketKey" > /dev/null
  echo "Access granted."
done

echo "Garage setup complete."
