# Stage 1: deps — install pnpm workspace dependencies
FROM node:25-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types/package.json packages/types/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# Stage 2: builder — build packages and Next.js app
FROM deps AS builder
# OpenSSL is required for Prisma to detect the correct engine binary (OpenSSL 3.x on Alpine 3.23+)
RUN apk add --no-cache openssl
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY packages/ packages/
COPY apps/web/ apps/web/
# Prisma generate needed because @prospector/types may depend on Prisma types
RUN pnpm --filter @prospector/db generate
RUN pnpm --filter @prospector/types build
RUN pnpm --filter @prospector/db build
RUN pnpm --filter @prospector/web build

# Stage 3: runner — standalone Next.js output
FROM node:25-alpine AS runner
RUN apk add --no-cache curl
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
WORKDIR /app

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
