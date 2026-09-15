'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format'
import { toast } from 'sonner'
import type { Product } from '@/components/landing/pricing'

function unitPrice(quantity: number) {
  if (quantity >= 10) return 2200
  if (quantity >= 5) return 2300
  return 100
}

export function VsPhonePricing({ products, isLoggedIn }: { products: Product[]; isLoggedIn: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [quantity, setQuantity] = useState(1)
  const [stockMessage, setStockMessage] = useState<string | null>(null)
  const keyRef = useRef<string | null>(null)
  const product = products.find((p) => p.screens === 1) ?? products[0] ?? null
  const price = unitPrice(quantity)
  const total = quantity * price

  function change(value: number) {
    setQuantity(Math.max(1, Math.min(500, Math.floor(value))))
    setStockMessage(null)
    keyRef.current = null
  }

  function buy() {
    if (!product) return toast.error('VSPhone indisponível no momento.')
    if (!isLoggedIn) return router.push('/auth/sign-up?next=/minha-conta')
    if (!keyRef.current) keyRef.current = crypto.randomUUID()
    const key = keyRef.current
    startTransition(async () => {
      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
          body: JSON.stringify({ productId: product.id, quantity }),
        })
        const data = await response.json()
        if (response.ok && data.ok) {
          keyRef.current = null
          window.dispatchEvent(new CustomEvent('jn:pix-created', { detail: data }))
          toast.success('Pagamento PIX gerado. Abra Minha Conta para continuar o pagamento.')
          router.push('/minha-conta')
          return
        }
        keyRef.current = null
        if (data.needsAuth) return router.push('/auth/login?next=/minha-conta')
        const message = data.error ?? 'Não foi possível criar o pedido.'
        if (/estoque|c[oó]digos? dispon[ií]veis|insuficiente/i.test(message)) setStockMessage(message)
        toast.error(message)
      } catch {
        keyRef.current = null
        toast.error('Não foi possível gerar o pagamento agora.')
      }
    })
  }

  return (
    <section className="bg-secondary/30 pb-5 pt-2">
      <div className="mx-auto max-w-2xl px-3 sm:px-4">
        <div className="relative mx-auto max-w-lg rounded-2xl border border-primary bg-card p-4 shadow-xl shadow-primary/15 sm:p-5">
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-0.5 text-[10px] font-semibold text-primary-foreground">VIP • 30 DIAS DE ACESSO</div>
          <div className="pt-3 text-center">
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-xl font-black text-primary shadow-[0_0_24px_rgba(117,103,255,0.25)]">VS</div>
            <h3 className="text-xl font-bold">VSPHONE VIP</h3>
            <p className="mt-0.5 text-xs font-semibold text-primary">30 DIAS</p>
            <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">Código de ativação • Entrega automática após o PIX</p>
            <div className="mt-2 flex items-baseline justify-center gap-1"><span className="text-3xl font-bold sm:text-4xl">{formatBRL(price)}</span><span className="text-xs text-muted-foreground">/ tela</span></div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" onClick={() => change(quantity - 1)} disabled={pending || quantity <= 1}><Minus className="size-4" /></Button>
            <div className="flex h-9 flex-1 items-center justify-center rounded-lg border bg-background text-base font-bold">{quantity}</div>
            <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" onClick={() => change(quantity + 1)} disabled={pending || quantity >= 500}><Plus className="size-4" /></Button>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border bg-secondary/40 p-2 text-center text-[10px]">
            <div className={quantity < 5 ? 'font-bold text-primary' : 'text-muted-foreground'}><div>1–4</div><div>R$ 1 TESTE</div></div>
            <div className={quantity >= 5 && quantity < 10 ? 'font-bold text-primary' : 'text-muted-foreground'}><div>5–9</div><div>R$ 23</div></div>
            <div className={quantity >= 10 ? 'font-bold text-primary' : 'text-muted-foreground'}><div>10+</div><div>R$ 22</div></div>
          </div>

          <div className="mt-2 flex items-center justify-between rounded-lg border bg-background px-3 py-2"><span className="text-xs text-muted-foreground">{quantity} tela{quantity === 1 ? '' : 's'} × {formatBRL(price)}</span><span className="text-lg font-bold">{formatBRL(total)}</span></div>
          <div className="mt-2 grid grid-cols-3 gap-1 border-t pt-2">
            {['30 dias de acesso', 'Ativação por código', 'Pagamento seguro (PIX)'].map((text) => <div key={text} className="flex flex-col items-center gap-0.5 text-center text-[9px] text-muted-foreground"><Check className="size-3 text-primary" /><span>{text}</span></div>)}
          </div>
          <Button className="mt-2 h-9 w-full text-sm" onClick={buy} disabled={pending || !product}>{pending ? <><Loader2 className="size-4 animate-spin" />Processando...</> : <>Comprar {quantity} {quantity === 1 ? 'tela' : 'telas'}</>}</Button>
          {stockMessage && <div role="alert" className="mt-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-center text-xs text-yellow-700 dark:text-yellow-300">{stockMessage}</div>}
        </div>
      </div>
    </section>
  )
}
