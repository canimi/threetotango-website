# Deploying Three To Tango (maintainers)

The site is one container (`ttw-web`: nginx + the built Astro site), deployed as a Portainer stack from this repository (`docker-compose.yml`).

## Required environment variables
Set them in Portainer (Stacks > Add stack > Environment variables). See `deploy/.env.example`.

| Variable | Purpose |
| --- | --- |
| `TTW_PROXY_KEY` | Secret nginx sends to n8n as `X-TTW-Proxy-Key`; the TTW n8n webhooks answer 404 without it. Hex, `openssl rand -hex 24`. |
| `TTW_MEDIA_KEY` | Secret n8n must send as `X-TTW-Key` to the internal media endpoint. |

Optional: `N8N_NETWORK` (default `n8n-docker_default`), `EPISODES_API_URL` (build-time episode list), `PUBLIC_UMAMI_ID` (analytics website id; empty = no tracking script).

## Network
The stack attaches to the existing, externally created Docker network of the n8n stack (`N8N_NETWORK`). Check the exact name in Portainer > Networks. On that network nginx reaches n8n at `http://n8n-docker-n8n-1:5678` (resolved at request time via Docker DNS, so nginx starts even when n8n is down), and the image build also uses it to fetch episodes. No host ports are published; cloudflared routes `threetotango.canimi.app` to `http://ttw-web:80`.

Public `/api/*` and `/tango-me/r/<id>` are proxied to fixed n8n webhook paths only (see `deploy/nginx.conf`); everything else under `/api/` is 404.

## Internal media endpoint (:8081)
Media lives in the named volume `ttw_media` (mounted at `/usr/share/nginx/media`). Port 8081 is never published and must not be routed by cloudflared. n8n writes with `PUT http://ttw-web:8081/media/<path>` and removes with `DELETE` on the same URL, always with header `X-TTW-Key: <TTW_MEDIA_KEY>`. Only private source IPs are accepted, a missing or wrong key gives 401, and `DELETE /media/` itself is refused. Public port 80 serves the same files read-only at `/media/...`; `/media/uploads/` is never public.

## Adding Umami later
1. In the existing Postgres create database `umami` and a user for it.
2. In Portainer add a second stack from `docker-compose.umami.yml` with `UMAMI_DB_USER`, `UMAMI_DB_PASSWORD`, `UMAMI_APP_SECRET` (and `N8N_NETWORK` if changed).
3. In Cloudflare Zero Trust add a tunnel route `stats.canimi.app` -> `http://umami:3000`.
4. Log in to Umami, create the website, copy its id into `PUBLIC_UMAMI_ID` on the main stack and redeploy it (the id is baked in at build time).
