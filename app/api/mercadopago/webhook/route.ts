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
        'Token do Mercado Pago não configurado.',
      )

      return NextResponse.json(
        {
          error:
            'Mercado Pago não configurado',
        },
        { status: 500 },
      )
    }

    const url = new URL(request.url)

    // =====================================================
    // PEGA DADOS DA URL
    // =====================================================

    let type =
      url.searchParams.get('type') ||
      url.searchParams.get('topic')

    let notificationId =
      url.searchParams.get('data.id') ||
      url.searchParams.get('id')

    // =====================================================
    // TENTA PEGAR O BODY TAMBÉM
    // =====================================================

    try {
      const body = await request.json()

      console.log(
        'Body recebido:',
        JSON.stringify(body),
      )

      if (!type && body.type) {
        type = body.type
      }

      if (!notificationId && body.data?.id) {
        notificationId = String(
          body.data.id,
        )
      }
    } catch {
      console.log(
        'Webhook sem JSON no body.',
      )
    }

    console.log('Tipo recebido:', type)
    console.log('ID recebido:', notificationId)

    // =====================================================
    // IGNORA NOTIFICAÇÕES SEM ID
    // =====================================================

    if (!notificationId) {
      console.log(
        'Notificação sem ID. Ignorada.',
      )

      return NextResponse.json({
        ok: true,
      })
    }

    const admin = createAdminClient()

    // =====================================================
    // EVENTO PAYMENT
    // =====================================================

    if (type === 'payment') {
      console.log(
        'Processando notificação PAYMENT.',
      )

      const paymentResponse =
        await fetch(
          `https://api.mercadopago.com/v1/payments/${notificationId}`,
          {
            headers: {
              Authorization:
                `Bearer ${mercadoPagoToken}`,
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

        return NextResponse.json({
          ok: true,
        })
      }

      const payment =
        await paymentResponse.json()

      console.log(
        'Payment ID:',
        payment.id,
      )

      console.log(
        'Payment Status:',
        payment.status,
      )

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

        return NextResponse.json({
          ok: true,
        })
      }

      await processPayment({
        admin,
        orderId,
        paymentId: String(payment.id),
        paymentStatus:
          payment.status ?? '',
      })

      return NextResponse.json({
        ok: true,
      })
    }

    // =====================================================
    // EVENTO ORDER
    // =====================================================

    if (type === 'order') {
      console.log(
        'Processando notificação ORDER.',
      )

      const orderResponse =
        await fetch(
          `https://api.mercadopago.com/v1/orders/${notificationId}`,
          {
            headers: {
              Authorization:
                `Bearer ${mercadoPagoToken}`,
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

        return NextResponse.json({
          ok: true,
        })
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

        return NextResponse.json({
          ok: true,
        })
      }

      // ===================================================
      // PROCURA O PAGAMENTO
      // ===================================================

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
          : String(mercadoPagoOrder.id)

      const paymentStatus =
        transaction?.status ??
        mercadoPagoOrder.status ??
        ''

      console.log(
        'Payment ID:',
        paymentId,
      )

      console.log(
        'Payment Status:',
        paymentStatus,
      )

      await processPayment({
        admin,
        orderId,
        paymentId,
        paymentStatus,
      })

      return NextResponse.json({
        ok: true,
      })
    }

    // =====================================================
    // OUTROS EVENTOS
    // =====================================================

    console.log(
      'Tipo de notificação não processado:',
      type,
    )

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    console.error('=================================')
    console.error(
      'ERRO NO WEBHOOK MERCADO PAGO',
    )
    console.error(error)
    console.error('=================================')

    // Sempre responde 200 para evitar
    // reenvios infinitos do webhook
    return NextResponse.json({
      ok: true,
    })
  }
}

// =========================================================
// PROCESSA PAGAMENTO
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
  console.log('Status recebido:', paymentStatus)
  console.log('=================================')

  // =====================================================
  // NORMALIZA STATUS
  // =====================================================

  const normalizedStatus =
    paymentStatus.toLowerCase()

  console.log(
    'Status normalizado:',
    normalizedStatus,
  )

  // =====================================================
  // BUSCA PEDIDO
  // =====================================================

  const {
    data: order,
    error: orderError,
  } = await admin
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

  console.log(
    'Status atual do pedido:',
    order.status,
  )

  // =====================================================
  // STATUS CONSIDERADOS PAGOS
  // =====================================================

  const paidStatuses = [
    'approved',
    'processed',
    'accredited',
  ]

  const isPaid =
    paidStatuses.includes(
      normalizedStatus,
    )

  // =====================================================
  // PAGAMENTO APROVADO
  // =====================================================

  if (isPaid) {
    console.log('=================================')
    console.log('PAGAMENTO CONFIRMADO!')
    console.log('=================================')

    // Evita entregar duas vezes
    if (order.status === 'delivered') {
      console.log(
        'Pedido já foi entregue anteriormente.',
      )

      return
    }

    // ===================================================
    // MARCA COMO PAGO
    // ===================================================

    const { error: paidError } =
      await admin
        .from('orders')
        .update({
          status: 'paid',
          payment_id: paymentId,
          paid_at:
            new Date().toISOString(),
        })
        .eq('id', order.id)

    if (paidError) {
      console.error(
        'Erro ao marcar pedido como pago:',
        paidError,
      )

      return
    }

    console.log(
      'Pedido marcado como PAID.',
    )

    // ===================================================
    // PROCURA CÓDIGO DISPONÍVEL
    // ===================================================

    const {
      data: code,
      error: codeError,
    } = await admin
      .from('activation_codes')
      .select('id, code')
      .eq(
        'product_id',
        order.product_id,
      )
      .eq('status', 'active')
      .is('user_id', null)
      .order(
        'created_at',
        {
          ascending: true,
        },
      )
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
      console.error('=================================')
      console.error(
        'NENHUM CÓDIGO DISPONÍVEL!',
      )
      console.error(
        'Produto:',
        order.product_id,
      )
      console.error('=================================')

      return
    }

    console.log(
      'Código disponível encontrado:',
      code.id,
    )

    // ===================================================
    // ATRIBUI CÓDIGO AO USUÁRIO
    // ===================================================

    const { error: assignError } =
      await admin
        .from('activation_codes')
        .update({
          user_id: order.user_id,
          assigned_at:
            new Date().toISOString(),
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

    console.log(
      'Código atribuído ao usuário.',
    )

    // ===================================================
    // MARCA PEDIDO COMO ENTREGUE
    // ===================================================

    const {
      error: deliverError,
    } = await admin
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
    console.log('Pedido:', order.id)
    console.log('Código ID:', code.id)
    console.log('=================================')

    return
  }

  // =====================================================
  // PAGAMENTO CANCELADO / REJEITADO
  // =====================================================

  const cancelledStatuses = [
    'rejected',
    'cancelled',
    'failed',
  ]

  if (
    cancelledStatuses.includes(
      normalizedStatus,
    )
  ) {
    console.log(
      'Pagamento cancelado/rejeitado:',
      normalizedStatus,
    )

    const { error } =
      await admin
        .from('orders')
        .update({
          status: 'cancelled',
          payment_id: paymentId,
        })
        .eq('id', order.id)

    if (error) {
      console.error(
        'Erro ao cancelar pedido:',
        error,
      )
    }

    return
  }

  // =====================================================
  // AINDA AGUARDANDO PAGAMENTO
  // =====================================================

  console.log(
    'Pagamento ainda aguardando confirmação:',
    normalizedStatus,
  )
}
