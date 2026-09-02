FROM oven/bun:1.4.0-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . .

RUN mkdir -p /app/tmp/downloads /app/tmp/queue /app/tmp/uploads /app/tmp/storage-cache

EXPOSE 4000

CMD ["bun", "index.js"]