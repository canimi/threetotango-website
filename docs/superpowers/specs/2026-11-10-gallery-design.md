# Gallery + Cat of the Week — Design Spec (v2a)
Status: **waiting for owner review** · Written 2026-11-10 · Approved in chat: Section 1 (data + flow), Section 2 (pages)

## 0. Intent
- **Why:** more shares, returning visitors and verified emails, which v3 sales will use later. Gallery cards link to share pages (OG previews). Cat of the Week gives people a reason to come back and like.
- **Who:** adult cat owners who used Tango Me, and their friends who come in through shared links.
- **Success:** approved Tango Me results show on `/gallery` without a rebuild; likes work without login and resist casual cheating; every Monday a winner is chosen automatically and all 4 rewards happen; the owner moderates from email alone.
- **Constraints:** only the existing stack (Astro static site, nginx, n8n, Postgres, Gmail node). No new paid services. Characters: only the user's own cat appears next to the series cast; we never generate anything new for the gallery.
- **Out of scope:** reader stories (v2b), voting on episodes (cancelled), comments, user accounts, user-side removal UI (the owner removes on request via the email link).

## 1. Data (Postgres, schema `ttw`)
Additions go into `db/schema.sql` (idempotent `add column if not exists` / `create table if not exists`) and are applied with the existing **TTW · Setup DB** workflow.

### 1.1 `generations` — new columns
| Column | Type | Meaning |
|---|---|---|
| `gallery_status` | text not null default `'none'`, check in (`none`,`pending`,`approved`,`rejected`,`removed`) | Moderation state |
| `gallery_mod_hash` | text | sha256 of the single-use Approve/Reject token; set to NULL after a decision |
| `gallery_remove_hash` | text | sha256 of the owner's reusable Remove token |
| `gallery_approved_at` | timestamptz | Set on approval (tie-breaker for Cat of the Week) |
| `uses_bonus` | boolean not null default false | This generation was paid for by a bonus credit |

- Index: `(gallery_approved_at desc) where gallery_status = 'approved'`.
- Existing `gallery_opt_in` stays as "the user ticked the box".
- **Retention:** on approval `expires_at = 'infinity'`. Rejected / pending / none keep the normal 30 days. Removed → `expires_at = now()`, so the nightly cleanup deletes files and row.
- **Cleanup change:** `TTW · Cleanup` drops the `not gallery_opt_in` condition (approved rows never expire because of `infinity`). The backup also includes the new tables.

### 1.2 New tables
```sql
create table if not exists gallery_likes (
  generation_id text not null references generations(id) on delete cascade,
  voter_hash    text not null,              -- sha256(device_id || '|' || ip)
  created_at    timestamptz not null default now(),
  primary key (generation_id, voter_hash)
);
create index if not exists gallery_likes_created_idx on gallery_likes (created_at);

create table if not exists gallery_like_ip (
  ip_hash text not null, day date not null, count int not null default 0,
  primary key (ip_hash, day)
);

create table if not exists cat_of_week (
  week_start    date primary key,             -- Monday (Europe/Berlin) the win was announced
  generation_id text not null unique references generations(id) on delete cascade,
  likes         int not null,
  created_at    timestamptz not null default now()
);

create table if not exists bonus_credits (
  id            bigserial primary key,
  email         text not null,
  reason        text not null check (reason in ('cat_of_week')),
  source_id     text,                          -- winning generation id
  granted_at    timestamptz not null default now(),
  used_by       text references generations(id) on delete set null,
  used_at       timestamptz                    -- set on claim; NULL = unused
);
create index if not exists bonus_credits_email_idx on bonus_credits (lower(email)) where used_at is null;
```
- A credit is **unused** when `used_at is null` (not `used_by`): when Cleanup deletes an expired bonus generation, `used_by` becomes NULL through the FK, but `used_at` stays set, so the credit does not open up again.

## 2. Flows (n8n)
All new public endpoints go through the site's nginx (`/api/...` → n8n webhook with `X-TTW-Proxy-Key`), the same as today.

### 2.1 Moderation request — sub-workflow **TTW · Gallery mod request**
Called (Execute Workflow) by:
- **Tango Me**, right after `Finalize Done`, when `gallery_opt_in` is true;
- **opt-in endpoint** (2.3).

Steps: in one SQL statement set `gallery_status='pending'`, store new random `gallery_mod_hash` + `gallery_remove_hash` (only when status is `none`). Then email `avcican@gmail.com`:
- Subject `Gallery: <cat name> wants in`
- The 4:5 image inline + cat name + scene.
- Buttons: **Approve**, **Reject**, and a small **Remove later** link.
- Links: `https://threetotango.canimi.app/gallery/mod?id=<id>&a=approve|reject|remove&t=<token>`.

### 2.2 Moderation endpoint — `/gallery/mod`
- **GET** never changes anything (mail scanners prefetch links). It returns a small HTML page: image, name and one button "Approve Mochi" / "Reject" / "Remove", which POSTs the same parameters.
- **POST** checks sha256(t) against the stored hash:
  - approve/reject: `gallery_mod_hash` must match and the status must be `pending`. Approve → `approved`, `gallery_approved_at = now()`, `expires_at = 'infinity'`. Reject → `rejected`. In both cases `gallery_mod_hash = NULL` (single use).
  - remove: `gallery_remove_hash` must match → `removed`, `expires_at = now()`, the row's likes are deleted. Works from any status.
- Result page: "Done. Luka has been informed." Wrong or used token → "This link has already been used."

### 2.3 Opt-in after the result — `POST /api/gallery/optin {token, id}`
The session token must belong to the generation's email; the generation must be `done` with `gallery_status='none'`. Then set `gallery_opt_in = true` and call 2.1. Response `{ok:true}` or `{ok:false,error:'bad_token'|'invalid'}`.

### 2.4 Gallery list — `GET /api/gallery?sort=new|top&offset=0&limit=24`
- `limit` 1–24, `offset` 0–2000, `sort` default `new`.
- Items: approved only, `{id, name, img:'/media/tango/<id>-post.jpg', likes}`. `new` = `gallery_approved_at desc`; `top` = likes desc, then approved_at desc.
- Also returns `featured`: the latest `cat_of_week` row whose `week_start >= current_date - 13` (approved, not removed), as `{id, name, img, likes, weekStart}`, or `null`.
- Response `{featured, items, next}`, where `next` is the next offset or `null`.
- nginx: `Cache-Control: public, max-age=30`.

### 2.5 Like — `POST /api/gallery/like {id, device}`
- `device` must match `^[A-Za-z0-9_-]{16,64}$` (random id the browser keeps in localStorage).
- `voter_hash = sha256(device|ip)`, `ip_hash = sha256(ip)` (IP comes from nginx `$ttw_real_ip`).
- One SQL statement:
  1. generation must be `approved`;
  2. increment `gallery_like_ip` only while count < **30** for today;
  3. insert into `gallery_likes` `on conflict do nothing`;
  4. return the new total.
- Responses: `{ok:true, likes, already:boolean}` · `{ok:false, error:'limit'}` (HTTP 429) · `{ok:false, error:'invalid'}`.
- The IP counter only goes up when a new like is actually inserted.
- Unlike is not supported (YAGNI).

### 2.6 Cat of the Week — workflow **TTW · Cat of the Week** (Schedule, Monday 09:00 Europe/Berlin)
1. Candidate = approved generation that is not already in `cat_of_week`, with the most `gallery_likes` where `created_at >= now() - 7 days`; tie → earliest `gallery_approved_at`; candidates with 0 likes are ignored. No candidate → stop (no email).
2. One transaction: insert `cat_of_week(week_start = current_date, generation_id, likes)` (`on conflict do nothing` → a re-run in the same week does nothing) and insert `bonus_credits(email, 'cat_of_week', source_id)`.
3. Email the winner's email: subject `<name> is Cat of the Week 🏆`. Body: image, share link `/tango-me/r/<id>`, "You earned one more free Tango Me" + link to `/tango-me`.
4. Email the owner: subject `Cat of the Week: <name> — story ready`, the 9:16 story image as an attachment, a suggested caption (paste-ready), and the share link.
5. Errors → `TTW · Errors` (error workflow).

### 2.7 Tango Me — bonus credit (careful change)
Today: one free generation per email (`free_use_consumed`, with a unique partial index on `lower(email)`, which stays as is).

New rule: an email may start a generation if it has **no consumed free use** OR it has **an unused bonus credit**.
- **Pre Checks / Insert tx:** "used" = free already consumed AND no row in `bonus_credits` with `used_at is null` for that email. When the free use is consumed and a bonus exists, the insert transaction picks the oldest unused credit (`select ... for update skip locked`), inserts the generation with `uses_bonus = true`, and then claims the credit only for the id that was actually inserted (`set used_by = <new id>, used_at = now()`). All of this happens inside the existing per-email advisory lock.
- **Finalize Done:** `free_use_consumed = true` only when `uses_bonus = false`; a bonus generation keeps `free_use_consumed = false`, so the unique index still holds.
- **Every failure path** (Fail not_cat / Fail server / Fail By Execution / status auto-fail) also releases the credit: `update bonus_credits set used_by = null, used_at = null where used_by = <id>`.
- The "pending in the last 5 minutes" block stays as it is.

## 3. Pages (Astro)
### 3.1 `/gallery` (new, `src/pages/gallery.astro`)
- Static shell + client script (`src/lib/gallery.ts` + `src/components/GalleryGrid.astro`).
- Header nav gets **Gallery**: Episodes · The Cats · Gallery · Quiz. Added to the sitemap.
- Top: **Cat of the Week** card (image, name, likes, "Week of 16 Nov"), hidden when `featured` is null.
- Toggle **Newest / Most loved**. Polaroid grid (same style as the home scene polaroids): 2 columns on mobile, 4 on desktop; 4:5 image, cat name, heart button + count. **Show more** loads the next 24.
- A card click opens `/tango-me/r/<id>`; the heart button is separate.
- Empty state: "No guests yet. Luka is relieved." + button to `/tango-me`.
- Bottom CTA band: "Put your cat in the gallery" → `/tango-me`.
- Loading: fixed-size skeleton cards (no layout shift). API error: "The gallery is napping. Try again in a minute."
- Each image: `loading="lazy"`, `width/height` set, `alt="<name>, a Tango Me guest of Nora's cats"`.

### 3.2 Heart behaviour
- Optimistic: fills and +1 immediately; rolls back on error. Liked ids are kept in localStorage `ttw.liked` (try/catch; with no storage it still works for that page view).
- `limit` → "Easy, Budy. Come back tomorrow." `already:true` → stays filled, shows the server count.
- Device id: localStorage `ttw.device` (random 32 chars); if storage is blocked, a per-page-view id.

### 3.3 Home page
- New small section **Cat of the Week**, placed right after the scene polaroids. It shows `featured` + "See the gallery". With no featured winner it shows the latest 3 approved as "New in the gallery". With nothing approved it stays hidden (rendered `hidden`, revealed by script, so no layout shift above the fold).
- Nothing else on home changes.

### 3.4 Tango Me result screen
- If the user did not tick the gallery box: button **"Add to the gallery"** → `POST /api/gallery/optin` → note "Sent. Luka will review your cat."
- If ticked: note "Your cat is waiting for Luka's approval to join the gallery."
- Share page unchanged.

### 3.5 Copy
All new strings in `src/i18n/en.json`. Tone: short and dry, the cats get the joke.

### 3.6 Analytics
`track('gallery-like')`, `track('gallery-optin', {from:'result'|'form'})`, plus the existing `tango-cta` for the gallery CTAs.

## 4. Security & abuse
- Mod tokens: 32 random bytes, only the hash is stored; approve/reject is single use; GET is read-only.
- All ids are validated with `^[A-Za-z0-9_-]{1,64}$`, the same as today. User text (cat name) is HTML-escaped in emails and on the mod page.
- Likes: per device+IP dedupe, 30/IP/day. A determined cheater can still add some likes (accepted by the owner).
- No emails or raw photos ever leave the server; the gallery API only returns id, name, image path and likes.
- nginx: new exact locations only (`/api/gallery`, `/api/gallery/like`, `/api/gallery/optin`, `/gallery/mod` with `proxy_hide_header Content-Security-Policy` like the share page); everything else under `/api/` stays 404. Body limit 2 KB for JSON endpoints.

## 5. Cost
- No AI calls in gallery flows. A bonus generation ≈ $0.045 inside the existing $3/day cap. At most 1 bonus per week.

## 6. Testing
- **Vitest:** `gallery.ts` (API mapping and errors, device id with and without storage, liked store, optimistic like + rollback, `limit` message); route test that `/gallery/index.html` exists and the nav has the Gallery link; nginx-conf test for the new locations; CSP test still passes.
- **n8n (pinned/real):**
  - like twice from the same device → 1 like, `already:true`;
  - 31st like from one IP in a day → `limit`;
  - liking a non-approved id → `invalid`;
  - GET mod link changes nothing;
  - approve twice → second time "already used";
  - remove sets `expires_at` and deletes likes;
  - winner: tie → earlier approval; 0 likes → no winner; a previous winner is skipped; a re-run in the same week does nothing;
  - bonus: an email with consumed free use + 1 credit can generate once more; on failure the credit is released; a parallel double start claims only one credit; the unique free-use index is never violated.
- **Live:** owner approves one real gallery entry from email; like it from a phone; run Cat of the Week manually once and check both emails.

## 7. Deploy (owner steps)
1. Portainer → Stacks → ttw → **Pull and redeploy** (new pages + nginx locations).
2. Nothing else: DB changes and n8n workflows are done by Claude through n8n.
