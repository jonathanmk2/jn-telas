import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type OrderRequest = {
  productId?: unknown
  quantity?: unknown
}

function getUnitPriceCents(quantity: number): number {
  if (quantity >= 10) return 3300
  if (quantity >= 5) return 3400
  return 3500
}

function isValidQuantity(quantity: unknown): quantity is number {
  return (
    typeof quantity === 'number' &&
    Number.isFinite(quantity) &&
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= 500
  )
}

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim()
    if (firstIp) return firstIp
  }

  return request.headers.get('x-real-ip')?.trim() || null
}

function getIdempotencyKey(request: Request): string | null {
  const value = request.headers.get('Idempotency-Key')?.trim()
  if (!value || value.length > 255) return null
  return value
}

function extractPaymentData(mercadoPagoOrder: any) {
  const transaction =
    mercadoPagoOrder?.transactions?.payments?.[0] ??
    mercadoPagoOrder?.transaction?.payments?.[0] ??
    mercadoPagoOrder?.payments?.[0] ??
    null

  return {
    qrCode:
      transaction?.payment_method?.qr_code ??
      transaction?.qr_code ??
      transaction?.point_of_interaction?.transaction_data?.qr_code ??
      mercadoPagoOrder?.qr_code ??
      mercadoPagoOrder?.point_of_interaction?.transaction_data?.qr_code ??
      null,
    qrCodeBase64:
      transaction?.payment_method?.qr_code_base64 ??
      transaction?.qr_code_base64 ??
      transaction?.point_of_interaction?.transaction_data?.qr_code_base64 ??
      mercadoPagoOrder?.qr_code_base64 ??
      mercadoPagoOrder?.point_of_interaction?.transaction_data?.qr_code_base64 ??
      null,
  }
}

async function getMercadoPagoOrder(token: string, orderId: string) {
  const response = await fetch(
    `https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    },
  )

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Mercado Pago erro ${response.status}: ${text}`)
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new Error('O Mercado Pago retornou uma resposta inválida.')
  }
}

export async function POST(request: Request) {
  try {
    const mercadoPagoToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
    if (!mercadoPagoToken) {
      return NextResponse.json(
        { ok: false, error: 'Mercado Pago não configurado no servidor.' },
        { status: 500 },
      )
    }

    const mercadoPagoIntegratorId = process.env.MERCADO_PAGO_INTEGRATOR_ID
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      return NextResponse.json(
        { ok: false, error: `Erro ao verificar autenticação: ${userError.message}` },
        { status: 401 },
      )
    }

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Você precisa entrar na sua conta para comprar.',
          needsAuth: true,
        },
        { status: 401 },
      )
    }

    const idempotencyKey = getIdempotencyKey(request)
    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: 'Idempotency-Key é obrigatória.' },
        { status: 400 },
      )
    }

    let body: OrderRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { ok: false, error: 'JSON inválido.' },
        { status: 400 },
      )
    }

    const productId = typeof body.productId === 'string' ? body.productId : ''
    const quantity = body.quantity

    if (!productId) {
      return NextResponse.json(
        { ok: false, error: 'Produto inválido.' },
        { status: 400 },
      )
    }

    if (!isValidQuantity(quantity)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Quantidade inválida. Informe um número inteiro entre 1 e 500.',
        },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    const plans: Record<string, number> = {
      'plano-1-tela': 1,
      'plano-1-telas': 1,
      'plano-5-telas': 5,
      'plano-10-telas': 10,
    }

    const screens = plans[productId]
    if (!screens) {
      return NextResponse.json(
        { ok: false, error: `Plano inválido recebido: ${productId}` },
        { status: 400 },
      )
    }

    const { data: product, error: productError } = await admin
      .from('products')
      .select('id, name, screens, price_cents, active')
      .eq('screens', screens)
      .eq('active', true)
      .single()

    if (productError) {
      return NextResponse.json(
        { ok: false, error: `Erro ao buscar o plano: ${productError.message}` },
        { status: 500 },
      )
    }

    if (!product) {
      return NextResponse.json(
        { ok: false, error: 'Plano não encontrado.' },
        { status: 404 },
      )
    }

    const { data: existingOrder, error: existingOrderError } = await admin
      .from('orders')
      .select('id, user_id, product_id, quantity, total_cents, status, payment_preference_id')
      .eq('user_id', user.id)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    if (existingOrderError) {
      return NextResponse.json(
        { ok: false, error: 'Não foi possível verificar a Idempotency-Key.' },
        { status: 500 },
      )
    }

    if (existingOrder) {
      if (
        existingOrder.product_id !== product.id ||
        existingOrder.quantity !== quantity
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Esta Idempotency-Key já foi utilizada em outra operação.',
          },
          { status: 409 },
        )
      }

      if (existingOrder.payment_preference_id) {
        try {
          const mercadoPagoOrder = await getMercadoPagoOrder(
            mercadoPagoToken,
            existingOrder.payment_preference_id,
          )
          const { qrCode, qrCodeBase64 } = extractPaymentData(mercadoPagoOrder)

          return NextResponse.json({
            ok: true,
            orderId: existingOrder.id,
            mercadoPagoOrderId: existingOrder.payment_preference_id,
            qrCode,
            qrCodeBase64,
            idempotent: true,
          })
        } catch (error) {
          console.error('Erro ao recuperar pedido idempotente:', error)
          return NextResponse.json(
            {
              ok: false,
              error: 'O pedido já existe, mas não foi possível recuperar os dados do pagamento.',
            },
            { status: 502 },
          )
        }
      }

      return NextResponse.json(
        {
          ok: false,
          error: 'Esta operação já possui um pedido em processamento.',
          orderId: existingOrder.id,
          idempotent: true,
        },
        { status: 409 },
      )
    }

    const ipAddress = getClientIp(request)
    const { data: rateLimit, error: rateLimitError } = await admin.rpc(
      'check_order_rate_limit',
      {
        p_user_id: user.id,
        p_ip_address: ipAddress,
        p_limit: 5,
        p_window_seconds: 60,
      },
    )

    if (rateLimitError) {
      console.error('Erro no rate limit:', rateLimitError)
      return NextResponse.json(
        { ok: false, error: 'Não foi possível validar o limite de pedidos.' },
        { status: 500 },
      )
    }

    const rateLimitResult = Array.isArray(rateLimit) ? rateLimit[0] : rateLimit
    if (!rateLimitResult?.allowed) {
      const retryAfter = Math.max(1, Number(rateLimitResult?.retry_after ?? 60))
      return NextResponse.json(
        {
          ok: false,
          error: 'Limite de pedidos atingido. Aguarde antes de tentar novamente.',
          retryAfter,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        },
      )
    }

    /* Bloqueio de estoque antes de criar o pedido e antes de chamar o Mercado Pago. */
    const { count: availableStock, error: stockError } = await admin
      .from('activation_codes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .is('user_id', null)

    if (stockError) {
      console.error('Erro ao verificar estoque:', stockError)
      return NextResponse.json(
        { ok: false, error: 'Não foi possível verificar o estoque no momento.' },
        { status: 500 },
      )
    }

    const stock = availableStock ?? 0
    if (stock < quantity) {
      return NextResponse.json(
        {
          ok: false,
          error: `Estoque insuficiente. Temos apenas ${stock} código(s) disponível(is) no momento para esta compra.`,
          availableStock: stock,
        },
        { status: 409 },
      )
    }

    const unitPriceCents = getUnitPriceCents(quantity)
    const totalCents = unitPriceCents * quantity
    const amount = (totalCents / 100).toFixed(2)

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
      .select('id')
      .single()

    if (orderError || !order) {
      if (orderError?.code === '23505') {
        const { data: concurrentOrder } = await admin
          .from('orders')
          .select('id, product_id, quantity, status, payment_preference_id')
          .eq('user_id', user.id)
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle()

        if (concurrentOrder) {
          if (
            concurrentOrder.product_id !== product.id ||
            concurrentOrder.quantity !== quantity
          ) {
            return NextResponse.json(
              {
                ok: false,
                error: 'Esta Idempotency-Key já foi utilizada em outra operação.',
              },
              { status: 409 },
            )
          }

          if (concurrentOrder.payment_preference_id) {
            try {
              const mercadoPagoOrder = await getMercadoPagoOrder(
                mercadoPagoToken,
                concurrentOrder.payment_preference_id,
              )
              const { qrCode, qrCodeBase64 } = extractPaymentData(mercadoPagoOrder)
              return NextResponse.json({
                ok: true,
                orderId: concurrentOrder.id,
                mercadoPagoOrderId: concurrentOrder.payment_preference_id,
                qrCode,
                qrCodeBase64,
                idempotent: true,
              })
            } catch (error) {
              console.error('Erro ao recuperar pagamento concorrente:', error)
              return NextResponse.json(
                {
                  ok: false,
                  error: 'O pedido já existe, mas não foi possível recuperar os dados do pagamento.',
                  orderId: concurrentOrder.id,
                },
                { status: 502 },
              )
            }
          }

          return NextResponse.json(
            {
              ok: false,
              error: 'Esta operação já possui um pedido em processamento.',
              orderId: concurrentOrder.id,
              idempotent: true,
            },
            { status: 409 },
          )
        }
      }

      return NextResponse.json(
        {
          ok: false,
          error: `Não foi possível criar o pedido: ${orderError?.message ?? 'Erro desconhecido'}`,
        },
        { status: 500 },
      )
    }

    const mercadoPagoBody = {
      type: 'online',
      processing_mode: 'automatic',
      external_reference: order.id,
      total_amount: amount,
      description:
        quantity === 1
          ? '1 Tela JN TELAS'
          : `${quantity} Telas JN TELAS`,
      payer: {
        email: user.email ?? undefined,
      },
      transactions: {
        payments: [
          {
            amount,
            payment_method: {
              id: 'pix',
              type: 'bank_transfer',
            },
          },
        ],
      },
    }

    const mercadoPagoIdempotencyKey = randomUUID()
    const headers: Record<string, string> = {
      Authorization: `Bearer ${mercadoPagoToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': mercadoPagoIdempotencyKey,
    }

    if (mercadoPagoIntegratorId) {
      headers['X-Integrator-Id'] = mercadoPagoIntegratorId
    }

    const response = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers,
      body: JSON.stringify(mercadoPagoBody),
      cache: 'no-store',
    })

    const responseText = await response.text()

    if (!response.ok) {
      await admin
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', order.id)

      return NextResponse.json(
        {
          ok: false,
          error: `Mercado Pago erro ${response.status}: ${responseText}`,
        },
        { status: 502 },
      )
    }

    let mercadoPagoOrder: any
    try {
      mercadoPagoOrder = JSON.parse(responseText)
    } catch {
      return NextResponse.json(
        { ok: false, error: 'O Mercado Pago retornou uma resposta inválida.' },
        { status: 502 },
      )
    }

    const mercadoPagoOrderId = String(
      mercadoPagoOrder.id ?? mercadoPagoOrder.order_id ?? '',
    )

    if (mercadoPagoOrderId) {
      await admin
        .from('orders')
        .update({ payment_preference_id: mercadoPagoOrderId })
        .eq('id', order.id)
    }

    const { qrCode, qrCodeBase64 } = extractPaymentData(mercadoPagoOrder)

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      mercadoPagoOrderId,
      qrCode,
      qrCodeBase64,
      idempotent: false,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('Erro ao criar pedido:', error)

    return NextResponse.json(
      { ok: false, error: `Erro ao criar pagamento: ${message}` },
      { status: 500 },
    )
  }
}
