FROM oven/bun:1.3.11-alpine AS deps

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS builder

WORKDIR /app

ARG STAGING=false
ARG API_BASE=https://api.modifold.com
ARG NEXT_PUBLIC_API_BASE=https://api.modifold.com
ARG NEXT_PUBLIC_GITHUB_CLIENT_ID=
ARG NEXT_PUBLIC_DISCORD_CLIENT_ID=
ARG NEXT_PUBLIC_HCAPTCHA_SITE_KEY=

ENV NEXT_TELEMETRY_DISABLED=1
ENV STAGING=${STAGING}
ENV API_BASE=${API_BASE}
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
ENV NEXT_PUBLIC_GITHUB_CLIENT_ID=${NEXT_PUBLIC_GITHUB_CLIENT_ID}
ENV NEXT_PUBLIC_DISCORD_CLIENT_ID=${NEXT_PUBLIC_DISCORD_CLIENT_ID}
ENV NEXT_PUBLIC_HCAPTCHA_SITE_KEY=${NEXT_PUBLIC_HCAPTCHA_SITE_KEY}

COPY . .
RUN bun run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]