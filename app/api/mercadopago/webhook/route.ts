import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    console.log('=================================')
    console.log('WEBHOOK MERCADO PAGO RECEBIDO')
    console.log('=================================')

    const mercadoPagoToken =
      process.env.MERCADO_PAGO_ACCESS_TOKEN

    if (!mercadoPagoToken) {
      console.error(
        'Token de produção do Mercado Pago não configurado.',
      )

      return NextResponse.json(
        { error: 'Mercado Pago não configurado' },
        { status: 500 },
      )
    }

    const url = new URL(request.url)

    const type =
      url.searchParams.get('type') ||
      url.searchParams.get('topic')

    const notificationId =
      url.searchParams.get('data.id') ||
      url.searchParams.get('id')

    console.log('Tipo recebido:', type)
    console.log('ID recebido:', notificationId)

    // =====================================================
    // IGNORA NOTIFICAÇÕES SEM ID
    // =====================================================

    if (!notificationId) {
      console.log(
        'Notificação sem ID. Ignorada.',
      )

      return NextResponse.json({ ok: true })
    }

    const admin = createAdminClient()

    // =====================================================
    // EVENTO PAYMENT
    // =====================================================

    if (type === 'payment') {
      console.log(
        'Processando notificação de PAYMENT.',
      )

      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${notificationId}`,
        {
          headers: {
            Authorization: `Bearer ${mercadoPagoToken}`,
          },
          cache: 'no-store',
        },
      )

      if (!paymentResponse.ok) {
        const errorText =
          await paymentResponse.text()

        console.error(
          'Erro ao consultar pagamento:',
          paymentResponse.status,
          errorText,
        )

        return NextResponse.json({ ok: true })
      }

      const payment =
        await paymentResponse.json()

      console.log('Payment ID:', payment.id)
      console.log('Status:', payment.status)
      console.log(
        'External Reference:',
        payment.external_reference,
      )

      const orderId =
        payment.external_reference

      if (!orderId) {
        console.error(
          'Pagamento sem external_reference.',
        )

        return NextResponse.json({ ok: true })
      }

      await processPayment({
        admin,
        orderId,
        paymentId: String(payment.id),
        paymentStatus: payment.status,
      })

      return NextResponse.json({ ok: true })
    }

    // =====================================================
    // EVENTO ORDER
    // =====================================================

    if (type === 'order') {
      console.log(
        'Processando notificação de ORDER.',
      )

      const orderResponse = await fetch(
        `https://api.mercadopago.com/v1/orders/${notificationId}`,
        {
          headers: {
            Authorization: `Bearer ${mercadoPagoToken}`,
          },
          cache: 'no-store',
        },
      )

      if (!orderResponse.ok) {
        const errorText =
          await orderResponse.text()

        console.error(
          'Erro ao consultar Order:',
          orderResponse.status,
          errorText,
        )

        return NextResponse.json({ ok: true })
      }

      const mercadoPagoOrder =
        await orderResponse.json()

      console.log(
        'Order Mercado Pago:',
        mercadoPagoOrder.id,
      )

      console.log(
        'Status da Order:',
        mercadoPagoOrder.status,
      )

      console.log(
        'External Reference:',
        mercadoPagoOrder.external_reference,
      )

      const orderId =
        mercadoPagoOrder.external_reference

      if (!orderId) {
        console.error(
          'Order sem external_reference.',
        )

        return NextResponse.json({ ok: true })
      }

      const transaction =
        mercadoPagoOrder.transactions
          ?.payments?.[0] ??
        mercadoPagoOrder.transaction
          ?.payments?.[0] ??
        mercadoPagoOrder.payments?.[0] ??
        null

      const paymentId =
        transaction?.id
          ? String(transaction.id)
          : null

      const paymentStatus =
        transaction?.status ??
        mercadoPagoOrder.status ??
        null

      console.log(
        'Payment ID:',
        paymentId,
      )

      console.log(
        'Payment Status:',
        paymentStatus,
      )

      if (!paymentId || !paymentStatus) {
        console.log(
          'Ainda não existe pagamento finalizado.',
        )

        return NextResponse.json({ ok: true })
      }

      await processPayment({
        admin,
        orderId,
        paymentId,
        paymentStatus,
      })

      return NextResponse.json({ ok: true })
    }

    // =====================================================
    // OUTROS EVENTOS
    // =====================================================

    console.log(
      'Tipo de notificação não processado:',
      type,
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('=================================')
    console.error('ERRO NO WEBHOOK MERCADO PAGO')
    console.error(error)
    console.error('=================================')

    return NextResponse.json({ ok: true })
  }
}

// =========================================================
// PROCESSA O PAGAMENTO E ENTREGA O CÓDIGO
// =========================================================

async function processPayment({
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
  console.log('=================================')
  console.log('PROCESSANDO STATUS DO PAGAMENTO')
  console.log('Pedido interno:', orderId)
  console.log('Payment ID:', paymentId)
  console.log('Status:', paymentStatus)
  console.log('=================================')

  const { data: order, error: orderError } =
    await admin
      .from('orders')
      .select(
        'id, user_id, product_id, status, activation_code_id',
      )
      .eq('id', orderId)
      .single()

  if (orderError || !order) {
    console.error(
      'Pedido não encontrado:',
      orderError,
    )

    return
  }

  console.log(
    'Pedido encontrado:',
    order.id,
  )

  // =====================================================
  // PAGAMENTO APROVADO
  // =====================================================

  if (paymentStatus === 'approved') {
    console.log('PAGAMENTO APROVADO!')

    // Evita entregar duas vezes caso o webhook seja reenviado
    if (order.status === 'delivered') {
      console.log(
        'Pedido já foi entregue anteriormente.',
      )

      return
    }

    const { error: paidError } =
      await admin
        .from('orders')
        .update({
          status: 'paid',
          payment_id: paymentId,
          paid_at: new Date().toISOString(),
        })
        .eq('id', order.id)

    if (paidError) {
      console.error(
        'Erro ao marcar pedido como pago:',
        paidError,
      )

      return
    }

    console.log('Pedido marcado como PAID.')

    // =====================================================
    // PROCURA CÓDIGO DISPONÍVEL
    // =====================================================

    const {
      data: code,
      error: codeError,
    } = await admin
      .from('activation_codes')
      .select('id')
      .eq('product_id', order.product_id)
      .eq('status', 'active')
      .is('user_id', null)
      .order('created_at')
      .limit(1)
      .maybeSingle()

    if (codeError) {
      console.error(
        'Erro ao procurar código:',
        codeError,
      )

      return
    }

    if (!code) {
      console.log(
        'Nenhum código disponível para este produto.',
      )

      return
    }

    console.log(
      'Código disponível encontrado:',
      code.id,
    )

    // =====================================================
    // ATRIBUI O CÓDIGO AO USUÁRIO
    // =====================================================

    const { error: assignError } =
      await admin
        .from('activation_codes')
        .update({
          user_id: order.user_id,
          assigned_at: new Date().toISOString(),
        })
        .eq('id', code.id)
        .is('user_id', null)

    if (assignError) {
      console.error(
        'Erro ao atribuir código:',
        assignError,
      )

      return
    }

    // =====================================================
    // MARCA PEDIDO COMO ENTREGUE
    // =====================================================

    const { error: deliverError } =
      await admin
        .from('orders')
        .update({
          status: 'delivered',
          activation_code_id: code.id,
        })
        .eq('id', order.id)

    if (deliverError) {
      console.error(
        'Erro ao entregar pedido:',
        deliverError,
      )

      return
    }

    console.log('=================================')
    console.log(
      'CÓDIGO ENTREGUE AO USUÁRIO COM SUCESSO!',
    )
    console.log('=================================')

    return
  }

  // =====================================================
  // PAGAMENTO CANCELADO / REJEITADO
  // =====================================================

  if (
    paymentStatus === 'rejected' ||
    paymentStatus === 'cancelled'
  ) {
    console.log(
      'Pagamento cancelado/rejeitado:',
      paymentStatus,
    )

    await admin
      .from('orders')
      .update({
        status: 'cancelled',
        payment_id: paymentId,
      })
      .eq('id', order.id)

    return
  }

  console.log(
    'Pagamento ainda não foi aprovado:',
    paymentStatus,
  )
}
