# Use Node.js 20 Alpine as base image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
# Install OpenSSL 1.1 for Prisma compatibility (Alpine 3.22+ uses OpenSSL 3)
# Download OpenSSL 1.1 library directly from Alpine 3.19 repository
RUN apk add --no-cache libc6-compat \
    && wget -O /tmp/libssl1.1.apk https://dl-cdn.alpinelinux.org/alpine/v3.19/main/x86_64/libssl1.1-1.1.1w-r1.apk \
    && apk add --no-cache --allow-untrusted /tmp/libssl1.1.apk \
    && rm /tmp/libssl1.1.apk
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN \
  if [ -f package-lock.json ]; then npm ci; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Rebuild the source code only when needed
FROM base AS builder
# Install OpenSSL 1.1 for Prisma compatibility during build
RUN wget -O /tmp/libssl1.1.apk https://dl-cdn.alpinelinux.org/alpine/v3.19/main/x86_64/libssl1.1-1.1.1w-r1.apk \
    && apk add --no-cache --allow-untrusted /tmp/libssl1.1.apk \
    && rm /tmp/libssl1.1.apk
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client
RUN npx prisma generate

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
# Install OpenSSL 1.1 for Prisma compatibility at runtime
RUN wget -O /tmp/libssl1.1.apk https://dl-cdn.alpinelinux.org/alpine/v3.19/main/x86_64/libssl1.1-1.1.1w-r1.apk \
    && apk add --no-cache --allow-untrusted /tmp/libssl1.1.apk \
    && rm /tmp/libssl1.1.apk
WORKDIR /app

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the built application
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create uploads directory with proper permissions
RUN mkdir -p /app/data/uploads && chown -R nextjs:nodejs /app/data/uploads

COPY --from=builder /app/prisma ./prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Entrypoint script para rodar migrations antes de subir o server
ENV MEDLOG_VERSION=0.1.0
ENTRYPOINT ["/bin/sh","./docker-entrypoint.sh"]