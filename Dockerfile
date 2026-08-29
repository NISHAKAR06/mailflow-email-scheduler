# Multi-stage production build for MailFlow Unified Monorepo (Backend + Frontend)
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

# Install backend dependencies & build backend
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma/
RUN cd backend && npm ci && npx prisma generate

COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src/
RUN cd backend && npm run build

# Install frontend dependencies & build frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY frontend ./frontend/
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN cd frontend && npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production
ENV PORT=10000
ENV BACKEND_PORT=4000

# Copy root files
COPY package*.json ./
COPY start-all.js ./

# Copy backend compiled files & node_modules
COPY --from=builder /app/backend/package*.json ./backend/
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma

# Copy frontend built files & node_modules
COPY --from=builder /app/frontend/package*.json ./frontend/
COPY --from=builder /app/frontend/node_modules ./frontend/node_modules
COPY --from=builder /app/frontend/.next ./frontend/.next
COPY --from=builder /app/frontend/public ./frontend/public
COPY --from=builder /app/frontend/next.config.js ./frontend/next.config.js

EXPOSE 10000 4000 3000

CMD ["node", "start-all.js"]
