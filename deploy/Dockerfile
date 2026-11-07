# Stage 1: build the Astro static site
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Build-time config (a unreachable EPISODES_API_URL is fine: the site builds with no episodes)
ARG EPISODES_API_URL=""
ARG PUBLIC_UMAMI_ID=""
ENV EPISODES_API_URL=$EPISODES_API_URL \
    PUBLIC_UMAMI_ID=$PUBLIC_UMAMI_ID \
    EPISODES_FILE=/tmp/episodes.json
# Remote ADD re-downloads the feed on every build and busts the layer cache when its content
# changes, so a Portainer webhook redeploy never reuses a stale "npm run build" layer.
ADD https://n8n.canimi.app/webhook/ttw-episodes /tmp/episodes.json
RUN npm run build

# Stage 2: serve with nginx
FROM nginx:alpine
RUN mkdir -p /etc/nginx/snippets /etc/nginx/templates /usr/share/nginx/media \
 && chown -R nginx:nginx /usr/share/nginx/media
COPY deploy/security-headers.conf /etc/nginx/snippets/ttw-security.conf
COPY deploy/ttw-proxy.inc.template /etc/nginx/templates/ttw-proxy.inc.template
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/media-internal.conf.template /etc/nginx/templates/media-internal.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 8081
