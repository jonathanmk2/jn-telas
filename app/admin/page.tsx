import { SiteNavbar } from '@/components/site-navbar'
import { Hero } from '@/components/landing/hero'
import { Benefits } from '@/components/landing/benefits'
import { Pricing, type Product } from '@/components/landing/pricing'
import { Faq } from '@/components/landing/faq'
import { Support } from '@/components/landing/support'
import { Footer } from '@/components/landing/footer'
import { WhatsAppButton } from '@/components/whatsapp-button'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const hasSupabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ),
  )

  let user: {
    email?: string | null
  } | null = null

  let products: Product[] = [
    {
      id: 'plano-1-tela',
      name: '1 Tela LD CLOUD VIP',
      screens: 1,
      price_cents: 3500,
      description: 'Versão VIP • Acesso por 30 dias',
    },
    {
      id: 'plano-5-telas',
      name: '5 Telas LD CLOUD VIP',
      screens: 5,
      price_cents: 17000,
      description: 'Versão VIP • Acesso por 30 dias',
    },
    {
      id: 'plano-10-telas',
      name: '10 Telas LD CLOUD VIP',
      screens: 10,
      price_cents: 33000,
      description: 'Versão VIP • Acesso por 30 dias',
    },
  ]

  let isAdmin = false

  if (hasSupabase) {
    try {
      const supabase = await createClient()

      const {
        data: { user: sessionUser },
      } = await supabase.auth.getUser()

      user = sessionUser

      /*
       * Carrega os produtos ativos.
       */
      const { data: productData } = await supabase
        .from('products')
        .select(
          'id, name, screens, price_cents, description',
        )
        .eq('active', true)
        .order('screens', { ascending: true })

      if (productData && productData.length > 0) {
        products = productData as Product[]
      }

      /*
       * Verifica se o usuário logado é administrador.
       *
       * IMPORTANTE:
       * O valor vem diretamente do perfil do usuário.
       * Somente is_admin = true libera o botão Admin.
       */
      if (sessionUser) {
        const { data: profile, error: profileError } =
          await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', sessionUser.id)
            .maybeSingle()

        if (profileError) {
          console.error(
            'Erro ao verificar administrador:',
            profileError,
          )

          isAdmin = false
        } else {
          isAdmin = profile?.is_admin === true
        }
      }
    } catch (error) {
      console.error(
        'Supabase indisponível:',
        error,
      )

      isAdmin = false
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteNavbar
        user={
          user
            ? {
                email: user.email ?? null,
                isAdmin,
              }
            : null
        }
      />

      <main className="flex-1">
        <Hero />

        {/* CARD DE VENDA — MANTIDO */}
        <Pricing
          products={products}
          isLoggedIn={!!user}
        />

        {/* DEMAIS INFORMAÇÕES */}
        <Benefits />
        <Faq />
        <Support />
      </main>

      <Footer />

      <WhatsAppButton />
    </div>
  )
}
