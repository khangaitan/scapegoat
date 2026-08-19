# Frontend (Vite dev server). See backend/Dockerfile for the API server.
FROM node:20-bookworm-slim

WORKDIR /repo

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src

EXPOSE 5173

CMD ["npm", "run", "dev"]
