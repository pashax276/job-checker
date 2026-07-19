# ---- Stage 1: dependencies (native build tools for better-sqlite3 on musl) ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci

# ---- Stage 2: build (Next standalone output) ----
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build \
    # image optimization is disabled (next.config images.unoptimized) — drop
    # sharp's traced platform binaries from the standalone bundle
    && rm -rf .next/standalone/node_modules/@img .next/standalone/node_modules/sharp

# ---- Stage 3: runner ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/tracker.db \
    DOCUMENTS_DIR=/data/files \
    NEXT_TELEMETRY_DISABLED=1

# Standalone server + static assets + runtime data the app reads from cwd.
# --chown at COPY time avoids a chown -R layer that would duplicate the app.
COPY --chown=node:node --from=build /app/.next/standalone ./
COPY --chown=node:node --from=build /app/.next/static ./.next/static
COPY --chown=node:node --from=build /app/public ./public
COPY --chown=node:node --from=build /app/drizzle ./drizzle
COPY --chown=node:node --from=build /app/data/jobs_seed.json ./data/jobs_seed.json

# Non-root; /data is the SQLite volume.
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
VOLUME /data

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server.js"]
