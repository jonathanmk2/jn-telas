import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
) {
  try {
    const orderId =
      request.nextUrl.searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'ID do pedido não informado.',
        },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    const {
      data: order,
      error,
    } = await admin
      .from('orders')
      .select(
        `
          id,
          status,
          activation_code_id
        `,
      )
      .eq('id', orderId)
      .single()

    if (error || !order) {
      console.error(
        'Erro ao buscar status do pedido:',
        error,
      )

      return NextResponse.json(
        {
          ok: false,
          error: 'Pedido não encontrado.',
        },
        { status: 404 },
      )
    }

    const isDelivered =
      order.status === 'delivered'

    const isPaid =
      order.status === 'paid' ||
      isDelivered

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      status: order.status,
      paid: isPaid,
      delivered: isDelivered,
      activationCodeId:
        order.activation_code_id,
    })
  } catch (error) {
    console.error(
      'Erro inesperado ao verificar pagamento:',
      error,
    )

    return NextResponse.json(
      {
        ok: false,
        error:
          'Erro interno ao verificar pagamento.',
      },
      { status: 500 },
    )
  }
}
