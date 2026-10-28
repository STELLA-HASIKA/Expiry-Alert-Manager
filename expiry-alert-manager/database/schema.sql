-- Expiry Alert Manager database schema
-- Run this entire script in Supabase Dashboard > SQL Editor.
-- This educational starter uses the Supabase anon/publishable key on the backend.
-- The products table is intentionally public for this single-user demo; see README
-- for limitations and the steps required before supporting multiple real users.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  category text not null check (category in ('Food', 'Medicine', 'Personal Care', 'Household', 'Other')),
  quantity integer not null default 1 check (quantity between 1 and 99999),
  expiry_date date not null,
  notes text null check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_expiry_date_idx on public.products (expiry_date);
create index if not exists products_category_idx on public.products (category);
create index if not exists products_name_idx on public.products (name);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

alter table public.products enable row level security;

-- Explicit policies for the beginner-friendly, single-user demo.
-- IMPORTANT: these policies allow anyone with the public API key to read/write
-- product data. Do not use this configuration for private or production data.
drop policy if exists "Demo users can read products" on public.products;
create policy "Demo users can read products"
on public.products for select to anon, authenticated using (true);

drop policy if exists "Demo users can add products" on public.products;
create policy "Demo users can add products"
on public.products for insert to anon, authenticated with check (true);

drop policy if exists "Demo users can update products" on public.products;
create policy "Demo users can update products"
on public.products for update to anon, authenticated using (true) with check (true);

drop policy if exists "Demo users can delete products" on public.products;
create policy "Demo users can delete products"
on public.products for delete to anon, authenticated using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.products to anon, authenticated;
