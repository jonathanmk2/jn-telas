import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    console.log('=================================')
    console.log('WEBHOOK MERCADO PAGO RECEBIDO')
    console.log('=================================')

    const mercadoPagoToken =
      process.env.MERCADO_PAGO_TEST_ACCESS_TOKEN ||
      process.env.MERCADO_PAGO_ACCESS_TOKEN

    if (!mercadoPagoToken) {
      console.error('Token do Mercado Pago não configurado.')

      return NextResponse.json(
        { error: 'Mercado Pago não configurado' },
        { status: 500 },
      )
    }

    const url = new URL(request.url)

    const type =
      url.searchParams.get('type') ||
      url.searchParams.get('topic')

    const id =
      url.searchParams.get('data.id') ||
      url.searchParams.get('id')

    console.log('Tipo:', type)
    console.log('ID recebido:', id)

    // Por enquanto, processamos somente notificações de pagamento
    if (type !== 'payment' || !id) {
      console.log('Notificação ignorada.')

      return NextResponse.json({ ok: true })
    }

    // =====================================================
    // CONSULTA O PAGAMENTO DIRETAMENTE NO MERCADO PAGO
    // =====================================================

    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${id}`,
      {
        headers: {
          Authorization: `Bearer ${mercadoPagoToken}`,
        },
        cache: 'no-store',
      },
    )

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text()

      console.error(
        'Erro ao consultar pagamento:',
        paymentResponse.status,
        errorText,
      )

      return NextResponse.json({ ok: true })
    }

    const payment = await paymentResponse.json()

    console.log('=================================')
    console.log('PAGAMENTO CONSULTADO')
    console.log('Payment ID:', payment.id)
    console.log('Status:', payment.status)
    console.log(
      'External Reference:',
      payment.external_reference,
    )
    console.log('=================================')

    const orderId = payment.external_reference

    if (!orderId) {
      console.error(
        'Pagamento não possui external_reference.',
      )

      return NextResponse.json({ ok: true })
    }

    // =====================================================
    // BUSCA O PEDIDO NO SUPABASE
    // =====================================================

    const admin = createAdminClient()

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select(
        'id, user_id, product_id, status',
      )
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error(
        'Pedido não encontrado:',
        orderError,
      )

      return NextResponse.json({ ok: true })
    }

    console.log('Pedido encontrado:', order.id)

    // =====================================================
    // PAGAMENTO APROVADO
    // =====================================================

    if (payment.status === 'approved') {
      console.log('PAGAMENTO APROVADO!')

      const { error: paidError } = await admin
        .from('orders')
        .update({
          status: 'paid',
          payment_id: String(payment.id),
          paid_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      if (paidError) {
        console.error(
          'Erro ao atualizar pedido:',
          paidError,
        )

        return NextResponse.json({ ok: true })
      }

      console.log('Pedido marcado como PAID.')

      // =====================================================
      // PROCURA UM CÓDIGO DE ATIVAÇÃO DISPONÍVEL
      // =====================================================

      const { data: code, error: codeError } =
        await admin
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
      }

      if (code) {
        console.log(
          'Código disponível encontrado:',
          code.id,
        )

        const { error: assignError } = await admin
          .from('activation_codes')
          .update({
            user_id: order.user_id,
            assigned_at: new Date().toISOString(),
          })
          .eq('id', code.id)

        if (assignError) {
          console.error(
            'Erro ao atribuir código:',
            assignError,
          )
        } else {
          await admin
            .from('orders')
            .update({
              status: 'delivered',
              activation_code_id: code.id,
            })
            .eq('id', order.id)

          console.log(
            'Código entregue ao usuário com sucesso!',
          )
        }
      } else {
        console.log(
          'Nenhum código disponível para este produto.',
        )
      }
    }

    // =====================================================
    // PAGAMENTO CANCELADO / REJEITADO
    // =====================================================

    if (
      payment.status === 'rejected' ||
      payment.status === 'cancelled'
    ) {
      console.log(
        'Pagamento cancelado/rejeitado:',
        payment.status,
      )

      await admin
        .from('orders')
        .update({
          status: 'cancelled',
          payment_id: String(payment.id),
        })
        .eq('id', order.id)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('=================================')
    console.error('ERRO NO WEBHOOK MERCADO PAGO')
    console.error(error)
    console.error('=================================')

    // Respondemos 200 para evitar loops infinitos
    return NextResponse.json({ ok: true })
  }
}
