-- JN TELAS: usuários, produtos, pedidos e códigos de ativação
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  screens integer not null default 1 check (screens > 0),
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id),
  status text not null default 'pending' check (status in ('pending','paid','delivered','cancelled')),
  total_cents integer not null check (total_cents >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.activation_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid references public.profiles(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  status text not null default 'active' check (status in ('active','inactive')),
  assigned_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.activation_codes enable row level security;

-- Cliente vê e edita apenas seu próprio perfil.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Produtos ativos podem ser exibidos no site.
drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products for select using (active = true);

-- Pedidos e códigos pertencem somente ao usuário autenticado.
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders for select to authenticated using (user_id = auth.uid());
drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "codes_select_own" on public.activation_codes;
create policy "codes_select_own" on public.activation_codes for select to authenticated using (user_id = auth.uid());

insert into public.products (name, screens, price_cents)
select * from (values
  ('1 Tela JN TELAS', 1, 3500),
  ('5 Telas JN TELAS', 5, 17000),
  ('10 Telas JN TELAS', 10, 33000)
) as seed(name, screens, price_cents)
where not exists (select 1 from public.products);
