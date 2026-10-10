# ==============================================================================
# Multi-Stage Dockerfile for DocuConvert (Word to PDF Web App)
# Builds the React frontend and packages the Express backend with headless LibreOffice
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build React Frontend
# ------------------------------------------------------------------------------
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Server with LibreOffice Headless
# ------------------------------------------------------------------------------
FROM node:20-bullseye-slim
WORKDIR /app

# Install LibreOffice headless and essential font packs for accurate rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-writer \
    fonts-dejavu \
    fonts-liberation \
    fonts-noto \
    && rm -rf /var/lib/apt/lists/*

# Set up backend server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --only=production
COPY server/ ./

# Copy React production build from Stage 1 into /app/client/dist
COPY --from=client-builder /app/client/dist /app/client/dist

# Configure environment & expose port
ENV PORT=5000
ENV NODE_ENV=production
EXPOSE 5000

# Start the application
CMD ["node", "server.js"]
