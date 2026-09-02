import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  KeyRound,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { CopyButton } from '@/components/copy-button'
import { CopyAllButton } from '@/components/copy-all-button'

type ActivationCode = {
  id: string
  code: string
  status: string
  created_at: string
  assigned_at: string | null
  order_id: string | null
  product: {
    name: string
  } | null
}

type Order = {
  id: string
  status: string
  total_cents: number
  quantity: number
  created_at: string
  product: {
    name: string
  } | null
  activation_codes: {
    id: string
    code: string
    status: string
    assigned_at: string | null
  }[]
}

function formatBRL(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function shortId(id: string) {
  return id.replaceAll('-', '').slice(0, 8).toUpperCase()
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'delivered':
      return 'Entregue'

    case 'paid':
      return 'Pago'

    case 'pending':
      return 'Aguardando pagamento'

    case 'cancelled':
    case 'canceled':
      return 'Cancelado'

    default:
      return status
  }
}

function getStatusClasses(status: string) {
  switch (status) {
    case 'delivered':
    case 'paid':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'

    case 'pending':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20'

    case 'cancelled':
    case 'canceled':
      return 'bg-red-500/10 text-red-600 border-red-500/20'

    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

function normalizeProductName(name: string | null | undefined) {
  const normalized =
    name
      ?.replace(/^\d+\s*Telas?\s*/i, '')
      ?.replace(/^JN TELAS\s*[-·]?\s*/i, '')
      ?.trim()

  return normalized || 'LD CLOUD VIP'
}

export default async function MinhaContaPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: profile }, { data: activationCodes }, { data: orders }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .maybeSingle(),

      supabase
        .from('activation_codes')
        .select(
          `
            id,
            code,
            status,
            created_at,
            assigned_at,
            order_id,
            product:products (
              name
            )
          `,
        )
        .eq('user_id', user.id)
        .order('assigned_at', { ascending: false }),

      supabase
        .from('orders')
        .select(
          `
            id,
            status,
            total_cents,
            quantity,
            created_at,
            product:products (
              name
            ),
            activation_codes (
              id,
              code,
              status,
              assigned_at
            )
          `,
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])

  const codes = (activationCodes ?? []) as unknown as ActivationCode[]
  const userOrders = (orders ?? []) as unknown as Order[]

  const deliveredCodes = codes.filter(
    (code) => code.order_id !== null,
  )

  const oldCodes = codes.filter(
    (code) => code.order_id === null,
  )

  const totalCodes = codes.length

  const activeCodes = codes.filter(
    (code) => code.status === 'active',
  ).length

  const firstName =
    profile?.full_name?.split(' ')[0] ||
    user.email?.split('@')[0] ||
    'Cliente'

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
        {/* HEADER */}
        <header className="mb-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              Minha conta
            </p>

            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
              Olá, {firstName} 👋
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/"
              className="hidden rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted sm:block"
            >
              Comprar
            </Link>

            <Link
              href="/admin"
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted"
            >
              Admin
            </Link>
          </div>
        </header>

        {/* RESUMO */}
        <section className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
            <div className="mb-2 flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <KeyRound className="size-4" />
            </div>

            <p className="text-xl font-bold leading-none sm:text-2xl">
              {totalCodes}
            </p>

            <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
              Códigos
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
            <div className="mb-2 flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <ShieldCheck className="size-4" />
            </div>

            <p className="text-xl font-bold leading-none sm:text-2xl">
              {activeCodes}
            </p>

            <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
              Ativos
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
            <div className="mb-2 flex size-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <ShoppingBag className="size-4" />
            </div>

            <p className="text-xl font-bold leading-none sm:text-2xl">
              {userOrders.length}
            </p>

            <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
              Pedidos
            </p>
          </div>
        </section>

        {/* AÇÃO PRINCIPAL */}
        <div className="mb-6">
          <Link
            href="/"
            className="flex w-full items-center justify-between rounded-2xl border border-primary/20 bg-primary px-4 py-3.5 text-primary-foreground shadow-sm transition hover:opacity-95"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground/15">
                <ShoppingBag className="size-4" />
              </div>

              <div className="text-left">
                <p className="text-sm font-semibold">
                  Comprar mais telas
                </p>
                <p className="text-xs text-primary-foreground/75">
                  Adicione novos códigos à sua conta
                </p>
              </div>
            </div>

            <ChevronRight className="size-5" />
          </Link>
        </div>

        {/* PEDIDOS */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold sm:text-lg">
                Meus pedidos
              </h2>

              <p className="text-xs text-muted-foreground sm:text-sm">
                Seus pedidos e códigos entregues
              </p>
            </div>

            <PackageCheck className="size-5 text-muted-foreground" />
          </div>

          {userOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
              <PackageCheck className="mx-auto mb-3 size-8 text-muted-foreground" />

              <p className="font-semibold">
                Nenhum pedido ainda
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Quando você comprar, seus pedidos aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {userOrders.map((order) => {
                const quantity =
                  order.quantity ||
                  order.activation_codes?.length ||
                  1

                const productName = normalizeProductName(
                  order.product?.name,
                )

                const orderCodes = order.activation_codes ?? []

                return (
                  <details
                    key={order.id}
                    className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                  >
                    <summary className="cursor-pointer list-none p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold tracking-wide">
                              #{shortId(order.id)}
                            </span>

                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusClasses(
                                order.status,
                              )}`}
                            >
                              {getStatusLabel(order.status)}
                            </span>

                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {quantity}{' '}
                              {quantity === 1
                                ? 'código'
                                : 'códigos'}
                            </span>
                          </div>

                          <p className="truncate text-sm font-semibold">
                            {productName} · {quantity}{' '}
                            {quantity === 1 ? 'tela' : 'telas'}
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span>
                              {formatDate(order.created_at)}
                            </span>

                            <span>•</span>

                            <span className="font-medium text-foreground">
                              {formatBRL(order.total_cents)}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2 pt-1">
                          <span className="hidden text-xs font-medium text-muted-foreground sm:block">
                            Ver códigos
                          </span>

                          <ChevronDown className="size-5 text-muted-foreground transition-transform group-open:rotate-180" />
                        </div>
                      </div>
                    </summary>

                    {/* CÓDIGOS DO PEDIDO */}
                    <div className="border-t border-border bg-muted/20 p-3 sm:p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <KeyRound className="size-4" />
                          </div>

                          <div className="min-w-0">
                            <p className="text-sm font-semibold">
                              Códigos deste pedido
                            </p>

                            <p className="text-[11px] text-muted-foreground">
                              {orderCodes.length}{' '}
                              {orderCodes.length === 1
                                ? 'código'
                                : 'códigos'}
                            </p>
                          </div>
                        </div>

                        {orderCodes.length > 0 && (
                          <div className="shrink-0">
                            <CopyAllButton
                              codes={orderCodes.map(
                                (item) => item.code,
                              )}
                            />
                          </div>
                        )}
                      </div>

                      {orderCodes.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-background p-4 text-center text-sm text-muted-foreground">
                          Os códigos deste pedido ainda não
                          foram vinculados.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {orderCodes.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-xl border border-border bg-background p-3"
                            >
                              <div className="flex items-center gap-3">
                                {/* CÓDIGO */}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-mono text-sm font-semibold tracking-wide">
                                    {item.code}
                                  </p>
                                </div>

                                {/* STATUS + COPIAR */}
                                <div className="flex shrink-0 items-center gap-4">
                                  <span className="whitespace-nowrap text-[10px] font-semibold text-emerald-600">
                                    Ativo
                                  </span>

                                  <CopyButton code={item.code} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                )
              })}
            </div>
          )}
        </section>

        {/* CÓDIGOS ANTIGOS */}
        {oldCodes.length > 0 && (
          <section className="mt-7">
            <div className="mb-3">
              <h2 className="text-base font-bold sm:text-lg">
                Outros códigos
              </h2>

              <p className="text-xs text-muted-foreground sm:text-sm">
                Códigos adicionados anteriormente
              </p>
            </div>

            <div className="space-y-2">
              {oldCodes.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border bg-card p-3 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-sm font-semibold">
                        {item.code}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-4">
                      <span className="whitespace-nowrap text-[10px] font-semibold text-emerald-600">
                        Ativo
                      </span>

                      <CopyButton code={item.code} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* RODAPÉ */}
        <footer className="mt-8 border-t border-border pt-5 text-center">
          <p className="text-[11px] text-muted-foreground">
            Seus códigos ficam vinculados à sua conta.
          </p>
        </footer>
      </div>
    </main>
  )
}
