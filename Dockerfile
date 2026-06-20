FROM node:24-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY pnpm-lock.yaml package.json tsconfig.json ./
RUN pnpm install --frozen-lockfile
COPY src/ ./src/
RUN pnpm run build
RUN pnpm prune --prod

FROM node:24-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 3000
ENV MIGRATION_DIR=dist/db/migrations
ENTRYPOINT ["/docker-entrypoint.sh"]
