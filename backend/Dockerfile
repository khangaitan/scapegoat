# Backend (Express + Socket.IO). Build context is the repo root because the
# esbuild bundle's type-only imports reference ../shared, and the build step
# (backend/build.mjs) is run from within backend/.
FROM node:20-bookworm-slim

# python3/make/g++: fallback so better-sqlite3 can compile from source if no
# prebuilt binary matches the container's Node ABI/arch (e.g. arm64 on
# Apple Silicon Docker Desktop).
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /repo/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/build.mjs ./
COPY backend/src ./src
RUN npm run build

ENV NODE_ENV=production
ENV SQLITE_PATH=/data/songolt.db
EXPOSE 3001

CMD ["npm", "start"]
