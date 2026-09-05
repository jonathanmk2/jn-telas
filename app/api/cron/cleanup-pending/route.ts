import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ORDER_EXPIRATION_MINUTES = 30

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: expiredOrders, error: findError } = await admin
    .from('orders')
    .select('id, user_id')
    .eq('status', 'pending')
    .is('payment_id', null)
    .lte('created_at', new Date(Date.now() - ORDER_EXPIRATION_MINUTES * 60 * 1000).toISOString())
    .limit(100)

  if (findError) {
    console.error('Erro ao localizar pedidos expirados:', findError)
    return NextResponse.json({ ok: false, error: 'Cleanup failed' }, { status: 500 })
  }

  let cancelled = 0

  for (const order of expiredOrders ?? []) {
    const { data, error } = await admin.rpc('cancel_pending_order', {
      p_order_id: order.id,
      p_user_id: order.user_id,
    })

    if (error) {
      console.error('Erro ao expirar pedido:', order.id, error)
      continue
    }

    if (data) cancelled += 1
  }

  return NextResponse.json({ ok: true, expired: cancelled })
}
