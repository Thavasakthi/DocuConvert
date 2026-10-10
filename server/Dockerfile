FROM node:20-bullseye-slim

# Install LibreOffice headless and essential fonts for high-fidelity conversion
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-writer \
    fonts-dejavu \
    fonts-liberation \
    fonts-noto \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install server dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy server source code
COPY . .

# Expose Render PORT
ENV PORT=5000
EXPOSE 5000

# Start Express server
CMD ["node", "server.js"]
