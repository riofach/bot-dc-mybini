# syntax=docker/dockerfile:1.7

# ---------- Stage 1: install production dependencies ----------
FROM node:20-alpine AS deps

WORKDIR /app

# Install only what's needed for `npm ci` (no build tooling required for this bot)
COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force


# ---------- Stage 2: runtime image ----------
FROM node:20-alpine AS runner

# dumb-init: a tiny init that forwards SIGTERM/SIGINT properly so the bot's
# graceful shutdown handlers in src/index.js actually run on container stop.
RUN apk add --no-cache dumb-init tzdata \
    && cp /usr/share/zoneinfo/Asia/Jakarta /etc/localtime \
    && echo "Asia/Jakarta" > /etc/timezone

ENV NODE_ENV=production \
    TZ=Asia/Jakarta

WORKDIR /app

# Copy installed node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY package.json ./
COPY src ./src

# Drop privileges — the `node` user (uid 1000) ships with the base image.
RUN chown -R node:node /app
USER node

# Discord bot is outbound only — no EXPOSE needed.

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
