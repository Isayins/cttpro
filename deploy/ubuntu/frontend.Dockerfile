FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=
ARG VITE_API_TIMEOUT_MS=15000
ARG VITE_IDLE_LOGOUT_MINUTES=120

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_API_TIMEOUT_MS=${VITE_API_TIMEOUT_MS} \
    VITE_IDLE_LOGOUT_MINUTES=${VITE_IDLE_LOGOUT_MINUTES}

RUN npm run build

FROM nginx:1.27-alpine

COPY deploy/ubuntu/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -qO- http://localhost/healthz >/dev/null || exit 1
