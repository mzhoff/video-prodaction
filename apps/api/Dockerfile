FROM node:24-alpine3.21 AS base
ENV TURBO_TELEMETRY_DISABLED=1
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS prune
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY . .
RUN pnpm dlx turbo prune api --docker

FROM base AS installer
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=prune /app/out/json/ .
RUN pnpm install --filter api... --frozen-lockfile

FROM base AS installer-production
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=prune /app/out/json/ .
RUN pnpm install --filter api... --frozen-lockfile --prod
RUN mkdir -p /app/packages/api/node_modules

FROM base AS builder
WORKDIR /app
COPY --from=installer /app/node_modules /app/node_modules
COPY --from=installer /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=installer /app/packages/api/node_modules /app/packages/api/node_modules
COPY --from=prune /app/out/full/ .
COPY --from=prune /app/out/json/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm exec turbo build --filter=api...

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
USER nestjs
COPY --from=prune --chown=nestjs:nodejs /app/out/json/ .
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /app/packages/api/dist ./packages/api/dist
COPY --from=installer-production --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=installer-production --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=installer-production --chown=nestjs:nodejs /app/packages/api/node_modules ./packages/api/node_modules
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/api/dist/main.js"]
