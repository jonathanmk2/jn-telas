'use client'

import {
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react'
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

function isValidQuantityInput(
  value: string,
): boolean {
  return /^(?:[1-9]|[1-9]\d|[1-4]\d{2}|500)$/.test(
    value,
  )
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

  const [quantity, setQuantity] =
    useState(1)

  const [quantityInput, setQuantityInput] =
    useState('1')

  const [rateLimitMessage, setRateLimitMessage] =
    useState<string | null>(null)

  const idempotencyKeyRef =
    useRef<string | null>(null)

  const product =
    products.find(
      (item) => item.screens === 1,
    ) ??
    products[0] ??
    null

  const inputIsValid =
    isValidQuantityInput(
      quantityInput,
    )

  const unitPriceCents =
    getUnitPriceCents(quantity)

  const totalCents =
    quantity * unitPriceCents

  const priceLabel =
    getPriceLabel(quantity)

  const nextPriceMessage =
    getNextPriceMessage(quantity)

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

    idempotencyKeyRef.current = null
    setRateLimitMessage(null)
  }

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

    setRateLimitMessage(null)

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

    const parsedQuantity =
      Number(quantityInput)

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

    setQuantity(
      parsedQuantity,
    )

    setQuantityInput(
      String(parsedQuantity),
    )

    if (
      !idempotencyKeyRef.current
    ) {
      idempotencyKeyRef.current =
        crypto.randomUUID()
    }

    const idempotencyKey =
      idempotencyKeyRef.current

    startTransition(async () => {
      try {
        const response = await fetch(
          '/api/orders',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
              'Idempotency-Key':
                idempotencyKey,
            },
            body: JSON.stringify({
              productId:
                product.id,
              quantity:
                parsedQuantity,
            }),
          },
        )

        const res =
          await response.json()

        if (
          response.status === 429
        ) {
          const retryAfter =
            Number(
              res.retryAfter ??
                60,
            )

          const seconds =
            Number.isFinite(
              retryAfter,
            ) &&
            retryAfter > 0
              ? retryAfter
              : 60

          const message =
            `Limite de pedidos atingido. Aguarde ${seconds} segundos e tente novamente.`

          setRateLimitMessage(
            message,
          )

          toast.error(
            message,
          )

          idempotencyKeyRef.current =
            null

          return
        }

        if (
          response.ok &&
          res.ok
        ) {
          setPayment({
            orderId:
              res.orderId,
            qrCode:
              res.qrCode,
            qrCodeBase64:
              res.qrCodeBase64,
          })

          setOrderStatus(
            'pending',
          )

          idempotencyKeyRef.current =
            null

          setRateLimitMessage(
            null,
          )

          toast.success(
            res.idempotent
              ? 'Pedido recuperado com sucesso!'
              : 'Pagamento PIX gerado com sucesso!',
          )

          return
        }

        if (
          res.needsAuth
        ) {
          router.push(
            '/auth/login?next=/minha-conta',
          )

          return
        }

        if (
          response.status === 409
        ) {
          toast.error(
            res.error ??
              'Esta operação já possui um pedido em processamento.',
          )

          return
        }

        console.error(
          'Erro no pagamento:',
          res.error,
        )

        toast.error(
          res.error ??
            'Não foi possível criar o pedido.',
        )
      } catch (error) {
        console.error(
          'Erro inesperado:',
          error,
        )

        toast.error(
          'Ocorreu um erro inesperado ao gerar o pagamento. Tente novamente.',
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
        className="scroll-mt-20 bg-secondary/30 py-4 sm:py-6"
      >
        <div className="mx-auto max-w-2xl px-3 sm:px-4">

          {product && (
            <div className="relative mx-auto max-w-md rounded-2xl border border-primary bg-card p-3 shadow-lg shadow-primary/10">

              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-semibold text-primary-foreground">
                30 dias de acesso
              </div>

              <div className="text-center">

                <h3 className="text-xl font-bold">
                  LD CLOUD VIP
                </h3>

                <div className="mt-1 flex items-baseline justify-center gap-1.5">

                  <span className="text-3xl font-bold tracking-tight">
                    {formatBRL(
                      unitPriceCents,
                    )}
                  </span>

                  <span className="text-xs text-muted-foreground">
                    / tela
                  </span>

                </div>

                <p className="mt-0.5 text-xs font-medium text-primary">
                  {priceLabel}
                </p>

              </div>

              <div className="mt-3">

                <p className="mb-1.5 text-center text-xs font-semibold">
                  Quantidade de telas
                </p>

                <div className="flex items-center gap-2">

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 shrink-0"
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
                    <Minus className="size-4" />
                  </Button>

                  <input
                    type="text"
                    inputMode="numeric"
                    value={quantityInput}
                    disabled={pending}
                    onChange={(event) => {
                      const value =
                        event.target.value

                      setQuantityInput(
                        value,
                      )

                      if (
                        isValidQuantityInput(
                          value,
                        )
                      ) {
                        setQuantity(
                          Number(value),
                        )

                        idempotencyKeyRef.current =
                          null

                        setRateLimitMessage(
                          null,
                        )
                      }
                    }}
                    className={`h-8 w-full rounded-lg border bg-background px-3 text-center text-base font-bold outline-none ${
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

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 shrink-0"
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
                    <Plus className="size-4" />
                  </Button>

                </div>

                {!inputIsValid && (
                  <p className="mt-1 text-center text-[10px] font-medium text-red-500">
                    Digite uma quantidade entre 1 e 500.
                  </p>
                )}

              </div>

              <div className="mt-2 grid grid-cols-3 rounded-lg border bg-secondary/40 p-2 text-center text-[10px]">

                <div
                  className={
                    quantity < 5
                      ? 'font-semibold text-primary'
                      : 'text-muted-foreground'
                  }
                >
                  <div>
                    1–4 telas
                  </div>

                  <div>
                    R$ 35,00
                  </div>
                </div>

                <div
                  className={
                    quantity >= 5 &&
                    quantity < 10
                      ? 'font-semibold text-primary'
                      : 'text-muted-foreground'
                  }
                >
                  <div>
                    5–9 telas
                  </div>

                  <div>
                    R$ 34,00
                  </div>
                </div>

                <div
                  className={
                    quantity >= 10
                      ? 'font-semibold text-primary'
                      : 'text-muted-foreground'
                  }
                >
                  <div>
                    10+ telas
                  </div>

                  <div>
                    R$ 33,00
                  </div>
                </div>

              </div>

              <div className="mt-2 flex items-center justify-between rounded-lg border bg-background px-3 py-2">

                <span className="text-xs text-muted-foreground">
                  {quantity} ×{' '}
                  {formatBRL(
                    unitPriceCents,
                  )}
                </span>

                <div className="flex items-center gap-2">

                  <span className="text-xs font-semibold">
                    Total
                  </span>

                  <span className="text-lg font-bold">
                    {formatBRL(
                      totalCents,
                    )}
                  </span>

                </div>

              </div>

              <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-muted-foreground">

                <li className="flex items-center gap-1.5">

                  <Check className="size-3 shrink-0 text-primary" />

                  <span>
                    30 dias de acesso VIP
                  </span>

                </li>

                <li className="flex items-center gap-1.5">

                  <Check className="size-3 shrink-0 text-primary" />

                  <span>
                    Telas simultâneas
                  </span>

                </li>

                <li className="flex items-center gap-1.5">

                  <Check className="size-3 shrink-0 text-primary" />

                  <span>
                    Suporte via WhatsApp
                  </span>

                </li>

                <li className="flex items-center gap-1.5">

                  <Check className="size-3 shrink-0 text-primary" />

                  <span>
                    Pagamento PIX
                  </span>

                </li>

              </ul>

              <Button
                className="mt-2 h-9 w-full text-sm"
                onClick={handleBuy}
                disabled={
                  pending ||
                  !product ||
                  !inputIsValid
                }
              >
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
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

              {rateLimitMessage && (
                <div
                  role="alert"
                  className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-center"
                >

                  <p className="text-xs font-semibold text-red-500">
                    🚫 Limite de pedidos atingido
                  </p>

                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {rateLimitMessage}
                  </p>

                </div>
              )}

            </div>
          )}

        </div>
      </section>

      {payment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">

          <div className="relative w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl">

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
              