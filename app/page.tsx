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
      )
  )

  let user: { email?: string | null } | null = null

  // Planos padrão
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

      const { data } = await supabase
        .from('products')
        .select('id, name, screens, price_cents, description')
        .eq('active', true)
        .order('screens', { ascending: true })

      if (data && data.length > 0) {
        products = data as Product[]
      }

      if (sessionUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', sessionUser.id)
          .single()

        isAdmin = profile?.is_admin ?? false
      }
    } catch (error) {
      console.error('Supabase indisponível:', error)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteNavbar
        user={user ? { email: user.email ?? null, isAdmin } : null}
      />

      <main className="flex-1">
        <Hero />

        {/* CARD DE VENDA — MANTIDO ORIGINAL */}
        <Pricing
          products={products}
          isLoggedIn={!!user}
        />

        {/* DEMAIS INFORMAÇÕES ABAIXO */}
        <Benefits />
        <Faq />
        <Support />
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  )
}
