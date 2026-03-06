# Stage 1: Build
FROM node:22-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy native better-sqlite3 module
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY --from=builder /app/node_modules/prebuild-install ./node_modules/prebuild-install

# Copy discord-interactions for slash command verification
COPY --from=builder /app/node_modules/discord-interactions ./node_modules/discord-interactions

# Create writable data directory for SQLite
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 8080

ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
