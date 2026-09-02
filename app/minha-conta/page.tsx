import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  KeyRound,
  ShoppingBag,
  Ticket,
  Shield,
  ChevronDown,
  PackageCheck,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DashboardNavbar } from '@/components/dashboard/dashboard-navbar'
import { CopyButton } from '@/components/copy-button'
import { CopyAllButton } from '@/components/copy-all-button'
import { StatusBadge } from '@/components/status-badge'
import { createClient } from '@/lib/supabase/server'
import { formatBRL, formatDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

type CodeItem = {
  id: string
  code: string
  user_id: string | null
  order_id: string | null
  status: string
  assigned_at: string | null
  created_at: string
  products:
    | {
        name: string
        screens: number
      }
    | {
        name: string
        screens: number
      }[]
    | null
}

type OrderItem = {
  id: string
  status: string
  quantity: number
  total_cents: number
  created_at: string
  products:
    | {
        name: string
        screens: number
      }
    | {
        name: string
        screens: number
      }[]
    | null
}

export default async function MinhaContaPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?next=/minha-conta')
  }

  // =====================================================
  // PERFIL
  // =====================================================

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, is_admin')
    .eq('id', user.id)
    .single()

  // =====================================================
  // CÓDIGOS
  // =====================================================

  const { data: codes, error: codesError } = await supabase
    .from('activation_codes')
    .select(`
      id,
      code,
      user_id,
      order_id,
      status,
      assigned_at,
      created_at,
      products (
        name,
        screens
      )
    `)
    .eq('user_id', user.id)
    .order('assigned_at', { ascending: false })

  if (codesError) {
    console.error(
      'Erro ao buscar códigos:',
      codesError,
    )
  }

  // =====================================================
  // PEDIDOS
  // =====================================================

  const { data: orders, error: ordersError } =
    await supabase
      .from('orders')
      .select(`
        id,
        status,
        quantity,
        total_cents,
        created_at,
        products (
          name,
          screens
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

  if (ordersError) {
    console.error(
      'Erro ao buscar pedidos:',
      ordersError,
    )
  }

  const codeList = (codes ?? []) as CodeItem[]
  const orderList = (orders ?? []) as OrderItem[]

  const firstName = (
    profile?.full_name ||
    user.email ||
    ''
  ).split(' ')[0]

  const activeCodes = codeList.filter(
    (code) => code.status === 'active',
  ).length

  const oldCodes = codeList.filter(
    (code) => !code.order_id,
  )

  return (
    <div className="flex min-h-dvh flex-col bg-background">

      <DashboardNavbar
        email={profile?.email ?? user.email ?? null}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-5 sm:px-4 sm:py-8">

        {/* ================================================= */}
        {/* CABEÇALHO */}
        {/* ================================================= */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div className="min-w-0">

            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Minha Conta
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Olá
              {firstName ? `, ${firstName}` : ''}! Gerencie seus
              pedidos e códigos.
            </p>

          </div>

          <div className="flex w-full gap-2 sm:w-auto">

            {profile?.is_admin && (
              <Button
                asChild
                variant="secondary"
                size="sm"
                className="flex-1 sm:flex-none"
              >
                <Link href="/admin">
                  <Shield className="size-4" />
                  Admin
                </Link>
              </Button>
            )}

            <Button
              asChild
              size="sm"
              className="flex-1 sm:flex-none"
            >
              <Link href="/#planos">
                Comprar mais
              </Link>
            </Button>

          </div>

        </div>

        {/* ================================================= */}
        {/* RESUMO */}
        {/* ================================================= */}

        <div className="mt-5 grid grid-cols-3 gap-2 sm:mt-6 sm:gap-4">

          <SummaryCard
            icon={Ticket}
            label="Códigos"
            value={codeList.length}
          />

          <SummaryCard
            icon={KeyRound}
            label="Ativos"
            value={activeCodes}
          />

          <SummaryCard
            icon={ShoppingBag}
            label="Pedidos"
            value={orderList.length}
          />

        </div>

        {/* ================================================= */}
        {/* PEDIDOS */}
        {/* ================================================= */}

        <section className="mt-8 sm:mt-10">

          <div>
            <h2 className="text-lg font-semibold sm:text-xl">
              Meus Pedidos
            </h2>

            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Suas compras e códigos recebidos.
            </p>
          </div>

          {orderList.length === 0 ? (

            <div className="mt-4 rounded-xl border border-dashed border-border bg-card/40 p-6 text-center">

              <ShoppingBag className="mx-auto size-8 text-muted-foreground" />

              <p className="mt-3 text-sm text-muted-foreground">
                Nenhum pedido registrado ainda.
              </p>

              <Button
                asChild
                className="mt-4"
                size="sm"
              >
                <Link href="/#planos">
                  Ver planos
                </Link>
              </Button>

            </div>

          ) : (

            <div className="mt-4 space-y-2.5 sm:space-y-3">

              {orderList.map((order) => {

                const product = Array.isArray(
                  order.products,
                )
                  ? order.products[0]
                  : order.products

                const orderCodes = codeList.filter(
                  (code) =>
                    code.order_id === order.id,
                )

                const shortOrderId =
                  order.id
                    .replace(/-/g, '')
                    .slice(0, 8)
                    .toUpperCase()

                const quantity =
                  Number(order.quantity) ||
                  orderCodes.length ||
                  1

                const codesForCopy =
                  orderCodes.map(
                    (code) => code.code,
                  )

                /*
                 * O nome do produto original pode ser
                 * "1 Tela JN TELAS", "5 Telas JN TELAS",
                 * etc.
                 *
                 * Como agora a quantidade é independente,
                 * mostramos a quantidade REAL comprada.
                 */

                const productName =
                  product?.name
                    ?.replace(
                      /^\d+\s*Telas?\s*/i,
                      '',
                    )
                    ?.replace(
                      /^JN TELAS\s*[-·]?\s*/i,
                      '',
                    )
                    ?.trim() ||
                  'LD CLOUD VIP'

                return (
                  <details
                    key={order.id}
                    className="group overflow-hidden rounded-xl border border-border/60 bg-card"
                  >

                    {/* ===================================== */}
                    {/* PEDIDO FECHADO */}
                    {/* ===================================== */}

                    <summary className="flex cursor-pointer list-none items-center gap-3 p-3.5 transition-colors hover:bg-secondary/20 sm:gap-4 sm:p-5">

                      <div className="min-w-0 flex-1">

                        {/* PRIMEIRA LINHA */}

                        <div className="flex flex-wrap items-center gap-2">

                          <span className="text-sm font-bold sm:text-base">
                            #{shortOrderId}
                          </span>

                          <StatusBadge
                            status={order.status}
                            type="order"
                          />

                        </div>

                        {/* SEGUNDA LINHA */}

                        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">

                          <span className="font-medium text-foreground">
                            {quantity}{' '}
                            {quantity === 1
                              ? 'código'
                              : 'códigos'}
                          </span>

                          <span className="text-border">
                            •
                          </span>

                          <span>
                            {formatDate(
                              order.created_at,
                            )}
                          </span>

                        </div>

                        {/* TERCEIRA LINHA */}

                        <div className="mt-1 flex min-w-0 items-center gap-2">

                          <span className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">
                            {productName} · {quantity}{' '}
                            {quantity === 1
                              ? 'tela'
                              : 'telas'}
                          </span>

                          <span className="shrink-0 text-sm font-bold sm:text-base">
                            {formatBRL(
                              order.total_cents,
                            )}
                          </span>

                        </div>

                      </div>

                      {/* ABRIR */}

                      <div className="flex shrink-0 items-center gap-1">

                        <span className="hidden text-xs font-medium text-primary sm:inline">
                          Ver códigos
                        </span>

                        <ChevronDown className="size-5 text-muted-foreground transition-transform group-open:rotate-180" />

                      </div>

                    </summary>

                    {/* ===================================== */}
                    {/* CONTEÚDO */}
                    {/* ===================================== */}

                    <div className="border-t border-border/60 bg-background/20 p-3 sm:p-4">

                      {orderCodes.length === 0 ? (

                        <div className="rounded-lg border border-dashed border-border p-5 text-center">

                          <p className="text-xs text-muted-foreground sm:text-sm">
                            {order.status === 'delivered'
                              ? 'Os códigos deste pedido ainda estão sendo organizados.'
                              : 'Os códigos aparecerão aqui após a confirmação e entrega do pedido.'}
                          </p>

                        </div>

                      ) : (

                        <div>

                          {/* CABEÇALHO */}

                          <div className="mb-3 flex items-center justify-between gap-3">

                            <div className="flex min-w-0 items-center gap-2">

                              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                <PackageCheck className="size-4 text-primary" />
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

                            <CopyAllButton
                              codes={codesForCopy}
                            />

                          </div>

                          {/* CÓDIGOS */}

                          <div className="space-y-2">

                            {orderCodes.map(
                              (code) => (
                                <div
                                  key={code.id}
                                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-card p-2.5 sm:p-3"
                                >

                                  <code className="min-w-0 flex-1 truncate rounded-md bg-secondary px-2 py-1.5 font-mono text-xs font-medium sm:text-sm">
                                    {code.code}
                                  </code>

                                  <StatusBadge
                                    status={
                                      code.status
                                    }
                                    type="code"
                                  />

                                  <CopyButton
                                    value={
                                      code.code
                                    }
                                    className="size-8 shrink-0 px-1.5 sm:size-9"
                                  />

                                </div>
                              ),
                            )}

                          </div>

                        </div>

                      )}

                    </div>

                  </details>
                )
              })}

            </div>

          )}

        </section>

        {/* ================================================= */}
        {/* OUTROS CÓDIGOS */}
        {/* ================================================= */}

        {oldCodes.length > 0 && (

          <section className="mt-8 sm:mt-10">

            <h2 className="text-lg font-semibold sm:text-xl">
              Outros Códigos
            </h2>

            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Códigos adquiridos antes da organização por pedidos.
            </p>

            <div className="mt-4 space-y-2">

              {oldCodes.map((code) => {

                const product =
                  Array.isArray(code.products)
                    ? code.products[0]
                    : code.products

                return (
                  <div
                    key={code.id}
                    className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-3"
                  >

                    <div className="min-w-0 flex-1">

                      <div className="flex min-w-0 items-center gap-2">

                        <code className="min-w-0 flex-1 truncate rounded-md bg-secondary px-2 py-1.5 font-mono text-xs sm:text-sm">
                          {code.code}
                        </code>

                        <StatusBadge
                          status={code.status}
                          type="code"
                        />

                      </div>

                      <p className="mt-1.5 truncate text-[11px] text-muted-foreground sm:text-xs">
                        {product?.name ?? 'Plano'} · Adquirido em{' '}
                        {formatDate(
                          code.assigned_at ??
                            code.created_at,
                        )}
                      </p>

                    </div>

                    <CopyButton
                      value={code.code}
                      className="size-8 shrink-0 px-1.5 sm:size-9"
                    />

                  </div>
                )
              })}

            </div>

          </section>

        )}

      </main>
    </div>
  )
}

// =====================================================
// CARDS DE RESUMO
// =====================================================

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{
    className?: string
  }>
  label: string
  value: number
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border/60 bg-card px-2.5 py-3 sm:gap-4 sm:p-4">

      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:size-11">
        <Icon className="size-4 sm:size-5" />
      </div>

      <div className="min-w-0">

        <p className="text-xl font-bold leading-none sm:text-2xl">
          {value}
        </p>

        <p className="mt-1 truncate text-[10px] text-muted-foreground sm:text-sm">
          {label}
        </p>

      </div>

    </div>
  )
}
