'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CheckCircle2, Copy, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format'
import { toast } from 'sonner'

type PendingOrder = { orderId: string; quantity: number; totalCents: number; paymentPreferenceId: string | null; expiresAt: string }
type PaymentState = 'pending' | 'confirmed' | 'cancelled' | null

export function PendingPayment() {
  const pathname = usePathname()
  const router = useRouter()
  const [order, setOrder] = useState<PendingOrder | null>(null)
  const [payment, setPayment] = useState<{ qrCode: string | null; qrCodeBase64: string | null } | null>(null)
  const [paymentState, setPaymentState] = useState<PaymentState>(null)
  const [pixCopied, setPixCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [dismissedOrderId, setDismissedOrderId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const response = await fetch('/api/orders/pending', { cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json()
        if (!active) return
        const nextOrder = data.pending ?? null
        if (!nextOrder) return
        if (nextOrder.orderId === dismissedOrderId || paymentState === 'confirmed') return
        setOrder(nextOrder); setPaymentState('pending')
      } catch {}
    }
    load()
    const interval = setInterval(load, 3000)
    return () => { active = false; clearInterval(interval) }
  }, [dismissedOrderId, paymentState])

  useEffect(() => {
    if (!order?.orderId || paymentState !== 'pending') return
    let active = true
    async function checkPayment() {
      try {
        const response = await fetch(`/api/payment-status?orderId=${order.orderId}`, { cache: 'no-store' })
        if (!active) return
        if (response.status === 410 || response.status === 404) {
          setOrder(null); setPayment(null); setPaymentState('cancelled'); router.refresh(); return
        }
        if (!response.ok) return
        const data = await response.json()
        if (!active) return
        if (data.status === 'paid' || data.status === 'delivered') {
          setPaymentState('confirmed'); setPayment(null); router.refresh(); toast.success('Pagamento confirmado com sucesso!')
        } else if (data.status === 'cancelled') {
          router.refresh(); setPaymentState('cancelled'); setPayment(null); setOrder(null); toast.error('Este pagamento foi cancelado.')
        }
      } catch {}
    }
    checkPayment()
    const interval = setInterval(checkPayment, 3000)
    return () => { active = false; clearInterval(interval) }
  }, [order?.orderId, paymentState, router])

  async function resumePayment() {
    if (!order) return
    setLoading(true)
    try {
      const response = await fetch(`/api/orders/${order.orderId}/resume`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) {
        setOrder(null); setPayment(null); setPaymentState('cancelled'); setDismissedOrderId(order.orderId); toast.error(data.error ?? 'Este pagamento expirou.'); router.refresh(); return
      }
      setPayment({ qrCode: data.qrCode, qrCodeBase64: data.qrCodeBase64 }); setPixCopied(false); setPaymentState('pending')
    } catch { toast.error('Não foi possível recuperar o PIX.') }
    finally { setLoading(false) }
  }

  async function cancelPayment() {
    if (!order) return
    setCancelling(true); const orderId = order.orderId
    try {
      const response = await fetch(`/api/orders/${orderId}/cancel`, { method: 'POST' }); const data = await response.json()
      if (!response.ok) { toast.error(data.error ?? 'Não foi possível cancelar o pagamento.'); return }
      setPayment(null); setOrder(null); setPaymentState('cancelled'); setDismissedOrderId(orderId); toast.success('Pagamento cancelado. O estoque foi liberado.'); router.refresh()
    } catch { toast.error('Não foi possível cancelar o pagamento.') }
    finally { setCancelling(false) }
  }

  function dismissPendingPayment() {
    if (order?.orderId) setDismissedOrderId(order.orderId)
    setPayment(null); setOrder(null); setPaymentState(null); setPixCopied(false); router.refresh()
  }

  async function copyPix() {
    if (!payment?.qrCode) return
    try {
      await navigator.clipboard.writeText(payment.qrCode)
      setPixCopied(true); toast.success('PIX copiado com sucesso!')
      window.setTimeout(() => setPixCopied(false), 2500)
    } catch { toast.error('Não foi possível copiar o código PIX.') }
  }

  if (pathname !== '/minha-conta') return null

  if (paymentState === 'confirmed') {
    return <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-emerald-500/30 bg-background p-4 shadow-2xl"><button type="button" onClick={dismissPendingPayment} className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Fechar confirmação"><X className="size-4" /></button><div className="flex items-center gap-3 pr-6"><CheckCircle2 className="size-9 shrink-0 text-emerald-500" /><div><p className="text-sm font-bold">Pagamento confirmado!</p><p className="mt-1 text-xs text-muted-foreground">Seu pagamento foi aprovado com sucesso. A entrega do código foi atualizada automaticamente.</p></div></div></div>
  }

  if (!order || paymentState === 'cancelled') return null

  const qrImage = payment?.qrCodeBase64 ? (payment.qrCodeBase64.startsWith('data:image') ? payment.qrCodeBase64 : `data:image/png;base64,${payment.qrCodeBase64}`) : null

  return <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-primary/30 bg-background p-4 shadow-2xl">
    <button type="button" onClick={dismissPendingPayment} className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Fechar aviso"><X className="size-4" /></button>
    {payment ? <div className="pt-1 text-center">
      <h3 className="text-lg font-bold">Continuar pagamento PIX</h3>
      <p className="mt-1 text-sm text-muted-foreground">{order.quantity} {order.quantity === 1 ? 'tela' : 'telas'} · {formatBRL(order.totalCents)}</p>
      {qrImage && <div className="mt-4 flex justify-center"><div className="rounded-xl bg-white p-2.5"><img src={qrImage} alt="QR Code PIX" className="aspect-square h-auto w-full max-w-[250px] object-contain" /></div></div>}
      {payment.qrCode && <div className="mt-4"><p className="mb-2 text-left text-xs font-semibold text-muted-foreground">Código PIX</p><div className="max-h-28 overflow-y-auto rounded-xl border bg-muted/30 p-3 text-left text-[11px] leading-relaxed break-all select-all">{payment.qrCode}</div><Button className="mt-3 w-full" onClick={copyPix}>{pixCopied ? <CheckCircle2 className="size-4" /> : <Copy className="size-4" />}{pixCopied ? 'PIX copiado com sucesso!' : 'Copiar código PIX'}</Button></div>}
      <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-center text-xs text-muted-foreground">⏳ Aguardando confirmação do pagamento...</div>
      <p className="mt-2 text-[10px] text-muted-foreground">Após o pagamento, a confirmação será automática.</p>
      <Button className="mt-3 w-full" variant="outline" onClick={() => { setPayment(null); setPixCopied(false) }}>Voltar</Button>
    </div> : <div className="pr-6"><p className="text-sm font-bold">Você tem um pagamento pendente</p><p className="mt-1 text-xs text-muted-foreground">{order.quantity} {order.quantity === 1 ? 'tela' : 'telas'} · {formatBRL(order.totalCents)}</p><div className="mt-3 grid grid-cols-2 gap-2"><Button onClick={resumePayment} disabled={loading || cancelling}>{loading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}Continuar PIX</Button><Button variant="outline" onClick={cancelPayment} disabled={loading || cancelling}>{cancelling ? <Loader2 className="size-4 animate-spin" /> : null}Cancelar pagamento</Button></div></div>}
  </div>
}
