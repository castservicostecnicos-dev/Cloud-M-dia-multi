# Multi-stage Docker build for Mídia Indoor
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build Vite frontend and prepare for production
RUN npm run build

# --- Production Runner Stage ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled frontend and server files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Create uploads directory with persistence permissions
RUN mkdir -p /app/uploads && chmod 777 /app/uploads

EXPOSE 3000

CMD ["npm", "start"]
