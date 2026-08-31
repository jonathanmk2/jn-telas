'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Check, Copy, Loader2, X } from 'lucide-react'
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

type PixPayment = {
  product: Product
  orderId: string
  qrCode: string | null
  qrCodeBase64: string | null
}

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

export function Pricing({
  products,
  isLoggedIn,
}: {
  products: Product[]
  isLoggedIn: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pixPayment, setPixPayment] =
    useState<PixPayment | null>(null)

  function handleBuy(product: Product) {
    if (!isLoggedIn) {
      router.push('/auth/sign-up?next=/minha-conta')
      return
    }

    setActiveId(product.id)

    startTransition(async () => {
      const res = await createOrder(product.id)

      if (res.ok) {
        setPixPayment({
          product,
          orderId: res.orderId,
          qrCode: res.qrCode,
          qrCodeBase64: res.qrCodeBase64,
        })

        toast.success('PIX gerado com sucesso!')
      } else if (res.needsAuth) {
        router.push('/auth/login?next=/minha-conta')
      } else {
        toast.error(res.error)
      }

      setActiveId(null)
    })
  }

  async function copyPix() {
    if (!pixPayment?.qrCode) return

    try {
      await navigator.clipboard.writeText(pixPayment.qrCode)
      toast.success('Código PIX copiado!')
    } catch {
      toast.error('Não foi possível copiar o código PIX.')
    }
  }

  const highlighted = 5

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
              Escolha a quantidade de telas ideal. Sem fidelidade, sem surpresas.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {products.map((product) => {
              const isHighlight =
                product.screens === highlighted

              const features =
                featuresByScreens[product.screens] ?? []

              const loading =
                pending && activeId === product.id

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

                  <div className="mt-5 flex items-end gap-1">
                    <span className="text-4xl font-bold tracking-tight">
                      {formatBRL(product.price_cents)}
                    </span>

                    <span className="mb-1 text-sm text-muted-foreground">
                      /mês
                    </span>
                  </div>

                  <ul className="mt-6 flex flex-1 flex-col gap-3">
                    {features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />

                        <span className="text-muted-foreground">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="mt-8"
                    variant={
                      isHighlight ? 'default' : 'secondary'
                    }
                    onClick={() => handleBuy(product)}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      'Comprar Agora'
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {pixPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-background p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setPixPayment(null)}
              className="absolute right-4 top-4 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="size-5" />
            </button>

            <div className="text-center">
              <h2 className="text-xl font-bold">
                Pagamento via PIX
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Escaneie o QR Code ou copie o código PIX abaixo.
              </p>
            </div>

            <div className="mt-6 rounded-xl bg-muted p-4 text-center">
              <p className="text-sm text-muted-foreground">
                {pixPayment.product.name}
              </p>

              <p className="mt-1 text-2xl font-bold">
                {formatBRL(
                  pixPayment.product.price_cents,
                )}
              </p>
            </div>

            <div className="mt-6 flex justify-center">
              {pixPayment.qrCodeBase64 ? (
                <img
                  src={`data:image/png;base64,${pixPayment.qrCodeBase64}`}
                  alt="QR Code PIX"
                  className="h-52 w-52 rounded-lg bg-white p-2"
                />
              ) : (
                <div className="flex h-52 w-52 items-center justify-center rounded-lg border text-center text-sm text-muted-foreground">
                  QR Code indisponível
                </div>
              )}
            </div>

            {pixPayment.qrCode && (
              <div className="mt-6">
                <p className="mb-2 text-sm font-medium">
                  PIX Copia e Cola
                </p>

                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="max-h-24 overflow-y-auto break-all text-xs text-muted-foreground">
                    {pixPayment.qrCode}
                  </p>
                </div>

                <Button
                  className="mt-3 w-full"
                  onClick={copyPix}
                >
                  <Copy className="size-4" />
                  Copiar código PIX
                </Button>
              </div>
            )}

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Após o pagamento ser confirmado, seu pedido será liberado automaticamente.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
