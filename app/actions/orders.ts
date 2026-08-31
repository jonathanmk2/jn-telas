'use server'

import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'

type BuyResult =
  | {
      ok: true
      orderId: string
      mercadoPagoOrderId: string
      qrCode: string | null
      qrCodeBase64: string | null
    }
  | {
      ok: false
      error: string
      needsAuth?: boolean
    }

export async function createOrder(productId: string): Promise<BuyResult> {
  try {
    // =====================================================
    // VERIFICA TOKEN DO MERCADO PAGO
    // =====================================================

    if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
      return {
        ok: false,
        error:
          'O pagamento ainda não foi configurado. A variável MERCADO_PAGO_ACCESS_TOKEN não foi encontrada.',
      }
    }

    const supabase = await createClient()

    // =====================================================
    // VERIFICA USUÁRIO LOGADO
    // =====================================================

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error('Erro ao verificar usuário:', userError)

      return {
        ok: false,
        error: `Erro ao verificar sua conta: ${userError.message}`,
      }
    }

    if (!user) {
      return {
        ok: false,
        error: 'Você precisa entrar na sua conta para comprar.',
        needsAuth: true,
      }
    }

    // =====================================================
    // CONVERTE O ID DO BOTÃO PARA QUANTIDADE DE TELAS
    // =====================================================

    const plans: Record<string, number> = {
      'plano-1-tela': 1,
      'plano-1-telas': 1,

      'plano-5-telas': 5,

      'plano-10-telas': 10,
    }

    const screens = plans[productId]

    if (!screens) {
      console.error('Plano inválido recebido:', productId)

      return {
        ok: false,
        error: `Plano inválido: ${productId}`,
      }
    }

    console.log('Buscando plano com', screens, 'tela(s)')

    // =====================================================
    // BUSCA PRODUTO NO SUPABASE
    // NÃO PROCURA MAIS PELO UUID
    // =====================================================

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, screens, price_cents, active')
      .eq('screens', screens)
      .eq('active', true)
      .single()

    if (productError) {
      console.error('Erro ao buscar produto:', productError)

      return {
        ok: false,
        error: `Erro ao buscar o plano: ${productError.message}`,
      }
    }

    if (!product) {
      return {
        ok: false,
        error: 'Plano não encontrado.',
      }
    }

    // =====================================================
    // CRIA PEDIDO NO BANCO
    // =====================================================

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        product_id: product.id,
        status: 'pending',
        total_cents: product.price_cents,
      })
      .select('id')
      .single()

    if (orderError || !order) {
      console.error('Erro ao criar pedido:', orderError)

      return {
        ok: false,
        error: `Não foi possível registrar o pedido: ${
          orderError?.message ?? 'Erro desconhecido'
        }`,
      }
    }

    // =====================================================
    // VALOR EM REAIS
    // =====================================================

    const amount = (product.price_cents / 100).toFixed(2)

    console.log('=================================')
    console.log('CRIANDO PAGAMENTO')
    console.log('Produto:', product.name)
    console.log('Telas:', product.screens)
    console.log('Valor:', amount)
    console.log('Order ID:', order.id)
    console.log('=================================')

    // =====================================================
    // DADOS DO PEDIDO PARA MERCADO PAGO
    // =====================================================

    const mercadoPagoBody = {
      type: 'online',

      processing_mode: 'automatic',

      external_reference: order.id,

      total_amount: amount,

      description: product.name,

      payer: {
        email: user.email ?? 'cliente@jntelas.com',
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

    // =====================================================
    // ENVIA PARA O MERCADO PAGO
    // =====================================================

    const response = await fetch(
      'https://api.mercadopago.com/v1/orders',
      {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': randomUUID(),
        },

        body: JSON.stringify(mercadoPagoBody),

        cache: 'no-store',
      },
    )

    const responseText = await response.text()

    console.log('Status Mercado Pago:', response.status)
    console.log('Resposta Mercado Pago:', responseText)

    // =====================================================
    // VERIFICA ERRO DO MERCADO PAGO
    // =====================================================

    if (!response.ok) {
      console.error(
        'Erro Mercado Pago:',
        response.status,
        responseText,
      )

      // Cancela o pedido criado caso o Mercado Pago dê erro
      await supabase
        .from('orders')
        .update({
          status: 'cancelled',
        })
        .eq('id', order.id)

      return {
        ok: false,
        error: `Mercado Pago erro ${response.status}: ${responseText}`,
      }
    }

    // =====================================================
    // CONVERTE RESPOSTA JSON
    // =====================================================

    let mercadoPagoOrder: any

    try {
      mercadoPagoOrder = JSON.parse(responseText)
    } catch (parseError) {
      console.error(
        'Erro ao interpretar resposta:',
        responseText,
      )

      return {
        ok: false,
        error: 'O Mercado Pago retornou uma resposta inválida.',
      }
    }

    console.log(
      'Resposta completa Mercado Pago:',
      JSON.stringify(mercadoPagoOrder, null, 2),
    )

    // =====================================================
    // SALVA ID DO PAGAMENTO NO SUPABASE
    // =====================================================

    const mercadoPagoOrderId = String(
      mercadoPagoOrder.id ??
      mercadoPagoOrder.order_id ??
      '',
    )

    if (mercadoPagoOrderId) {
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_preference_id: mercadoPagoOrderId,
        })
        .eq('id', order.id)

      if (updateError) {
        console.error(
          'Erro ao salvar ID Mercado Pago:',
          updateError,
        )
      }
    }

    // =====================================================
    // PROCURA DADOS DO PIX
    // =====================================================

    const transaction =
      mercadoPagoOrder.transactions?.payments?.[0] ??
      mercadoPagoOrder.transaction?.payments?.[0] ??
      mercadoPagoOrder.payments?.[0] ??
      null

    const qrCode =
      transaction?.point_of_interaction?.transaction_data?.qr_code ??
      transaction?.qr_code ??
      mercadoPagoOrder.qr_code ??
      mercadoPagoOrder.point_of_interaction?.transaction_data?.qr_code ??
      null

    const qrCodeBase64 =
      transaction?.point_of_interaction?.transaction_data
        ?.qr_code_base64 ??
      transaction?.qr_code_base64 ??
      mercadoPagoOrder.qr_code_base64 ??
      mercadoPagoOrder.point_of_interaction?.transaction_data
        ?.qr_code_base64 ??
      null

    console.log('=================================')
    console.log('PIX CRIADO')
    console.log('Mercado Pago ID:', mercadoPagoOrderId)
    console.log('QR Code:', !!qrCode)
    console.log('QR Base64:', !!qrCodeBase64)
    console.log('=================================')

    // =====================================================
    // RETORNA PARA O SITE
    // =====================================================

    return {
      ok: true,
      orderId: order.id,
      mercadoPagoOrderId,
      qrCode,
      qrCodeBase64,
    }
  } catch (error) {
    console.error('ERRO GERAL AO CRIAR PAGAMENTO:', error)

    const message =
      error instanceof Error
        ? error.message
        : 'Erro desconhecido'

    return {
      ok: false,
      error: `Erro ao conectar com o Mercado Pago: ${message}`,
    }
  }
}
