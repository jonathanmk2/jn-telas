'use client'

import { useMemo, useState } from 'react'
import { createOrder } from '@/app/actions/orders'
import { toast } from 'sonner'

type Product = {
  id: string
  name: string
  screens: number
  price_cents: number
  active: boolean
}

type PricingProps = {
  products: Product[]
  isLoggedIn: boolean
}

function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100)
}

function getUnitPriceCents(quantity: number): number {
  if (quantity >= 10) return 3300
  if (quantity >= 5) return 3400
  return 3500
}

function isValidQuantity(value: string): boolean {
  return /^(?:[1-9]\d{0,2}|500)$/.test(value)
}

export default function Pricing({
  products,
  isLoggedIn,
}: PricingProps) {
  const [quantity, setQuantity] = useState(1)
  const [quantityInput, setQuantityInput] = useState('1')
  const [pending, setPending] = useState(false)

  const product = useMemo(() => {
    return products.find(
      (item) => item.screens === 1 && item.active,
    )
  }, [products])

  const unitPriceCents = getUnitPriceCents(quantity)
  const totalCents = unitPriceCents * quantity

  function changeQuantity(value: number) {
    if (!Number.isFinite(value)) return

    const newQuantity = Math.max(
      1,
      Math.min(500, Math.floor(value)),
    )

    setQuantity(newQuantity)
    setQuantityInput(String(newQuantity))
  }

  async function handleBuy() {
    if (!product) {
      toast.error('Produto não encontrado.')
      return
    }

    if (!isLoggedIn) {
      window.location.href = '/auth/login?next=/'
      return
    }

    /*
     * Validação do texto digitado.
     *
     * Aceita somente:
     * 1 até 500
     *
     * Bloqueia:
     * 0
     * -1
     * 1.5
     * 5e2
     * 501
     * abc
     */
    if (!isValidQuantity(quantityInput)) {
      toast.error(
        'Quantidade inválida. Digite um número inteiro entre 1 e 500.',
      )
      return
    }

    const parsedQuantity = Number(quantityInput)

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

    setPending(true)

    try {
      const result = await createOrder(
        product.id,
        parsedQuantity,
      )

      if (!result.ok) {
        if (result.needsAuth) {
          window.location.href = '/auth/login?next=/'
          return
        }

        toast.error(result.error)
        return
      }

      const params = new URLSearchParams()

      params.set('order', result.orderId)

      if (result.mercadoPagoOrderId) {
        params.set(
          'payment',
          result.mercadoPagoOrderId,
        )
      }

      if (result.qrCode) {
        params.set('qr', result.qrCode)
      }

      if (result.qrCodeBase64) {
        params.set(
          'qrBase64',
          result.qrCodeBase64,
        )
      }

      window.location.href =
        `/pagamento?${params.toString()}`
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Erro desconhecido.'

      toast.error(
        `Não foi possível criar o pedido: ${message}`,
      )
    } finally {
      setPending(false)
    }
  }

  if (!product) {
    return (
      <section
        id="planos"
        className="px-4 py-12"
      >
        <div className="mx-auto max-w-md">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
            <h2 className="text-xl font-bold text-white">
              LD CLOUD VIP
            </h2>

            <p className="mt-2 text-sm text-white/60">
              Produto indisponível no momento.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      id="planos"
      className="px-4 py-12"
    >
      <div className="mx-auto max-w-md">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] shadow-2xl">
          <div className="p-6 sm:p-7">

            <div className="text-center">
              <div className="mx-auto inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                MAIS VENDIDO
              </div>

              <h2 className="mt-4 text-2xl font-black tracking-tight text-white">
                LD CLOUD VIP
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/60">
                Tela VIP com ativação por código.
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-4">

                <div>
                  <p className="text-sm font-semibold text-white">
                    Quantidade
                  </p>

                  <p className="mt-1 text-xs text-white/50">
                    De 1 até 500 telas
                  </p>
                </div>

                <div className="flex items-center rounded-xl border border-white/10 bg-white/5">

                  <button
                    type="button"
                    disabled={
                      pending || quantity <= 1
                    }
                    onClick={() =>
                      changeQuantity(quantity - 1)
                    }
                    className="flex h-11 w-11 items-center justify-center text-xl font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    −
                  </button>

                  <input
                    type="text"
                    inputMode="numeric"
                    value={quantityInput}
                    disabled={pending}
                    onChange={(event) => {
                      const value =
                        event.target.value

                      /*
                       * Não usamos Number() aqui.
                       *
                       * Isso é importante para impedir que:
                       *
                       * 5e2 -> 500
                       *
                       * seja convertido automaticamente.
                       */
                      setQuantityInput(value)

                      /*
                       * Só atualiza a quantidade válida
                       * quando o valor digitado está entre
                       * 1 e 500 e é um inteiro.
                       */
                      if (isValidQuantity(value)) {
                        setQuantity(Number(value))
                      }
                    }}
                    onBlur={() => {
                      /*
                       * Se o usuário sair do campo com
                       * valor inválido, volta para a última
                       * quantidade válida.
                       */
                      if (
                        !isValidQuantity(
                          quantityInput,
                        )
                      ) {
                        setQuantityInput(
                          String(quantity),
                        )
                      }
                    }}
                    aria-label="Quantidade de telas"
                    className="h-11 w-16 border-x border-white/10 bg-transparent text-center text-base font-bold text-white outline-none placeholder:text-white/30"
                  />

                  <button
                    type="button"
                    disabled={
                      pending || quantity >= 500
                    }
                    onClick={() =>
                      changeQuantity(quantity + 1)
                    }
                    className="flex h-11 w-11 items-center justify-center text-xl font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    +
                  </button>

                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">

              <button
                type="button"
                disabled={pending}
                onClick={() => changeQuantity(1)}
                className={`rounded-xl border px-3 py-3 text-center transition ${
                  quantity >= 1 && quantity < 5
                    ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300'
                    : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                <span className="block text-sm font-bold">
                  1–4
                </span>

                <span className="mt-1 block text-xs">
                  R$ 35/un
                </span>
              </button>

              <button
                type="button"
                disabled={pending}
                onClick={() => changeQuantity(5)}
                className={`rounded-xl border px-3 py-3 text-center transition ${
                  quantity >= 5 && quantity < 10
                    ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300'
                    : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                <span className="block text-sm font-bold">
                  5–9
                </span>

                <span className="mt-1 block text-xs">
                  R$ 34/un
                </span>
              </button>

              <button
                type="button"
                disabled={pending}
                onClick={() => changeQuantity(10)}
                className={`rounded-xl border px-3 py-3 text-center transition ${
                  quantity >= 10
                    ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300'
                    : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                <span className="block text-sm font-bold">
                  10+
                </span>

                <span className="mt-1 block text-xs">
                  R$ 33/un
                </span>
              </button>

            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">

              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">
                  Valor por tela
                </span>

                <span className="font-semibold text-white">
                  {formatBRL(unitPriceCents)}
                </span>
              </div>

              <div className="mt-3 flex items-end justify-between gap-4">

                <div>
                  <p className="text-xs text-white/50">
                    Total
                  </p>

                  <p className="mt-1 text-3xl font-black tracking-tight text-white">
                    {formatBRL(totalCents)}
                  </p>
                </div>

                <p className="pb-1 text-xs text-white/50">
                  {quantity}{' '}
                  {quantity === 1
                    ? 'tela'
                    : 'telas'}
                </p>

              </div>
            </div>

            <button
              type="button"
              disabled={pending}
              onClick={handleBuy}
              className="mt-5 flex w-full items-center justify-center rounded-2xl bg-cyan-400 px-5 py-4 text-sm font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending
                ? 'CRIANDO PEDIDO...'
                : 'COMPRAR AGORA'}
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-white/40">
              Pagamento via PIX • Entrega automática
              após confirmação.
            </p>

          </div>
        </div>
      </div>
    </section>
  )
}
