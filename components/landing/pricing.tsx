'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
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

type Product = {
  id: string
  name: string
  screens: number
  price_cents: number
  description: string | null
}

type PaymentData = {
  orderId: string
  qrCode: string
  qrCodeBase64: string
}

type OrderStatus = 'pending' | 'paid' | 'delivered' | 'cancelled' | 'unknown'

const PRICING_TIERS = [
  { min: 1, max: 4, unitPrice: 3500 },
  { min: 5, max: 9, unitPrice: 3400 },
  { min: 10, max: 500, unitPrice: 3300 },
]

function getUnitPrice(quantity: number) {
  const tier = PRICING_TIERS.find(
    (item) => quantity >= item.min && quantity <= item.max,
  )

  return tier?.unitPrice ?? 3500
}

function getNextPriceMessage(quantity: number) {
  if (quantity < 5) {
    return `Compre ${5 - quantity} tela${
      5 - quantity === 1 ? '' : 's'
    } a mais e pague R$ 34,00 cada.`
  }

  if (quantity < 10) {
    return `Compre ${10 - quantity} tela${
      10 - quantity === 1 ? '' : 's'
    } a mais e pague R$ 33,00 cada.`
  }

  return null
}

function isValidQuantity(value: string) {
  return /^(?:[1-9]|[1-9]\d|[1-4]\d{2}|500)$/.test(value)
}

export default function Pricing({ products }: { products: Product[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [quantity, setQuantity] = useState(1)
  const [quantityInput, setQuantityInput] = useState('1')

  const [payment, setPayment] = useState<PaymentData | null>(null)
  const [paymentStatus, setPaymentStatus] =
    useState<OrderStatus>('pending')

  const [copied, setCopied] = useState(false)

  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const product =
    products.find((item) => item.screens === 1) ?? products[0]

  const unitPrice = getUnitPrice(quantity)
  const totalPrice = unitPrice * quantity
  const nextPriceMessage = getNextPriceMessage(quantity)

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!payment?.orderId) return

    const checkStatus = async () => {
      try {
        const response = await fetch(
          `/api/orders/${payment.orderId}`,
          {
            cache: 'no-store',
          },
        )

        if (!response.ok) return

        const data = await response.json()

        const status: OrderStatus =
          data?.order?.status ?? data?.status ?? 'unknown'

        setPaymentStatus(status)

        if (status === 'paid' || status === 'delivered') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
        }

        if (status === 'cancelled') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
        }
      } catch {
        // Mantém o polling em caso de erro temporário.
      }
    }

    checkStatus()

    pollingRef.current = setInterval(checkStatus, 3000)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [payment?.orderId])

  const updateQuantity = (nextQuantity: number) => {
    const safeQuantity = Math.min(500, Math.max(1, nextQuantity))

    setQuantity(safeQuantity)
    setQuantityInput(String(safeQuantity))
  }

  const handleQuantityInput = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value

    if (value === '') {
      setQuantityInput('')
      return
    }

    if (!/^\d+$/.test(value)) {
      return
    }

    if (value.length > 3) {
      return
    }

    const numericValue = Number(value)

    if (numericValue > 500) {
      return
    }

    setQuantityInput(value)

    if (numericValue >= 1) {
      setQuantity(numericValue)
    }
  }

  const handleQuantityBlur = () => {
    if (!isValidQuantity(quantityInput)) {
      setQuantityInput(String(quantity))
      return
    }

    const numericValue = Number(quantityInput)

    if (numericValue < 1 || numericValue > 500) {
      setQuantityInput(String(quantity))
      return
    }

    setQuantity(numericValue)
    setQuantityInput(String(numericValue))
  }

  const handleBuy = () => {
    if (!product) {
      toast.error('Produto indisponível no momento.')
      return
    }

    if (!isValidQuantity(quantityInput)) {
      toast.error('Informe uma quantidade válida entre 1 e 500.')
      return
    }

    const numericQuantity = Number(quantityInput)

    if (
      !Number.isInteger(numericQuantity) ||
      numericQuantity < 1 ||
      numericQuantity > 500
    ) {
      toast.error('Informe uma quantidade válida entre 1 e 500.')
      return
    }

    setQuantity(numericQuantity)

    startTransition(async () => {
      try {
        const idempotencyKey = crypto.randomUUID()

        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            productId: product.id,
            quantity: numericQuantity,
          }),
        })

        const data = await response.json().catch(() => null)

        if (response.status === 401) {
          toast.error('Faça login para continuar.')

          router.push(
            `/login?redirect=${encodeURIComponent('/')}`,
          )

          return
        }

        if (response.status === 429) {
          toast.error(
            data?.error ??
              'Muitas tentativas. Aguarde um momento e tente novamente.',
          )

          return
        }

        if (response.status === 409) {
          if (data?.order?.id && data?.payment?.qrCode) {
            setPayment({
              orderId: data.order.id,
              qrCode: data.payment.qrCode,
              qrCodeBase64: data.payment.qrCodeBase64 ?? '',
            })

            setPaymentStatus(
              data.order.status === 'paid'
                ? 'paid'
                : data.order.status === 'delivered'
                  ? 'delivered'
                  : 'pending',
            )

            return
          }

          toast.error(
            data?.error ?? 'Este pedido já foi processado.',
          )

          return
        }

        if (!response.ok) {
          throw new Error(
            data?.error ?? 'Não foi possível criar o pedido.',
          )
        }

        const order = data?.order
        const paymentData = data?.payment

        if (!order?.id || !paymentData?.qrCode) {
          throw new Error(
            'Não foi possível gerar o pagamento PIX.',
          )
        }

        setPayment({
          orderId: order.id,
          qrCode: paymentData.qrCode,
          qrCodeBase64: paymentData.qrCodeBase64 ?? '',
        })

        setPaymentStatus('pending')
      } catch (error) {
        console.error(error)

        toast.error(
          error instanceof Error
            ? error.message
            : 'Ocorreu um erro ao criar o pedido.',
        )
      }
    })
  }

  const copyPixCode = async () => {
    if (!payment?.qrCode) return

    try {
      await navigator.clipboard.writeText(payment.qrCode)
      setCopied(true)

      toast.success('Código PIX copiado!')

      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch {
      toast.error('Não foi possível copiar o código PIX.')
    }
  }

  const closePayment = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }

    setPayment(null)
    setPaymentStatus('pending')
    setCopied(false)
  }

  if (!product) {
    return null
  }

  return (
    <>
      <section
        id="precos"
        className="py-12 sm:py-14"
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Escolha seu plano
            </h2>

            <p className="mt-3 text-muted-foreground">
              Ative suas telas LD CLOUD de forma rápida e segura.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-xl rounded-2xl border bg-card p-4 shadow-lg sm:p-5">
            <div className="text-center">
              <h3 className="text-xl font-semibold">
                Tela LD CLOUD
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Ativação por código
              </p>
            </div>

            <div className="mt-5 text-center">
              <div className="flex items-end justify-center gap-1">
                <span className="text-4xl font-bold tracking-tight sm:text-5xl">
                  {formatBRL(totalPrice)}
                </span>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                {formatBRL(unitPrice)} por tela
              </p>
            </div>

            <div className="mt-5 flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 rounded-full"
                disabled={quantity <= 1}
                onClick={() => updateQuantity(quantity - 1)}
              >
                <Minus className="size-4" />
                <span className="sr-only">
                  Diminuir quantidade
                </span>
              </Button>

              <input
                type="text"
                inputMode="numeric"
                value={quantityInput}
                onChange={handleQuantityInput}
                onBlur={handleQuantityBlur}
                className="h-10 w-24 rounded-lg border bg-background text-center text-lg font-semibold outline-none transition focus:ring-2 focus:ring-ring"
                aria-label="Quantidade de telas"
              />

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 rounded-full"
                disabled={quantity >= 500}
                onClick={() => updateQuantity(quantity + 1)}
              >
                <Plus className="size-4" />
                <span className="sr-only">
                  Aumentar quantidade
                </span>
              </Button>
            </div>

            <div className="mt-4 space-y-2 rounded-xl border bg-muted/30 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  1–4 telas
                </span>

                <span className="font-medium">
                  R$ 35,00 / tela
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  5–9 telas
                </span>

                <span className="font-medium">
                  R$ 34,00 / tela
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  10+ telas
                </span>

                <span className="font-medium">
                  R$ 33,00 / tela
                </span>
              </div>
            </div>

            {nextPriceMessage && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {nextPriceMessage}
              </p>
            )}

            <div className="mt-4 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">
                  Total
                </span>

                <span className="text-2xl font-bold">
                  {formatBRL(totalPrice)}
                </span>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              {[
                'Ativação rápida por código',
                'Código enviado após confirmação do pagamento',
                'Suporte para ativação e renovação',
                'Pagamento seguro via PIX',
              ].map((benefit) => (
                <div
                  key={benefit}
                  className="flex items-center gap-2 text-sm"
                >
                  <Check className="size-4 shrink-0 text-primary" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            <Button
              type="button"
              className="mt-5 h-11 w-full"
              disabled={isPending}
              onClick={handleBuy}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Processando...
                </>
              ) : (
                'Comprar agora'
              )}
            </Button>
          </div>
        </div>
      </section>

      {payment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-background p-6 shadow-2xl">
            <button
              type="button"
              onClick={closePayment}
              className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="size-5" />
            </button>

            <div className="pr-8">
              <h3 className="text-xl font-bold">
                Pagamento PIX
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Escaneie o QR Code ou copie o código PIX.
              </p>
            </div>

            {paymentStatus === 'paid' ||
            paymentStatus === 'delivered' ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto size-16 text-green-500" />

                <h4 className="mt-4 text-xl font-bold">
                  Pagamento confirmado!
                </h4>

                <p className="mt-2 text-sm text-muted-foreground">
                  Seu pedido foi confirmado com sucesso.
                </p>

                <Button
                  className="mt-6 w-full"
                  onClick={() => router.push('/minha-conta')}
                >
                  Ir para minha conta
                </Button>
              </div>
            ) : paymentStatus === 'cancelled' ? (
              <div className="py-8 text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/10">
                  <X className="size-8 text-destructive" />
                </div>

                <h4 className="mt-4 text-xl font-bold">
                  Pagamento cancelado
                </h4>

                <p className="mt-2 text-sm text-muted-foreground">
                  Este pagamento foi cancelado.
                </p>

                <Button
                  className="mt-6 w-full"
                  onClick={closePayment}
                >
                  Fechar
                </Button>
              </div>
            ) : (
              <>
                <div className="mt-6 flex justify-center">
                  {payment.qrCodeBase64 ? (
                    <img
                      src={`data:image/png;base64,${payment.qrCodeBase64}`}
                      alt="QR Code PIX"
                      className="size-64 rounded-xl border bg-white p-2"
                    />
                  ) : (
                    <div className="flex size-64 items-center justify-center rounded-xl border bg-muted">
                      <Loader2 className="size-8 animate-spin" />
                    </div>
                  )}
                </div>

                <div className="mt-5">
                  <p className="mb-2 text-sm font-medium">
                    PIX Copia e Cola
                  </p>

                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1 rounded-lg border bg-muted p-3">
                      <p className="break-all text-xs text-muted-foreground">
                        {payment.qrCode}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={copyPixCode}
                      aria-label="Copiar código PIX"
                    >
                      {copied ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border bg-muted/30 p-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin" />

                    <span className="text-sm font-medium">
                      Aguardando pagamento...
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Esta tela será atualizada automaticamente.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}