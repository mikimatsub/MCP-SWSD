# syntax=docker/dockerfile:1.7

# === Builder stage ===
FROM node:24-alpine AS builder
WORKDIR /app

# Copy manifests first so npm ci is cached when only source changes.
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Drop devDependencies for the runtime stage
RUN npm prune --omit=dev


# === Runtime stage ===
FROM node:24-alpine AS runtime
WORKDIR /app

# Copy production deps and built artifacts only. Explicit ownership avoids
# permission issues when running as the non-root `node` user.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json

USER node

ENV NODE_ENV=production
ENV PORT=3000
# HTTP transport is the only sensible default in a container; stdio expects
# to be spawned by an MCP host as a subprocess. Override via -e SWSD_TRANSPORT=stdio
# if you really need stdio inside a container (rare).
ENV SWSD_TRANSPORT=http

EXPOSE 3000

# /healthz returns 200 with {"ok":true,...} when the server is responsive.
# Uses Node 24's built-in fetch — no curl/wget needed in the image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

LABEL org.opencontainers.image.source="https://github.com/mikimatsub/MCP-SWSD"
LABEL org.opencontainers.image.description="MCP server for SolarWinds Service Desk (SWSD / Samanage). Stdio + Streamable HTTP transports."
LABEL org.opencontainers.image.licenses="MIT"

CMD ["node", "dist/cli.js"]
