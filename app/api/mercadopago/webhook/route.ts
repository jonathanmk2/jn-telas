import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const type = url.searchParams.get('type') || url.searchParams.get('topic')
    const id = url.searchParams.get('data.id') || url.searchParams.get('id')
    if (type !== 'payment' || !id) return NextResponse.json({ ok: true })
    if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) return NextResponse.json({ error: 'not configured' }, { status: 500 })

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}` }, cache: 'no-store'
    })
    if (!paymentResponse.ok) return NextResponse.json({ ok: true })
    const payment = await paymentResponse.json()
    const orderId = payment.external_reference
    if (!orderId) return NextResponse.json({ ok: true })

    const admin = createAdminClient()
    const { data: order } = await admin.from('orders').select('id, user_id, product_id, status').eq('id', orderId).single()
    if (!order) return NextResponse.json({ ok: true })

    if (payment.status === 'approved') {
      await admin.from('orders').update({ status: 'paid', payment_id: String(payment.id), paid_at: new Date().toISOString() }).eq('id', order.id)
      const { data: code } = await admin.from('activation_codes')
        .select('id').eq('product_id', order.product_id).eq('status', 'active').is('user_id', null).order('created_at').limit(1).maybeSingle()
      if (code) {
        await admin.from('activation_codes').update({ user_id: order.user_id, assigned_at: new Date().toISOString() }).eq('id', code.id)
        await admin.from('orders').update({ status: 'delivered', activation_code_id: code.id }).eq('id', order.id)
      }
    } else if (['rejected','cancelled'].includes(payment.status)) {
      await admin.from('orders').update({ status: 'cancelled', payment_id: String(payment.id) }).eq('id', order.id)
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Mercado Pago webhook error', error)
    return NextResponse.json({ ok: true })
  }
}
