-- SellerBot RAG setup for Supabase pgvector
-- Run this in Supabase SQL Editor once for your project.

create extension if not exists vector;

create table if not exists public.product_embeddings (
  id bigserial primary key,
  seller_uid text not null,
  product_id text not null,
  product_name text not null default '',
  bangla_name text not null default '',
  price numeric not null default 0,
  cost_price numeric not null default 0,
  tags text[] not null default '{}',
  embedding vector(384) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_embeddings_seller_product_unique unique (seller_uid, product_id)
);

create table if not exists public.zone_embeddings (
  id bigserial primary key,
  seller_uid text not null,
  zone_id text not null,
  area text not null default '',
  bangla_area text not null default '',
  charge numeric not null default 0,
  keywords text[] not null default '{}',
  embedding vector(384) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zone_embeddings_seller_zone_unique unique (seller_uid, zone_id)
);

create index if not exists product_embeddings_embedding_idx
  on public.product_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists zone_embeddings_embedding_idx
  on public.zone_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.match_products(
  query_embedding vector(384),
  seller_uid_filter text,
  match_threshold float default 0.45,
  match_count int default 5
)
returns table (
  id bigint,
  product_id text,
  product_name text,
  bangla_name text,
  price numeric,
  cost_price numeric,
  tags text[],
  similarity float
)
language sql stable
as $$
  select
    pe.id,
    pe.product_id,
    pe.product_name,
    pe.bangla_name,
    pe.price,
    pe.cost_price,
    pe.tags,
    1 - (pe.embedding <=> query_embedding) as similarity
  from public.product_embeddings pe
  where pe.seller_uid = seller_uid_filter
    and 1 - (pe.embedding <=> query_embedding) >= match_threshold
  order by pe.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_zones(
  query_embedding vector(384),
  seller_uid_filter text,
  match_threshold float default 0.35,
  match_count int default 3
)
returns table (
  id bigint,
  zone_id text,
  area text,
  bangla_area text,
  charge numeric,
  keywords text[],
  similarity float
)
language sql stable
as $$
  select
    ze.id,
    ze.zone_id,
    ze.area,
    ze.bangla_area,
    ze.charge,
    ze.keywords,
    1 - (ze.embedding <=> query_embedding) as similarity
  from public.zone_embeddings ze
  where ze.seller_uid = seller_uid_filter
    and 1 - (ze.embedding <=> query_embedding) >= match_threshold
  order by ze.embedding <=> query_embedding
  limit match_count;
$$;

alter table public.product_embeddings enable row level security;
alter table public.zone_embeddings enable row level security;

-- SellerBot uses Firebase Auth, so Supabase cannot verify the Firebase uid in RLS with the anon key.
-- For the prototype, allow anon access to these embedding tables and always filter by seller_uid in RPC/client calls.
-- Before production, move embedding writes/search behind a server API that verifies Firebase ID tokens.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'product_embeddings' and policyname = 'prototype_product_embeddings_access') then
    create policy prototype_product_embeddings_access
      on public.product_embeddings
      for all
      using (true)
      with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'zone_embeddings' and policyname = 'prototype_zone_embeddings_access') then
    create policy prototype_zone_embeddings_access
      on public.zone_embeddings
      for all
      using (true)
      with check (true);
  end if;
end $$;
