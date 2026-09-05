import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ ok: true, pending: null })

  const { data: order, error } = await admin
    .from('orders')
    .select('id, status, quantity, total_cents, payment_preference_id, created_at')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Erro ao buscar pedido pendente:', error)
    return NextResponse.json({ ok: false, error: 'Não foi possível verificar pagamentos pendentes.' }, { status: 500 })
  }

  if (!order) return NextResponse.json({ ok: true, pending: null })

  const expiresAtMs = new Date(order.created_at).getTime() + 10 * 60 * 1000

  if (Date.now() >= expiresAtMs) {
    await admin.rpc('cancel_pending_order', {
      p_order_id: order.id,
      p_user_id: user.id,
    })
    return NextResponse.json({ ok: true, pending: null, expired: true })
  }

  return NextResponse.json({
    ok: true,
    pending: {
      orderId: order.id,
      quantity: order.quantity,
      totalCents: order.total_cents,
      paymentPreferenceId: order.payment_preference_id,
      createdAt: order.created_at,
      expiresAt: new Date(expiresAtMs).toISOString(),
    },
  })
}
