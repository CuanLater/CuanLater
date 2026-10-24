# Keeper worker: block poller, no port, no web server.
# Build context is the repo root (the keeper imports ../app/lib/abi.ts).
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY keeper/package.json keeper/package-lock.json ./keeper/
RUN npm ci --prefix keeper

COPY keeper/index.ts ./keeper/index.ts
COPY app/lib/abi.ts ./app/lib/abi.ts
COPY deployments/10143.json ./deployments/10143.json

CMD ["node", "keeper/index.ts"]
