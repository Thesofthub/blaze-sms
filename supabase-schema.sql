-- ============================================================
-- Telnyx SMS Platform — Supabase Schema
-- Run this entire file in: Supabase → SQL Editor → New Query
-- ============================================================

-- ── CONTACTS ────────────────────────────────────────────────
create table if not exists contacts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null unique,
  tags       text[] default '{}',
  created_at timestamptz default now()
);

-- ── MESSAGES ────────────────────────────────────────────────
create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  telnyx_id  text,
  direction  text not null check (direction in ('inbound', 'outbound')),
  from_phone text,
  from_name  text,
  to_phone   text,
  to_name    text,
  text       text,
  status     text default 'queued',
  auto       boolean default false,
  created_at timestamptz default now()
);

create index if not exists messages_from_phone_idx on messages(from_phone);
create index if not exists messages_to_phone_idx   on messages(to_phone);
create index if not exists messages_telnyx_id_idx  on messages(telnyx_id);

-- ── AUTO-REPLY RULES ─────────────────────────────────────────
create table if not exists auto_replies (
  id         uuid primary key default gen_random_uuid(),
  trigger    text not null unique,
  response   text not null,
  active     boolean default true,
  created_at timestamptz default now()
);

-- ── SEED: default auto-reply rules ───────────────────────────
insert into auto_replies (trigger, response) values
  ('YES',  'Great, confirmed! Our estimator will be in touch within 24 hours.'),
  ('STOP', 'You have been unsubscribed. Reply START to re-subscribe.'),
  ('HELP', 'For help call us at 1-800-555-0100 or email plans@blazeestimating.com.')
on conflict (trigger) do nothing;

-- ── SEED: sample contacts ─────────────────────────────────────
insert into contacts (name, phone, tags) values
  ('John Carter',   '+13105550101', array['client']),
  ('Sara Mitchell', '+19175550188', array['client', 'vip']),
  ('Mike Lawson',   '+17025550134', array['prospect'])
on conflict (phone) do nothing;

-- ── ROW LEVEL SECURITY (disable for service key usage) ───────
-- The Netlify functions use the service role key which bypasses RLS.
-- If you want to enable RLS later for additional security, uncomment:
-- alter table contacts    enable row level security;
-- alter table messages    enable row level security;
-- alter table auto_replies enable row level security;

select 'Schema created successfully!' as result;
