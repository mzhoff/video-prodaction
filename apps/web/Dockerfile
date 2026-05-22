FROM node:24-alpine3.21 AS base
ENV NEXT_TELEMETRY_DISABLED=1
ENV TURBO_TELEMETRY_DISABLED=1
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS prune
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY . .
RUN pnpm dlx turbo prune web --docker

FROM base AS installer
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=prune /app/out/json/ .
RUN pnpm install --filter web... --frozen-lockfile

FROM base AS installer-production
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=prune /app/out/json/ .
RUN pnpm install --filter web... --frozen-lockfile --prod

FROM base AS builder
WORKDIR /app
COPY --from=installer /app/node_modules /app/node_modules
COPY --from=installer /app/apps/web/node_modules /app/apps/web/node_modules
COPY --from=installer /app/packages/api/node_modules /app/packages/api/node_modules
COPY --from=prune /app/out/full/ .
COPY --from=prune /app/out/json/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm exec turbo build --filter=web...

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]
