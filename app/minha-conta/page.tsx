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
  quantity: number
  status: string
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
  // CÓDIGOS DO USUÁRIO
  // =====================================================

  const { data: codes, error: codesError } =
    await supabase
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
      .order('assigned_at', {
        ascending: false,
      })

  if (codesError) {
    console.error(
      'Erro ao buscar códigos:',
      codesError,
    )
  }

  // =====================================================
  // PEDIDOS DO USUÁRIO
  // =====================================================

  const { data: orders, error: ordersError } =
    await supabase
      .from('orders')
      .select(`
        id,
        quantity,
        status,
        total_cents,
        created_at,
        products (
          name,
          screens
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', {
        ascending: false,
      })

  if (ordersError) {
    console.error(
      'Erro ao buscar pedidos:',
      ordersError,
    )
  }

  const codeList =
    (codes ?? []) as CodeItem[]

  const orderList =
    (orders ?? []) as OrderItem[]

  const firstName = (
    profile?.full_name ||
    user.email ||
    ''
  ).split(' ')[0]

  const activeCodes =
    codeList.filter(
      (code) => code.status === 'active',
    ).length

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <DashboardNavbar
        email={
          profile?.email ??
          user.email ??
          null
        }
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">

        {/* ================================================= */}
        {/* CABEÇALHO */}
        {/* ================================================= */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Minha Conta
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Olá
              {firstName
                ? `, ${firstName}`
                : ''}! Gerencie seus pedidos e códigos aqui.
            </p>
          </div>

          <div className="flex gap-2">

            {profile?.is_admin && (
              <Button
                asChild
                variant="secondary"
                size="sm"
              >
                <Link href="/admin">
                  <Shield className="size-4" />
                  Painel Admin
                </Link>
              </Button>
            )}

            <Button
              asChild
              size="sm"
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

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">

          <SummaryCard
            icon={Ticket}
            label="Códigos"
            value={codeList.length}
          />

          <SummaryCard
            icon={KeyRound}
            label="Códigos ativos"
            value={activeCodes}
          />

          <SummaryCard
            icon={ShoppingBag}
            label="Pedidos"
            value={orderList.length}
          />

        </div>

        {/* ================================================= */}
        {/* MEUS PEDIDOS */}
        {/* ================================================= */}

        <section className="mt-10">

          <h2 className="text-lg font-semibold">
            Meus Pedidos
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Visualize suas compras e os códigos recebidos em cada pedido.
          </p>

          {orderList.length === 0 ? (

            <div className="mt-4 rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">

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

            <div className="mt-4 space-y-4">

              {orderList.map((order) => {

                const product =
                  Array.isArray(order.products)
                    ? order.products[0]
                    : order.products

                const orderCodes =
                  codeList.filter(
                    (code) =>
                      code.order_id === order.id,
                  )

                const shortOrderId =
                  order.id
                    .replace(/-/g, '')
                    .slice(0, 8)
                    .toUpperCase()

                /*
                 * A quantidade vem diretamente do pedido.
                 *
                 * Para pedidos antigos que não tenham
                 * quantidade válida, usamos a quantidade
                 * de códigos encontrados como fallback.
                 */
                const quantity =
                  Number(order.quantity) ||
                  orderCodes.length ||
                  1

                const quantityLabel =
                  `${quantity} ${
                    quantity === 1
                      ? 'tela'
                      : 'telas'
                  }`

                const allCodes =
                  orderCodes.map(
                    (code) => code.code,
                  )

                return (
                  <details
                    key={order.id}
                    className="group overflow-hidden rounded-xl border border-border/60 bg-card"
                  >

                    {/* ===================================== */}
                    {/* CABEÇALHO DO PEDIDO */}
                    {/* ===================================== */}

                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 transition hover:bg-secondary/20">

                      <div className="min-w-0">

                        <div className="flex flex-wrap items-center gap-3">

                          <span className="font-semibold">
                            Pedido #{shortOrderId}
                          </span>

                          <StatusBadge
                            status={order.status}
                            type="order"
                          />

                          <span className="text-sm text-muted-foreground">
                            ({orderCodes.length}{' '}
                            {orderCodes.length === 1
                              ? 'código'
                              : 'códigos'})
                          </span>

                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">

                          <span>
                            {formatDate(
                              order.created_at,
                            )}
                          </span>

                          <span>
                            Plano:{' '}
                            <strong className="font-medium text-foreground">
                              LD CLOUD VIP ·{' '}
                              {quantityLabel}
                            </strong>
                          </span>

                          <span>
                            Total:{' '}
                            <strong className="font-medium text-foreground">
                              {formatBRL(
                                order.total_cents,
                              )}
                            </strong>
                          </span>

                        </div>

                      </div>

                      <div className="flex shrink-0 items-center gap-2">

                        <span className="hidden text-sm font-medium sm:inline">
                          Visualizar códigos
                        </span>

                        <ChevronDown className="size-5 transition-transform group-open:rotate-180" />

                      </div>

                    </summary>

                    {/* ===================================== */}
                    {/* CÓDIGOS DO PEDIDO */}
                    {/* ===================================== */}

                    <div className="border-t border-border/60 bg-background/30 p-4">

                      {orderCodes.length === 0 ? (

                        <div className="rounded-lg border border-dashed border-border p-5 text-center">

                          <p className="text-sm text-muted-foreground">
                            {order.status === 'delivered'
                              ? 'Os códigos deste pedido ainda estão sendo organizados.'
                              : 'Os códigos aparecerão aqui após a confirmação e entrega do pedido.'}
                          </p>

                        </div>

                      ) : (

                        <div className="space-y-3">

                          {/* CABEÇALHO DOS CÓDIGOS */}

                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                            <div className="flex items-center gap-2 text-sm font-medium">
                              <PackageCheck className="size-4 text-primary" />
                              Códigos deste pedido
                            </div>

                            {orderCodes.length > 1 && (
                              <CopyAllButton
                                codes={allCodes}
                              />
                            )}

                          </div>

                          {/* LISTA DE CÓDIGOS */}

                          {orderCodes.map(
                            (code) => (
                              <div
                                key={code.id}
                                className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                              >

                                <div className="min-w-0">

                                  <div className="flex flex-wrap items-center gap-2">

                                    <code className="rounded-md bg-secondary px-2 py-1 font-mono text-sm">
                                      {code.code}
                                    </code>

                                    <StatusBadge
                                      status={
                                        code.status
                                      }
                                      type="code"
                                    />

                                  </div>

                                  <p className="mt-2 text-xs text-muted-foreground">
                                    Código adquirido neste pedido
                                  </p>

                                </div>

                                <CopyButton
                                  value={
                                    code.code
                                  }
                                  className="shrink-0"
                                />

                              </div>
                            ),
                          )}

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
        {/* CÓDIGOS ANTIGOS SEM PEDIDO */}
        {/* ================================================= */}

        {codeList.filter(
          (code) => !code.order_id,
        ).length > 0 && (

          <section className="mt-10">

            <h2 className="text-lg font-semibold">
              Outros Códigos
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Códigos adquiridos antes da organização por pedidos.
            </p>

            <div className="mt-4 space-y-3">

              {codeList
                .filter(
                  (code) => !code.order_id,
                )
                .map((code) => {

                  const product =
                    Array.isArray(
                      code.products,
                    )
                      ? code.products[0]
                      : code.products

                  return (
                    <div
                      key={code.id}
                      className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                    >

                      <div className="min-w-0">

                        <div className="flex items-center gap-2">

                          <code className="truncate rounded-md bg-secondary px-2 py-1 font-mono text-sm">
                            {code.code}
                          </code>

                          <StatusBadge
                            status={
                              code.status
                            }
                            type="code"
                          />

                        </div>

                        <p className="mt-1.5 text-xs text-muted-foreground">

                          {product?.name ??
                            'Plano'}{' '}
                          · Adquirido em{' '}

                          {formatDate(
                            code.assigned_at ??
                              code.created_at,
                          )}

                        </p>

                      </div>

                      <CopyButton
                        value={code.code}
                        className="shrink-0 self-start sm:self-auto"
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
    <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4">

      <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>

      <div>

        <p className="text-2xl font-bold">
          {value}
        </p>

        <p className="text-sm text-muted-foreground">
          {label}
        </p>

      </div>

    </div>
  )
}
