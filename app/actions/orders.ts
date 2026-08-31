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

export async function createOrder(
  productId: string,
): Promise<BuyResult> {
  // Verifica se o Mercado Pago está configurado
  if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
    return {
      ok: false,
      error: 'O pagamento ainda não foi configurado pelo administrador.',
    }
  }

  // Conecta ao Supabase
  const supabase = await createClient()

  // Verifica se o usuário está logado
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  if (productError || !product) {
    return {
      ok: false,
      error: 'Plano não encontrado.',
    }
  }

  // Verifica se o produto está ativo
  if (!product.active) {
    return {
      ok: false,
      error: 'Este plano não está disponível no momento.',
    }
  }

  // Cria o pedido no nosso banco
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
      error: 'Não foi possível registrar o pedido.',
    }
  }

  // Converte centavos para reais
  const amount = Number(
    (product.price_cents / 100).toFixed(2),
  )

  // Cria o pagamento PIX no Mercado Pago
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

    // Se o Mercado Pago retornar erro
    if (!response.ok) {
      console.error(
        'Erro Mercado Pago:',
        response.status,
        responseText,
      )

      return {
        ok: false,
        error: 'Não foi possível gerar o pagamento PIX.',
      }
    }

    const mercadoPagoOrder = JSON.parse(responseText)

    console.log(
      'Resposta Mercado Pago:',
      mercadoPagoOrder,
    )

    // Salva o ID da Order do Mercado Pago
    await supabase
      .from('orders')
      .update({
        payment_preference_id: mercadoPagoOrder.id,
      })
      .eq('id', order.id)

    // Pega o primeiro pagamento da Order
    const payment =
      mercadoPagoOrder.transactions?.payments?.[0] ?? null

    // PIX Copia e Cola
    const qrCode =
      payment?.payment_method?.qr_code ?? null

    // Imagem do QR Code em Base64
    const qrCodeBase64 =
      payment?.payment_method?.qr_code_base64 ?? null

    return {
      ok: true,

      orderId: order.id,

      mercadoPagoOrderId: mercadoPagoOrder.id,

      qrCode,

      qrCodeBase64,
    }
  } catch (error) {
    console.error(
      'Erro ao criar PIX:',
      error,
    )

    return {
      ok: false,
      error:
        'Ocorreu um erro ao conectar com o Mercado Pago.',
    }
  }
}
