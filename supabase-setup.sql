-- Palengke marketplace: run once in the Supabase SQL editor.

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 80),
  description text not null check (char_length(description) between 10 and 2000),
  price numeric(12,2) not null check (price >= 0 and price <= 10000000),
  seller_email text not null check (seller_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' and char_length(seller_email) <= 120),
  category text not null check (category in ('electronics','home','clothing','books','vehicles','hobbies','other')),
  image_url text not null,
  created_at timestamptz not null default now()
);
create index if not exists listings_created_idx on public.listings (created_at desc);
create index if not exists listings_cat_idx on public.listings (category, created_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_name text not null check (char_length(buyer_name) between 1 and 60),
  buyer_email text not null check (buyer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' and char_length(buyer_email) <= 120),
  body text not null check (char_length(body) between 2 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists messages_listing_idx on public.messages (listing_id);

-- Row level security: anyone can browse and post listings, anyone can send a message.
alter table public.listings enable row level security;
alter table public.messages enable row level security;
create policy "Anyone can browse listings" on public.listings for select to anon, authenticated using (true);
create policy "Anyone can post a listing" on public.listings for insert to anon, authenticated with check (true);
create policy "Anyone can message a seller" on public.messages for insert to anon, authenticated with check (true);
-- No select policy on messages: buyers' messages are private (read them in the dashboard).

-- Keep seller emails private: the public API can read every column except seller_email.
revoke select on public.listings from anon, authenticated;
grant select (id, title, description, price, category, image_url, created_at) on public.listings to anon, authenticated;
revoke select on public.messages from anon, authenticated;

-- Photos: public bucket, images only, 5 MB max.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 5242880, array['image/jpeg','image/png','image/gif','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

create policy "Anyone can upload listing photos" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'listing-photos');
