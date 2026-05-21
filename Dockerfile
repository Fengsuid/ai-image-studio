FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-bookworm-slim AS canvas-v2-build
WORKDIR /app
COPY apps/canvas-v2/package.json ./apps/canvas-v2/package.json
COPY apps/canvas-v2/scripts ./apps/canvas-v2/scripts
COPY apps/canvas-v2/src ./apps/canvas-v2/src
RUN npm run build --prefix apps/canvas-v2

FROM node:20-bookworm-slim AS app
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json server.js ./
COPY src ./src
COPY public ./public
COPY apps/canvas-v2 ./apps/canvas-v2
COPY scripts ./scripts
COPY docs/README.md ./docs/README.md
COPY --from=canvas-v2-build /app/public/canvas-v2 ./public/canvas-v2
EXPOSE 3000
CMD ["npm", "start"]
