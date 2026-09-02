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

/*
 * REGRA DE PREÇO
 *
 * 1 a 4 telas  = R$ 35,00 cada
 * 5 a 9 telas  = R$ 34,00 cada
 * 10+ telas    = R$ 33,00 cada
 */
function getUnitPriceCents(quantity: number): number {
  if (quantity >= 10) {
    return 3300
  }

  if (quantity >= 5) {
    return 3400
  }

  return 3500
}

/*
 * VALIDAÇÃO RIGOROSA DA QUANTIDADE
 *
 * Aceita somente:
 * - número inteiro
 * - positivo
 * - entre 1 e 500
 *
 * Rejeita:
 * - notação científica (ex.: 5e2)
 * - decimais (ex.: 1.5)
 * - zero
 * - negativos
 * - Infinity
 * - NaN
 * - valores acima de 500
 *
 * A validação acontece no backend.
 */
function isValidQuantity(
  quantity: unknown,
): quantity is number {
  return (
    typeof quantity === 'number' &&
    Number.isFinite(quantity) &&
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= 500
  )
}

export async function createOrder(
  productId: string,
  quantity: number = 1,
): Promise<BuyResult> {
  try {
    // =====================================================
    // 1. TOKEN DO MERCADO PAGO - PRODUÇÃO
    // =====================================================

    const mercadoPagoToken =
      process.env.MERCADO_PAGO_ACCESS_TOKEN

    if (!mercadoPagoToken) {
      return {
        ok: false,
        error:
          'O pagamento ainda não foi configurado. Token do Mercado Pago não encontrado.',
      }
    }

    const mercadoPagoIntegratorId =
      process.env.MERCADO_PAGO_INTEGRATOR_ID

    // =====================================================
    // 2. VERIFICA LOGIN DO USUÁRIO
    // =====================================================

    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error(
        'Erro ao verificar usuário:',
        userError,
      )

      return {
        ok: false,
        error: `Erro ao verificar sua conta: ${userError.message}`,
      }
    }

    if (!user) {
      return {
        ok: false,
        error:
          'Você precisa entrar na sua conta para comprar.',
        needsAuth: true,
      }
    }

    // =====================================================
    // 3. VALIDA QUANTIDADE - BACKEND
    // =====================================================

    if (!isValidQuantity(quantity)) {
      return {
        ok: false,
        error:
          'Quantidade inválida. Informe um número inteiro entre 1 e 500.',
      }
    }

    // =====================================================
    // 4. CLIENTE ADMIN
    // =====================================================

    const admin = createAdminClient()

    // =====================================================
    // 5. CONVERTE O PLANO PARA NÚMERO DE TELAS
    // =====================================================

    const plans: Record<string, number> = {
      'plano-1-tela': 1,
      'plano-1-telas': 1,
      'plano-5-telas': 5,
      'plano-10-telas': 10,
    }

    const screens = plans[productId]

    if (!screens) {
      console.error(
        'Plano inválido recebido:',
        productId,
      )

      return {
        ok: false,
        error: `Plano inválido recebido: ${productId}`,
      }
    }

    console.log('=================================')
    console.log('INICIANDO COMPRA - PRODUÇÃO')
    console.log('Usuário:', user.id)
    console.log('Plano recebido:', productId)
    console.log('Quantidade solicitada:', quantity)
    console.log('Plano base:', screens)
    console.log('=================================')

    // =====================================================
    // 6. BUSCA O PRODUTO
    // =====================================================

    const {
      data: product,
      error: productError,
    } = await admin
      .from('products')
      .select(
        'id, name, screens, price_cents, active',
      )
      .eq('screens', screens)
      .eq('active', true)
      .single()

    if (productError) {
      console.error(
        'Erro ao buscar produto:',
        productError,
      )

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
    // 7. CALCULA PREÇO
    // =====================================================

    const unitPriceCents =
      getUnitPriceCents(quantity)

    const totalCents =
      unitPriceCents * quantity

    const amount =
      (totalCents / 100).toFixed(2)

    console.log('=================================')
    console.log('CÁLCULO DA COMPRA')
    console.log('Quantidade:', quantity)
    console.log(
      'Preço unitário:',
      (unitPriceCents / 100).toFixed(2),
    )
    console.log(
      'Total:',
      amount,
    )
    console.log('=================================')

    // =====================================================
    // 8. CRIA O PEDIDO NO BANCO
    // =====================================================

    const {
      data: order,
      error: orderError,
    } = await admin
      .from('orders')
      .insert({
        user_id: user.id,
        product_id: product.id,
        quantity,
        status: 'pending',
        total_cents: totalCents,
      })
      .select('id')
      .single()

    if (orderError || !order) {
      console.error(
        'Erro ao criar pedido:',
        orderError,
      )

      return {
        ok: false,
        error: `Não foi possível criar o pedido: ${
          orderError?.message ??
          'Erro desconhecido'
        }`,
      }
    }

    console.log('Pedido criado:', order.id)

    // =====================================================
    // 9. MONTA O PEDIDO DO MERCADO PAGO
    // =====================================================

    const mercadoPagoBody = {
      type: 'online',

      processing_mode: 'automatic',

      external_reference: order.id,

      total_amount: amount,

      description:
        quantity === 1
          ? product.name
          : `${quantity} telas - ${product.name}`,

      payer: {
        email: user.email ?? undefined,
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

    console.log('=================================')
    console.log('CRIANDO PIX - PRODUÇÃO')
    console.log('Produto:', product.name)
    console.log('Quantidade:', quantity)
    console.log('Valor:', amount)
    console.log('Pedido:', order.id)
    console.log('=================================')

    // =====================================================
    // 10. HEADERS
    // =====================================================

    const headers: Record<string, string> = {
      Authorization: `Bearer ${mercadoPagoToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': randomUUID(),
    }

    if (mercadoPagoIntegratorId) {
      headers['X-Integrator-Id'] =
        mercadoPagoIntegratorId
    }

    // =====================================================
    // 11. ENVIA PARA O MERCADO PAGO
    // =====================================================

    const response = await fetch(
      'https://api.mercadopago.com/v1/orders',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(
          mercadoPagoBody,
        ),
        cache: 'no-store',
      },
    )

    const responseText =
      await response.text()

    console.log('=================================')
    console.log('RESPOSTA MERCADO PAGO')
    console.log('Status:', response.status)
    console.log(
      'Resposta:',
      responseText,
    )
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
    // 13. CONVERTE RESPOSTA PARA JSON
    // =====================================================

    let mercadoPagoOrder: any

    try {
      mercadoPagoOrder =
        JSON.parse(responseText)
    } catch {
      console.error(
        'Resposta inválida do Mercado Pago:',
        responseText,
      )

      return {
        ok: false,
        error:
          'O Mercado Pago retornou uma resposta inválida.',
      }
    }

    // =====================================================
    // 14. ID DO PEDIDO MERCADO PAGO
    // =====================================================

    const mercadoPagoOrderId =
      String(
        mercadoPagoOrder.id ??
          mercadoPagoOrder.order_id ??
          '',
      )

    // =====================================================
    // 15. SALVA ID NO BANCO
    // =====================================================

    if (mercadoPagoOrderId) {
      const {
        error: updateError,
      } = await admin
        .from('orders')
        .update({
          payment_preference_id:
            mercadoPagoOrderId,
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
    // 16. PROCURA OS DADOS DO PIX
    // =====================================================

    const transaction =
      mercadoPagoOrder.transactions
        ?.payments?.[0] ??
      mercadoPagoOrder.transaction
        ?.payments?.[0] ??
      mercadoPagoOrder.payments?.[0] ??
      null

    const qrCode =
      transaction?.payment_method
        ?.qr_code ??
      transaction?.qr_code ??
      transaction
        ?.point_of_interaction
        ?.transaction_data
        ?.qr_code ??
      mercadoPagoOrder.qr_code ??
      mercadoPagoOrder
        .point_of_interaction
        ?.transaction_data
        ?.qr_code ??
      null

    const qrCodeBase64 =
      transaction
        ?.payment_method
        ?.qr_code_base64 ??
      transaction?.qr_code_base64 ??
      transaction
        ?.point_of_interaction
        ?.transaction_data
        ?.qr_code_base64 ??
      mercadoPagoOrder.qr_code_base64 ??
      mercadoPagoOrder
        .point_of_interaction
        ?.transaction_data
        ?.qr_code_base64 ??
      null

    console.log('=================================')
    console.log('PIX CRIADO COM SUCESSO')
    console.log(
      'Pedido interno:',
      order.id,
    )
    console.log(
      'Pedido Mercado Pago:',
      mercadoPagoOrderId,
    )
    console.log(
      'Quantidade:',
      quantity,
    )
    console.log(
      'Total:',
      amount,
    )
    console.log(
      'Tem QR Code:',
      !!qrCode,
    )
    console.log(
      'Tem QR Base64:',
      !!qrCodeBase64,
    )
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
    console.error(
      'ERRO GERAL AO CRIAR PAGAMENTO:',
      error,
    )
    console.error('=================================')

    const message =
      error instanceof Error
        ? error.message
        : 'Erro desconhecido'

    return {
      ok: false,
      error:
        `Erro ao criar pagamento: ${message}`,
    }
  }
}
