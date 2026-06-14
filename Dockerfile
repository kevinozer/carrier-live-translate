# Single-stage Node 20 image — express + statický frontend + ephemeral token proxy.
FROM node:20-alpine
WORKDIR /app

# Závislosti zvlášť kvůli Docker cache.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Server + statický frontend.
# GitHub web upload nezachová podsložky → index.html přijde do rootu, sem ho srovnáme.
COPY server.js ./
COPY index.html ./public/index.html

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.js"]
