import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

type MercadoPagoWebhookBody = {
  action?: string
  api_version?: string
  application_id?: string
  date_created?: string
  id?: string | number
  live_mode?: boolean
  type?: string
  user_id?: string | number
  data?: {
    id?: string
  }
}

function validateWebhookSignature(
  request: NextRequest,
  dataId: string,
  secret: string,
) {
  const xSignature = request.headers.get('x-signature')
  const xRequestId = request.headers.get('x-request-id')

  // Se não existir assinatura, não é uma notificação válida
  if (!xSignature) {
    console.error('Webhook sem x-signature.')
    return false
  }

  // Extrai ts e v1 do formato:
  // ts=123456,v1=abcdef
  const parts = xSignature.split(',')

  let ts = ''
  let receivedHash = ''

  for (const part of parts) {
    const [key, value] = part.trim().split('=')

    if (key === 'ts') {
      ts = value ?? ''
    }

    if (key === 'v1') {
      receivedHash = value ?? ''
    }
  }

  if (!receivedHash) {
    console.error('Webhook sem assinatura v1.')
    return false
  }

  // Manifest oficial:
  // id:<data.id>;request-id:<x-request-id>;ts:<ts>;
  let manifest = ''

  if (dataId) {
    manifest += `id:${dataId};`
  }

  if (xRequestId) {
    manifest += `request-id:${xRequestId};`
  }

  if (ts) {
    manifest += `ts:${ts};`
  }

  const calculatedHash = createHmac(
    'sha256',
    secret,
  )
    .update(manifest)
    .digest('hex')

  try {
    const receivedBuffer = Buffer.from(
      receivedHash,
      'hex',
    )

    const calculatedBuffer = Buffer.from(
      calculatedHash,
      'hex',
    )

    if (
      receivedBuffer.length !==
      calculatedBuffer.length
    ) {
      return false
    }

    return timingSafeEqual(
      receivedBuffer,
      calculatedBuffer,
    )
  } catch (error) {
    console.error(
      'Erro ao validar assinatura:',
      error,
    )

    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('=================================')
    console.log('WEBHOOK MERCADO PAGO RECEBIDO')
    console.log('=================================')

    // =====================================================
    // 1. CONFIGURAÇÕES
    // =====================================================

    const mercadoPagoToken =
      process.env.MERCADO_PAGO_TEST_ACCESS_TOKEN ||
      process.env.MERCADO_PAGO_ACCESS_TOKEN

    const webhookSecret =
      process.env.MERCADO_PAGO_WEBHOOK_SECRET

    if (!mercadoPagoToken) {
      console.error(
        'Token do Mercado Pago não configurado.',
      )

      return NextResponse.json(
        { error: 'Mercado Pago não configurado' },
        { status: 500 },
      )
    }

    if (!webhookSecret) {
      console.error(
        'Assinatura secreta do webhook não configurada.',
      )

      return NextResponse.json(
        { error: 'Webhook secret não configurado' },
        { status: 500 },
      )
    }

    // =====================================================
    // 2. LÊ URL E BODY
    // =====================================================

    const url = new URL(request.url)

    const body: MercadoPagoWebhookBody =
      await request.json()

    const type =
      body.type ||
      url.searchParams.get('type') ||
      url.searchParams.get('topic')

    const resourceId =
      body.data?.id ||
      url.searchParams.get('data.id') ||
      url.searchParams.get('id')

    console.log('Tipo:', type)
    console.log('Action:', body.action)
    console.log('Resource ID:', resourceId)
    console.log(
      'Notification ID:',
      body.id,
    )

    // =====================================================
    // 3. VALIDA ASSINATURA
    // =====================================================

    if (!resourceId) {
      console.error(
        'Webhook recebido sem data.id.',
      )

      return NextResponse.json(
        { error: 'ID não informado' },
        { status: 400 },
      )
    }

    const isValid = validateWebhookSignature(
      request,
      resourceId,
      webhookSecret,
    )

    if (!isValid) {
      console.error(
        'ASSINATURA DO WEBHOOK INVÁLIDA!',
      )

      return NextResponse.json(
        { error: 'Assinatura inválida' },
        { status: 401 },
      )
    }

    console.log(
      'Assinatura do webhook validada com sucesso.',
    )

    // =====================================================
    // 4. PROCESSAMOS APENAS ORDER
    // =====================================================

    if (type !== 'order') {
      console.log(
        'Notificação ignorada. Tipo:',
        type,
      )

      return NextResponse.json({ ok: true })
    }

    // =====================================================
    // 5. CONSULTA A ORDER NO MERCADO PAGO
    // =====================================================

    console.log(
      'Consultando Order:',
      resourceId,
    )

    const orderResponse = await fetch(
      `https://api.mercadopago.com/v1/orders/${resourceId}`,
      {
        headers: {
          Authorization: `Bearer ${mercadoPagoToken}`,
        },

        cache: 'no-store',
      },
    )

    const orderResponseText =
      await orderResponse.text()

    if (!orderResponse.ok) {
      console.error(
        'Erro ao consultar Order:',
        orderResponse.status,
        orderResponseText,
      )

      return NextResponse.json({ ok: true })
    }

    const mercadoPagoOrder =
      JSON.parse(orderResponseText)

    console.log('=================================')
    console.log('ORDER CONSULTADA')
    console.log(
      'Mercado Pago Order ID:',
      mercadoPagoOrder.id,
    )
    console.log(
      'Status:',
      mercadoPagoOrder.status,
    )
    console.log(
      'External Reference:',
      mercadoPagoOrder.external_reference,
    )
    console.log('=================================')

    // =====================================================
    // 6. IDENTIFICA NOSSO PEDIDO
    // =====================================================

    const internalOrderId =
      mercadoPagoOrder.external_reference

    if (!internalOrderId) {
      console.error(
        'Order não possui external_reference.',
      )

      return NextResponse.json({ ok: true })
    }

    // =====================================================
    // 7. BUSCA PEDIDO NO SUPABASE
    // =====================================================

    const admin = createAdminClient()

    const { data: order, error: orderError } =
      await admin
        .from('orders')
        .select(
          'id, user_id, product_id, status, payment_id',
        )
        .eq('id', internalOrderId)
        .single()

    if (orderError || !order) {
      console.error(
        'Pedido interno não encontrado:',
        orderError,
      )

      return NextResponse.json({ ok: true })
    }

    console.log(
      'Pedido interno encontrado:',
      order.id,
    )

    // =====================================================
    // 8. ENCONTRA O PAGAMENTO DA ORDER
    // =====================================================

    const payment =
      mercadoPagoOrder.transactions
        ?.payments?.[0] ?? null

    if (!payment) {
      console.log(
        'Order ainda não possui pagamento.',
      )

      return NextResponse.json({ ok: true })
    }

    const paymentId = String(payment.id ?? '')

    const paymentStatus =
      payment.status ??
      mercadoPagoOrder.status

    console.log('=================================')
    console.log('PAGAMENTO DA ORDER')
    console.log('Payment ID:', paymentId)
    console.log('Payment Status:', paymentStatus)
    console.log('=================================')

    // =====================================================
    // 9. PROTEÇÃO CONTRA WEBHOOK DUPLICADO
    // =====================================================

    if (order.status === 'delivered') {
      console.log(
        'Pedido já foi entregue anteriormente.',
      )

      return NextResponse.json({ ok: true })
    }

    // =====================================================
    // 10. PAGAMENTO APROVADO
    // =====================================================

    if (paymentStatus === 'approved') {
      console.log('=================================')
      console.log('PAGAMENTO APROVADO!')
      console.log('=================================')

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

        return NextResponse.json({ ok: true })
      }

      console.log(
        'Pedido marcado como PAID.',
      )

      // =================================================
      // 11. PROCURA CÓDIGO DISPONÍVEL
      // =================================================

      const {
        data: activationCode,
        error: codeError,
      } = await admin
        .from('activation_codes')
        .select('id')
        .eq('product_id', order.product_id)
        .eq('status', 'active')
        .is('user_id', null)
        .order('created_at', {
          ascending: true,
        })
        .limit(1)
        .maybeSingle()

      if (codeError) {
        console.error(
          'Erro ao procurar código:',
          codeError,
        )

        return NextResponse.json({ ok: true })
      }

      // =================================================
      // 12. SEM CÓDIGO DISPONÍVEL
      // =================================================

      if (!activationCode) {
        console.log(
          'Nenhum código disponível para este produto.',
        )

        return NextResponse.json({ ok: true })
      }

      console.log(
        'Código disponível encontrado:',
        activationCode.id,
      )

      // =================================================
      // 13. ATRIBUI O CÓDIGO AO USUÁRIO
      // =================================================

      const { error: assignError } =
        await admin
          .from('activation_codes')
          .update({
            user_id: order.user_id,
            assigned_at: new Date().toISOString(),
          })
          .eq('id', activationCode.id)
          .is('user_id', null)

      if (assignError) {
        console.error(
          'Erro ao atribuir código:',
          assignError,
        )

        return NextResponse.json({ ok: true })
      }

      // =================================================
      // 14. FINALIZA PEDIDO
      // =================================================

      const { error: deliverError } =
        await admin
          .from('orders')
          .update({
            status: 'delivered',
            activation_code_id:
              activationCode.id,
          })
          .eq('id', order.id)

      if (deliverError) {
        console.error(
          'Erro ao finalizar entrega:',
          deliverError,
        )

        return NextResponse.json({ ok: true })
      }

      console.log('=================================')
      console.log(
        'CÓDIGO ENTREGUE AO USUÁRIO COM SUCESSO!',
      )
      console.log('Pedido:', order.id)
      console.log(
        'Código:',
        activationCode.id,
      )
      console.log('=================================')

      return NextResponse.json({ ok: true })
    }

    // =====================================================
    // 15. PAGAMENTO CANCELADO / REJEITADO
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
    }

    // =====================================================
    // 16. PAGAMENTO AINDA PENDENTE
    // =====================================================

    console.log(
      'Pagamento ainda não aprovado:',
      paymentStatus,
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('=================================')
    console.error(
      'ERRO NO WEBHOOK MERCADO PAGO',
    )
    console.error(error)
    console.error('=================================')

    return NextResponse.json(
      { ok: true },
      { status: 200 },
    )
  }
}
