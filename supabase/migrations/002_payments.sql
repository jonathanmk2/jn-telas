-- Pagamentos Mercado Pago e vínculo do código entregue ao pedido
alter table public.orders add column if not exists payment_preference_id text;
alter table public.orders add column if not exists payment_id text;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists activation_code_id uuid references public.activation_codes(id) on delete set null;
create unique index if not exists orders_payment_id_unique on public.orders(payment_id) where payment_id is not null;
