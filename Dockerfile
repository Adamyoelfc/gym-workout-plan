# syntax=docker/dockerfile:1

# --- Stage 1: build the Vite client -----------------------------------------
FROM node:20-alpine AS client
WORKDIR /client
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=$VITE_BASE_PATH
COPY client/package*.json ./
RUN npm ci --ignore-scripts
COPY client/ ./
RUN npm run build

# --- Stage 2: server runtime ------------------------------------------------
FROM node:20-alpine AS server
WORKDIR /app
ENV NODE_ENV=production
COPY server/package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server/ ./
# Built client lands where index.js expects it (../public relative to src/).
COPY --from=client /client/dist ./public
EXPOSE 8080
CMD ["node", "src/index.js"]
