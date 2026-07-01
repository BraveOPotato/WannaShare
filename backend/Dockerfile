# --- Build stage: compile TypeScript to dist/ ------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Install all deps (incl. dev) for the build. Copy only package.json so we do
# not depend on a committed lockfile; npm will resolve the ranges.
COPY package.json ./
RUN npm install

# Compile.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Run stage: production deps + compiled output --------------------------
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# :PORT (PeerJS broker + /health) and :SIGNAL_PORT (presence WebSocket).
EXPOSE 9000 9001

CMD ["node", "dist/server.js"]
