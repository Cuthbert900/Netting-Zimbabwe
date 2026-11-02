# Multi-stage build for the Next.js 16 app, using the `output: "standalone"`
# trace Next.js produces (see next.config.ts). Runtime image ends up with just
# node + the traced production deps + the compiled server — no pnpm, no full
# node_modules, no source. Mirrors the pattern in
# node_modules/next/dist/docs/01-app/02-guides/self-hosting.md.

# ---- deps: install once, cached as long as lockfiles don't change ----
FROM node:22.2.0-alpine AS deps
WORKDIR /app
ENV PNPM_CONFIG_MINIMUM_RELEASE_AGE=0
ENV PNPM_CONFIG_STRICT_DEP_BUILDS=false
# Install pnpm directly to avoid corepack signature issues.
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# ---- builder: compile the app ----
FROM node:22.2.0-alpine AS builder
WORKDIR /app
ENV PNPM_CONFIG_MINIMUM_RELEASE_AGE=0
ENV PNPM_CONFIG_STRICT_DEP_BUILDS=false
RUN npm install -g pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so
# they must be present here (server-only vars like SUPABASE_SERVICE_ROLE_KEY
# are read at runtime instead — see self-hosting.md — and are NOT needed
# during build).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ---- runner: minimal production image ----
FROM node:22.2.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# `standalone` output includes a minimal server.js plus only the node_modules
# actually needed at runtime; public/ and static assets are copied alongside.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
