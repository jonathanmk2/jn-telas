import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ORDER_EXPIRATION_MINUTES = 30

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, needsAuth: true, error: 'Você precisa estar logado.' }, { status: 401 })
  }

  const { orderId } = await params
  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'Pedido inválido.' }, { status: 400 })
  }

  const { data: order, error } = await admin
    .from('orders')
    .select('id, user_id, status, quantity, total_cents, payment_preference_id, created_at')
    .eq('id', orderId)
    .maybeSingle()

  if (error || !order) {
    return NextResponse.json({ ok: false, expired: true, error: 'Pagamento expirado ou não encontrado.' }, { status: 404 })
  }

  if (order.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: 'Você não pode acessar este pagamento.' }, { status: 403 })
  }

  const expiresAt = new Date(order.created_at).getTime() + ORDER_EXPIRATION_MINUTES * 60 * 1000

  if (order.status !== 'pending' || Date.now() >= expiresAt || !order.payment_preference_id) {
    if (order.status === 'pending' && Date.now() >= expiresAt) {
      await admin.rpc('cancel_pending_order', { p_order_id: order.id, p_user_id: user.id })
    }

    return NextResponse.json({ ok: false, expired: true, error: 'Pagamento expirado ou não disponível.' }, { status: 410 })
  }

  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
  if (!accessToken) {
    return NextResponse.json({ ok: false, error: 'Pagamento indisponível no momento.' }, { status: 500 })
  }

  const mercadoPagoResponse = await fetch(
    `https://api.mercadopago.com/v1/orders/${encodeURIComponent(order.payment_preference_id)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    },
  )

  if (!mercadoPagoResponse.ok) {
    return NextResponse.json({ ok: false, error: 'Não foi possível recuperar o PIX.' }, { status: 502 })
  }

  const mercadoPagoOrder = await mercadoPagoResponse.json()
  const transaction = mercadoPagoOrder?.transactions?.payments?.[0]
  const qrCode = transaction?.payment_method?.qr_code ?? null
  const qrCodeBase64 = transaction?.payment_method?.qr_code_base64 ?? null

  if (!qrCode) {
    return NextResponse.json({ ok: false, error: 'PIX não disponível para este pagamento.' }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    quantity: order.quantity,
    totalCents: order.total_cents,
    qrCode,
    qrCodeBase64,
    expiresAt: new Date(expiresAt).toISOString(),
  })
}
