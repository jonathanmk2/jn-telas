'use server'

import { createClient } from '@/lib/supabase/server'

type BuyResult = { ok: true; checkoutUrl: string } | { ok: false; error: string; needsAuth?: boolean }

export async function createOrder(productId: string): Promise<BuyResult> {
  if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
    return { ok: false, error: 'O pagamento ainda não foi configurado pelo administrador.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Você precisa entrar na sua conta para comprar.', needsAuth: true }

  const { data: product, error: prodError } = await supabase
    .from('products').select('id, name, screens, price_cents, active').eq('id', productId).single()
  if (prodError || !product) return { ok: false, error: 'Plano não encontrado.' }
  if (!product.active) return { ok: false, error: 'Este plano não está disponível no momento.' }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({ user_id: user.id, product_id: product.id, status: 'pending', total_cents: product.price_cents })
    .select('id').single()
  if (orderError || !order) return { ok: false, error: 'Não foi possível registrar o pedido.' }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const body = {
    items: [{ title: product.name, quantity: 1, unit_price: product.price_cents / 100, currency_id: 'BRL' }],
    external_reference: order.id,
    payer: { email: user.email ?? undefined },
    back_urls: {
      success: `${siteUrl}/minha-conta?pagamento=sucesso`,
      failure: `${siteUrl}/minha-conta?pagamento=falhou`,
      pending: `${siteUrl}/minha-conta?pagamento=pendente`,
    },
    auto_return: 'approved',
    notification_url: `${siteUrl}/api/mercadopago/webhook`,
  }

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!response.ok) {
    console.error('Mercado Pago preference error', await response.text())
    return { ok: false, error: 'Não foi possível iniciar o pagamento.' }
  }
  const preference = await response.json()
  await supabase.from('orders').update({ payment_preference_id: preference.id }).eq('id', order.id)
  const checkoutUrl = preference.init_point
  if (!checkoutUrl) return { ok: false, error: 'O Mercado Pago não retornou o link de pagamento.' }
  return { ok: true, checkoutUrl }
}
