'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Loader2, Minus, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format'
import { toast } from 'sonner'
import type { Product } from '@/components/landing/pricing'

type Payment = { orderId: string; qrCode: string | null; qrCodeBase64: string | null }

function unitPrice(quantity: number) {
  if (quantity >= 10) return 2200
  if (quantity >= 5) return 2300
  return 2400
}

export function VsPhonePricing({ products, isLoggedIn }: { products: Product[]; isLoggedIn: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [quantity, setQuantity] = useState(1)
  const [stockMessage, setStockMessage] = useState<string | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState('pending')
  const keyRef = useRef<string | null>(null)
  const product = products.find((p) => p.screens === 1) ?? products[0] ?? null
  const price = unitPrice(quantity)
  const total = quantity * price

  function change(value: number) { setQuantity(Math.max(1, Math.min(500, Math.floor(value)))); setStockMessage(null); keyRef.current = null }
  function buy() {
    if (!product) return toast.error('VSPhone indisponível no momento.')
    if (!isLoggedIn) return router.push('/auth/sign-up?next=/minha-conta')
    if (!keyRef.current) keyRef.current = crypto.randomUUID()
    const key = keyRef.current
    startTransition(async () => {
      try {
        const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ productId: product.id, quantity }) })
        const data = await response.json()
        if (response.ok && data.ok) { keyRef.current = null; setPayment({ orderId: data.orderId, qrCode: data.qrCode ?? null, qrCodeBase64: data.qrCodeBase64 ?? null }); setStatus('pending'); setCopied(false); window.dispatchEvent(new CustomEvent('jn:pix-created', { detail: data })); toast.success('Pagamento PIX gerado com sucesso!'); return }
        keyRef.current = null
        if (data.needsAuth) return router.push('/auth/login?next=/minha-conta')
        const message = data.error ?? 'Não foi possível criar o pedido.'
        if (/estoque|c[oó]digos? dispon[ií]veis|insuficiente/i.test(message)) setStockMessage(message)
        toast.error(message)
      } catch { keyRef.current = null; toast.error('Não foi possível gerar o pagamento agora.') }
    })
  }

  useEffect(() => {
    if (!payment?.orderId || status !== 'pending') return
    let active = true
    async function check() { try { const response = await fetch(`/api/payment-status?orderId=${payment!.orderId}`, { cache: 'no-store' }); if (!response.ok) return; const data = await response.json(); if (!active) return; if (data.status === 'paid' || data.status === 'delivered') { setStatus(data.status); toast.success('Pagamento confirmado com sucesso!'); router.refresh() } else if (data.status === 'cancelled') setStatus('cancelled') } catch {} }
    check(); const timer = window.setInterval(check, 3000); return () => { active = false; window.clearInterval(timer) }
  }, [payment?.orderId, status, router])

  async function copyPix() { if (!payment?.qrCode) return; try { await navigator.clipboard.writeText(payment.qrCode); setCopied(true); toast.success('PIX copiado com sucesso!'); window.setTimeout(() => setCopied(false), 2500) } catch { toast.error('Não foi possível copiar o código PIX.') } }
  const qrImage = payment?.qrCodeBase64 ? (payment.qrCodeBase64.startsWith('data:image') ? payment.qrCodeBase64 : `data:image/png;base64,${payment.qrCodeBase64}`) : null

  return <>
    <section className="bg-secondary/30 pb-5 pt-2"><div className="mx-auto max-w-2xl px-3 sm:px-4"><div className="relative mx-auto max-w-lg rounded-2xl border border-primary bg-card p-4 shadow-xl shadow-primary/15 sm:p-5">
      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-0.5 text-[10px] font-semibold text-primary-foreground">VIP • 30 DIAS DE ACESSO</div>
      <div className="pt-3 text-center"><div className="group relative mx-auto mb-3 flex h-20 w-full max-w-sm items-center justify-center overflow-hidden rounded-2xl border border-amber-300/80 bg-zinc-950 shadow-[0_0_28px_rgba(245,158,11,0.32)]"><div className="absolute inset-2 rounded-[50%] border border-amber-400/70 animate-pulse" /><div className="absolute -left-10 top-0 h-full w-8 -skew-x-12 bg-amber-100/40 blur-sm animate-[vsphoneShine_2.8s_ease-in-out_infinite]" /><div className="relative z-10 flex items-center gap-3 animate-[vsphoneFloat_3s_ease-in-out_infinite]"><span className="text-4xl font-black text-amber-50 drop-shadow-[0_0_8px_rgba(245,158,11,0.9)]">∞</span><span className="text-2xl font-black italic tracking-tight"><span className="text-white">VS</span><span className="text-amber-400">PHONE</span></span></div><div className="absolute bottom-2 left-1/2 h-px w-2/3 -translate-x-1/2 bg-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.9)]" /></div><style jsx>{`@keyframes vsphoneFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-3px) scale(1.03)}}@keyframes vsphoneShine{0%,35%{transform:translateX(-30px) skewX(-12deg);opacity:0}50%{opacity:1}75%,100%{transform:translateX(220px) skewX(-12deg);opacity:0}}@media (prefers-reduced-motion:reduce){.animate-pulse{animation:none!important}}`}</style><h3 className="text-xl font-bold">VSPHONE VIP</h3><p className="mt-0.5 text-xs font-semibold text-primary">30 DIAS</p><p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">Código de ativação • Entrega automática após o PIX</p><div className="mt-2 flex items-baseline justify-center gap-1"><span className="text-3xl font-bold sm:text-4xl">{formatBRL(price)}</span><span className="text-xs text-muted-foreground">/ tela</span></div></div>
      <div className="mt-3 flex items-center gap-2"><Button type="button" variant="outline" size="icon" className="size-9 shrink-0" onClick={() => change(quantity - 1)} disabled={pending || quantity <= 1}><Minus className="size-4" /></Button><div className="flex h-9 flex-1 items-center justify-center rounded-lg border bg-background text-base font-bold">{quantity}</div><Button type="button" variant="outline" size="icon" className="size-9 shrink-0" onClick={() => change(quantity + 1)} disabled={pending || quantity >= 500}><Plus className="size-4" /></Button></div>
      <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border bg-secondary/40 p-2 text-center text-[10px]"><div className={quantity < 5 ? 'font-bold text-primary' : 'text-muted-foreground'}><div>1–4</div><div>R$ 24</div></div><div className={quantity >= 5 && quantity < 10 ? 'font-bold text-primary' : 'text-muted-foreground'}><div>5–9</div><div>R$ 23</div></div><div className={quantity >= 10 ? 'font-bold text-primary' : 'text-muted-foreground'}><div>10+</div><div>R$ 22</div></div></div>
      <div className="mt-2 flex items-center justify-between rounded-lg border bg-background px-3 py-2"><span className="text-xs text-muted-foreground">{quantity} tela{quantity === 1 ? '' : 's'} × {formatBRL(price)}</span><span className="text-lg font-bold">{formatBRL(total)}</span></div>
      <div className="mt-2 grid grid-cols-3 gap-1 border-t pt-2">{['30 dias de acesso', 'Ativação por código', 'Pagamento seguro (PIX)'].map((text) => <div key={text} className="flex flex-col items-center gap-0.5 text-center text-[9px] text-muted-foreground"><Check className="size-3 text-primary" /><span>{text}</span></div>)}</div>
      <Button className="mt-2 h-9 w-full text-sm" onClick={buy} disabled={pending || !product}>{pending ? <><Loader2 className="size-4 animate-spin" />Processando...</> : <>Comprar {quantity} {quantity === 1 ? 'tela' : 'telas'}</>}</Button>{stockMessage && <div role="alert" className="mt-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-center text-xs text-yellow-700 dark:text-yellow-300">{stockMessage}</div>}
    </div></div></section>
    {payment && <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm"><div className="relative my-auto w-full max-w-md rounded-2xl border border-primary/40 bg-card p-5 shadow-2xl"><button type="button" onClick={() => setPayment(null)} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"><X className="size-5" /></button>{status === 'paid' || status === 'delivered' ? <div className="py-8 text-center"><Check className="mx-auto size-12 text-primary" /><h3 className="mt-3 text-2xl font-bold">Pagamento confirmado!</h3><p className="mt-2 text-sm text-muted-foreground">Seu código VSPhone já está sendo entregue na sua conta.</p><Button className="mt-5 w-full" onClick={() => { setPayment(null); router.push('/minha-conta') }}>Ver meu código</Button></div> : <><h3 className="pr-8 text-center text-xl font-bold">Pagamento via PIX</h3><p className="mt-1 text-center text-sm text-muted-foreground">{quantity} tela{quantity === 1 ? '' : 's'} • {formatBRL(total)}</p>{qrImage && <div className="mx-auto mt-4 w-fit rounded-xl bg-white p-3"><img src={qrImage} alt="QR Code PIX" className="h-64 w-64 max-w-full" /></div>}<div className="mt-4"><p className="mb-2 text-sm font-semibold">Código PIX</p><div className="max-h-28 overflow-y-auto break-all rounded-xl border bg-background p-3 text-sm">{payment.qrCode}</div></div><Button className="mt-3 w-full" onClick={copyPix}><Copy className="size-4" />{copied ? 'PIX copiado com sucesso!' : 'Copiar código PIX'}</Button><div className="mt-3 rounded-xl border bg-secondary/30 p-3 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline size-4 animate-spin" />Aguardando confirmação do pagamento...</div></>}</div></div>}
  </>
}
