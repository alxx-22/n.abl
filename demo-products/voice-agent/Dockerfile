# n.abl Reception. Node runs the server's TypeScript directly (type
# stripping); only the React app has a build step.

FROM node:22-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
# The app shares the floor plan's layout code and the builder's types with the server.
COPY src ./src
COPY web ./web
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8787 \
    CHROME_PATH=/usr/bin/chromium

# Chromium for the website scout's one render of a prospect's home page
# (colours, fonts, logo). Without it the scout reads stylesheets instead.
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-liberation ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY fixtures ./fixtures
COPY --from=web /app/web/dist ./web/dist

USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:'+process.env.PORT+'/demo/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server/main.ts"]
