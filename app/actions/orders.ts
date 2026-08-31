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

type BuyerData = {
  firstName?: string
  lastName?: string
  identificationType?: string
  identificationNumber?: string
  phoneAreaCode?: string
  phoneNumber?: string
}

export async function createOrder(
  productId: string,
  deviceId?: string,
  buyerData?: BuyerData,
): Promise<BuyResult> {
  try {
    // =====================================================
    // 1. TOKEN DO MERCADO PAGO
    // =====================================================

    const mercadoPagoToken =
      process.env.MERCADO_PAGO_TEST_ACCESS_TOKEN ||
      process.env.MERCADO_PAGO_ACCESS_TOKEN

    if (!mercadoPagoToken) {
      return {
        ok: false,
        error:
          'O pagamento ainda não foi configurado. Token do Mercado Pago não encontrado.',
      }
    }

    // =====================================================
    // 2. VERIFICA LOGIN
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
    // 4. CONVERTE O PLANO PARA NÚMERO DE TELAS
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
    console.log('Plano:', productId)
    console.log('Quantidade de telas:', screens)
    console.log('Device ID recebido:', !!deviceId)
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
    // 6. CRIA PEDIDO NO BANCO
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
    // 7. VALORES
    // =====================================================

    const amount = (product.price_cents / 100).toFixed(2)

    // =====================================================
    // 8. MONTA OS DADOS DO COMPRADOR
    // =====================================================

    const payer: Record<string, unknown> = {
      email: user.email ?? 'test_user_br@testuser.com',
    }

    if (buyerData?.firstName) {
      payer.first_name = buyerData.firstName
    }

    if (buyerData?.lastName) {
      payer.last_name = buyerData.lastName
    }

    if (
      buyerData?.identificationType &&
      buyerData?.identificationNumber
    ) {
      payer.identification = {
        type: buyerData.identificationType,
        number: buyerData.identificationNumber,
      }
    }

    if (buyerData?.phoneAreaCode && buyerData?.phoneNumber) {
      payer.phone = {
        area_code: buyerData.phoneAreaCode,
        number: buyerData.phoneNumber,
      }
    }

    // =====================================================
    // 9. MONTA A ORDER DO MERCADO PAGO
    // =====================================================

    const mercadoPagoBody = {
      type: 'online',

      processing_mode: 'automatic',

      external_reference: order.id,

      total_amount: amount,

      description: product.name,

      payer,

      // ===============================================
      // DADOS DO PRODUTO
      // ===============================================

      items: [
        {
          title: product.name,
          description: `${product.screens} tela${
            product.screens > 1 ? 's' : ''
          } LD CLOUD - acesso por 30 dias`,
          external_code: product.id,
          quantity: 1,
          unit_price: amount,
          total_amount: amount,
        },
      ],

      // ===============================================
      // PAGAMENTO PIX
      // ===============================================

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

    console.log('=================================')
    console.log('CRIANDO PIX')
    console.log('Produto:', product.name)
    console.log('Telas:', product.screens)
    console.log('Valor:', amount)
    console.log('Pedido interno:', order.id)
    console.log('Device ID:', deviceId ? 'SIM' : 'NÃO')
    console.log('=================================')

    // =====================================================
    // 10. HEADERS
    // =====================================================

    const headers: Record<string, string> = {
      Authorization: `Bearer ${mercadoPagoToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': randomUUID(),
    }

    // =====================================================
    // DEVICE ID
    // =====================================================

    if (deviceId) {
      headers['X-meli-session-id'] = deviceId
    }

    // =====================================================
    // 11. ENVIA PARA O MERCADO PAGO
    // =====================================================

    const response = await fetch(
      'https://api.mercadopago.com/v1/orders',
      {
        method: 'POST',

        headers,

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
    // 12. ERRO DO MERCADO PAGO
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
    // 13. CONVERTE RESPOSTA
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
    // 14. PEGA ID DA ORDER
    // =====================================================

    const mercadoPagoOrderId = String(
      mercadoPagoOrder.id ??
        mercadoPagoOrder.order_id ??
        '',
    )

    // =====================================================
    // 15. SALVA ID DO MERCADO PAGO
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
    // 16. PROCURA DADOS DO PIX
    // =====================================================

    const transaction =
      mercadoPagoOrder.transactions?.payments?.[0] ??
      mercadoPagoOrder.transaction?.payments?.[0] ??
      mercadoPagoOrder.payments?.[0] ??
      null

    const qrCode =
      transaction?.payment_method?.qr_code ??
      transaction?.qr_code ??
      transaction?.point_of_interaction?.transaction_data?.qr_code ??
      mercadoPagoOrder.qr_code ??
      mercadoPagoOrder.point_of_interaction?.transaction_data?.qr_code ??
      null

    const qrCodeBase64 =
      transaction?.payment_method?.qr_code_base64 ??
      transaction?.qr_code_base64 ??
      transaction?.point_of_interaction?.transaction_data?.qr_code_base64 ??
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
    // 17. RETORNA PARA O SITE
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
