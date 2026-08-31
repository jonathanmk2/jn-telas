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
  // Verifica se o token do Mercado Pago foi configurado
  if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
    return {
      ok: false,
      error:
        'O pagamento ainda não foi configurado. A variável MERCADO_PAGO_ACCESS_TOKEN não foi encontrada.',
    }
  }

  const supabase = await createClient()

  // Verifica o usuário logado
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

  // Busca o produto
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, screens, price_cents, active')
    .eq('id', productId)
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

  if (!product.active) {
    return {
      ok: false,
      error: 'Este plano não está disponível no momento.',
    }
  }

  // Cria o pedido no banco
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

  // Converte centavos para reais
  const amount = (product.price_cents / 100).toFixed(2)

  // Dados enviados para o Mercado Pago
  const mercadoPagoBody = {
    type: 'online',

    processing_mode: 'automatic',

    external_reference: order.id,

    total_amount: amount,

    description: product.name,

    payer: {
      email: user.email ?? '',
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

  try {
    console.log('Criando pagamento Mercado Pago...')
    console.log('Produto:', product.name)
    console.log('Valor:', amount)
    console.log('Order ID:', order.id)

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

    // MOSTRA O ERRO REAL DO MERCADO PAGO
    if (!response.ok) {
      console.error(
        'Erro Mercado Pago:',
        response.status,
        responseText,
      )

      return {
        ok: false,
        error: `Mercado Pago erro ${response.status}: ${responseText}`,
      }
    }

    let mercadoPagoOrder: any

    try {
      mercadoPagoOrder = JSON.parse(responseText)
    } catch (parseError) {
      console.error(
        'Erro ao interpretar resposta do Mercado Pago:',
        responseText,
      )

      return {
        ok: false,
        error: `O Mercado Pago retornou uma resposta inválida: ${responseText}`,
      }
    }

    console.log(
      'Resposta Mercado Pago:',
      JSON.stringify(mercadoPagoOrder, null, 2),
    )

    // Salva o ID do pedido do Mercado Pago
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_preference_id: mercadoPagoOrder.id,
      })
      .eq('id', order.id)

    if (updateError) {
      console.error(
        'Erro ao salvar ID do Mercado Pago:',
        updateError,
      )
    }

    /*
      Procura os dados do PIX em diferentes locais
      possíveis da resposta da API.
    */

    const transaction =
      mercadoPagoOrder.transactions?.payments?.[0] ??
      mercadoPagoOrder.transaction?.payments?.[0] ??
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

    console.log('PIX criado com sucesso')
    console.log('Mercado Pago Order ID:', mercadoPagoOrder.id)
    console.log('QR Code encontrado:', !!qrCode)
    console.log('QR Base64 encontrado:', !!qrCodeBase64)

    return {
      ok: true,
      orderId: order.id,
      mercadoPagoOrderId: mercadoPagoOrder.id,
      qrCode,
      qrCodeBase64,
    }
  } catch (error) {
    console.error('Erro ao criar PIX:', error)

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
