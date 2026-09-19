FROM node:22-slim AS builder
WORKDIR /app

# Copy root workspace manifests
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY server/package*.json ./server/

# Install workspace dependencies (ignore scripts so lifecycle hooks don't run before src is copied)
RUN npm install --ignore-scripts --workspace=@hero_manager/shared --workspace=hero_manager_server

# Copy and build shared
COPY packages/shared/ ./packages/shared/
RUN npm run build --workspace=@hero_manager/shared

# Copy and build server
COPY server/tsconfig.json ./server/
COPY server/src/ ./server/src/
RUN npm run build --workspace=hero_manager_server

FROM node:22-slim
WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY server/package*.json ./server/
RUN npm install --omit=dev --ignore-scripts --workspace=@hero_manager/shared --workspace=hero_manager_server

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/server/dist ./server/dist

RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 3000
CMD ["node", "server/dist/server.js"]