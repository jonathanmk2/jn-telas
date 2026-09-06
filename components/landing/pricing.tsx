'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CheckCircle2, Copy, Loader2, MessageCircle, Minus, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format'
import { toast } from 'sonner'

export type Product = { id: string; name: string; screens: number; price_cents: number; description: string | null }
type PaymentData = { orderId: string; qrCode: string | null; qrCodeBase64: string | null }
type OrderStatus = 'pending' | 'paid' | 'delivered' | 'cancelled' | 'unknown'

function getUnitPriceCents(quantity: number): number {
  if (quantity >= 10) return 3300
  if (quantity >= 5) return 3400
  return 3500
}

function isValidQuantityInput(value: string): boolean {
  return /^(?:[1-9]|[1-9]\d|[1-4]\d{2}|500)$/.test(value)
}

function LdCloudMascot() {
  return (
    <div className="relative mx-auto flex h-28 w-32 shrink-0 -translate-x-3 items-end justify-center sm:h-32 sm:w-36 sm:translate-x-0" aria-label="Mascote LD Cloud">
      <div className="absolute bottom-2 h-20 w-24 rounded-[44%] bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 shadow-[0_0_28px_rgba(117,103,255,0.45)] sm:h-24 sm:w-28">
        <div className="absolute -left-2 top-1/2 h-10 w-5 -translate-y-1/2 rounded-full border-2 border-slate-500/50 bg-slate-300" />
        <div className="absolute -right-2 top-1/2 h-10 w-5 -translate-y-1/2 rounded-full border-2 border-slate-500/50 bg-slate-300" />
        <div className="absolute left-1/2 top-1/2 flex h-12 w-[78%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[45%] border-2 border-slate-500/40 bg-slate-950 shadow-[inset_0_0_18px_rgba(35,112,255,0.45)] sm:h-14">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]" />
          </div>
          <span className="absolute bottom-1.5 left-1/2 h-2 w-5 -translate-x-1/2 rounded-b-full border-b-2 border-cyan-300" />
        </div>
        <div className="absolute -bottom-5 left-1/2 flex h-10 w-20 -translate-x-1/2 items-center justify-center rounded-b-[45%] rounded-t-xl bg-slate-100 shadow-md">
          <span className="rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-black tracking-wide text-slate-700">LD</span>
        </div>
      </div>
      <div className="absolute bottom-7 left-0 h-7 w-10 rotate-12 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 opacity-90 blur-[1px]" />
      <div className="absolute right-0 top-7 flex h-8 w-8 rotate-12 items-center justify-center rounded-full bg-violet-500 text-sm font-bold text-white shadow-[0_0_16px_rgba(139,92,246,0.65)]">✓</div>
      <div className="absolute -bottom-1 left-1/2 h-2 w-20 -translate-x-1/2 rounded-full bg-primary/30 blur-md" />
    </div>
  )
}

export function Pricing({ products, isLoggedIn }: { products: Product[]; isLoggedIn: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [payment, setPayment] = useState<PaymentData | null>(null)
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('pending')
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [pixCopied, setPixCopied] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [quantityInput, setQuantityInput] = useState('1')
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null)
  const [stockMessage, setStockMessage] = useState<string | null>(null)
  const [pendingPaymentMessage, setPendingPaymentMessage] = useState<string | null>(null)
  const idempotencyKeyRef = useRef<string | null>(null)

  const product = products.find((item) => item.screens === 1) ?? products[0] ?? null
  const inputIsValid = isValidQuantityInput(quantityInput)
  const unitPriceCents = getUnitPriceCents(quantity)
  const totalCents = quantity * unitPriceCents

  function changeQuantity(value: number) {
    if (!Number.isFinite(value)) return
    const newQuantity = Math.max(1, Math.min(500, Math.floor(value)))
    setQuantity(newQuantity); setQuantityInput(String(newQuantity)); idempotencyKeyRef.current = null
    setRateLimitMessage(null); setStockMessage(null); setPendingPaymentMessage(null)
  }

  function handleBuy() {
    if (!product) { toast.error('Produto não encontrado.'); return }
    if (!isLoggedIn) { router.push('/auth/sign-up?next=/minha-conta'); return }
    setRateLimitMessage(null); setStockMessage(null); setPendingPaymentMessage(null)
    if (!isValidQuantityInput(quantityInput)) { toast.error('Quantidade inválida. Digite um número inteiro entre 1 e 500.'); return }
    const parsedQuantity = Number(quantityInput)
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 500) { toast.error('Quantidade inválida. Digite um número inteiro entre 1 e 500.'); return }
    setQuantity(parsedQuantity); setQuantityInput(String(parsedQuantity))
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID()
    const idempotencyKey = idempotencyKeyRef.current

    startTransition(async () => {
      try {
        const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ productId: product.id, quantity: parsedQuantity }) })
        const res = await response.json()
        if (response.status === 429) {
          const retryAfter = Number(res.retryAfter ?? 60); const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60
          const message = `Limite de pedidos atingido. Aguarde ${seconds} segundos e tente novamente.`
          setRateLimitMessage(message); toast.error(message); idempotencyKeyRef.current = null; return
        }
        if (response.ok && res.ok) {
          setPayment({ orderId: res.orderId, qrCode: res.qrCode, qrCodeBase64: res.qrCodeBase64 })
          setOrderStatus('pending'); setPixCopied(false); idempotencyKeyRef.current = null
          setRateLimitMessage(null); setStockMessage(null); setPendingPaymentMessage(null)
          toast.success(res.idempotent ? 'Pedido recuperado com sucesso!' : 'Pagamento PIX gerado com sucesso!')
          return
        }
        if (res.needsAuth) { router.push('/auth/login?next=/minha-conta'); return }
        const errorMessage = res.error ?? 'Não foi possível criar o pedido.'
        const isStockError = /estoque|c[oó]digos? dispon[ií]veis|insuficiente/i.test(errorMessage)
        if (response.status === 409 && res.duplicatePending) {
          const message = 'Você já possui um pagamento pendente. Finalize ou cancele esse pagamento antes de realizar uma nova compra.'
          setPendingPaymentMessage(message); idempotencyKeyRef.current = null; toast.error(message); return
        }
        if (isStockError) { setStockMessage(errorMessage); idempotencyKeyRef.current = null; return }
        if (response.status === 409) { toast.error(errorMessage); idempotencyKeyRef.current = null; return }
        toast.error(errorMessage)
      } catch (error) { console.error('Erro inesperado:', error); toast.error('Ocorreu um erro inesperado ao gerar o pagamento. Tente novamente.') }
    })
  }

  async function copyPixCode() {
    if (!payment?.qrCode) { toast.error('Código PIX não disponível.'); return }
    try {
      await navigator.clipboard.writeText(payment.qrCode)
      setPixCopied(true); toast.success('PIX copiado com sucesso!')
      window.setTimeout(() => setPixCopied(false), 2500)
    } catch { toast.error('Não foi possível copiar o código PIX.') }
  }

  useEffect(() => {
    if (!payment?.orderId) return
    if (orderStatus === 'paid' || orderStatus === 'delivered' || orderStatus === 'cancelled') return
    let active = true
    async function checkPayment() {
      try {
        setCheckingPayment(true)
        const response = await fetch(`/api/payment-status?orderId=${payment.orderId}`, { method: 'GET', cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json(); if (!active) return
        const newStatus = (data.status as OrderStatus) ?? 'unknown'
        setOrderStatus(newStatus)
        if (newStatus === 'paid' || newStatus === 'delivered') {
          toast.success('Pagamento confirmado com sucesso!')
          router.refresh()
        }
        if (newStatus === 'cancelled') { toast.error('Este pagamento foi cancelado.'); router.refresh() }
      } catch (error) { console.error('Erro ao verificar pagamento:', error) }
      finally { if (active) setCheckingPayment(false) }
    }
    checkPayment(); const interval = setInterval(checkPayment, 3000)
    return () => { active = false; clearInterval(interval) }
  }, [payment?.orderId, orderStatus, router])

  const qrImage = payment?.qrCodeBase64 ? (payment.qrCodeBase64.startsWith('data:image') ? payment.qrCodeBase64 : `data:image/png;base64,${payment.qrCodeBase64}`) : null
  const paymentConfirmed = orderStatus === 'paid' || orderStatus === 'delivered'

  function closePaymentModal() {
    const wasConfirmed = paymentConfirmed
    setPayment(null); setOrderStatus('pending'); setPixCopied(false)
    if (wasConfirmed) window.location.href = `/minha-conta?updated=${Date.now()}`
  }

  return (
    <>
      <section id="planos" className="scroll-mt-20 bg-secondary/30 py-3 sm:py-5">
        <div className="mx-auto max-w-2xl px-3 sm:px-4">
          {product && <div className="relative mx-auto max-w-lg rounded-2xl border border-primary bg-card p-4 shadow-xl shadow-primary/15 sm:p-5">
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-0.5 text-[10px] font-semibold text-primary-foreground">30 dias de acesso</div>

            <div className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3 pt-2 sm:grid-cols-[145px_minmax(0,1fr)] sm:gap-5 sm:pt-1">
              <LdCloudMascot />
              <div className="min-w-0 text-left">
                <h3 className="text-lg font-bold sm:text-xl">LD CLOUD VIP</h3>
                <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">Suas telas, sem limites.</p>
                <div className="mt-1 flex items-baseline gap-1"><span className="text-3xl font-bold sm:text-4xl">{formatBRL(unitPriceCents)}</span><span className="text-xs text-muted-foreground">/ tela</span></div>
              </div>
            </div>

            <div className="mt-3"><div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" onClick={() => changeQuantity(quantity - 1)} disabled={pending || quantity <= 1}><Minus className="size-4" /></Button>
              <input type="text" inputMode="numeric" value={quantityInput} disabled={pending} onChange={(event) => { const value = event.target.value; setQuantityInput(value); if (isValidQuantityInput(value)) { setQuantity(Number(value)); idempotencyKeyRef.current = null; setRateLimitMessage(null); setStockMessage(null); setPendingPaymentMessage(null) } }} className={`h-9 w-full rounded-lg border bg-background px-2 text-center text-base font-bold outline-none ${!inputIsValid ? 'border-red-500' : ''}`} aria-label="Quantidade de telas" autoComplete="off" />
              <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" onClick={() => changeQuantity(quantity + 1)} disabled={pending || quantity >= 500}><Plus className="size-4" /></Button>
            </div></div>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border bg-secondary/40 p-2 text-center text-[10px]"><div className={quantity < 5 ? 'font-bold text-primary' : 'text-muted-foreground'}><div>1–4</div><div>R$ 35</div></div><div className={quantity >= 5 && quantity < 10 ? 'font-bold text-primary' : 'text-muted-foreground'}><div>5–9</div><div>R$ 34</div></div><div className={quantity >= 10 ? 'font-bold text-primary' : 'text-muted-foreground'}><div>10+</div><div>R$ 33</div></div></div>
            <div className="mt-2 flex items-center justify-between rounded-lg border bg-background px-3 py-2"><span className="text-xs text-muted-foreground">{quantity} tela{quantity === 1 ? '' : 's'} × {formatBRL(unitPriceCents)}</span><span className="text-lg font-bold">{formatBRL(totalCents)}</span></div>
            <div className="mt-2 grid grid-cols-4 gap-1 border-t pt-2"><div className="flex flex-col items-center justify-center gap-0.5 text-center text-[9px] text-muted-foreground"><Check className="size-3 shrink-0 text-primary" /><span>Acesso imediato</span></div><div className="flex flex-col items-center justify-center gap-0.5 text-center text-[9px] text-muted-foreground"><Check className="size-3 shrink-0 text-primary" /><span>Vários dispositivos</span></div><div className="flex flex-col items-center justify-center gap-0.5 text-center text-[9px] text-muted-foreground"><Check className="size-3 shrink-0 text-primary" /><span>Ativação por código</span></div><div className="flex flex-col items-center justify-center gap-0.5 text-center text-[9px] text-muted-foreground"><Check className="size-3 shrink-0 text-primary" /><span>Pagamento seguro (PIX)</span></div></div>
            <Button className="mt-2 h-9 w-full text-sm" onClick={handleBuy} disabled={pending || !product || !inputIsValid}>{pending ? <><Loader2 className="size-4 animate-spin" />Processando...</> : <>Comprar {inputIsValid ? quantity : '—'} {inputIsValid && quantity === 1 ? 'tela' : 'telas'}</>}</Button>
            {pendingPaymentMessage && <div role="alert" className="mt-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-center"><p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">⚠️ Pagamento pendente</p><p className="mt-1 text-[10px] text-muted-foreground">{pendingPaymentMessage}</p><Button type="button" variant="outline" className="mt-2 h-9 w-full text-xs" onClick={() => router.push('/minha-conta')}>Ver pagamento pendente</Button></div>}
            {rateLimitMessage && <div role="alert" className="mt-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-center"><p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">⚠️ Muitas tentativas</p><p className="mt-1 text-[10px] text-muted-foreground">{rateLimitMessage}</p></div>}
            {stockMessage && <div role="alert" className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-center"><p className="text-xs font-semibold text-destructive">Estoque insuficiente</p><p className="mt-1 text-[10px] text-muted-foreground">{stockMessage}</p></div>}
          </div>}
        </div>
      </section>

      {payment && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
        <div className="relative my-auto w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl">
          <button type="button" aria-label="Fechar" onClick={closePaymentModal} className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"><X className="size-5" /></button>
          {paymentConfirmed ? <div className="py-4 text-center"><CheckCircle2 className="mx-auto size-20 text-green-500" /><h2 className="mt-5 text-2xl font-bold">Pagamento confirmado!</h2><p className="mt-2 text-muted-foreground">Seu pagamento foi aprovado com sucesso.</p><div className="mt-6 grid gap-2"><Button type="button" onClick={() => { router.refresh(); window.location.href = `/minha-conta?updated=${Date.now()}` }}>Ver meus códigos</Button><Button type="button" variant="outline" onClick={closePaymentModal}>Fechar</Button></div></div> : orderStatus === 'cancelled' ? <div className="py-4 text-center"><X className="mx-auto size-20 text-destructive" /><h2 className="mt-5 text-2xl font-bold">Pagamento cancelado</h2><p className="mt-2 text-muted-foreground">Este pagamento foi cancelado. Você pode tentar novamente.</p><Button className="mt-6 w-full" onClick={closePaymentModal}>Fechar</Button></div> : <div><h2 className="text-2xl font-bold">Pague com PIX</h2><p className="mt-1 text-sm text-muted-foreground">Escaneie o QR Code ou copie o código PIX.</p>{qrImage && <div className="mt-5 flex justify-center"><img src={qrImage} alt="QR Code PIX" className="size-56 rounded-xl border bg-white p-2" /></div>}{payment.qrCode && <div className="mt-4"><p className="mb-2 text-xs font-semibold text-muted-foreground">Código PIX</p><div className="max-h-28 overflow-auto rounded-xl border bg-muted/40 p-3 text-xs leading-5 break-all select-all">{payment.qrCode}</div><Button type="button" variant="outline" className="mt-2 h-10 w-full" onClick={copyPixCode}>{pixCopied ? <><CheckCircle2 className="size-4 text-green-500" />PIX copiado com sucesso!</> : <><Copy className="size-4" />Copiar código PIX</>}</Button></div>}<div className="mt-5 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3"><Loader2 className="size-4 shrink-0 animate-spin text-primary" /><p className="text-xs font-medium">{checkingPayment ? 'Aguardando confirmação do pagamento...' : 'Após o pagamento, a confirmação será automática.'}</p></div><p className="mt-4 text-center text-[11px] text-muted-foreground">O pagamento pode levar alguns segundos para ser confirmado.</p></div>}
        </div>
      </div>}
    </>
  )
}
