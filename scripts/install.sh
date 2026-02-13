#!/bin/bash
# Colophony Self-Hosted Installation Script
# Usage: bash scripts/install.sh
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BOLD}======================================${NC}"
echo -e "${BOLD}  Colophony Installation Script${NC}"
echo -e "${BOLD}======================================${NC}"
echo ""

# Step 1: Check prerequisites
echo -e "${BOLD}Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
  echo -e "${RED}ERROR: Docker is not installed.${NC}"
  echo "Install Docker: https://docs.docker.com/engine/install/"
  exit 1
fi

DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "0")
echo "  Docker: v${DOCKER_VERSION}"

if ! docker compose version &> /dev/null; then
  echo -e "${RED}ERROR: Docker Compose v2 is not available.${NC}"
  echo "Docker Compose v2 is included with Docker Desktop, or install the plugin:"
  echo "https://docs.docker.com/compose/install/"
  exit 1
fi

COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "unknown")
echo "  Docker Compose: v${COMPOSE_VERSION}"

if ! command -v openssl &> /dev/null; then
  echo -e "${RED}ERROR: openssl is not installed (needed for secret generation).${NC}"
  exit 1
fi
echo "  openssl: available"

# Check port availability
HTTP_PORT=${HTTP_PORT:-80}
if command -v ss &> /dev/null; then
  if ss -tlnp | grep -q ":${HTTP_PORT} "; then
    echo -e "${YELLOW}WARNING: Port ${HTTP_PORT} is already in use.${NC}"
    read -p "Enter an alternative port (or Ctrl+C to abort): " HTTP_PORT
  fi
elif command -v lsof &> /dev/null; then
  if lsof -i ":${HTTP_PORT}" &> /dev/null; then
    echo -e "${YELLOW}WARNING: Port ${HTTP_PORT} is already in use.${NC}"
    read -p "Enter an alternative port (or Ctrl+C to abort): " HTTP_PORT
  fi
fi

echo -e "${GREEN}  All prerequisites met.${NC}"
echo ""

# Step 2: Back up existing .env.prod
if [ -f .env.prod ]; then
  BACKUP=".env.prod.backup.$(date +%Y%m%d%H%M%S)"
  cp .env.prod "$BACKUP"
  echo -e "${YELLOW}Existing .env.prod backed up to ${BACKUP}${NC}"
fi

# Step 3: Generate secrets
echo -e "${BOLD}Generating secrets...${NC}"

POSTGRES_PASSWORD=$(openssl rand -base64 48 | tr -d '=/+' | head -c 48)
APP_USER_PASSWORD=$(openssl rand -base64 48 | tr -d '=/+' | head -c 48)
JWT_SECRET=$(openssl rand -base64 64 | tr -d '=/+' | head -c 64)
REDIS_PASSWORD=$(openssl rand -base64 48 | tr -d '=/+' | head -c 48)
MINIO_ROOT_USER=$(openssl rand -hex 16)
MINIO_ROOT_PASSWORD=$(openssl rand -base64 48 | tr -d '=/+' | head -c 48)
TUS_HOOK_SECRET=$(openssl rand -hex 32)

echo "  Secrets generated."
echo ""

# Step 4: Prompt for configuration
read -p "Enter your domain (e.g., submissions.example.com): " DOMAIN
DOMAIN=${DOMAIN:-localhost}

echo ""
echo -e "${BOLD}Optional: Stripe configuration${NC}"
read -p "Stripe secret key (leave empty to skip): " STRIPE_SECRET_KEY
if [ -n "$STRIPE_SECRET_KEY" ]; then
  read -p "Stripe webhook secret: " STRIPE_WEBHOOK_SECRET
  read -p "Stripe publishable key: " STRIPE_PUBLISHABLE_KEY
fi

echo ""
echo -e "${BOLD}Optional: Email configuration${NC}"
read -p "SMTP host (leave empty to skip): " SMTP_HOST
if [ -n "$SMTP_HOST" ]; then
  read -p "SMTP port [587]: " SMTP_PORT
  SMTP_PORT=${SMTP_PORT:-587}
  read -p "SMTP user: " SMTP_USER
  read -p "SMTP password: " SMTP_PASSWORD
  read -p "From email address: " EMAIL_FROM
fi

# Step 5: Write .env.prod
echo ""
echo -e "${BOLD}Writing .env.prod...${NC}"

cat > .env.prod << EOF
# =============================================================================
# Colophony Production Configuration
# Generated on $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# =============================================================================

DOMAIN=${DOMAIN}
HTTP_PORT=${HTTP_PORT}

# PostgreSQL
POSTGRES_USER=colophony
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=colophony
APP_USER_PASSWORD=${APP_USER_PASSWORD}

# Authentication
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Redis
REDIS_PASSWORD=${REDIS_PASSWORD}

# MinIO (S3-compatible storage)
MINIO_ROOT_USER=${MINIO_ROOT_USER}
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}

# tusd webhook
TUS_HOOK_SECRET=${TUS_HOOK_SECRET}

# Stripe (payments)
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}

# Email
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USER=${SMTP_USER}
SMTP_PASSWORD=${SMTP_PASSWORD}
EMAIL_FROM=${EMAIL_FROM:-noreply@${DOMAIN}}

# Rate Limiting
RATE_LIMIT_DEFAULT_MAX=100
RATE_LIMIT_AUTH_MAX=20
EOF

chmod 600 .env.prod
echo "  .env.prod written (permissions: 600)."

# Step 6: Build and start services
echo ""
echo -e "${BOLD}Building and starting services...${NC}"
echo "This may take a few minutes on first run."
echo ""

docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build

# Step 7: Wait for health checks
echo ""
echo -e "${BOLD}Waiting for services to become healthy...${NC}"

MAX_WAIT=120
WAITED=0
INTERVAL=5

while [ $WAITED -lt $MAX_WAIT ]; do
  # Check if nginx is healthy (depends on api and web)
  NGINX_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' colophony-nginx 2>/dev/null || echo "not found")

  if [ "$NGINX_HEALTH" = "healthy" ]; then
    echo ""
    echo -e "${GREEN}${BOLD}======================================${NC}"
    echo -e "${GREEN}${BOLD}  Colophony is ready!${NC}"
    echo -e "${GREEN}${BOLD}======================================${NC}"
    echo ""
    echo "  URL: http://${DOMAIN}:${HTTP_PORT}"
    echo ""
    echo "  Useful commands:"
    echo "    docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f    # View logs"
    echo "    docker compose --env-file .env.prod -f docker-compose.prod.yml ps         # Service status"
    echo "    docker compose --env-file .env.prod -f docker-compose.prod.yml down       # Stop services"
    echo ""
    echo "  To enable virus scanning, restart with:"
    echo "    docker compose --env-file .env.prod -f docker-compose.prod.yml --profile full up -d"
    echo ""
    exit 0
  fi

  echo "  Waiting... (${WAITED}s / ${MAX_WAIT}s) - nginx: ${NGINX_HEALTH}"
  sleep $INTERVAL
  WAITED=$((WAITED + INTERVAL))
done

echo ""
echo -e "${RED}WARNING: Services did not become healthy within ${MAX_WAIT}s.${NC}"
echo "Check logs with: docker compose -f docker-compose.prod.yml logs"
exit 1
