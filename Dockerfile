FROM node:22-alpine AS base
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_PATH=/data/sendthen.db
ENV SENDTHEN_OUTBOX_DIR=/data/outbox

RUN addgroup -S sendthen && adduser -S sendthen -G sendthen \
  && mkdir -p /data && chown sendthen:sendthen /data

COPY --from=build --chown=sendthen:sendthen /app/.next/standalone ./
COPY --from=build --chown=sendthen:sendthen /app/.next/static ./.next/static
COPY --from=build --chown=sendthen:sendthen /app/public ./public
COPY --from=build --chown=sendthen:sendthen /app/drizzle ./drizzle

USER sendthen
EXPOSE 3000
VOLUME /data
CMD ["node", "server.js"]
