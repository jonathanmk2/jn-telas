'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format'
import { createOrder } from '@/app/actions/orders'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export type Product = {
  id: string
  name: string
  screens: number
  price_cents: number
  description: string | null
}

const featuresByScreens: Record<number, string[]> = {
  1: ['1 tela simultânea', 'Qualidade Full HD', 'Suporte via WhatsApp'],
  5: ['5 telas simultâneas', 'Qualidade Full HD/4K', 'Suporte prioritário', 'Ideal para a família'],
  10: [
    '10 telas simultâneas',
    'Qualidade Full HD/4K',
    'Suporte prioritário',
    'Ideal para revenda',
    'Melhor custo por tela',
  ],
}

export function Pricing({ products, isLoggedIn }: { products: Product[]; isLoggedIn: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [activeId, setActiveId] = useState<string | null>(null)

  function handleBuy(product: Product) {
    if (!isLoggedIn) {
      router.push(`/auth/sign-up?next=/minha-conta`)
      return
    }
    setActiveId(product.id)
    startTransition(async () => {
      const res = await createOrder(product.id)
      if (res.ok) {
        toast.success('Redirecionando para o pagamento seguro...')
        window.location.href = res.checkoutUrl
      } else if (res.needsAuth) {
        router.push('/auth/login?next=/minha-conta')
      } else {
        toast.error(res.error)
      }
      setActiveId(null)
    })
  }

  const highlighted = 5

  return (
    <section id="planos" className="scroll-mt-20 bg-secondary/30 py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
            Planos e preços
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            Escolha a quantidade de telas ideal. Sem fidelidade, sem surpresas.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {products.map((product) => {
            const isHighlight = product.screens === highlighted
            const features = featuresByScreens[product.screens] ?? []
            const loading = pending && activeId === product.id
            return (
              <div
                key={product.id}
                className={cn(
                  'relative flex flex-col rounded-2xl border bg-card p-6',
                  isHighlight
                    ? 'border-primary shadow-lg shadow-primary/10'
                    : 'border-border/60',
                )}
              >
                {isHighlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Mais popular
                  </span>
                )}
                <h3 className="text-lg font-semibold">{product.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {product.description ?? `Acesso para ${product.screens} tela(s)`}
                </p>
                <div className="mt-5 flex items-end gap-1">
                  <span className="text-4xl font-bold tracking-tight">
                    {formatBRL(product.price_cents)}
                  </span>
                  <span className="mb-1 text-sm text-muted-foreground">/mês</span>
                </div>

                <ul className="mt-6 flex flex-1 flex-col gap-3">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-8"
                  variant={isHighlight ? 'default' : 'secondary'}
                  onClick={() => handleBuy(product)}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Processando...
                    </>
                  ) : (
                    'Comprar Agora'
                  )}
                </Button>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
