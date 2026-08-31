'use server'

import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
    // 1. DEFINE TOKEN DO MERCADO PAGO
    // =====================================================

    const testToken = process.env.MERCADO_PAGO_TEST_ACCESS_TOKEN
    const productionToken = process.env.MERCADO_PAGO_ACCESS_TOKEN

    // Se existir token de teste, usa ele.
    // Caso contrário, usa o token de produção.
    const mercadoPagoToken = testToken || productionToken

    const isSandbox = Boolean(testToken)

    if (!mercadoPagoToken) {
      return {
        ok: false,
        error:
          'O pagamento ainda não foi configurado. Nenhum Access Token do Mercado Pago foi encontrado.',
      }
    }

    console.log('=================================')
    console.log('AMBIENTE MERCADO PAGO:', isSandbox ? 'TESTE' : 'PRODUÇÃO')
    console.log('=================================')

    // =====================================================
    // 2. CLIENTE NORMAL: VERIFICA LOGIN
    // =====================================================

    const supabase = await createClient()

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
    // 3. CLIENTE ADMIN
    // =====================================================

    const admin = createAdminClient()

    // =====================================================
    // 4. CONVERTE O ID PARA QUANTIDADE DE TELAS
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
        error: `Plano inválido recebido: ${productId}`,
      }
    }

    console.log('=================================')
    console.log('INICIANDO COMPRA')
    console.log('Usuário:', user.id)
    console.log('Plano recebido:', productId)
    console.log('Quantidade de telas:', screens)
    console.log('=================================')

    // =====================================================
    // 5. BUSCA O PRODUTO
    // =====================================================

    const { data: product, error: productError } = await admin
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
    // 6. CRIA O PEDIDO NO BANCO
    // =====================================================

    const { data: order, error: orderError } = await admin
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
        error: `Não foi possível criar o pedido: ${
          orderError?.message ?? 'Erro desconhecido'
        }`,
      }
    }

    console.log('Pedido criado:', order.id)

    // =====================================================
    // 7. CONVERTE CENTAVOS PARA REAIS
    // =====================================================

    const amount = (product.price_cents / 100).toFixed(2)

    console.log('=================================')
    console.log('CRIANDO PIX')
    console.log('Produto:', product.name)
    console.log('Telas:', product.screens)
    console.log('Valor:', amount)
    console.log('Pedido:', order.id)
    console.log('Ambiente:', isSandbox ? 'TESTE' : 'PRODUÇÃO')
    console.log('=================================')

    // =====================================================
    // 8. DEFINE O PAGADOR
    // =====================================================

    const payer = isSandbox
      ? {
          email: 'test_user_br@testuser.com',
          first_name: 'APRO',
        }
      : {
          email: user.email || 'cliente@jntelas.com',
        }

    // =====================================================
    // 9. MONTA O PEDIDO PARA O MERCADO PAGO
    // =====================================================

    const mercadoPagoBody = {
      type: 'online',

      processing_mode: 'automatic',

      external_reference: order.id,

      total_amount: amount,

      description: product.name,

      payer,

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
    // 10. ENVIA PARA O MERCADO PAGO
    // =====================================================

    const response = await fetch(
      'https://api.mercadopago.com/v1/orders',
      {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${mercadoPagoToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': randomUUID(),
        },

        body: JSON.stringify(mercadoPagoBody),

        cache: 'no-store',
      },
    )

    const responseText = await response.text()

    console.log('=================================')
    console.log('RESPOSTA MERCADO PAGO')
    console.log('Status:', response.status)
    console.log('Resposta:', responseText)
    console.log('=================================')

    // =====================================================
    // 11. TRATA ERRO DO MERCADO PAGO
    // =====================================================

    if (!response.ok) {
      console.error(
        'Erro Mercado Pago:',
        response.status,
        responseText,
      )

      await admin
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
    // 12. CONVERTE RESPOSTA PARA JSON
    // =====================================================

    let mercadoPagoOrder: any

    try {
      mercadoPagoOrder = JSON.parse(responseText)
    } catch {
      console.error(
        'Resposta inválida do Mercado Pago:',
        responseText,
      )

      return {
        ok: false,
        error: 'O Mercado Pago retornou uma resposta inválida.',
      }
    }

    console.log(
      'Resposta completa:',
      JSON.stringify(mercadoPagoOrder, null, 2),
    )

    // =====================================================
    // 13. PEGA ID DO PEDIDO DO MERCADO PAGO
    // =====================================================

    const mercadoPagoOrderId = String(
      mercadoPagoOrder.id ??
        mercadoPagoOrder.order_id ??
        '',
    )

    // =====================================================
    // 14. SALVA O ID DO MERCADO PAGO
    // =====================================================

    if (mercadoPagoOrderId) {
      const { error: updateError } = await admin
        .from('orders')
        .update({
          payment_preference_id: mercadoPagoOrderId,
        })
        .eq('id', order.id)

      if (updateError) {
        console.error(
          'Erro ao salvar ID do Mercado Pago:',
          updateError,
        )
      }
    }

    // =====================================================
    // 15. PROCURA OS DADOS DO PIX
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
    console.log('PIX CRIADO COM SUCESSO')
    console.log('Pedido interno:', order.id)
    console.log('Pedido Mercado Pago:', mercadoPagoOrderId)
    console.log('Tem QR Code:', !!qrCode)
    console.log('Tem QR Base64:', !!qrCodeBase64)
    console.log('=================================')

    // =====================================================
    // 16. RETORNA OS DADOS PARA O SITE
    // =====================================================

    return {
      ok: true,
      orderId: order.id,
      mercadoPagoOrderId,
      qrCode,
      qrCodeBase64,
    }
  } catch (error) {
    console.error('=================================')
    console.error('ERRO GERAL AO CRIAR PAGAMENTO:', error)
    console.error('=================================')

    const message =
      error instanceof Error
        ? error.message
        : 'Erro desconhecido'

    return {
      ok: false,
      error: `Erro ao criar pagamento: ${message}`,
    }
  }
}
