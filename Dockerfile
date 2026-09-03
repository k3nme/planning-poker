# Portable image for anywhere that runs a container (Fly.io, Railway, Koyeb,
# Cloud Run, a VPS). Render uses render.yaml instead and does not need this.

# ---- build the client -------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci --include=dev
COPY . .
RUN npm run build

# ---- runtime: server + built client only ------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787

COPY package.json package-lock.json ./
COPY server/package.json ./server/
RUN npm ci --omit=dev --workspaces --include-workspace-root && npm cache clean --force

COPY server ./server
COPY --from=build /app/client/dist ./client/dist

# Drop privileges; the node image ships an unprivileged `node` user.
USER node

EXPOSE 8787
CMD ["node", "server/index.mjs"]
