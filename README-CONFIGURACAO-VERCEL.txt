CONFIGURAÇÃO FINAL - JN TELAS

Esta versão foi corrigida para funcionar com as variáveis já cadastradas na Vercel:

Obrigatórias para Supabase:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

Importante:
- A chave publishable pode ser usada no navegador; não é a service_role.
- NÃO coloque SUPABASE_SERVICE_ROLE_KEY com prefixo NEXT_PUBLIC_.

Necessárias para recursos administrativos/pagamentos:
- SUPABASE_SERVICE_ROLE_KEY
- MERCADO_PAGO_ACCESS_TOKEN
- NEXT_PUBLIC_SITE_URL=https://www.jntelasld.shop

Banco:
Execute no Supabase SQL Editor:
1. supabase/migrations/001_ld_cloud_auth_codes.sql
2. supabase/migrations/002_payments.sql

Depois do primeiro cadastro, para liberar o painel /admin:
No Supabase SQL Editor, marque o perfil desejado como administrador:
update public.profiles set is_admin = true where email = 'SEU_EMAIL';

WhatsApp:
O número configurado nesta versão está em lib/format.ts.
