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
 * ============================================================
 * REGRA DE PREÇO
 * ============================================================
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

function getPriceLabel(quantity: number): string {
  if (quantity >= 10) {
    return 'R$ 33,00 por tela'
  }

  if (quantity >= 5) {
    return 'R$ 34,00 por tela'
  }

  return 'R$ 35,00 por tela'
}

function getNextPriceMessage(
  quantity: number,
): string | null {
  if (quantity < 5) {
    return 'A partir de 5 telas: R$ 34,00 por tela'
  }

  if (quantity < 10) {
    return 'A partir de 10 telas: R$ 33,00 por tela'
  }

  return 'Melhor preço disponível'
}

/*
 * ============================================================
 * VALIDAÇÃO DA QUANTIDADE
 * ============================================================
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
 */

function isValidQuantityInput(
  value: string,
): boolean {
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

  const [pending, startTransition] =
    useTransition()

  const [payment, setPayment] =
    useState<PaymentData | null>(null)

  const [orderStatus, setOrderStatus] =
    useState<OrderStatus>('pending')

  const [checkingPayment, setCheckingPayment] =
    useState(false)

  /*
   * Quantidade válida utilizada nos cálculos.
   */
  const [quantity, setQuantity] =
    useState(1)

  /*
   * Texto que está dentro do campo.
   *
   * Fica separado de "quantity" para impedir
   * que valores como "5e2" sejam transformados
   * automaticamente em 500.
   */
  const [quantityInput, setQuantityInput] =
    useState('1')

  /*
   * Produto de 1 tela como produto base.
   */
  const product =
    products.find(
      (item) => item.screens === 1,
    ) ??
    products[0] ??
    null

  /*
   * Quantidade digitada atualmente é válida?
   */
  const inputIsValid =
    isValidQuantityInput(
      quantityInput,
    )

  /*
   * Quantidade válida para os cálculos.
   */
  const unitPriceCents =
    getUnitPriceCents(quantity)

  const totalCents =
    quantity * unitPriceCents

  const priceLabel =
    getPriceLabel(quantity)

  const nextPriceMessage =
    getNextPriceMessage(quantity)

  /*
   * ============================================================
   * ALTERAR QUANTIDADE PELOS BOTÕES
   * ============================================================
   */

  function changeQuantity(value: number) {
    if (!Number.isFinite(value)) {
      return
    }

    const newQuantity = Math.max(
      1,
      Math.min(
        500,
        Math.floor(value),
      ),
    )

    setQuantity(newQuantity)
    setQuantityInput(
      String(newQuantity),
    )
  }

  /*
   * ============================================================
   * COMPRAR
   * ============================================================
   */

  function handleBuy() {
    /*
     * Produto inexistente.
     */
    if (!product) {
      toast.error(
        'Produto não encontrado.',
      )

      return
    }

    /*
     * Usuário não logado.
     */
    if (!isLoggedIn) {
      router.push(
        '/auth/sign-up?next=/minha-conta',
      )

      return
    }

    /*
     * IMPORTANTE:
     *
     * Validamos o texto ANTES de usar Number().
     *
     * Assim:
     *
     * 5e2  -> inválido
     * 501  -> inválido
     * 1.5  -> inválido
     * -1   -> inválido
     * 0    -> inválido
     */
    if (
      !isValidQuantityInput(
        quantityInput,
      )
    ) {
      toast.error(
        'Quantidade inválida. Digite um número inteiro entre 1 e 500.',
      )

      return
    }

    /*
     * Só converte depois da validação.
     */
    const parsedQuantity =
      Number(quantityInput)

    /*
     * Segunda camada de segurança.
     */
    if (
      !Number.isInteger(
        parsedQuantity,
      ) ||
      parsedQuantity < 1 ||
      parsedQuantity > 500
    ) {
      toast.error(
        'Quantidade inválida. Digite um número inteiro entre 1 e 500.',
      )

      return
    }

    /*
     * Mantém o estado sincronizado.
     */
    setQuantity(
      parsedQuantity,
    )

    setQuantityInput(
      String(parsedQuantity),
    )

    console.log(
      'Iniciando compra:',
      {
        productId: product.id,
        quantity: parsedQuantity,
        totalCents:
          getUnitPriceCents(
            parsedQuantity,
          ) *
          parsedQuantity,
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

          setOrderStatus(
            'pending',
          )

          toast.success(
            'Pagamento PIX gerado com sucesso!',
          )
        } else if (
          res.needsAuth
        ) {
          router.push(
            '/auth/login?next=/minha-conta',
          )
        } else {
          console.error(
            'Erro no pagamento:',
            res.error,
          )

          toast.error(
            res.error,
          )
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

  /*
   * ============================================================
   * COPIAR PIX
   * ============================================================
   */

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

  /*
   * ============================================================
   * VERIFICAR PAGAMENTO AUTOMATICAMENTE
   * ============================================================
   */

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
        setCheckingPayment(
          true,
        )

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

        setOrderStatus(
          newStatus,
        )

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
          setCheckingPayment(
            false,
          )
        }
      }
    }

    checkPayment()

    const interval =
      setInterval(
        checkPayment,
        3000,
      )

    return () => {
      active = false

      clearInterval(
        interval,
      )
    }
  }, [
    payment?.orderId,
    orderStatus,
  ])

  /*
   * ============================================================
   * QR CODE
   * ============================================================
   */

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
        <div className="mx-auto max-w-3xl px-4">

          {/* CABEÇALHO */}

          <div className="mx-auto max-w-2xl text-center">

            <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
              LD CLOUD VIP
            </h2>

            <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
              Escolha quantas telas você precisa e pague tudo em um único PIX.
            </p>

          </div>

          {/* CARD ÚNICO */}

          {product && (
            <div className="relative mx-auto mt-12 max-w-xl rounded-2xl border border-primary bg-card p-6 shadow-lg shadow-primary/10 sm:p-8">

              {/* BADGE */}

              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
                30 dias de acesso
              </div>

              {/* PRODUTO */}

              <div className="text-center">

                <h3 className="text-2xl font-bold">
                  LD CLOUD VIP
                </h3>

                <p className="mt-2 text-sm text-muted-foreground">
                  Acesso VIP por 30 dias
                </p>

              </div>

              {/* PREÇO */}

              <div className="mt-8 text-center">

                <div className="flex items-end justify-center gap-2">

                  <span className="text-5xl font-bold tracking-tight">
                    {formatBRL(
                      unitPriceCents,
                    )}
                  </span>

                  <span className="mb-2 text-sm text-muted-foreground">
                    / tela
                  </span>

                </div>

                <p className="mt-2 text-sm font-medium text-primary">
                  {priceLabel}
                </p>

              </div>

              {/* QUANTIDADE */}

              <div className="mt-8">

                <p className="mb-3 text-center text-sm font-semibold">
                  Quantidade de telas
                </p>

                <div className="mx-auto flex max-w-sm items-center gap-3">

                  {/* MENOS */}

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-12 shrink-0"
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
                    <Minus className="size-5" />
                  </Button>

                  {/* INPUT */}

                  <input
                    type="text"
                    inputMode="numeric"
                    value={quantityInput}
                    disabled={pending}
                    onChange={(event) => {
                      const value =
                        event.target.value

                      /*
                       * NÃO usamos Number()
                       * aqui.
                       *
                       * Isso mantém:
                       *
                       * 5e2
                       * 501
                       * 1.5
                       *
                       * exatamente como foram digitados.
                       */
                      setQuantityInput(
                        value,
                      )
                    }}
                    className={`h-12 w-full rounded-lg border bg-background px-3 text-center text-xl font-bold outline-none ${
                      !inputIsValid
                        ? 'border-red-500 focus:border-red-500'
                        : ''
                    }`}
                    aria-label="Quantidade de telas"
                    aria-invalid={
                      !inputIsValid
                    }
                    autoComplete="off"
                  />

                  {/* MAIS */}

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-12 shrink-0"
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
                    <Plus className="size-5" />
                  </Button>

                </div>

                {/* MENSAGEM */}

                {!inputIsValid ? (
                  <p className="mt-2 text-center text-xs font-medium text-red-500">
                    Quantidade inválida. Digite um número inteiro entre 1 e 500.
                  </p>
                ) : (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Informe uma quantidade inteira de 1 a 500.
                  </p>
                )}

              </div>

              {/* DESCONTO POR QUANTIDADE */}

              <div className="mt-6 rounded-xl border bg-secondary/40 p-4">

                <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">

                  <div
                    className={
                      quantity < 5
                        ? 'font-semibold text-primary'
                        : 'text-muted-foreground'
                    }
                  >
                    1–4 telas

                    <br />

                    <span className="text-xs">
                      R$ 35,00 / tela
                    </span>
                  </div>

                  <div
                    className={
                      quantity >= 5 &&
                      quantity < 10
                        ? 'font-semibold text-primary'
                        : 'text-muted-foreground'
                    }
                  >
                    5–9 telas

                    <br />

                    <span className="text-xs">
                      R$ 34,00 / tela
                    </span>
                  </div>

                  <div
                    className={
                      quantity >= 10
                        ? 'font-semibold text-primary'
                        : 'text-muted-foreground'
                    }
                  >
                    10+ telas

                    <br />

                    <span className="text-xs">
                      R$ 33,00 / tela
                    </span>
                  </div>

                </div>

                {nextPriceMessage && (
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    {nextPriceMessage}
                  </p>
                )}

              </div>

              {/* TOTAL */}

              <div className="mt-6 rounded-xl border bg-background p-5">

                {inputIsValid ? (
                  <>
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

                    <div className="mt-3 flex items-center justify-between">

                      <span className="text-base font-semibold">
                        Total a pagar
                      </span>

                      <span className="text-2xl font-bold">
                        {formatBRL(
                          totalCents,
                        )}
                      </span>

                    </div>
                  </>
                ) : (
                  <div className="py-1 text-center">

                    <p className="text-sm font-semibold text-red-500">
                      Quantidade inválida
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Digite um número inteiro entre 1 e 500.
                    </p>

                  </div>
                )}

              </div>

              {/* BENEFÍCIOS */}

              <ul className="mt-7 space-y-3">

                <li className="flex items-center gap-3 text-sm">

                  <Check className="size-4 shrink-0 text-primary" />

                  <span className="text-muted-foreground">
                    Telas simultâneas conforme quantidade comprada
                  </span>

                </li>

                <li className="flex items-center gap-3 text-sm">

                  <Check className="size-4 shrink-0 text-primary" />

                  <span className="text-muted-foreground">
                    Acesso VIP por 30 dias
                  </span>

                </li>

                <li className="flex items-center gap-3 text-sm">

                  <Check className="size-4 shrink-0 text-primary" />

                  <span className="text-muted-foreground">
                    Suporte via WhatsApp
                  </span>

                </li>

                <li className="flex items-center gap-3 text-sm">

                  <Check className="size-4 shrink-0 text-primary" />

                  <span className="text-muted-foreground">
                    Um único pagamento PIX
                  </span>

                </li>

              </ul>

              {/* BOTÃO */}

              <Button
                className="mt-8 h-12 w-full text-base"
                onClick={handleBuy}
                disabled={
                  pending ||
                  !product ||
                  !inputIsValid
                }
              >
                {pending ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    Comprar{' '}
                    {inputIsValid
                      ? quantity
                      : '—'}{' '}
                    {inputIsValid
                      ? quantity === 1
                        ? 'tela'
                        : 'telas'
                      : 'telas'}
                  </>
                )}
              </Button>

            </div>
          )}

        </div>
      </section>

      {/* =====================================================
          MODAL PIX
      ===================================================== */}

      {payment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">

          <div className="relative w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl">

            {/* FECHAR */}

            <button
              type="button"
              onClick={() => {
                setPayment(null)
                setOrderStatus(
                  'pending',
                )
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
