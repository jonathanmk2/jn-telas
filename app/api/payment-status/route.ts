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
      .select('id, user_id, status, activation_code_id, created_at')
      .eq('id', orderId)
      .maybeSingle()

    if (error || !order) {
      return NextResponse.json({ ok: false, expired: true, error: 'Pedido não encontrado.' }, { status: 404 })
    }

    if (order.user_id !== user.id) {
      return NextResponse.json({ ok: false, error: 'Você não pode consultar este pedido.' }, { status: 403 })
    }

    if (order.status === 'pending' && Date.now() >= new Date(order.created_at).getTime() + ORDER_EXPIRATION_MINUTES * 60 * 1000) {
      await admin.rpc('cancel_pending_order', {
        p_order_id: order.id,
        p_user_id: user.id,
      })

      return NextResponse.json({ ok: false, expired: true, error: 'Pagamento expirado.' }, { status: 410 })
    }

    const isDelivered = order.status === 'delivered'
    const isPaid = order.status === 'paid' || isDelivered

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      status: order.status,
      paid: isPaid,
      delivered: isDelivered,
      activationCodeId: order.activation_code_id,
    })
  } catch (error) {
    console.error('Erro inesperado ao verificar pagamento:', error)
    return NextResponse.json({ ok: false, error: 'Erro interno ao verificar pagamento.' }, { status: 500 })
  }
}
