-- Three To Tango website schema (database: ttw). Idempotent: safe to run repeatedly.
-- All app objects live in schema ttw; every query must schema-qualify (ttw.table).

create schema if not exists ttw;
set search_path to ttw;

create table if not exists episodes (
  id            text primary key default gen_random_uuid()::text,
  platform      text not null check (platform in ('youtube','instagram')),
  external_id   text not null,
  slug          text not null unique,
  title         text not null,
  description   text,
  published_at  timestamptz,
  thumbnail_url text,
  video_url     text,
  hero_mp4_path text,
  characters    text[] default '{}',  -- NULL = not yet tagged (episode import retries tagging)
  short_title   text,                 -- clean 2-5 word title written by Gemini at import; NULL = retry
  is_hidden     boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (platform, external_id)
);
create index if not exists episodes_published_at_idx on episodes (published_at desc) where not is_hidden;

create table if not exists subscribers (
  id               text primary key default gen_random_uuid()::text,
  email            text not null,
  verified_at      timestamptz,
  source           text not null check (source in ('gift','tango-me','footer')),
  created_at       timestamptz not null default now(),
  unsubscribed_at  timestamptz
);
create unique index if not exists subscribers_email_lower_uq on subscribers (lower(email));

create table if not exists email_codes (
  id          bigserial primary key,
  email       text not null,
  code_hash   text not null,
  sent_at     timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '10 minutes'),
  attempts    int not null default 0
);
create index if not exists email_codes_email_sent_idx on email_codes (lower(email), sent_at desc);
create index if not exists email_codes_expires_idx on email_codes (expires_at);

create table if not exists generations (
  id                text primary key,
  email             text not null,
  ip_hash           text,
  cat_name          text,
  personality       text check (personality in ('genius','chatterbox','unbothered','chaos')),
  scene             text check (scene in ('kitchen-table','sofa-gang','fridge-heist','box-fort','window-birds','lettuce-crime','custom')),
  user_idea         text,
  status            text not null default 'queued' check (status in ('queued','running','done','failed')),
  cost_usd          numeric(6,4) not null default 0,
  reserved_usd      numeric(6,4) not null default 0,
  idem_key          text unique,
  result_path_45    text,
  result_path_916   text,
  gallery_opt_in    boolean not null default false,
  free_use_consumed boolean not null default false,
  error             text,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default (now() + interval '30 days')
);
create index if not exists generations_email_idx on generations (lower(email));
create index if not exists generations_ip_created_idx on generations (ip_hash, created_at);
create index if not exists generations_created_idx on generations (created_at);
create index if not exists generations_expires_idx on generations (expires_at);
create index if not exists generations_status_idx on generations (status) where status in ('queued','running');
create unique index if not exists generations_free_use_uq on generations (lower(email)) where free_use_consumed;
create index if not exists generations_gallery_idx on generations (created_at desc) where gallery_opt_in and status = 'done';

create table if not exists waitlist (
  id             bigserial primary key,
  email          text not null,
  kind           text not null check (kind in ('hd','mug','credits')),
  generation_id  text references generations(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists waitlist_email_idx on waitlist (lower(email));
create index if not exists waitlist_created_idx on waitlist (created_at);
create unique index if not exists waitlist_signup_uq on waitlist (lower(email), kind, generation_id);

-- Contract: no seed row. The Tango Me pipeline must run
--   insert into daily_budget(day) values (current_date) on conflict do nothing
-- before the atomic reserve update.
create table if not exists daily_budget (
  day               date primary key,
  spent_usd         numeric(8,4) not null default 0,
  reserved_usd      numeric(8,4) not null default 0,
  generations_count int not null default 0
);

create table if not exists ip_attempts (
  ip_hash text not null,
  day     date not null,
  count   int not null default 0,
  primary key (ip_hash, day)
);

-- Session tokens for verified emails: client gets 32 random bytes base64url; DB stores only its sha256 hex (token_hash); expires after 24 h.
create table if not exists sessions (
  token_hash text primary key,
  email      text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_expires_idx on sessions (expires_at);
create index if not exists sessions_email_idx on sessions (lower(email));

reset search_path;

-- Migration for DBs created before 'characters' became nullable (idempotent):
alter table ttw.episodes alter column characters drop not null;
alter table ttw.episodes add column if not exists short_title text;
-- SEO (2026-11-10): clean web meta description + short premise, written by Gemini at import from the caption; NULL = retry
alter table ttw.episodes add column if not exists seo_description text;
alter table ttw.episodes add column if not exists summary text;

-- ============================================================
-- v2a gallery (spec: docs/superpowers/specs/2026-11-10-gallery-design.md §1)
-- ============================================================
alter table ttw.generations add column if not exists gallery_status text not null default 'none';
alter table ttw.generations add column if not exists gallery_mod_hash text;
alter table ttw.generations add column if not exists gallery_remove_hash text;
alter table ttw.generations add column if not exists gallery_approved_at timestamptz;
alter table ttw.generations add column if not exists uses_bonus boolean not null default false;

do $$
begin
  alter table ttw.generations add constraint generations_gallery_status_check
    check (gallery_status in ('none','pending','approved','rejected','removed'));
exception when duplicate_object then null;
end
$$;

create index if not exists generations_gallery_approved_idx on ttw.generations (gallery_approved_at desc) where gallery_status = 'approved';

create table if not exists ttw.gallery_likes (
  generation_id text not null references ttw.generations(id) on delete cascade,
  voter_hash    text not null,              -- sha256(device_id || '|' || ip)
  created_at    timestamptz not null default now(),
  primary key (generation_id, voter_hash)
);
create index if not exists gallery_likes_created_idx on ttw.gallery_likes (created_at);

create table if not exists ttw.gallery_like_ip (
  ip_hash text not null,
  day     date not null,
  count   int not null default 0,
  primary key (ip_hash, day)
);

create table if not exists ttw.cat_of_week (
  week_start    date primary key,             -- Monday (Europe/Berlin) the win was announced
  generation_id text not null unique references ttw.generations(id) on delete cascade,
  likes         int not null,
  created_at    timestamptz not null default now()
);

create table if not exists ttw.bonus_credits (
  id            bigserial primary key,
  email         text not null,
  reason        text not null check (reason in ('cat_of_week')),
  source_id     text,                          -- winning generation id
  granted_at    timestamptz not null default now(),
  used_by       text references ttw.generations(id) on delete set null,
  used_at       timestamptz                    -- set when claimed; NULL = unused (survives used_by -> NULL on delete)
);
alter table ttw.bonus_credits add column if not exists used_at timestamptz;
-- "unused" = used_at is null (idempotent upgrade of the old used_by-based partial index)
do $$
begin
  if exists (select 1 from pg_indexes where schemaname = 'ttw' and indexname = 'bonus_credits_email_idx'
             and indexdef not like '%used_at IS NULL%') then
    drop index ttw.bonus_credits_email_idx;
  end if;
end
$$;
create index if not exists bonus_credits_email_idx on ttw.bonus_credits (lower(email)) where used_at is null;

-- cat_of_week: a removed winner must cascade away (idempotent upgrade of DBs created without cascade)
alter table ttw.cat_of_week
  drop constraint if exists cat_of_week_generation_id_fkey,
  add constraint cat_of_week_generation_id_fkey foreign key (generation_id) references ttw.generations(id) on delete cascade;
