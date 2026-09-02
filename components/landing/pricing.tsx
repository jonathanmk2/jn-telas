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

function getNextPriceMessage(quantity: number): string | null {
  if (quantity < 5) {
    return 'A partir de 5 telas: R$ 34,00 por tela'
  }

  if (quantity < 10) {
    return 'A partir de 10 telas: R$ 33,00 por tela'
  }

  return 'Melhor preço disponível'
}

/*
 * VALIDAÇÃO DO TEXTO DO CAMPO
 *
 * Aceita somente números inteiros de 1 até 500.
 *
 * Válidos:
 * 1
 * 5
 * 10
 * 100
 * 500
 *
 * Inválidos:
 * 0
 * 00
 * -1
 * 1.5
 * 5e2
 * 501
 * abc
 * espaços
 */
function isValidQuantityInput(value: string): boolean {
  return /^(?:[1-9]\d{0,2}|500)$/.test(value)
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

  const [payment, setPayment] =
    useState<PaymentData | null>(null)

  const [orderStatus, setOrderStatus] =
    useState<OrderStatus>('pending')

  const [checkingPayment, setCheckingPayment] =
    useState(false)

  /*
   * Usa o produto de 1 tela como produto base.
   */
  const product =
    products.find((item) => item.screens === 1) ??
    products[0] ??
    null

  /*
   * Quantidade válida usada nos cálculos.
   */
  const [quantity, setQuantity] =
    useState(1)

  /*
   * Texto que está efetivamente dentro
   * do campo de quantidade.
   *
   * É separado de "quantity" para impedir
   * que valores como "5e2" sejam convertidos
   * automaticamente para 500.
   */
  const [quantityInput, setQuantityInput] =
    useState('1')

  function changeQuantity(value: number) {
    if (!Number.isFinite(value)) {
      return
    }

    const newQuantity = Math.max(
      1,
      Math.min(500, Math.floor(value)),
    )

    setQuantity(newQuantity)
    setQuantityInput(String(newQuantity))
  }

  const unitPriceCents =
    getUnitPriceCents(quantity)

  const totalCents =
    quantity * unitPriceCents

  const priceLabel =
    getPriceLabel(quantity)

  const nextPriceMessage =
    getNextPriceMessage(quantity)

  function handleBuy() {
    if (!product) {
      toast.error(
        'Produto não encontrado.',
      )

      return
    }

    if (!isLoggedIn) {
      router.push(
        '/auth/sign-up?next=/minha-conta',
      )

      return
    }

    /*
     * Primeiro validamos exatamente o que
     * está escrito no campo.
     *
     * Isso impede:
     * 5e2
     * 1.5
     * -1
     * 0
     * 501
     * etc.
     */
    if (!isValidQuantityInput(quantityInput)) {
      toast.error(
        'Quantidade inválida. Digite um número inteiro entre 1 e 500.',
      )

      return
    }

    const parsedQuantity =
      Number(quantityInput)

    /*
     * Segunda camada de segurança.
     */
    if (
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity < 1 ||
      parsedQuantity > 500
    ) {
      toast.error(
        'Quantidade inválida. Digite um número inteiro entre 1 e 500.',
      )

      return
    }

    console.log(
      'Iniciando compra:',
      {
        productId: product.id,
        quantity: parsedQuantity,
        totalCents:
          getUnitPriceCents(
            parsedQuantity,
          ) * parsedQuantity,
      },
    )

    startTransition(async () => {
      try {
        const res = await createOrder(
          product.id,
          parsedQuantity,
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
        className="scroll-mt-20 bg-secondary/30 py-10 sm:py-16"
      >
        <div className="mx-auto max-w-3xl px-3 sm:px-4">

          {/* CABEÇALHO */}

          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
              LD CLOUD VIP
            </h2>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground sm:mt-4 sm:text-base">
              Escolha quantas telas você precisa e pague tudo em um único PIX.
            </p>
          </div>

          {/* CARD ÚNICO */}

          {product && (
            <div className="relative mx-auto mt-7 max-w-xl rounded-2xl border border-primary bg-card p-4 shadow-lg shadow-primary/10 sm:mt-10 sm:p-7">

              {/* BADGE */}

              <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-[10px] font-semibold text-primary-foreground sm:px-4 sm:text-xs">
                30 dias de acesso
              </div>

              {/* PRODUTO */}

              <div className="text-center">
                <h3 className="text-xl font-bold sm:text-2xl">
                  LD CLOUD VIP
                </h3>

                <p className="mt-1 text-xs text-muted-foreground sm:mt-2 sm:text-sm">
                  Acesso VIP por 30 dias
                </p>
              </div>

              {/* PREÇO */}

              <div className="mt-5 text-center sm:mt-7">
                <div className="flex items-end justify-center gap-1.5">
                  <span className="text-4xl font-bold tracking-tight sm:text-5xl">
                    {formatBRL(unitPriceCents)}
                  </span>

                  <span className="mb-1.5 text-xs text-muted-foreground sm:mb-2 sm:text-sm">
                    / tela
                  </span>
                </div>

                <p className="mt-1 text-xs font-medium text-primary sm:mt-2 sm:text-sm">
                  {priceLabel}
                </p>
              </div>

              {/* QUANTIDADE */}

              <div className="mt-5 sm:mt-7">
                <p className="mb-2 text-center text-xs font-semibold sm:mb-3 sm:text-sm">
                  Quantidade de telas
                </p>

                <div className="mx-auto flex max-w-sm items-center gap-2">

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-10 shrink-0 sm:size-12"
                    onClick={() =>
                      changeQuantity(
                        quantity - 1,
                      )
                    }
                    disabled={
                      pending ||
                      quantity <= 1
                    }
                    aria-label="Diminuir quantidade"
                  >
                    <Minus className="size-4 sm:size-5" />
                  </Button>

                  <input
                    type="text"
                    inputMode="numeric"
                    value={quantityInput}
                    disabled={pending}
                    onChange={(event) => {
                      /*
                       * IMPORTANTE:
                       *
                       * Não usamos:
                       *
                       * Number(event.target.value)
                       *
                       * aqui.
                       *
                       * Dessa forma "5e2" permanece
                       * exatamente "5e2" no campo,
                       * em vez de virar 500.
                       */
                      const value =
                        event.target.value

                      setQuantityInput(value)

                      /*
                       * Só altera a quantidade usada
                       * no cálculo quando o valor é
                       * realmente válido.
                       */
                      if (
                        isValidQuantityInput(value)
                      ) {
                        setQuantity(
                          Number(value),
                        )
                      }
                    }}
                    onBlur={() => {
                      /*
                       * Se sair do campo com algo
                       * inválido, volta para a última
                       * quantidade válida.
                       */
                      if (
                        !isValidQuantityInput(
                          quantityInput,
                        )
                      ) {
                        setQuantityInput(
                          String(quantity),
                        )
                      }
                    }}
                    className="h-10 w-full rounded-lg border bg-background px-3 text-center text-lg font-bold sm:h-12 sm:text-xl"
                    aria-label="Quantidade de telas"
                    autoComplete="off"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-10 shrink-0 sm:size-12"
                    onClick={() =>
                      changeQuantity(
                        quantity + 1,
                      )
                    }
                    disabled={
                      pending ||
                      quantity >= 500
                    }
                    aria-label="Aumentar quantidade"
                  >
                    <Plus className="size-4 sm:size-5" />
                  </Button>

                </div>

                <p className="mt-2 text-center text-[10px] text-muted-foreground">
                  Informe uma quantidade inteira de 1 a 500.
                </p>
              </div>

              {/* FAIXAS DE PREÇO */}

              <div className="mt-4 rounded-xl border bg-secondary/40 p-3 sm:mt-5 sm:p-4">
                <div className="grid grid-cols-3 gap-1 text-center sm:gap-2">

                  <div
                    className={
                      quantity < 5
                        ? 'font-semibold text-primary'
                        : 'text-muted-foreground'
                    }
                  >
                    <p className="text-xs">
                      1–4
                    </p>

                    <p className="text-[10px] sm:text-xs">
                      R$ 35/tela
                    </p>
                  </div>

                  <div
                    className={
                      quantity >= 5 &&
                      quantity < 10
                        ? 'font-semibold text-primary'
                        : 'text-muted-foreground'
                    }
                  >
                    <p className="text-xs">
                      5–9
                    </p>

                    <p className="text-[10px] sm:text-xs">
                      R$ 34/tela
                    </p>
                  </div>

                  <div
                    className={
                      quantity >= 10
                        ? 'font-semibold text-primary'
                        : 'text-muted-foreground'
                    }
                  >
                    <p className="text-xs">
                      10+
                    </p>

                    <p className="text-[10px] sm:text-xs">
                      R$ 33/tela
                    </p>
                  </div>

                </div>

                {nextPriceMessage && (
                  <p className="mt-2 text-center text-[10px] text-muted-foreground sm:text-xs">
                    {nextPriceMessage}
                  </p>
                )}
              </div>

              {/* TOTAL */}

              <div className="mt-4 rounded-xl border bg-background p-3.5 sm:mt-5 sm:p-5">

                <div className="flex items-center justify-between text-xs sm:text-sm">
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

                <div className="mt-2.5 flex items-center justify-between sm:mt-3">
                  <span className="text-sm font-semibold sm:text-base">
                    Total a pagar
                  </span>

                  <span className="text-xl font-bold sm:text-2xl">
                    {formatBRL(
                      totalCents,
                    )}
                  </span>
                </div>

              </div>

              {/* BENEFÍCIOS */}

              <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 sm:mt-6 sm:grid-cols-1 sm:gap-3">

                <li className="flex items-start gap-2 text-xs sm:text-sm">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary sm:size-4" />

                  <span className="text-muted-foreground">
                    Telas simultâneas conforme quantidade
                  </span>
                </li>

                <li className="flex items-start gap-2 text-xs sm:text-sm">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary sm:size-4" />

                  <span className="text-muted-foreground">
                    Acesso VIP por 30 dias
                  </span>
                </li>

                <li className="flex items-start gap-2 text-xs sm:text-sm">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary sm:size-4" />

                  <span className="text-muted-foreground">
                    Suporte via WhatsApp
                  </span>
                </li>

                <li className="flex items-start gap-2 text-xs sm:text-sm">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary sm:size-4" />

                  <span className="text-muted-foreground">
                    Um único pagamento PIX
                  </span>
                </li>

              </ul>

              {/* BOTÃO */}

              <Button
                className="mt-5 h-11 w-full text-sm font-semibold sm:mt-7 sm:h-12 sm:text-base"
                onClick={handleBuy}
                disabled={
                  pending ||
                  !product
                }
              >
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin sm:size-5" />
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
          )}

        </div>
      </section>

      {/* ============================================
          MODAL PIX
      ============================================ */}

      {payment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4">

          <div className="relative max-h-[95vh] w-full max-w-md overflow-y-auto rounded-2xl bg-background p-4 shadow-2xl sm:p-6">

            <button
              type="button"
              onClick={() => {
                setPayment(null)
                setOrderStatus('pending')
              }}
              className="absolute right-3 top-3 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground sm:right-4 sm:top-4"
              aria-label="Fechar"
            >
              <X className="size-5" />
            </button>

            {/* PAGAMENTO CONFIRMADO */}

            {paymentConfirmed ? (
              <div className="py-5 text-center sm:py-6">

                <div className="flex justify-center">
                  <CheckCircle2 className="size-16 text-green-500 sm:size-20" />
                </div>

                <h2 className="mt-4 text-xl font-bold sm:mt-5 sm:text-2xl">
                  Pagamento confirmado!
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  Seu pagamento foi aprovado com sucesso.
                </p>

                <p className="mt-2 text-sm text-muted-foreground">
                  Seus códigos já foram adicionados à sua conta.
                </p>

                <Button
                  className="mt-6 w-full sm:mt-8"
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

              <div className="py-5 text-center sm:py-6">

                <h2 className="text-xl font-bold sm:text-2xl">
                  Pagamento cancelado
                </h2>

                <p className="mt-3 text-sm text-muted-foreground">
                  Este pagamento não foi aprovado.
                </p>

                <Button
                  variant="outline"
                  className="mt-6 w-full sm:mt-8"
                  onClick={() => {
                    setPayment(null)
                  }}
                >
                  Fechar
                </Button>

              </div>

            ) : (

              <div className="text-center">

                <h2 className="text-xl font-bold sm:text-2xl">
                  Pague com PIX
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  Escaneie o QR Code ou copie o código PIX.
                </p>

                {qrImage ? (
                  <div className="mt-5 flex justify-center sm:mt-6">

                    <div className="rounded-xl bg-white p-2.5 sm:p-3">
                      <img
                        src={qrImage}
                        alt="QR Code PIX"
                        className="h-52 w-52 sm:h-56 sm:w-56"
                      />
                    </div>

                  </div>
                ) : (
                  <div className="mt-5 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm">
                    O pagamento foi criado, mas o QR Code não foi encontrado na resposta.
                  </div>
                )}

                {payment.qrCode && (
                  <>
                    <div className="mt-5 max-h-24 overflow-auto rounded-lg border bg-muted p-3 text-left text-xs break-all">
                      {payment.qrCode}
                    </div>

                    <Button
                      className="mt-3 w-full"
                      onClick={
                        copyPixCode
                      }
                    >
                      <Copy className="size-4" />
                      Copiar código PIX
                    </Button>
                  </>
                )}

                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground sm:mt-5 sm:text-sm">

                  <Loader2 className="size-4 animate-spin text-primary" />

                  <span>
                    {checkingPayment
                      ? 'Verificando pagamento...'
                      : 'Aguardando confirmação...'}
                  </span>

                </div>

                <p className="mt-2 text-[10px] text-muted-foreground sm:text-xs">
                  Esta página verifica automaticamente seu pagamento.
                </p>

                <p className="mt-4 text-[10px] text-muted-foreground sm:mt-5 sm:text-xs">
                  Pedido: {payment.orderId}
                </p>

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
            )}

          </div>
        </div>
      )}
    </>
  )
}
