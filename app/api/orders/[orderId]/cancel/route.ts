import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
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

  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id, user_id, status, created_at')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError || !order) {
    return NextResponse.json({ ok: false, error: 'Pedido não encontrado.' }, { status: 404 })
  }

  if (order.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: 'Você não pode cancelar este pedido.' }, { status: 403 })
  }

  if (order.status !== 'pending') {
    return NextResponse.json({ ok: false, error: 'Este pagamento não está mais pendente.' }, { status: 409 })
  }

  const { data: cancelled, error: cancelError } = await admin.rpc('cancel_pending_order', {
    p_order_id: orderId,
    p_user_id: user.id,
  })

  if (cancelError) {
    console.error('Erro ao cancelar pedido:', cancelError)
    return NextResponse.json({ ok: false, error: 'Não foi possível cancelar o pagamento.' }, { status: 500 })
  }

  if (!cancelled) {
    return NextResponse.json({ ok: false, error: 'O pagamento já foi finalizado ou expirou.' }, { status: 409 })
  }

  return NextResponse.json({ ok: true, orderId, cancelled: true })
}
