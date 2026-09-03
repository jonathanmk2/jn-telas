import { redirect } from 'next/navigation'

import { DashboardNavbar } from '@/components/dashboard/dashboard-navbar'
import { AdminDashboard } from '@/components/admin/admin-dashboard'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  /*
   * =========================================================
   * PROTEÇÃO DO PAINEL ADMIN
   * =========================================================
   *
   * Primeiro verifica se existe usuário autenticado.
   * Depois verifica se esse usuário possui is_admin = true.
   *
   * Essa proteção acontece no servidor.
   */

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
    console.error(
      'Erro ao verificar administrador:',
      profileError,
    )

    redirect('/minha-conta')
  }

  if (profile?.is_admin !== true) {
    redirect('/minha-conta')
  }

  /*
   * =========================================================
   * CLIENT ADMINISTRATIVO
   * =========================================================
   *
   * Os dados administrativos são carregados usando
   * createAdminClient().
   *
   * Não alteramos RLS nem permissões do cliente comum.
   */

  const admin = createAdminClient()

  const [
    profilesResult,
    codesResult,
    ordersResult,
    productsResult,
  ] = await Promise.all([
    admin
      .from('profiles')
      .select(
        'id, email, full_name, created_at',
      )
      .order('created_at', {
        ascending: false,
      }),

    admin
      .from('activation_codes')
      .select(
        'id, code, status, created_at, assigned_at, user_id, product_id',
      )
      .order('created_at', {
        ascending: false,
      }),

    admin
      .from('orders')
      .select(
        'id, status, total_cents, created_at, user_id, product_id',
      )
      .order('created_at', {
        ascending: false,
      }),

    admin
      .from('products')
      .select('id, name')
      .order('name', {
        ascending: true,
      }),
  ])

  if (profilesResult.error) {
    console.error(
      'Erro ao carregar clientes:',
      profilesResult.error,
    )
  }

  if (codesResult.error) {
    console.error(
      'Erro ao carregar códigos:',
      codesResult.error,
    )
  }

  if (ordersResult.error) {
    console.error(
      'Erro ao carregar pedidos:',
      ordersResult.error,
    )
  }

  if (productsResult.error) {
    console.error(
      'Erro ao carregar produtos:',
      productsResult.error,
    )
  }

  const profiles = profilesResult.data ?? []
  const codes = codesResult.data ?? []
  const orders = ordersResult.data ?? []
  const products = productsResult.data ?? []

  /*
   * =========================================================
   * MAPAS AUXILIARES
   * =========================================================
   */

  const profileMap = new Map(
    profiles.map((profile) => [
      profile.id,
      profile,
    ]),
  )

  const productMap = new Map(
    products.map((product) => [
      product.id,
      product,
    ]),
  )

  /*
   * =========================================================
   * CLIENTES
   * =========================================================
   */

  const customers = profiles.map(
    (customer) => ({
      id: customer.id,
      email: customer.email ?? null,
      full_name: customer.full_name ?? null,
      created_at: customer.created_at,
      codeCount: codes.filter(
        (code) =>
          code.user_id === customer.id,
      ).length,
      orderCount: orders.filter(
        (order) =>
          order.user_id === customer.id,
      ).length,
    }),
  )

  /*
   * =========================================================
   * CÓDIGOS
   * =========================================================
   */

  const adminCodes = codes.map(
    (code) => {
      const customer = code.user_id
        ? profileMap.get(code.user_id)
        : null

      const product = code.product_id
        ? productMap.get(code.product_id)
        : null

      return {
        id: code.id,
        code: code.code,
        status: code.status,
        created_at: code.created_at,
        assigned_at:
          code.assigned_at ?? null,
        user_id: code.user_id ?? null,
        userEmail:
          customer?.email ?? null,
        productName:
          product?.name ?? null,
        productId:
          code.product_id ?? null,
      }
    },
  )

  /*
   * =========================================================
   * PEDIDOS
   * =========================================================
   */

  const adminOrders = orders.map(
    (order) => {
      const customer = order.user_id
        ? profileMap.get(order.user_id)
        : null

      const product = order.product_id
        ? productMap.get(order.product_id)
        : null

      return {
        id: order.id,
        status: order.status,
        total_cents: order.total_cents,
        created_at: order.created_at,
        userEmail:
          customer?.email ?? null,
        productName:
          product?.name ?? null,
      }
    },
  )

  /*
   * =========================================================
   * OPÇÕES DE PRODUTOS
   * =========================================================
   */

  const productOptions = products.map(
    (product) => ({
      id: product.id,
      name: product.name,
    }),
  )

  /*
   * =========================================================
   * OPÇÕES DE CLIENTES
   * =========================================================
   */

  const customerOptions = profiles
    .filter(
      (customer) =>
        customer.id !== user.id ||
        customer.email ||
        customer.full_name,
    )
    .map((customer) => ({
      id: customer.id,
      label:
        customer.email ??
        customer.full_name ??
        customer.id,
    }))

  /*
   * =========================================================
   * PAINEL
   * =========================================================
   */

  return (
    <div className="min-h-dvh bg-background">
      <DashboardNavbar
        user={{
          email:
            user.email ??
            profile.email ??
            null,
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
