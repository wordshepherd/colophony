# Stage 1: deps — install pnpm workspace dependencies
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

# Stage 2: builder — generate Prisma, build packages, build API
FROM deps AS builder
# OpenSSL is required for Prisma to detect the correct engine binary (OpenSSL 3.x on Alpine 3.23+)
RUN apk add --no-cache openssl
COPY packages/ packages/
COPY apps/api/ apps/api/
# Prisma generate MUST run before building other packages
RUN pnpm --filter @prospector/db generate
RUN pnpm --filter @prospector/types build
RUN pnpm --filter @prospector/db build
RUN pnpm --filter @prospector/api build
# Deploy creates a standalone directory with production deps (pnpm's Docker approach)
RUN pnpm --filter @prospector/api deploy --prod /app/deploy
# Copy generated Prisma client (pnpm deploy only copies stubs, not generated files)
RUN cp -r /app/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma /app/deploy/node_modules/.pnpm/@prisma+client@*/node_modules/

# Stage 3: runner — production image
FROM node:20-alpine AS runner
RUN apk add --no-cache curl openssl
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
WORKDIR /app

# Copy deployed production output
COPY --from=builder /app/deploy/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist

# Copy workspace package dist files (built in builder, not included by pnpm deploy)
COPY --from=builder /app/packages/db/dist ./node_modules/@prospector/db/dist
COPY --from=builder /app/packages/db/package.json ./node_modules/@prospector/db/package.json
COPY --from=builder /app/packages/types/dist ./node_modules/@prospector/types/dist
COPY --from=builder /app/packages/types/package.json ./node_modules/@prospector/types/package.json

# Copy Prisma schema + migrations (needed at runtime for prisma migrate deploy)
COPY --from=builder /app/packages/db/prisma ./prisma

USER nestjs
EXPOSE 4000
CMD ["node", "dist/main.js"]
