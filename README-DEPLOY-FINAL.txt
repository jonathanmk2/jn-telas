JN TELAS — VERSÃO FINAL PARA CONFIGURAÇÃO

1) SUPABASE
- Crie o projeto no Supabase.
- Execute, nesta ordem, as migrations:
  supabase/migrations/001_ld_cloud_auth_codes.sql
  supabase/migrations/002_payments.sql
- No Authentication > URL Configuration, configure a URL do site e as URLs de redirecionamento.
- Para transformar sua conta em admin, execute no SQL Editor:
  update public.profiles set is_admin = true where email = 'SEU_EMAIL';

2) MERCADO PAGO
Na Vercel, configure:
- MERCADO_PAGO_ACCESS_TOKEN
- NEXT_PUBLIC_SITE_URL

Nunca coloque o Access Token em NEXT_PUBLIC_*. Ele deve ficar apenas no servidor.

3) VERCEL
Configure também:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SERVICE_ROLE_KEY

4) WEBHOOK
Depois do deploy, use:
https://SEU-DOMINIO/api/mercadopago/webhook

O webhook marca o pedido como pago e tenta entregar automaticamente o primeiro código disponível do plano correspondente.

IMPORTANTE
Antes de produção, faça um pagamento de teste e confirme que existem códigos cadastrados para cada plano.
