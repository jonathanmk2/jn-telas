'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Minus,
  Plus,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format'
import { createOrder } from '@/app/actions/orders'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export type Product = {
  id: string
  name: string
  screens: number
  price_cents: number
  description: string | null
}

type PaymentData = {
  orderId: string
  qrCode: string | null
  qrCodeBase64: string | null
}

type OrderStatus =
  | 'pending'
  | 'paid'
  | 'delivered'
  | 'cancelled'
  | 'unknown'

const featuresByScreens: Record<number, string[]> = {
  1: [
    '1 tela simultânea',
    'Acesso por 30 dias',
    'Suporte via WhatsApp',
  ],

  5: [
    '5 telas simultâneas',
    'Acesso por 30 dias',
    'Suporte prioritário',
  ],

  10: [
    '10 telas simultâneas',
    'Acesso por 30 dias',
    'Suporte prioritário',
    'Melhor custo por tela',
  ],
}

/*
 * REGRA DE PREÇO
 *
 * 1 a 4 telas  = R$ 35 cada
 * 5 a 9 telas  = R$ 34 cada
 * 10+ telas    = R$ 33 cada
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

function getPriceLabel(quantity: number): string {
  if (quantity >= 10) {
    return 'R$ 33,00 por tela'
  }

  if (quantity >= 5) {
    return 'R$ 34,00 por tela'
  }

  return 'R$ 35,00 por tela'
}

export function Pricing({
  products,
  isLoggedIn,
}: {
  products: Product[]
  isLoggedIn: boolean
}) {
  const router = useRouter()

  const [pending, startTransition] = useTransition()

  const [activeId, setActiveId] =
    useState<string | null>(null)

  const [payment, setPayment] =
    useState<PaymentData | null>(null)

  const [orderStatus, setOrderStatus] =
    useState<OrderStatus>('pending')

  const [checkingPayment, setCheckingPayment] =
    useState(false)

  /*
   * Quantidade selecionada para cada produto.
   *
   * Cada plano começa com a quantidade mínima dele:
   *
   * Plano 1  -> 1
   * Plano 5  -> 5
   * Plano 10 -> 10
   */
  const [quantities, setQuantities] =
    useState<Record<string, number>>(() => {
      const initial: Record<string, number> = {}

      for (const product of products) {
        initial[product.id] =
          product.screens
      }

      return initial
    })

  function getQuantity(product: Product): number {
    return quantities[product.id] ??
      product.screens
  }

  function changeQuantity(
    product: Product,
    value: number,
  ) {
    const quantity = Math.max(
      1,
      Math.min(500, Math.floor(value)),
    )

    setQuantities((current) => ({
      ...current,
      [product.id]: quantity,
    }))
  }

  function getTotalCents(
    quantity: number,
  ): number {
    return (
      quantity *
      getUnitPriceCents(quantity)
    )
  }

  function handleBuy(product: Product) {
    if (!isLoggedIn) {
      router.push(
        '/auth/sign-up?next=/minha-conta',
      )
      return
    }

    const quantity =
      getQuantity(product)

    const totalCents =
      getTotalCents(quantity)

    console.log(
      'Iniciando compra:',
      {
        productId: product.id,
        quantity,
        totalCents,
      },
    )

    setActiveId(product.id)

    startTransition(async () => {
      try {
        /*
         * ATENÇÃO:
         *
         * O createOrder ainda precisa ser
         * atualizado no servidor para receber
         * a quantidade.
         *
         * Por enquanto enviamos produto + quantidade
         * através da nova assinatura.
         */
        const res = await createOrder(
          product.id,
          quantity,
        )

        if (res.ok) {
          console.log(
            'Pagamento criado:',
            res,
          )

          setPayment({
            orderId: res.orderId,
            qrCode: res.qrCode,
            qrCodeBase64:
              res.qrCodeBase64,
          })

          setOrderStatus('pending')

          toast.success(
            'Pagamento PIX gerado com sucesso!',
          )
        } else if (res.needsAuth) {
          router.push(
            '/auth/login?next=/minha-conta',
          )
        } else {
          console.error(
            'Erro no pagamento:',
            res.error,
          )

          toast.error(res.error)
        }
      } catch (error) {
        console.error(
          'Erro inesperado:',
          error,
        )

        toast.error(
          'Ocorreu um erro inesperado ao gerar o pagamento.',
        )
      } finally {
        setActiveId(null)
      }
    })
  }

  async function copyPixCode() {
    if (!payment?.qrCode) {
      toast.error(
        'Código PIX não disponível.',
      )

      return
    }

    try {
      await navigator.clipboard.writeText(
        payment.qrCode,
      )

      toast.success(
        'Código PIX copiado!',
      )
    } catch {
      toast.error(
        'Não foi possível copiar o código PIX.',
      )
    }
  }

  // ============================================
  // VERIFICA STATUS DO PAGAMENTO AUTOMATICAMENTE
  // ============================================

  useEffect(() => {
    if (!payment?.orderId) {
      return
    }

    if (
      orderStatus === 'paid' ||
      orderStatus === 'delivered' ||
      orderStatus === 'cancelled'
    ) {
      return
    }

    let active = true

    async function checkPayment() {
      try {
        setCheckingPayment(true)

        const response = await fetch(
          `/api/payment-status?orderId=${payment.orderId}`,
          {
            method: 'GET',
            cache: 'no-store',
          },
        )

        if (!response.ok) {
          console.error(
            'Erro ao consultar status do pagamento.',
          )

          return
        }

        const data =
          await response.json()

        if (!active) {
          return
        }

        console.log(
          'Status do pedido:',
          data.status,
        )

        const newStatus =
          (data.status as OrderStatus) ??
          'unknown'

        setOrderStatus(newStatus)

        if (
          newStatus === 'paid' ||
          newStatus === 'delivered'
        ) {
          toast.success(
            'Pagamento confirmado com sucesso!',
          )
        }

        if (
          newStatus === 'cancelled'
        ) {
          toast.error(
            'Este pagamento foi cancelado.',
          )
        }
      } catch (error) {
        console.error(
          'Erro ao verificar pagamento:',
          error,
        )
      } finally {
        if (active) {
          setCheckingPayment(false)
        }
      }
    }

    checkPayment()

    const interval = setInterval(
      checkPayment,
      3000,
    )

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [
    payment?.orderId,
    orderStatus,
  ])

  const highlighted = 5

  const qrImage =
    payment?.qrCodeBase64
      ? payment.qrCodeBase64.startsWith(
          'data:image',
        )
        ? payment.qrCodeBase64
        : `data:image/png;base64,${payment.qrCodeBase64}`
      : null

  const paymentConfirmed =
    orderStatus === 'paid' ||
    orderStatus === 'delivered'

  return (
    <>
      <section
        id="planos"
        className="scroll-mt-20 bg-secondary/30 py-20"
      >
        <div className="mx-auto max-w-6xl px-4">

          <div className="mx-auto max-w-2xl text-center">

            <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
              Planos e preços
            </h2>

            <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
              Escolha a quantidade de telas ideal para você.
            </p>

          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">

            {products.map((product) => {

              const isHighlight =
                product.screens === highlighted

              const features =
                featuresByScreens[
                  product.screens
                ] ?? []

              const quantity =
                getQuantity(product)

              const unitPriceCents =
                getUnitPriceCents(
                  quantity,
                )

              const totalCents =
                getTotalCents(
                  quantity,
                )

              const loading =
                pending &&
                activeId === product.id

              return (
                <div
                  key={product.id}
                  className={cn(
                    'relative flex flex-col rounded-2xl border bg-card p-6',
                    isHighlight
                      ? 'border-primary shadow-lg shadow-primary/10'
                      : 'border-border/60',
                  )}
                >

                  {isHighlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      Mais popular
                    </span>
                  )}

                  <h3 className="text-lg font-semibold">
                    {product.name}
                  </h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {product.description ??
                      `Acesso para ${product.screens} tela(s)`}
                  </p>

                  {/* PREÇO */}

                  <div className="mt-5">

                    <div className="flex items-end gap-1">

                      <span className="text-4xl font-bold tracking-tight">
                        {formatBRL(
                          unitPriceCents,
                        )}
                      </span>

                      <span className="mb-1 text-sm text-muted-foreground">
                        /tela
                      </span>

                    </div>

                    <p className="mt-1 text-sm text-primary">
                      {getPriceLabel(
                        quantity,
                      )}
                    </p>

                  </div>

                  {/* QUANTIDADE */}

                  <div className="mt-6">

                    <p className="mb-2 text-sm font-medium">
                      Quantidade de telas
                    </p>

                    <div className="flex items-center gap-2">

                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-10 shrink-0"
                        onClick={() =>
                          changeQuantity(
                            product,
                            quantity - 1,
                          )
                        }
                        disabled={
                          loading ||
                          quantity <= 1
                        }
                        aria-label="Diminuir quantidade"
                      >
                        <Minus className="size-4" />
                      </Button>

                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={quantity}
                        disabled={loading}
                        onChange={(event) => {
                          const value =
                            Number(
                              event.target.value,
                            )

                          if (
                            Number.isFinite(
                              value,
                            )
                          ) {
                            changeQuantity(
                              product,
                              value,
                            )
                          }
                        }}
                        className="h-10 w-full rounded-md border bg-background px-3 text-center text-base font-semibold"
                        aria-label="Quantidade de telas"
                      />

                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-10 shrink-0"
                        onClick={() =>
                          changeQuantity(
                            product,
                            quantity + 1,
                          )
                        }
                        disabled={
                          loading ||
                          quantity >= 500
                        }
                        aria-label="Aumentar quantidade"
                      >
                        <Plus className="size-4" />
                      </Button>

                    </div>

                  </div>

                  {/* TOTAL */}

                  <div className="mt-5 rounded-xl border bg-secondary/40 p-4">

                    <div className="flex items-center justify-between text-sm">

                      <span className="text-muted-foreground">
                        {quantity} ×{' '}
                        {formatBRL(
                          unitPriceCents,
                        )}
                      </span>

                      <span className="font-semibold">
                        {formatBRL(
                          totalCents,
                        )}
                      </span>

                    </div>

                    <div className="mt-2 flex items-center justify-between">

                      <span className="text-sm font-medium">
                        Total a pagar
                      </span>

                      <span className="text-xl font-bold">
                        {formatBRL(
                          totalCents,
                        )}
                      </span>

                    </div>

                  </div>

                  <ul className="mt-6 flex flex-1 flex-col gap-3">

                    {features.map(
                      (feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2 text-sm"
                        >

                          <Check className="mt-0.5 size-4 shrink-0 text-primary" />

                          <span className="text-muted-foreground">
                            {feature}
                          </span>

                        </li>
                      ),
                    )}

                  </ul>

                  <Button
                    className="mt-8"
                    variant={
                      isHighlight
                        ? 'default'
                        : 'secondary'
                    }
                    onClick={() =>
                      handleBuy(product)
                    }
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        Comprar{' '}
                        {quantity}{' '}
                        {quantity === 1
                          ? 'tela'
                          : 'telas'}
                      </>
                    )}
                  </Button>

                </div>
              )
            })}

          </div>

        </div>
      </section>

      {/* ============================================
          MODAL PIX
      ============================================ */}

      {payment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">

          <div className="relative w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl">

            <button
              type="button"
              onClick={() => {
                setPayment(null)
                setOrderStatus('pending')
              }}
              className="absolute right-4 top-4 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="size-5" />
            </button>

            {/* PAGAMENTO CONFIRMADO */}

            {paymentConfirmed ? (

              <div className="py-6 text-center">

                <div className="flex justify-center">
                  <CheckCircle2 className="size-20 text-green-500" />
                </div>

                <h2 className="mt-5 text-2xl font-bold">
                  Pagamento confirmado!
                </h2>

                <p className="mt-3 text-sm text-muted-foreground">
                  Seu pagamento foi aprovado com sucesso.
                </p>

                <p className="mt-2 text-sm text-muted-foreground">
                  Seus códigos já foram adicionados à sua conta.
                </p>

                <Button
                  className="mt-8 w-full"
                  onClick={() => {
                    setPayment(null)
                    router.push(
                      '/minha-conta',
                    )
                  }}
                >
                  Ver meus códigos
                </Button>

                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => {
                    setPayment(null)
                  }}
                >
                  Fechar
                </Button>

              </div>

            ) : orderStatus === 'cancelled' ? (

              /* PAGAMENTO CANCELADO */

              <div className="py-6 text-center">

                <h2 className="text-2xl font-bold">
                  Pagamento cancelado
                </h2>

                <p className="mt-3 text-sm text-muted-foreground">
                  Este pagamento não foi aprovado.
                </p>

                <Button
                  variant="outline"
                  className="mt-8 w-full"
                  onClick={() => {
                    setPayment(null)
                  }}
                >
                  Fechar
                </Button>

              </div>

            ) : (

              /* AGUARDANDO PAGAMENTO */

              <div className="text-center">

                <h2 className="text-2xl font-bold">
                  Pague com PIX
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  Escaneie o QR Code ou copie o código PIX.
                </p>

                {qrImage ? (

                  <div className="mt-6 flex justify-center">

                    <div className="rounded-xl bg-white p-3">

                      <img
                        src={qrImage}
                        alt="QR Code PIX"
                        className="h-56 w-56"
                      />

                    </div>

                  </div>

                ) : (

                  <div className="mt-6 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm">
                    O pagamento foi criado, mas o QR Code não foi encontrado na resposta.
                  </div>

                )}

                {payment.qrCode && (
                  <>

                    <div className="mt-6 max-h-24 overflow-auto rounded-lg border bg-muted p-3 text-left text-xs break-all">
                      {payment.qrCode}
                    </div>

                    <Button
                      className="mt-4 w-full"
                      onClick={
                        copyPixCode
                      }
                    >
                      <Copy className="size-4" />
                      Copiar código PIX
                    </Button>

                  </>
                )}

                {/* STATUS AUTOMÁTICO */}

                <div className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">

                  <Loader2 className="size-4 animate-spin text-primary" />

                  <span>
                    {checkingPayment
                      ? 'Verificando pagamento...'
                      : 'Aguardando confirmação do pagamento...'}
                  </span>

                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  Esta página verifica automaticamente seu pagamento.
                </p>

                <p className="mt-5 text-xs text-muted-foreground">
                  Pedido: {payment.orderId}
                </p>

                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() => {
                    setPayment(null)
                  }}
                >
                  Fechar
                </Button>

              </div>

            )}

          </div>

        </div>
      )}
    </>
  )
}
