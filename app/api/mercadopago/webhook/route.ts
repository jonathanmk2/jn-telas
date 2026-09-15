import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function toCents(value: unknown): number | null {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.round(amount * 100) : null
}

export async function POST(request: NextRequest) {
  try {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN
    if (!token) return NextResponse.json({ error: 'Mercado Pago não configurado' }, { status: 500 })
    const url = new URL(request.url)
    let type = url.searchParams.get('type') || url.searchParams.get('topic')
    let notificationId = url.searchParams.get('data.id') || url.searchParams.get('id')
    try {
      const body = await request.json()
      if (!type && body.type) type = body.type
      if (!notificationId && body.data?.id) notificationId = String(body.data.id)
    } catch {}
    if (!notificationId) return NextResponse.json({ ok: true })
    const admin = createAdminClient()

    if (type === 'payment') {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(notificationId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      if (!response.ok) return NextResponse.json({ ok: true })
      const payment = await response.json()
      if (payment.external_reference) await processPayment({ admin, orderId: String(payment.external_reference), paymentId: String(payment.id), paymentStatus: payment.status ?? '', amountCents: toCents(payment.transaction_amount), currencyId: payment.currency_id ?? null, externalReference: String(payment.external_reference) })
      return NextResponse.json({ ok: true })
    }

    if (type === 'order') {
      const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(notificationId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      if (!response.ok) return NextResponse.json({ ok: true })
      const mpOrder = await response.json()
      const orderId = mpOrder.external_reference
      if (orderId) {
        const tx = mpOrder.transactions?.payments?.[0] ?? mpOrder.transaction?.payments?.[0] ?? mpOrder.payments?.[0] ?? null
        await processPayment({ admin, orderId: String(orderId), paymentId: tx?.id ? String(tx.id) : String(mpOrder.id), paymentStatus: tx?.status ?? mpOrder.status ?? '', amountCents: toCents(tx?.amount ?? tx?.transaction_amount ?? mpOrder.total_amount), currencyId: tx?.currency_id ?? mpOrder.currency_id ?? 'BRL', externalReference: String(orderId) })
      }
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro no webhook Mercado Pago:', error)
    return NextResponse.json({ ok: true })
  }
}

export async function processPayment({ admin, orderId, paymentId, paymentStatus, amountCents = null, currencyId = null, externalReference = null }: {
  admin: ReturnType<typeof createAdminClient>
  orderId: string
  paymentId: string
  paymentStatus: string
  amountCents?: number | null
  currencyId?: string | null
  externalReference?: string | null
}) {
  const normalizedStatus = String(paymentStatus || '').toLowerCase()
  const { data: order, error } = await admin.from('orders').select('id,user_id,quantity,status,total_cents,product_id').eq('id', orderId).maybeSingle()
  if (error || !order || order.status === 'delivered') return
  const paidStatuses = ['approved', 'processed', 'accredited']
  const cancelledStatuses = ['rejected', 'cancelled', 'failed']

  if (paidStatuses.includes(normalizedStatus)) {
    if (order.status === 'cancelled') return
    if (order.status === 'pending') {
      if (externalReference !== order.id || amountCents === null || amountCents !== Number(order.total_cents) || String(currencyId || '').toUpperCase() !== 'BRL') {
        console.error('Pagamento divergente; entrega bloqueada.', { orderId: order.id, expectedAmount: order.total_cents, receivedAmount: amountCents, currencyId, externalReference })
        return
      }
      const { data: paidOrder, error: paidError } = await admin.from('orders').update({ status: 'paid', payment_id: paymentId, paid_at: new Date().toISOString() }).eq('id', order.id).eq('status', 'pending').select('id').maybeSingle()
      if (paidError || !paidOrder) return
    } else if (order.status !== 'paid') return

    const { data: product } = await admin.from('products').select('platform').eq('id', order.product_id).maybeSingle()
    const platform = product?.platform === 'vsphone' ? 'vsphone' : 'ldcloud'
    const quantity = Number(order.quantity) || 1
    const { data: reservations, error: reservationError } = await admin.from('activation_code_reservations').select('activation_code_id').eq('order_id', order.id).gt('expires_at', new Date().toISOString())
    if (reservationError) return
    let reserved = reservations?.length ?? 0

    if (reserved < quantity) {
      const { error: reserveError } = await admin.rpc('reserve_activation_codes', { p_order_id: order.id, p_quantity: quantity, p_minutes: 30, p_platform: platform })
      if (reserveError) return
      const { data: refreshed } = await admin.from('activation_code_reservations').select('activation_code_id').eq('order_id', order.id).gt('expires_at', new Date().toISOString())
      reserved = refreshed?.length ?? 0
    }
    if (reserved !== quantity) {
      console.error('Pagamento aprovado sem reserva completa; pedido permanece PAID.', { orderId: order.id, quantity, reserved, platform })
      return
    }

    // A atribuição dos códigos, a mudança para delivered e a remoção das reservas
    // acontecem em uma única transação PostgreSQL. Qualquer falha reverte tudo.
    const { data: deliveredCount, error: deliveryError } = await admin.rpc('finalize_order_delivery', { p_order_id: order.id })
    if (deliveryError || Number(deliveredCount) !== quantity) {
      console.error('Falha na entrega atômica; nenhuma entrega parcial foi confirmada.', { orderId: order.id, deliveryError })
      return
    }
    console.log('Pedido entregue atomicamente:', order.id, platform)
    return
  }

  if (cancelledStatuses.includes(normalizedStatus)) {
    await admin.rpc('release_activation_code_reservations', { p_order_id: order.id })
    if (order.status === 'pending') await admin.from('orders').update({ status: 'cancelled' }).eq('id', order.id).eq('status', 'pending')
  }
}
