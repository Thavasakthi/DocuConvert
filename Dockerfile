FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install LibreOffice Writer and essential fonts for headless Word to PDF conversion
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libreoffice-writer \
        fonts-liberation \
        fonts-dejavu-core && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy server dependency files and install
COPY server/package*.json ./
RUN npm ci --only=production

# Copy server source code
COPY server/ ./

ENV PORT=5000
EXPOSE 5000

CMD ["node", "server.js"]
