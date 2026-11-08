# Deploying Three To Tango (maintainers)

The site is one container (`ttw-web`: nginx + the built Astro site), deployed as a Portainer stack from this repository (`docker-compose.yml`).

## Required environment variables
Set them in Portainer (Stacks > Add stack > Environment variables). See `deploy/.env.example`.

| Variable | Purpose |
| --- | --- |
| `TTW_PROXY_KEY` | Secret nginx sends to n8n as `X-TTW-Proxy-Key`; the TTW n8n webhooks answer 404 without it. Hex, `openssl rand -hex 24`. |
| `TTW_MEDIA_KEY` | Secret n8n must send as `X-TTW-Key` to the internal media endpoint. |

Optional: `N8N_NETWORK` (default `n8n-docker_default`), `EPISODES_API_URL` (build-time episode list, fetched over the public internet; default `https://n8n.canimi.app/webhook/ttw-episodes`), `PUBLIC_UMAMI_ID` (analytics website id; empty = no tracking script).

## Network
The stack attaches to the existing, externally created Docker network of the n8n stack (`N8N_NETWORK`). Check the exact name in Portainer > Networks. On that network nginx reaches n8n at `http://n8n-docker-n8n-1:5678` (resolved at request time via Docker DNS, so nginx starts even when n8n is down). The image build does not use this network (BuildKit cannot join it); it fetches episodes from the public n8n URL. No host ports are published; cloudflared routes `threetotango.canimi.app` to `http://ttw-web:80`.

Public `/api/*` and `/tango-me/r/<id>` are proxied to fixed n8n webhook paths only (see `deploy/nginx.conf`); everything else under `/api/` is 404.

## Internal media endpoint (:8081)
Media lives in the named volume `ttw_media` (mounted at `/usr/share/nginx/media`). Port 8081 is never published and must not be routed by cloudflared. n8n writes with `PUT http://ttw-web:8081/media/<path>` and removes with `DELETE` on the same URL, always with header `X-TTW-Key: <TTW_MEDIA_KEY>`. Only private source IPs are accepted, a missing or wrong key gives 401, and `DELETE /media/` itself is refused. Public port 80 serves the same files read-only at `/media/...`; `/media/uploads/` is never public.

## Adding Umami later
1. In the existing Postgres create database `umami` and a user for it.
2. In Portainer add a second stack from `docker-compose.umami.yml` with `UMAMI_DB_USER`, `UMAMI_DB_PASSWORD`, `UMAMI_APP_SECRET` (and `N8N_NETWORK` if changed).
3. In Cloudflare Zero Trust add a tunnel route `stats.canimi.app` -> `http://umami:3000`.
4. Log in to Umami, create the website, copy its id into `PUBLIC_UMAMI_ID` on the main stack and redeploy it (the id is baked in at build time).

## Nightly cleanup, backups and error alerts (n8n)
- **TTW · Cleanup** (`n8n/ttw-cleanup.json`, daily 03:30 Europe/Berlin):
  1. Exports every `ttw.*` table as one JSON file to `PUT http://ttw-web:8081/media/uploads/backups/ttw-YYYY-MM-DD.json` (`/media/uploads/` is never served publicly) and deletes the copies older than 14 days.
  2. Deletes expired `email_codes` (1 day after expiry), expired `sessions`, `ip_attempts` older than 2 days.
  3. Deletes the images of Tango Me generations past `expires_at` (30 days; `gallery_opt_in` rows are kept), then their rows. A row is only deleted when both images are gone (204/404); otherwise it is retried the next night.
  - The three HTTP nodes authenticate with an n8n **Header Auth** credential named `TTW Media Key` (header `X-TTW-Key`, value = `TTW_MEDIA_KEY`). After importing, select it on the nodes.
  - Raw user photos are never stored (Tango Me sends them inline to Gemini), so there are no upload files to expire.
  - Restore: open the JSON, each key under `tables` is a list of rows for `ttw.<table>`; insert them with `json_populate_recordset` (e.g. `insert into ttw.subscribers select * from json_populate_recordset(null::ttw.subscribers, '<rows json>')`).
- **TTW · Errors** (`n8n/ttw-errors.json`): error workflow for Subscribe, Episode import and Cleanup; Tango Me keeps its own Error Trigger (refunds the budget) and calls TTW · Errors from it. Emails avcican@gmail.com, at most one email per workflow per 30 minutes.
