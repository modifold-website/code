FROM oven/bun:1.3.11-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . .

RUN mkdir -p /app/media /app/tmp/downloads /app/tmp/queue

EXPOSE 4000

CMD ["bun", "index.js"]
