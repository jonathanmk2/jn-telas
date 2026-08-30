# JN TELAS — Correção da versão publicada

## O que foi corrigido
- Os 3 planos agora aparecem mesmo se o Supabase ainda não estiver configurado.
- Nenhum middleware ou Edge Function foi adicionado.
- Cadastro e login continuam usando Supabase, mas agora informam claramente quando as variáveis não foram configuradas.

## Para contas, painel e códigos funcionarem
1. Criar/configurar um projeto Supabase.
2. Executar `supabase/migrations/001_ld_cloud_auth_codes.sql` no SQL Editor do Supabase.
3. Na Vercel > Settings > Environment Variables, adicionar:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   - SUPABASE_SERVICE_ROLE_KEY
4. Fazer Redeploy.

## Planos
- 1 Tela: R$ 35,00
- 5 Telas: R$ 170,00
- 10 Telas: R$ 330,00

## Importante
O ZIP original recebido estava nomeado como `sem-middleware`, mas internamente a pasta raiz era
`jn-telas-site-edge-corrigido`. Esta correção não adiciona middleware.
