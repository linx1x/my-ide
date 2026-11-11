# My IDE - runs bridge + Cursor CLI in container
# Stage 1: build dashboard client
FROM node:22-bookworm-slim AS dashboard-builder
WORKDIR /app
COPY tsconfig*.json ./
COPY src/dashboard/client/package*.json src/dashboard/client/
RUN npm ci --prefix src/dashboard/client --legacy-peer-deps
COPY src/dashboard/client src/dashboard/client
RUN npm run build --prefix src/dashboard/client

# Stage 2: runtime
FROM node:22-bookworm-slim

# Build deps for node-pty + Chromium for Puppeteer; git for terminal, dashboard git panel, scaffold
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    git \
    chromium \
    ca-certificates \
    curl \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Cursor CLI (agent binary)
ENV PATH="/root/.local/bin:${PATH}"
RUN curl -fsSL https://cursor.com/install | bash

# Install Claude CLI (agent binary — used when AGENT_PROVIDER=claude)
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
# Copy built dashboard from stage 1 (avoids build:dashboard in this stage)
COPY --from=dashboard-builder /app/src/dashboard/client/dist src/dashboard/client/dist

# Puppeteer: use system Chromium in Docker
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN mkdir -p /data /workspace

ENV DOCKER_DATA_DIR=/data
ENV NODE_ENV=production

ENTRYPOINT ["npx", "tsx", "scripts/docker-entrypoint.ts"]
