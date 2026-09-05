import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const mercadoPagoToken = process.env.MERCADO_PAGO_ACCESS_TOKEN

    if (!mercadoPagoToken) {
      console.error('Token do Mercado Pago não configurado.')
      return NextResponse.json({ error: 'Mercado Pago não configurado' }, { status: 500 })
    }

    const url = new URL(request.url)
    let type = url.searchParams.get('type') || url.searchParams.get('topic')
    let notificationId = url.searchParams.get('data.id') || url.searchParams.get('id')

    try {
      const body = await request.json()
      if (!type && body.type) type = body.type
      if (!notificationId && body.data?.id) notificationId = String(body.data.id)
    } catch {
      // Algumas notificações podem chegar sem JSON.
    }

    if (!notificationId) return NextResponse.json({ ok: true })

    const admin = createAdminClient()

    if (type === 'payment') {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(notificationId)}`, {
        headers: { Authorization: `Bearer ${mercadoPagoToken}` },
        cache: 'no-store',
      })

      if (!response.ok) {
        console.error('Erro ao consultar pagamento:', response.status, await response.text())
        return NextResponse.json({ ok: true })
      }

      const payment = await response.json()
      const orderId = payment.external_reference

      if (orderId) {
        await processPayment({
          admin,
          orderId: String(orderId),
          paymentId: String(payment.id),
          paymentStatus: payment.status ?? '',
        })
      }

      return NextResponse.json({ ok: true })
    }

    if (type === 'order') {
      const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(notificationId)}`, {
        headers: { Authorization: `Bearer ${mercadoPagoToken}` },
        cache: 'no-store',
      })

      if (!response.ok) {
        console.error('Erro ao consultar Order:', response.status, await response.text())
        return NextResponse.json({ ok: true })
      }

      const mercadoPagoOrder = await response.json()
      const orderId = mercadoPagoOrder.external_reference

      if (orderId) {
        const transaction =
          mercadoPagoOrder.transactions?.payments?.[0] ??
          mercadoPagoOrder.transaction?.payments?.[0] ??
          mercadoPagoOrder.payments?.[0] ??
          null

        await processPayment({
          admin,
          orderId: String(orderId),
          paymentId: transaction?.id ? String(transaction.id) : String(mercadoPagoOrder.id),
          paymentStatus: transaction?.status ?? mercadoPagoOrder.status ?? '',
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

export async function processPayment({
  admin,
  orderId,
  paymentId,
  paymentStatus,
}: {
  admin: ReturnType<typeof createAdminClient>
  orderId: string
  paymentId: string
  paymentStatus: string
}) {
  const normalizedStatus = String(paymentStatus || '').toLowerCase()

  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id, user_id, quantity, status, activation_code_id')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError || !order) {
    console.log('Pedido não encontrado; pagamento não será entregue:', orderId)
    return
  }

  if (order.status === 'delivered') return

  const paidStatuses = ['approved', 'processed', 'accredited']
  const cancelledStatuses = ['rejected', 'cancelled', 'failed']

  if (paidStatuses.includes(normalizedStatus)) {
    // Nunca entregue um pagamento aprovado em um pedido já cancelado.
    if (order.status === 'cancelled') {
      console.error('Pagamento aprovado para pedido já cancelado; entrega bloqueada.', order.id)
      return
    }

    if (order.status === 'pending') {
      const { error } = await admin
        .from('orders')
        .update({
          status: 'paid',
          payment_id: paymentId,
          paid_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('status', 'pending')

      if (error) {
        console.error('Erro ao marcar pedido como pago:', error)
        return
      }
    } else if (order.status !== 'paid') {
      console.error('Status inesperado para pagamento aprovado; entrega bloqueada.', {
        orderId: order.id,
        status: order.status,
      })
      return
    }

    const now = new Date().toISOString()
    const { data: reservations, error: reservationError } = await admin
      .from('activation_code_reservations')
      .select('activation_code_id')
      .eq('order_id', order.id)
      .gt('expires_at', now)

    if (reservationError) {
      console.error('Erro ao buscar códigos reservados:', reservationError)
      return
    }

    let reservationIds = (reservations ?? []).map((item) => item.activation_code_id)
    const quantity = Number(order.quantity) || 1

    // Se o pagamento chegou depois do prazo da reserva, recuperamos a reserva
    // antes de tentar entregar. Isso evita pedidos pagos presos em PAID.
    if (reservationIds.length < quantity) {
      const missingQuantity = quantity - reservationIds.length

      const { data: reservedCount, error: reserveError } = await admin.rpc(
        'reserve_activation_codes',
        {
          p_order_id: order.id,
          p_quantity: missingQuantity,
          p_minutes: 30,
        },
      )

      if (reserveError) {
        console.error('Erro ao recuperar reserva após pagamento:', reserveError, {
          orderId: order.id,
          missingQuantity,
        })
        return
      }

      const { data: refreshedReservations, error: refreshedReservationError } = await admin
        .from('activation_code_reservations')
        .select('activation_code_id')
        .eq('order_id', order.id)
        .gt('expires_at', new Date().toISOString())

      if (refreshedReservationError) {
        console.error('Erro ao verificar reserva recuperada:', refreshedReservationError)
        return
      }

      reservationIds = (refreshedReservations ?? []).map((item) => item.activation_code_id)

      console.log('Reserva recuperada após pagamento:', {
        orderId: order.id,
        requested: missingQuantity,
        reserved: Number(reservedCount) || 0,
        totalReserved: reservationIds.length,
      })
    }

    if (reservationIds.length !== quantity) {
      console.error('Pagamento aprovado sem estoque/reserva completa; pedido permanece PAID.', {
        orderId: order.id,
        expected: quantity,
        reserved: reservationIds.length,
      })
      return
    }

    const assignedAt = new Date().toISOString()
    const { data: assignedCodes, error: assignError } = await admin
      .from('activation_codes')
      .update({
        user_id: order.user_id,
        order_id: order.id,
        assigned_at: assignedAt,
      })
      .in('id', reservationIds)
      .is('user_id', null)
      .is('order_id', null)
      .select('id, code')

    if (assignError) {
      console.error('Erro ao atribuir códigos reservados:', assignError)
      return
    }

    if ((assignedCodes ?? []).length !== quantity) {
      console.error('Nem todos os códigos reservados puderam ser atribuídos:', {
        orderId: order.id,
        expected: quantity,
        assigned: assignedCodes?.length ?? 0,
      })
      return
    }

    const { error: deliverError } = await admin
      .from('orders')
      .update({
        status: 'delivered',
        activation_code_id: assignedCodes?.[0]?.id ?? null,
      })
      .eq('id', order.id)
      .in('status', ['paid'])

    if (deliverError) {
      console.error('Erro ao marcar pedido como entregue:', deliverError)
      return
    }

    await admin
      .from('activation_code_reservations')
      .delete()
      .eq('order_id', order.id)

    console.log('Pedido entregue usando os códigos reservados/recuperados:', order.id)
    return
  }

  if (cancelledStatuses.includes(normalizedStatus)) {
    await admin.rpc('release_activation_code_reservations', {
      p_order_id: order.id,
    })

    if (order.status === 'pending') {
      const { error } = await admin
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', order.id)
        .eq('status', 'pending')

      if (error) console.error('Erro ao cancelar pedido:', error)
    }
  }
}
