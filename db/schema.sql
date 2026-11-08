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
