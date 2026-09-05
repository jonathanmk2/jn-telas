import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ORDER_EXPIRATION_MINUTES = 30

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json({ ok: false, error: 'ID do pedido não informado.' }, { status: 400 })
    }

    const supabase = await createClient()
    const admin = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ ok: false, needsAuth: true, error: 'Você precisa estar logado.' }, { status: 401 })
    }

    const { data: order, error } = await admin
      .from('orders')
      .select('id, user_id, status, activation_code_id, payment_preference_id, payment_id, created_at')
      .eq('id', orderId)
      .maybeSingle()

    if (error || !order) {
      return NextResponse.json({ ok: false, expired: true, error: 'Pedido não encontrado.' }, { status: 404 })
    }

    if (order.user_id !== user.id) {
      return NextResponse.json({ ok: false, error: 'Você não pode consultar este pedido.' }, { status: 403 })
    }

    // Se o pedido já foi marcado como pago, tentamos a entrega novamente
    // mesmo que o webhook tenha falhado ou chegado antes da reserva.
    // O processPayment é idempotente e só usa códigos reservados/disponíveis.
    if (order.status === 'paid') {
      try {
        const { processPayment } = await import('@/app/api/mercadopago/webhook/route')

        await processPayment({
          admin,
          orderId: order.id,
          paymentId: order.payment_id ? String(order.payment_id) : 'payment-status-retry',
          paymentStatus: 'approved',
        })
      } catch (error) {
        console.error('Erro ao tentar entregar pedido já pago:', error)
      }
    }

    // Fallback de confirmação: se o webhook do Mercado Pago ainda não processou
    // o pagamento, consultamos o pedido diretamente no Mercado Pago e executamos
    // o mesmo fluxo de entrega usado pelo webhook.
    if (
      order.status === 'pending' &&
      order.payment_preference_id
    ) {
      const mercadoPagoToken = process.env.MERCADO_PAGO_ACCESS_TOKEN

      if (mercadoPagoToken) {
        try {
          const mercadoPagoResponse = await fetch(
            `https://api.mercadopago.com/v1/orders/${encodeURIComponent(order.payment_preference_id)}`,
            {
              headers: { Authorization: `Bearer ${mercadoPagoToken}` },
              cache: 'no-store',
            },
          )

          if (mercadoPagoResponse.ok) {
            const mercadoPagoOrder = await mercadoPagoResponse.json()
            const transaction =
              mercadoPagoOrder.transactions?.payments?.[0] ??
              mercadoPagoOrder.transaction?.payments?.[0] ??
              mercadoPagoOrder.payments?.[0] ??
              null

            const paymentStatus = String(
              transaction?.status ?? mercadoPagoOrder.status ?? '',
            ).toLowerCase()

            if (['approved', 'processed', 'accredited'].includes(paymentStatus)) {
              const { processPayment } = await import('@/app/api/mercadopago/webhook/route')

              await processPayment({
                admin,
                orderId: order.id,
                paymentId: transaction?.id
                  ? String(transaction.id)
                  : String(mercadoPagoOrder.id),
                paymentStatus,
              })
            }
          } else {
            console.error(
              'Erro ao consultar pedido Mercado Pago no fallback:',
              mercadoPagoResponse.status,
              await mercadoPagoResponse.text(),
            )
          }
        } catch (error) {
          console.error('Erro no fallback de confirmação Mercado Pago:', error)
        }
      }
    }

    const { data: refreshedOrder, error: refreshedError } = await admin
      .from('orders')
      .select('id, user_id, status, activation_code_id, created_at')
      .eq('id', order.id)
      .maybeSingle()

    if (refreshedError || !refreshedOrder) {
      return NextResponse.json({ ok: false, error: 'Não foi possível atualizar o status do pedido.' }, { status: 500 })
    }

    if (
      refreshedOrder.status === 'pending' &&
      Date.now() >= new Date(refreshedOrder.created_at).getTime() + ORDER_EXPIRATION_MINUTES * 60 * 1000
    ) {
      await admin.rpc('cancel_pending_order', {
        p_order_id: refreshedOrder.id,
        p_user_id: user.id,
      })

      return NextResponse.json({ ok: false, expired: true, error: 'Pagamento expirado.' }, { status: 410 })
    }

    const isDelivered = refreshedOrder.status === 'delivered'
    const isPaid = refreshedOrder.status === 'paid' || isDelivered

    return NextResponse.json({
      ok: true,
      orderId: refreshedOrder.id,
      status: refreshedOrder.status,
      paid: isPaid,
      delivered: isDelivered,
      activationCodeId: refreshedOrder.activation_code_id,
    })
  } catch (error) {
    console.error('Erro inesperado ao verificar pagamento:', error)
    return NextResponse.json({ ok: false, error: 'Erro interno ao verificar pagamento.' }, { status: 500 })
  }
}
