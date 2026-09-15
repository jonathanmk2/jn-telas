import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type OrderRequest = { productId?: unknown; quantity?: unknown }
const ORDER_EXPIRATION_MINUTES = 30

type Platform = 'ldcloud' | 'vsphone'
function unitPrice(platform: Platform, quantity: number) {
  if (platform === 'vsphone') return quantity >= 10 ? 2200 : quantity >= 5 ? 2300 : 2400
  return quantity >= 10 ? 3300 : quantity >= 5 ? 3400 : 3500
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, needsAuth: true, error: 'Você precisa estar logado para realizar uma compra.' }, { status: 401 })

  const idempotencyKey = request.headers.get('Idempotency-Key')?.trim()
  if (!idempotencyKey) return NextResponse.json({ ok: false, error: 'Chave de idempotência obrigatória.' }, { status: 400 })

  let body: OrderRequest
  try { body = await request.json() as OrderRequest } catch { return NextResponse.json({ ok: false, error: 'Dados da compra inválidos.' }, { status: 400 }) }
  const quantity = Number(body.quantity)
  const requestedProductId = typeof body.productId === 'string' ? body.productId : ''
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) return NextResponse.json({ ok: false, error: 'Quantidade inválida. Escolha entre 1 e 500 telas.' }, { status: 400 })
  if (!requestedProductId) return NextResponse.json({ ok: false, error: 'Produto inválido.' }, { status: 400 })

  const { data: rateLimitOk, error: rateLimitError } = await admin.rpc('check_order_rate_limit', { p_user_id: user.id, p_ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null, p_limit: 5, p_window_seconds: 60 })
  if (rateLimitError) return NextResponse.json({ ok: false, error: 'Não foi possível validar a compra no momento.' }, { status: 500 })
  if (!rateLimitOk) return NextResponse.json({ ok: false, error: 'Muitas tentativas. Aguarde um momento e tente novamente.' }, { status: 429 })

  const { data: product, error: productError } = await admin.from('products').select('id, name, platform').eq('id', requestedProductId).eq('active', true).eq('screens', 1).maybeSingle()
  if (productError || !product) return NextResponse.json({ ok: false, error: 'Produto indisponível no momento.' }, { status: 404 })
  const platform: Platform = product.platform === 'vsphone' ? 'vsphone' : 'ldcloud'

  const { data: existingByIdempotency } = await admin.from('orders').select('id,status,total_cents,quantity,payment_preference_id,created_at').eq('user_id', user.id).eq('idempotency_key', idempotencyKey).maybeSingle()
  if (existingByIdempotency) {
    const expired = existingByIdempotency.status === 'pending' && new Date(existingByIdempotency.created_at).getTime() <= Date.now() - ORDER_EXPIRATION_MINUTES * 60000
    if (expired) await admin.rpc('cancel_pending_order', { p_order_id: existingByIdempotency.id, p_user_id: user.id })
    else return NextResponse.json({ ok: true, existing: true, orderId: existingByIdempotency.id, status: existingByIdempotency.status, totalCents: existingByIdempotency.total_cents, quantity: existingByIdempotency.quantity, mercadoPagoOrderId: existingByIdempotency.payment_preference_id })
  }

  const { data: existingPending, error: pendingError } = await admin.from('orders').select('id,status,total_cents,quantity,payment_preference_id,created_at').eq('user_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (pendingError) return NextResponse.json({ ok: false, error: 'Não foi possível verificar seu pedido pendente.' }, { status: 500 })
  if (existingPending) {
    const expired = Date.now() >= new Date(existingPending.created_at).getTime() + ORDER_EXPIRATION_MINUTES * 60000
    if (expired) await admin.rpc('cancel_pending_order', { p_order_id: existingPending.id, p_user_id: user.id })
    else return NextResponse.json({ ok: false, duplicatePending: true, orderId: existingPending.id, status: existingPending.status, totalCents: existingPending.total_cents, quantity: existingPending.quantity, mercadoPagoOrderId: existingPending.payment_preference_id, error: 'Você já possui um pagamento pendente. Finalize ou cancele esse pagamento antes de realizar uma nova compra.' }, { status: 409 })
  }

  const price = unitPrice(platform, quantity)
  const totalCents = price * quantity
  const { data: order, error: orderError } = await admin.from('orders').insert({ user_id: user.id, product_id: product.id, quantity, status: 'pending', total_cents: totalCents, idempotency_key: idempotencyKey }).select('id,status,total_cents,quantity,created_at').single()
  if (orderError || !order) return NextResponse.json({ ok: false, error: 'Não foi possível criar o pedido.' }, { status: 500 })

  const { data: reservedCount, error: reservationError } = await admin.rpc('reserve_activation_codes', { p_order_id: order.id, p_quantity: quantity, p_minutes: ORDER_EXPIRATION_MINUTES, p_platform: platform })
  const reserved = Number(reservedCount)
  if (reservationError || !Number.isFinite(reserved) || reserved !== quantity) {
    await admin.rpc('release_activation_code_reservations', { p_order_id: order.id })
    await admin.from('orders').delete().eq('id', order.id).eq('status', 'pending')
    return NextResponse.json({ ok: false, error: `Estoque ${platform === 'vsphone' ? 'VSPHONE' : 'LD CLOUD'} insuficiente para esta quantidade.` }, { status: 409 })
  }

  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
  if (!accessToken) {
    await admin.rpc('release_activation_code_reservations', { p_order_id: order.id }); await admin.from('orders').delete().eq('id', order.id).eq('status', 'pending')
    return NextResponse.json({ ok: false, error: 'Pagamento indisponível no momento.' }, { status: 500 })
  }

  const label = platform === 'vsphone' ? 'VSPHONE VIP 30 DIAS' : 'LD CLOUD VIP 30 DIAS'
  const mercadoPagoBody = { type: 'online', total_amount: (totalCents / 100).toFixed(2), external_reference: order.id, processing_mode: 'automatic', description: `${quantity} ${quantity === 1 ? 'Tela' : 'Telas'} ${label}`, transactions: { payments: [{ amount: (totalCents / 100).toFixed(2), payment_method: { id: 'pix', type: 'bank_transfer' }, expiration_time: 'PT30M' }] }, payer: { email: user.email } }
  const mpResponse = await fetch('https://api.mercadopago.com/v1/orders', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': randomUUID() }, body: JSON.stringify(mercadoPagoBody) })
  if (!mpResponse.ok) {
    console.error('Erro Mercado Pago:', await mpResponse.text())
    await admin.rpc('release_activation_code_reservations', { p_order_id: order.id }); await admin.from('orders').delete().eq('id', order.id).eq('status', 'pending')
    return NextResponse.json({ ok: false, error: 'Não foi possível criar o pagamento.' }, { status: 502 })
  }

  const mpOrder = await mpResponse.json()
  const mercadoPagoOrderId = mpOrder?.id ?? null
  const method = mpOrder?.transactions?.payments?.[0]?.payment_method ?? null
  const qrCode = method?.qr_code ?? null
  const qrCodeBase64 = method?.qr_code_base64 ?? null
  if (!mercadoPagoOrderId || !qrCode) {
    await admin.rpc('release_activation_code_reservations', { p_order_id: order.id }); await admin.from('orders').delete().eq('id', order.id).eq('status', 'pending')
    return NextResponse.json({ ok: false, error: 'Não foi possível gerar o PIX.' }, { status: 502 })
  }
  await admin.from('orders').update({ payment_preference_id: mercadoPagoOrderId }).eq('id', order.id).eq('status', 'pending')
  return NextResponse.json({ ok: true, orderId: order.id, mercadoPagoOrderId, qrCode, qrCodeBase64, platform })
}
