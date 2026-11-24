# Dockerfile — my-bmad
# Note : reste a la racine (et non docker/Dockerfile) pour simplifier le build context
# Node 24 = active LTS. Keep every stage on the same image so native bits
# (Prisma engines, sharp) built here match the runner.
FROM node:24-alpine AS base

# Install pnpm (build stages only — the runner never gets a package manager)
RUN corepack enable && corepack prepare pnpm@10.34.9 --activate

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Valeurs factices pour le build uniquement (disparaissent apres le build)
# Evite les warnings Better Auth et Prisma pendant next build
ARG DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ARG BETTER_AUTH_SECRET="build-time-placeholder-secret-not-used-at-runtime"
ARG BETTER_AUTH_URL="http://localhost:3000"
RUN pnpm db:generate
RUN pnpm build

# --- Prisma CLI (runtime migrations) ---
# Installed with npm into a flat node_modules (pnpm's symlinked layout does not
# survive being copied out). The prisma version and the security overrides are
# read from package.json so they stay in step with the lockfile. npm may skip
# install scripts, so the engines are fetched explicitly: the runtime user must
# never have to write into this root-owned tree.
FROM node:24-alpine AS prisma-cli
WORKDIR /prisma-cli
COPY package.json /tmp/app-package.json
RUN node -e 'const app = require("/tmp/app-package.json"); require("fs").writeFileSync("package.json", JSON.stringify({ private: true, dependencies: { prisma: app.devDependencies.prisma }, overrides: app.pnpm.overrides }))' \
  && npm install --omit=dev --no-audit --no-fund \
  && node node_modules/@prisma/engines/scripts/postinstall.js \
  && npm cache clean --force

# --- Runner ---
# Fresh image, not `base`: no pnpm, and Alpine packages patched at build time.
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Apply Alpine security updates, then drop the package managers bundled with
# the node image (npm, npx, corepack, yarn): nothing runs them at runtime and
# their vendored dependencies are a large share of image scan findings.
RUN apk upgrade --no-cache \
  && rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx \
    /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copie explicite du client Prisma genere (le tracing standalone peut manquer les chemins custom)
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated
# Prisma schema + migrations for runtime migrate deploy
# Note: prisma.config.ts is NOT copied — it imports dotenv which isn't needed in production
# (env vars are injected by Docker). Without it, Prisma uses default schema discovery.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# Prisma CLI for runtime migrations (see the prisma-cli stage)
COPY --from=prisma-cli /prisma-cli/node_modules /opt/prisma-cli/node_modules
ENV PATH="/opt/prisma-cli/node_modules/.bin:$PATH"

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "prisma migrate deploy && node server.js"]
