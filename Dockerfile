# ── Build stage ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install backend dependencies
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npx tsc

# Install frontend dependencies and build
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci

COPY frontend ./frontend
RUN cd frontend && npx vite build

# ── Production stage ───────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy Prisma schema + generated client
COPY prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy compiled backend
COPY --from=builder /app/dist ./dist

# Copy built frontend
COPY --from=builder /app/frontend/dist ./frontend/dist

# Copy data files (toxic domains, etc.)
COPY data ./data

# Healthcheck
RUN apk add --no-cache wget
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

EXPOSE 3000

CMD ["node", "dist/index.js"]
