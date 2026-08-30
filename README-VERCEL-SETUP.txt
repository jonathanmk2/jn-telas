CONFIGURAÇÃO FINAL - JN TELAS

Variáveis já usadas pelo código:

1) NEXT_PUBLIC_SUPABASE_URL
   Valor: URL do projeto Supabase
   Tipo na Vercel: Config

2) NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   Valor: chave pública/anon do Supabase
   Tipo na Vercel: Config

Para painel administrativo e operações privilegiadas:

3) SUPABASE_SERVICE_ROLE_KEY
   Valor: service_role/secret key do Supabase
   Tipo: Secret
   NUNCA usar NEXT_PUBLIC_ e nunca expor no navegador.

Para Mercado Pago:

4) MERCADO_PAGO_ACCESS_TOKEN
   Tipo: Secret

5) NEXT_PUBLIC_SITE_URL
   Ex.: https://seu-dominio.com
   Tipo: Config

Opcional:
6) MERCADO_PAGO_WEBHOOK_SECRET
   Tipo: Secret

Depois de adicionar/alterar variáveis na Vercel, faça Redeploy.

O projeto contém:
- Supabase Auth
- planos carregados do Supabase com fallback
- criação de pedidos
- checkout do Mercado Pago
- webhook do Mercado Pago
- entrega de códigos de ativação
- painel administrativo
- gerenciamento de códigos e pedidos
