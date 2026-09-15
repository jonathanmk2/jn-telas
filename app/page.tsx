import { SiteNavbar } from '@/components/site-navbar'
import { Hero } from '@/components/landing/hero'
import { Benefits } from '@/components/landing/benefits'
import { Pricing, type Product } from '@/components/landing/pricing'
import { VsPhonePricing } from '@/components/landing/vsphone-pricing'
import { Faq } from '@/components/landing/faq'
import { Support } from '@/components/landing/support'
import { Footer } from '@/components/landing/footer'
import { WhatsAppButton } from '@/components/whatsapp-button'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type PlatformProduct = Product & { platform: 'ldcloud' | 'vsphone' }

export default async function HomePage() {
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
  let user: { email?: string | null } | null = null
  let isAdmin = false
  let products: PlatformProduct[] = []

  if (hasSupabase) {
    try {
      const supabase = await createClient()
      const { data: { user: sessionUser } } = await supabase.auth.getUser()
      user = sessionUser
      const { data, error: productsError } = await supabase.from('products').select('id, name, screens, price_cents, platform').eq('active', true).order('screens', { ascending: true })
      if (productsError) console.error('Erro ao carregar produtos:', productsError)
      else if (data) products = data.map((item) => ({ ...item, platform: item.platform === 'vsphone' ? 'vsphone' : 'ldcloud', description: null })) as PlatformProduct[]

      if (sessionUser) {
        const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', sessionUser.id).single()
        isAdmin = profile?.is_admin ?? false
      }
    } catch (error) { console.error('Supabase indisponível:', error) }
  }

  if (!hasSupabase) {
    products = [
      { id: 'ld-1', name: '1 Tela LD CLOUD VIP', screens: 1, price_cents: 3500, description: 'VIP • 30 dias', platform: 'ldcloud' },
      { id: 'vs-1', name: '1 Tela VSPHONE VIP 30 DIAS', screens: 1, price_cents: 2400, description: 'VIP • 30 dias', platform: 'vsphone' },
    ]
  }

  const ldProducts = products.filter((p) => p.platform === 'ldcloud')
  const vsProducts = products.filter((p) => p.platform === 'vsphone')

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteNavbar user={user ? { email: user.email ?? null, isAdmin } : null} />
      <main className="flex-1">
        <Hero />
        <Pricing products={ldProducts} isLoggedIn={!!user} />
        <VsPhonePricing products={vsProducts} isLoggedIn={!!user} />
        <Benefits />
        <Faq />
        <Support />
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  )
}
