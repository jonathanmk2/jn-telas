'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Copy, Loader2, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format'
import { toast } from 'sonner'

type PendingOrder = {
  orderId: string
  quantity: number
  totalCents: number
  paymentPreferenceId: string | null
  expiresAt: string
}

export function PendingPayment() {
  const pathname = usePathname()
  const [order, setOrder] = useState<PendingOrder | null>(null)
  const [payment, setPayment] = useState<{ qrCode: string | null; qrCodeBase64: string | null } | null>(null)
  const [loading, setLoading] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (pathname !== '/minha-conta') return
    let active = true

    async function load() {
      try {
        const response = await fetch('/api/orders/pending', { cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json()
        if (active) setOrder(data.pending ?? null)
      } catch {
        // A página de conta não deve falhar por causa deste aviso.
      }
    }

    load()
    const interval = setInterval(load, 15000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [pathname])

  async function resumePayment() {
    if (!order) return
    setLoading(true)

    try {
      const response = await fetch(`/api/orders/${order.orderId}/resume`, { cache: 'no-store' })
      const data = await response.json()

      if (!response.ok) {
        setOrder(null)
        toast.error(data.error ?? 'Este pagamento expirou.')
        return
      }

      setPayment({ qrCode: data.qrCode, qrCodeBase64: data.qrCodeBase64 })
    } catch {
      toast.error('Não foi possível recuperar o PIX.')
    } finally {
      setLoading(false)
    }
  }

  async function cancelPayment() {
    if (!order) return
    setCancelling(true)

    try {
      const response = await fetch(`/api/orders/${order.orderId}/cancel`, { method: 'POST' })
      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error ?? 'Não foi possível cancelar o pagamento.')
        return
      }

      setPayment(null)
      setOrder(null)
      toast.success('Pagamento cancelado. O estoque foi liberado.')
    } catch {
      toast.error('Não foi possível cancelar o pagamento.')
    } finally {
      setCancelling(false)
    }
  }

  async function copyPix() {
    if (!payment?.qrCode) return
    try {
      await navigator.clipboard.writeText(payment.qrCode)
      toast.success('Código PIX copiado!')
    } catch {
      toast.error('Não foi possível copiar o código PIX.')
    }
  }

  if (pathname !== '/minha-conta' || !order) return null

  const qrImage = payment?.qrCodeBase64
    ? payment.qrCodeBase64.startsWith('data:image')
      ? payment.qrCodeBase64
      : `data:image/png;base64,${payment.qrCodeBase64}`
    : null

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-primary/30 bg-background p-4 shadow-2xl">
      <button
        type="button"
        onClick={() => setOrder(null)}
        className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
        aria-label="Fechar aviso"
      >
        <X className="size-4" />
      </button>

      {payment ? (
        <div className="pt-1 text-center">
          <h3 className="text-lg font-bold">Continuar pagamento PIX</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.quantity} {order.quantity === 1 ? 'tela' : 'telas'} · {formatBRL(order.totalCents)}
          </p>
          {qrImage && (
            <div className="mt-4 flex justify-center">
              <div className="rounded-xl bg-white p-3">
                <img src={qrImage} alt="QR Code PIX" className="h-52 w-52" />
              </div>
            </div>
          )}
          <Button className="mt-3 w-full" onClick={copyPix} disabled={!payment.qrCode}>
            <Copy className="size-4" />
            Copiar código PIX
          </Button>
          <Button className="mt-2 w-full" variant="outline" onClick={() => setPayment(null)}>
            Voltar
          </Button>
        </div>
      ) : (
        <div className="pr-6">
          <p className="text-sm font-bold">Você tem um pagamento pendente</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {order.quantity} {order.quantity === 1 ? 'tela' : 'telas'} · {formatBRL(order.totalCents)}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={resumePayment} disabled={loading || cancelling}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Continuar PIX
            </Button>
            <Button variant="outline" onClick={cancelPayment} disabled={loading || cancelling}>
              {cancelling ? <Loader2 className="size-4 animate-spin" /> : null}
              Cancelar pagamento
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
