import { redirect } from 'next/navigation'

import { DashboardNavbar } from '@/components/dashboard/dashboard-navbar'
import { AdminDashboard } from '@/components/admin/admin-dashboard'
import { AdminAuditLog } from '@/components/admin/admin-audit-log'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?next=/admin')
  }

  const { data: profile, error: profileError } =
    await supabase
      .from('profiles')
      .select('is_admin, email, full_name')
      .eq('id', user.id)
      .maybeSingle()

  if (profileError) {
    console.error('Erro ao verificar administrador:', profileError)
    redirect('/minha-conta')
  }

  if (profile?.is_admin !== true) {
    redirect('/minha-conta')
  }

  const admin = createAdminClient()

  const [
    profilesResult,
    codesResult,
    ordersResult,
    productsResult,
    auditLogsResult,
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('id, email, full_name, created_at')
      .order('created_at', { ascending: false }),

    admin
      .from('activation_codes')
      .select('id, code, status, created_at, assigned_at, user_id, product_id, order_id')
      .order('created_at', { ascending: false }),

    admin
      .from('orders')
      .select('id, status, total_cents, quantity, created_at, user_id, product_id')
      .order('created_at', { ascending: false }),

    admin
      .from('products')
      .select('id, name')
      .order('name', { ascending: true }),

    admin
      .from('admin_audit_logs')
      .select('id, action, entity_type, entity_id, description, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (profilesResult.error) {
    console.error('Erro ao carregar clientes:', profilesResult.error)
  }

  if (codesResult.error) {
    console.error('Erro ao carregar códigos:', codesResult.error)
  }

  if (ordersResult.error) {
    console.error('Erro ao carregar pedidos:', ordersResult.error)
  }

  if (productsResult.error) {
    console.error('Erro ao carregar produtos:', productsResult.error)
  }

  if (auditLogsResult.error) {
    console.error('Erro ao carregar histórico administrativo:', auditLogsResult.error)
  }

  const profiles = profilesResult.data ?? []
  const codes = codesResult.data ?? []
  const orders = ordersResult.data ?? []
  const products = productsResult.data ?? []
  const auditLogs = auditLogsResult.data ?? []

  const profileMap = new Map(
    profiles.map((profile) => [profile.id, profile]),
  )

  const productMap = new Map(
    products.map((product) => [product.id, product]),
  )

  const completedOrders = orders.filter(
    (order) =>
      order.status === 'paid' ||
      order.status === 'delivered',
  )

  const salesSummary = {
    revenueCents: completedOrders.reduce(
      (total, order) => total + (order.total_cents ?? 0),
      0,
    ),
    orders: orders.length,
    completedOrders: completedOrders.length,
    codesSold: completedOrders.reduce(
      (total, order) => total + (order.quantity ?? 0),
      0,
    ),
    availableStock: codes.filter(
      (code) => code.status === 'active' && !code.user_id,
    ).length,
    recentSales: completedOrders.slice(0, 5).map((order) => ({
      id: order.id,
      status: order.status,
      total_cents: order.total_cents,
      quantity: order.quantity ?? 0,
      created_at: order.created_at,
      userEmail: profileMap.get(order.user_id ?? '')?.email ?? null,
      productName: productMap.get(order.product_id ?? '')?.name ?? null,
    })),
  }

  const customers = profiles.map((customer) => ({
    id: customer.id,
    email: customer.email ?? null,
    full_name: customer.full_name ?? null,
    created_at: customer.created_at,
    codeCount: codes.filter((code) => code.user_id === customer.id).length,
    orderCount: orders.filter((order) => order.user_id === customer.id).length,
  }))

  const adminCodes = codes.map((code) => {
    const customer = code.user_id ? profileMap.get(code.user_id) : null
    const product = code.product_id ? productMap.get(code.product_id) : null

    return {
      id: code.id,
      code: code.code,
      status: code.status,
      created_at: code.created_at,
      assigned_at: code.assigned_at ?? null,
      user_id: code.user_id ?? null,
      userEmail: customer?.email ?? null,
      productName: product?.name ?? null,
      productId: code.product_id ?? null,
      orderId: code.order_id ?? null,
    }
  })

  const adminOrders = orders.map((order) => {
    const customer = order.user_id ? profileMap.get(order.user_id) : null
    const product = order.product_id ? productMap.get(order.product_id) : null

    const orderCodes = codes
      .filter((code) => code.order_id === order.id)
      .map((code) => ({
        id: code.id,
        code: code.code,
        status: code.status,
        created_at: code.created_at,
        assigned_at: code.assigned_at ?? null,
      }))

    return {
      id: order.id,
      status: order.status,
      total_cents: order.total_cents,
      quantity: order.quantity ?? orderCodes.length,
      created_at: order.created_at,
      userId: order.user_id ?? null,
      userEmail: customer?.email ?? null,
      userName: customer?.full_name ?? null,
      productName: product?.name ?? null,
      productId: order.product_id ?? null,
      codes: orderCodes,
    }
  })

  const productOptions = products.map((product) => ({
    id: product.id,
    name: product.name,
  }))

  const customerOptions = profiles
    .filter(
      (customer) =>
        customer.id !== user.id || customer.email || customer.full_name,
    )
    .map((customer) => ({
      id: customer.id,
      label: customer.email ?? customer.full_name ?? customer.id,
    }))

  return (
    <div className="min-h-dvh bg-background">
      <DashboardNavbar
        user={{
          email: user.email ?? profile.email ?? null,
        }}
      />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            Painel Administrativo
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie clientes, códigos, estoque e pedidos.
          </p>
        </div>

        <section className="mb-8">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Resumo de vendas</h2>
              <p className="text-sm text-muted-foreground">
                Visão geral baseada nos pedidos e códigos atuais.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-border/60 bg-card p-5">
              <p className="text-sm text-muted-foreground">Faturamento</p>
              <p className="mt-2 text-2xl font-bold">
                R$ {(salesSummary.revenueCents / 100).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pedidos pagos/entregues
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-5">
              <p className="text-sm text-muted-foreground">Pedidos</p>
              <p className="mt-2 text-2xl font-bold">{salesSummary.orders}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Total registrados
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-5">
              <p className="text-sm text-muted-foreground">Pagamentos concluídos</p>
              <p className="mt-2 text-2xl font-bold text-emerald-500">
                {salesSummary.completedOrders}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pagamentos ou entregas confirmadas
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-5">
              <p className="text-sm text-muted-foreground">Códigos vendidos</p>
              <p className="mt-2 text-2xl font-bold">{salesSummary.codesSold}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Quantidade dos pedidos concluídos
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-5">
              <p className="text-sm text-muted-foreground">Estoque disponível</p>
              <p className="mt-2 text-2xl font-bold text-primary">
                {salesSummary.availableStock}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Códigos ativos sem cliente
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border/60 bg-card">
            <div className="border-b border-border/60 px-5 py-4">
              <h3 className="font-semibold">Vendas recentes</h3>
            </div>

            {salesSummary.recentSales.length === 0 ? (
              <div className="px-5 py-6 text-sm text-muted-foreground">
                Nenhuma venda concluída registrada.
              </div>
            ) : (
              <div className="divide-y">
                {salesSummary.recentSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {sale.userEmail ?? 'Cliente não identificado'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sale.quantity} código(s)
                        {sale.productName ? ` • ${sale.productName}` : ''}
                        {' • '}
                        {new Date(sale.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-600">
                        {sale.status === 'delivered' ? 'ENTREGUE' : 'PAGO'}
                      </span>
                      <span className="text-sm font-bold">
                        R$ {(sale.total_cents / 100).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <AdminAuditLog logs={auditLogs} />

        <AdminDashboard
          customers={customers}
          codes={adminCodes}
          orders={adminOrders}
          productOptions={productOptions}
          customerOptions={customerOptions}
        />
      </main>
    </div>
  )
}
