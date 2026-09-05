import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type OrderRequest = {
  productId?: unknown
  quantity?: unknown
}

function getBackendUnitPrice(quantity: number) {
  if (quantity >= 10) return 3300
  if (quantity >= 5) return 3400
  return 3500
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { ok: false, needsAuth: true, error: 'Você precisa estar logado para realizar uma compra.' },
      { status: 401 },
    )
  }

  const idempotencyKey = request.headers.get('Idempotency-Key')?.trim()

  if (!idempotencyKey) {
    return NextResponse.json(
      { ok: false, error: 'Chave de idempotência obrigatória.' },
      { status: 400 },
    )
  }

  let body: OrderRequest

  try {
    body = (await request.json()) as OrderRequest
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Dados da compra inválidos.' },
      { status: 400 },
    )
  }

  const requestedQuantity = Number(body.quantity)

  if (
    !Number.isInteger(requestedQuantity) ||
    requestedQuantity < 1 ||
    requestedQuantity > 500
  ) {
    return NextResponse.json(
      { ok: false, error: 'Quantidade inválida. Escolha entre 1 e 500 telas.' },
      { status: 400 },
    )
  }

  const quantity = requestedQuantity

  const { data: rateLimitOk, error: rateLimitError } = await admin.rpc(
    'check_order_rate_limit',
    {
      p_user_id: user.id,
      p_ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      p_limit: 5,
      p_window_seconds: 60,
    },
  )

  if (rateLimitError) {
    console.error('Erro ao verificar limite de pedidos:', rateLimitError)
    return NextResponse.json(
      { ok: false, error: 'Não foi possível validar a compra no momento.' },
      { status: 500 },
    )
  }

  if (!rateLimitOk) {
    return NextResponse.json(
      { ok: false, error: 'Muitas tentativas. Aguarde um momento e tente novamente.' },
      { status: 429 },
    )
  }

  const { data: existingByIdempotency, error: idempotencyError } = await admin
    .from('orders')
    .select('id, status, total_cents, quantity, payment_preference_id, created_at')
    .eq('user_id', user.id)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (idempotencyError) {
    console.error('Erro ao verificar idempotência:', idempotencyError)
    return NextResponse.json(
      { ok: false, error: 'Não foi possível validar a compra no momento.' },
      { status: 500 },
    )
  }

  if (existingByIdempotency) {
    if (
      existingByIdempotency.status === 'pending' &&
      existingByIdempotency.created_at &&
      new Date(existingByIdempotency.created_at).getTime() <= Date.now() - 10 * 60 * 1000
    ) {
      await admin.rpc('cancel_pending_order', {
        p_order_id: existingByIdempotency.id,
        p_user_id: user.id,
      })
    } else {
      return NextResponse.json({
        ok: true,
        existing: true,
        orderId: existingByIdempotency.id,
        status: existingByIdempotency.status,
        totalCents: existingByIdempotency.total_cents,
        quantity: existingByIdempotency.quantity,
        mercadoPagoOrderId: existingByIdempotency.payment_preference_id,
      })
    }
  }

  const { data: existingPending, error: pendingError } = await admin
    .from('orders')
    .select('id, status, total_cents, quantity, payment_preference_id, created_at')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pendingError) {
    console.error('Erro ao verificar pedido pendente:', pendingError)
    return NextResponse.json(
      { ok: false, error: 'Não foi possível verificar seu pedido pendente.' },
      { status: 500 },
    )
  }

  if (existingPending) {
    const expiresAt = new Date(existingPending.created_at).getTime() + 10 * 60 * 1000

    if (Date.now() >= expiresAt) {
      const { data: cancelled, error: cancelError } = await admin.rpc('cancel_pending_order', {
        p_order_id: existingPending.id,
        p_user_id: user.id,
      })

      if (cancelError || !cancelled) {
        console.error('Erro ao expirar pedido pendente:', cancelError)
        return NextResponse.json(
          { ok: false, error: 'Não foi possível liberar o pagamento pendente.' },
          { status: 500 },
        )
      }
    } else {
      return NextResponse.json(
        {
          ok: false,
          duplicatePending: true,
          orderId: existingPending.id,
          status: existingPending.status,
          totalCents: existingPending.total_cents,
          quantity: existingPending.quantity,
          mercadoPagoOrderId: existingPending.payment_preference_id,
          error: 'Você já possui um pagamento pendente. Finalize ou cancele esse pagamento antes de realizar uma nova compra.',
        },
        { status: 409 },
      )
    }
  }

  // O product_id no banco é UUID. Não confiamos no ID enviado pelo navegador:
  // o produto válido é resolvido no servidor pela configuração de 1 tela.
  const { data: product, error: productError } = await admin
    .from('products')
    .select('id')
    .eq('active', true)
    .eq('screens', 1)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (productError || !product) {
    console.error('Erro ao localizar produto de 1 tela:', productError)
    return NextResponse.json(
      { ok: false, error: 'Produto indisponível no momento.' },
      { status: 500 },
    )
  }

  const unitPriceCents = getBackendUnitPrice(quantity)
  const totalCents = unitPriceCents * quantity

  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({
      user_id: user.id,
      product_id: product.id,
      quantity,
      status: 'pending',
      total_cents: totalCents,
      idempotency_key: idempotencyKey,
    })
    .select('id, status, total_cents, quantity, created_at')
    .single()

  if (orderError || !order) {
    if (orderError?.code === '23505') {
      const { data: concurrentPending } = await admin
        .from('orders')
        .select('id, status, total_cents, quantity, payment_preference_id, created_at')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (concurrentPending) {
        return NextResponse.json(
          {
            ok: false,
            duplicatePending: true,
            orderId: concurrentPending.id,
            status: concurrentPending.status,
            totalCents: concurrentPending.total_cents,
            quantity: concurrentPending.quantity,
            mercadoPagoOrderId: concurrentPending.payment_preference_id,
            error: 'Você já possui um pagamento pendente. Finalize ou cancele esse pagamento antes de realizar uma nova compra.',
          },
          { status: 409 },
        )
      }
    }

    console.error('Erro ao criar pedido:', orderError)
    return NextResponse.json(
      { ok: false, error: 'Não foi possível criar o pedido.' },
      { status: 500 },
    )
  }

  const { data: reservedCount, error: reservationError } = await admin.rpc(
    'reserve_activation_codes',
    {
      p_order_id: order.id,
      p_quantity: quantity,
      p_minutes: 10,
    },
  )

  if (reservationError || Number(reservedCount ?? 0) !== quantity) {
    console.error('Erro ao reservar códigos:', reservationError, reservedCount)

    await admin.rpc('release_activation_code_reservations', {
      p_order_id: order.id,
    })
    await admin.from('orders').delete().eq('id', order.id).eq('status', 'pending')

    return NextResponse.json(
      {
        ok: false,
        error: 'Estoque insuficiente. Os códigos disponíveis foram reservados por outros pedidos ou não estão disponíveis no momento.',
      },
      { status: 409 },
    )
  }

  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN

  if (!accessToken) {
    console.error('MERCADO_PAGO_ACCESS_TOKEN não configurado.')

    await admin.rpc('release_activation_code_reservations', {
      p_order_id: order.id,
    })
    await admin.from('orders').delete().eq('id', order.id).eq('status', 'pending')

    return NextResponse.json(
      { ok: false, error: 'Pagamento indisponível no momento.' },
      { status: 500 },
    )
  }

  const externalReference = order.id
  const mercadoPagoBody = {
    type: 'online',
    total_amount: (totalCents / 100).toFixed(2),
    external_reference: externalReference,
    processing_mode: 'automatic',
    description: quantity === 1 ? '1 Tela JN TELAS' : `${quantity} Telas JN TELAS`,
    transactions: {
      payments: [
        {
          amount: (totalCents / 100).toFixed(2),
          payment_method: {
            id: 'pix',
            type: 'bank_transfer',
          },
        },
      ],
    },
    payer: {
      email: user.email,
    },
  }

  const mercadoPagoResponse = await fetch('https://api.mercadopago.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': randomUUID(),
    },
    body: JSON.stringify(mercadoPagoBody),
  })

  if (!mercadoPagoResponse.ok) {
    const errorText = await mercadoPagoResponse.text()
    console.error('Erro Mercado Pago:', errorText)

    await admin.rpc('release_activation_code_reservations', {
      p_order_id: order.id,
    })
    await admin.from('orders').delete().eq('id', order.id).eq('status', 'pending')

    return NextResponse.json(
      { ok: false, error: 'Não foi possível criar o pagamento.' },
      { status: 502 },
    )
  }

  const mercadoPagoOrder = await mercadoPagoResponse.json()
  const mercadoPagoOrderId = mercadoPagoOrder?.id ?? null
  const paymentMethod = mercadoPagoOrder?.transactions?.payments?.[0]?.payment_method ?? null
  const qrCode = paymentMethod?.qr_code ?? null
  const qrCodeBase64 = paymentMethod?.qr_code_base64 ?? null

  if (!mercadoPagoOrderId || !qrCode) {
    console.error('Mercado Pago retornou pedido sem QR Code:', mercadoPagoOrder)

    await admin.rpc('release_activation_code_reservations', {
      p_order_id: order.id,
    })
    await admin.from('orders').delete().eq('id', order.id).eq('status', 'pending')

    return NextResponse.json(
      { ok: false, error: 'Não foi possível gerar o PIX.' },
      { status: 502 },
    )
  }

  const { error: paymentReferenceError } = await admin
    .from('orders')
    .update({ payment_preference_id: mercadoPagoOrderId })
    .eq('id', order.id)
    .eq('status', 'pending')

  if (paymentReferenceError) {
    console.error('Erro ao salvar ID do Mercado Pago:', paymentReferenceError)
  }

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    mercadoPagoOrderId,
    qrCode,
    qrCodeBase64,
  })
}
