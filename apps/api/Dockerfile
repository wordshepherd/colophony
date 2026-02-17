# Stage 1: deps — install pnpm workspace dependencies
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

# Stage 2: builder — build packages and API
FROM deps AS builder
COPY packages/ packages/
COPY apps/api/ apps/api/
RUN pnpm --filter @colophony/types build
RUN pnpm --filter @colophony/db build
RUN pnpm --filter @colophony/api build
# Deploy creates a standalone directory with production deps (pnpm's Docker approach)
RUN pnpm --filter @colophony/api deploy --prod /app/deploy

# Stage 3: runner — production image
FROM node:22-alpine AS runner
RUN apk add --no-cache curl
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 colophony
WORKDIR /app

# Copy deployed production output
COPY --from=builder /app/deploy/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist

# Copy workspace package dist files (built in builder, not included by pnpm deploy)
COPY --from=builder /app/packages/db/dist ./node_modules/@colophony/db/dist
COPY --from=builder /app/packages/db/package.json ./node_modules/@colophony/db/package.json
COPY --from=builder /app/packages/types/dist ./node_modules/@colophony/types/dist
COPY --from=builder /app/packages/types/package.json ./node_modules/@colophony/types/package.json

# Copy Drizzle migrations (for production CD init step, not run at API startup)
COPY --from=builder /app/packages/db/migrations ./migrations

USER colophony
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1
CMD ["node", "dist/main.js"]
