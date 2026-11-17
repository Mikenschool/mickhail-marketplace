-- Test 4: Stripe Connect. Run once in the Supabase SQL editor AFTER supabase-setup.sql.
-- Replace CHANGE_ME with the same random value you put in SERVER_TOKEN (Vercel env).
-- The browser only uses the public anon key, so every write that matters goes through
-- these functions, and they only work when the server passes the right token.

-- 1. New public columns on listings
alter table public.listings add column if not exists sold boolean not null default false;
alter table public.listings add column if not exists buyable boolean not null default false;
grant select (sold, buyable) on public.listings to anon, authenticated;
-- Visitors may only fill in the normal fields, never sold/buyable.
revoke insert on public.listings from anon, authenticated;
grant insert (title, description, price, seller_email, category, image_url) on public.listings to anon, authenticated;

-- 2. Private tables (no API access at all)
create schema if not exists app_private;
revoke all on schema app_private from anon, authenticated;

create table if not exists app_private.settings (key text primary key, value text not null);
alter table app_private.settings enable row level security;
insert into app_private.settings (key, value) values ('server_token', 'CHANGE_ME')
on conflict (key) do update set value = excluded.value;

create table if not exists public.sellers (
  email text primary key,
  stripe_account_id text not null unique,
  onboarded boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.sellers enable row level security;  -- no policies: invisible to the public
revoke all on public.sellers from anon, authenticated;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  stripe_session_id text not null unique,
  stripe_account_id text not null,
  amount_total bigint not null,       -- in centavos
  application_fee bigint not null,    -- platform fee in centavos
  currency text not null,
  buyer_email text,
  status text not null default 'paid',
  created_at timestamptz not null default now()
);
alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;

-- 3. Keep listings.buyable in sync with the seller's Stripe status
create or replace function app_private.check_token(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_token is null or p_token <> (select value from app_private.settings where key = 'server_token') then
    raise exception 'not allowed';
  end if;
end $$;

create or replace function app_private.listing_buyable() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.sold := false;
  new.buyable := exists (select 1 from public.sellers s where s.email = lower(new.seller_email) and s.onboarded);
  return new;
end $$;
drop trigger if exists listings_buyable on public.listings;
create trigger listings_buyable before insert on public.listings
for each row execute function app_private.listing_buyable();

-- 4. Server-only functions (called from Next.js API routes with the token)
create or replace function public.get_seller(p_token text, p_email text)
returns table (stripe_account_id text, onboarded boolean)
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.check_token(p_token);
  return query select s.stripe_account_id, s.onboarded from public.sellers s where s.email = lower(trim(p_email));
end $$;

create or replace function public.save_seller(p_token text, p_email text, p_account text, p_onboarded boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.check_token(p_token);
  insert into public.sellers (email, stripe_account_id, onboarded)
  values (lower(trim(p_email)), p_account, p_onboarded)
  on conflict (email) do update set stripe_account_id = excluded.stripe_account_id,
    onboarded = excluded.onboarded, updated_at = now();
  update public.listings set buyable = p_onboarded where lower(seller_email) = lower(trim(p_email)) and not sold;
end $$;

-- Used by the account.updated webhook: only touches accounts we already know.
create or replace function public.set_account_status(p_token text, p_account text, p_onboarded boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_email text;
begin
  perform app_private.check_token(p_token);
  update public.sellers set onboarded = p_onboarded, updated_at = now()
  where stripe_account_id = p_account returning email into v_email;
  if v_email is null then return false; end if;
  update public.listings set buyable = p_onboarded where lower(seller_email) = v_email and not sold;
  return true;
end $$;

create or replace function public.checkout_info(p_token text, p_listing uuid)
returns table (title text, price numeric, image_url text, sold boolean, stripe_account_id text, onboarded boolean)
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.check_token(p_token);
  return query
    select l.title, l.price, l.image_url, l.sold, s.stripe_account_id, coalesce(s.onboarded, false)
    from public.listings l left join public.sellers s on s.email = lower(l.seller_email)
    where l.id = p_listing;
end $$;

-- Saves the order once (safe to call twice) and marks the listing as Sold.
create or replace function public.record_order(
  p_token text, p_listing uuid, p_session text, p_account text,
  p_amount bigint, p_fee bigint, p_currency text, p_buyer_email text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_ok boolean;
begin
  perform app_private.check_token(p_token);
  -- The payment must belong to this listing's seller.
  select exists (
    select 1 from public.listings l join public.sellers s on s.email = lower(l.seller_email)
    where l.id = p_listing and s.stripe_account_id = p_account
  ) into v_ok;
  if not v_ok then return false; end if;
  insert into public.orders (listing_id, stripe_session_id, stripe_account_id, amount_total, application_fee, currency, buyer_email)
  values (p_listing, p_session, p_account, p_amount, p_fee, p_currency, p_buyer_email)
  on conflict (stripe_session_id) do nothing;
  update public.listings set sold = true, buyable = false where id = p_listing;
  return true;
end $$;

create or replace function public.get_order(p_token text, p_session text)
returns table (listing_id uuid, amount_total bigint, application_fee bigint, currency text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.check_token(p_token);
  return query select o.listing_id, o.amount_total, o.application_fee, o.currency, o.created_at
    from public.orders o where o.stripe_session_id = p_session;
end $$;

revoke execute on function public.get_seller, public.save_seller, public.set_account_status,
  public.checkout_info, public.record_order, public.get_order from public;
grant execute on function public.get_seller, public.save_seller, public.set_account_status,
  public.checkout_info, public.record_order, public.get_order to anon, authenticated;
