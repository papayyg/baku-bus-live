FROM oven/bun:1.4.2-alpine AS web
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY shared ./shared
COPY web ./web
RUN bun run build

FROM oven/bun:1.4.2-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4.2-alpine
RUN apk add --no-cache tzdata
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY shared ./shared
COPY server ./server
COPY --from=web /app/web/dist ./web/dist
RUN mkdir -p /data && chown bun:bun /data
ENV NODE_ENV=production TZ=Asia/Baku DATA_DIR=/data STATIC_DIR=/app/web/dist HOST=127.0.0.1 PORT=8080
USER bun
CMD ["bun", "run", "server/index.ts"]
