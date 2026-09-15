import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type PaymentEvidence = {
  amountCents?: number | null
  currencyId?: string | null
  externalReference?: string | null
}

function toCents(value: unknown): number | null {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.round(amount * 100) : null
}

export async function POST(request: NextRequest) {
  try {
    const mercadoPagoToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
    if (!mercadoPagoToken) return NextResponse.json({ error: 'Mercado Pago não configurado' }, { status: 500 })

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
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(notificationId)}`, { headers: { Authorization: `Bearer ${mercadoPagoToken}` }, cache: 'no-store' })
      if (!response.ok) { console.error('Erro ao consultar pagamento:', response.status); return NextResponse.json({ ok: true }) }
      const payment = await response.json()
      const orderId = payment.external_reference
      if (orderId) await processPayment({ admin, orderId: String(orderId), paymentId: String(payment.id), paymentStatus: payment.status ?? '', amountCents: toCents(payment.transaction_amount), currencyId: payment.currency_id ?? null, externalReference: String(orderId) })
      return NextResponse.json({ ok: true })
    }

    if (type === 'order') {
      const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(notificationId)}`, { headers: { Authorization: `Bearer ${mercadoPagoToken}` }, cache: 'no-store' })
      if (!response.ok) { console.error('Erro ao consultar Order:', response.status); return NextResponse.json({ ok: true }) }
      const mpOrder = await response.json()
      const orderId = mpOrder.external_reference
      if (orderId) {
        const tx = mpOrder.transactions?.payments?.[0] ?? mpOrder.transaction?.payments?.[0] ?? mpOrder.payments?.[0] ?? null
        await processPayment({
          admin,
          orderId: String(orderId),
          paymentId: tx?.id ? String(tx.id) : String(mpOrder.id),
          paymentStatus: tx?.status ?? mpOrder.status ?? '',
          amountCents: toCents(tx?.amount ?? tx?.transaction_amount ?? mpOrder.total_amount),
          currencyId: tx?.currency_id ?? mpOrder.currency_id ?? 'BRL',
          externalReference: String(orderId),
        })
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
  const { data: order, error: orderError } = await admin.from('orders').select('id,user_id,quantity,status,activation_code_id,total_cents,product_id').eq('id', orderId).maybeSingle()
  if (orderError || !order) { console.log('Pedido não encontrado; pagamento não será entregue:', orderId); return }
  if (order.status === 'delivered') return

  const paidStatuses = ['approved', 'processed', 'accredited']
  const cancelledStatuses = ['rejected', 'cancelled', 'failed']
  if (paidStatuses.includes(normalizedStatus)) {
    if (order.status === 'cancelled') { console.error('Pagamento aprovado para pedido cancelado; entrega bloqueada.', order.id); return }

    // Para um pedido ainda pendente, a evidência vinda diretamente do Mercado Pago
    // precisa bater com o pedido salvo antes de qualquer entrega.
    if (order.status === 'pending') {
      if (externalReference !== order.id || amountCents === null || amountCents !== Number(order.total_cents) || String(currencyId || '').toUpperCase() !== 'BRL') {
        console.error('Pagamento divergente; entrega bloqueada.', { orderId: order.id, expectedAmount: order.total_cents, receivedAmount: amountCents, currencyId, externalReference })
        return
      }
      const { error } = await admin.from('orders').update({ status: 'paid', payment_id: paymentId, paid_at: new Date().toISOString() }).eq('id', order.id).eq('status', 'pending')
      if (error) { console.error('Erro ao marcar pedido como pago:', error); return }
    } else if (order.status !== 'paid') { console.error('Status inesperado para pagamento aprovado:', order.status); return }

    const { data: product } = await admin.from('products').select('platform').eq('id', order.product_id).maybeSingle()
    const platform = product?.platform === 'vsphone' ? 'vsphone' : 'ldcloud'

    const now = new Date().toISOString()
    const { data: reservations, error: reservationError } = await admin.from('activation_code_reservations').select('activation_code_id').eq('order_id', order.id).gt('expires_at', now)
    if (reservationError) { console.error('Erro ao buscar códigos reservados:', reservationError); return }
    let reservationIds = (reservations ?? []).map((item) => item.activation_code_id)
    const quantity = Number(order.quantity) || 1

    if (reservationIds.length < quantity) {
      const missingQuantity = quantity - reservationIds.length
      const { data: reservedCount, error: reserveError } = await admin.rpc('reserve_activation_codes', { p_order_id: order.id, p_quantity: missingQuantity, p_minutes: 30, p_platform: platform })
      if (reserveError) { console.error('Erro ao recuperar reserva após pagamento:', reserveError); return }
      const { data: refreshed, error: refreshedError } = await admin.from('activation_code_reservations').select('activation_code_id').eq('order_id', order.id).gt('expires_at', new Date().toISOString())
      if (refreshedError) { console.error('Erro ao verificar reserva recuperada:', refreshedError); return }
      reservationIds = (refreshed ?? []).map((item) => item.activation_code_id)
      console.log('Reserva recuperada após pagamento:', { orderId: order.id, platform, requested: missingQuantity, reserved: Number(reservedCount) || 0, totalReserved: reservationIds.length })
    }

    if (reservationIds.length !== quantity) { console.error('Pagamento aprovado sem estoque/reserva completa; pedido permanece PAID.', { orderId: order.id, expected: quantity, reserved: reservationIds.length, platform }); return }

    // Defesa adicional: mesmo uma reserva existente deve pertencer à plataforma do pedido.
    const { data: reservedCodes, error: reservedCodesError } = await admin.from('activation_codes').select('id,platform').in('id', reservationIds)
    if (reservedCodesError || (reservedCodes ?? []).length !== quantity || (reservedCodes ?? []).some((code) => code.platform !== platform)) {
      console.error('Reserva contém código de plataforma incorreta; entrega bloqueada.', { orderId: order.id, platform })
      return
    }

    const assignedAt = new Date().toISOString()
    const { data: assignedCodes, error: assignError } = await admin.from('activation_codes').update({ user_id: order.user_id, order_id: order.id, assigned_at: assignedAt }).in('id', reservationIds).eq('platform', platform).is('user_id', null).is('order_id', null).select('id,code')
    if (assignError || (assignedCodes ?? []).length !== quantity) { console.error('Nem todos os códigos reservados puderam ser atribuídos:', assignError); return }

    const { error: deliverError } = await admin.from('orders').update({ status: 'delivered', activation_code_id: assignedCodes?.[0]?.id ?? null }).eq('id', order.id).eq('status', 'paid')
    if (deliverError) { console.error('Erro ao marcar pedido como entregue:', deliverError); return }
    await admin.from('activation_code_reservations').delete().eq('order_id', order.id)
    console.log('Pedido entregue:', order.id, platform)
    return
  }

  if (cancelledStatuses.includes(normalizedStatus)) {
    await admin.rpc('release_activation_code_reservations', { p_order_id: order.id })
    if (order.status === 'pending') {
      const { error } = await admin.from('orders').update({ status: 'cancelled' }).eq('id', order.id).eq('status', 'pending')
      if (error) console.error('Erro ao cancelar pedido:', error)
    }
  }
}
