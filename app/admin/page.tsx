import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DashboardNavbar } from '@/components/dashboard/dashboard-navbar'
import { AdminDashboard } from '@/components/admin/admin-dashboard'

export type AdminCustomer = {
  id: string
  email: string | null
  full_name: string | null
  created_at: string
  codeCount: number
  orderCount: number
}

export type AdminCode = {
  id: string
  code: string
  status: string
  created_at: string
  assigned_at: string | null
  user_id: string | null
  userEmail: string | null
  productName: string | null
  productId: string | null
}

export type AdminOrder = {
  id: string
  status: string
  total_cents: number
  created_at: string
  userEmail: string | null
  productName: string | null
}

export type AdminProductOption = {
  id: string
  name: string
}

export default async function AdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?next=/admin')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, email')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    redirect('/minha-conta')
  }

  const admin = createAdminClient()

  const profilesResult = await admin
    .from('profiles')
    .select('id, email, full_name, created_at')
    .order('created_at', { ascending: false })

  const codesResult = await admin
    .from('activation_codes')
    .select(
      'id, code, status, created_at, assigned_at, user_id, products(id, name)',
    )
    .order('created_at', { ascending: false })

  const ordersResult = await admin
    .from('orders')
    .select(
      'id, status, total_cents, created_at, user_id, products(name)',
    )
    .order('created_at', { ascending: false })

  const productsResult = await admin
    .from('products')
    .select('id, name')
    .order('screens', { ascending: true })

  const profileList = profilesResult.data ?? []
  const codeList = codesResult.data ?? []
  const orderList = ordersResult.data ?? []
  const productList = productsResult.data ?? []

  /*
   * Mapa dos clientes.
   *
   * O user_id dos códigos/pedidos aponta para profiles.id.
   * Assim conseguimos mostrar o e-mail do cliente sem
   * depender de relacionamento automático do Supabase.
   */
  const emailById = new Map<string, string | null>()

  const nameById = new Map<string, string | null>()

  for (const profile of profileList) {
    emailById.set(profile.id, profile.email ?? null)
    nameById.set(profile.id, profile.full_name ?? null)
  }

  const customers: AdminCustomer[] = profileList.map((profile) => ({
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    created_at: profile.created_at,

    codeCount: codeList.filter(
      (code) => code.user_id === profile.id,
    ).length,

    orderCount: orderList.filter(
      (order) => order.user_id === profile.id,
    ).length,
  }))

  const adminCodes: AdminCode[] = codeList.map((code) => {
    const product = Array.isArray(code.products)
      ? code.products[0]
      : code.products

    const userEmail = code.user_id
      ? emailById.get(code.user_id) ?? null
      : null

    return {
      id: code.id,
      code: code.code,
      status: code.status,
      created_at: code.created_at,
      assigned_at: code.assigned_at,
      user_id: code.user_id,

      userEmail,

      productName: product?.name ?? null,

      productId: product?.id ?? null,
    }
  })

  const adminOrders: AdminOrder[] = orderList.map((order) => {
    const product = Array.isArray(order.products)
      ? order.products[0]
      : order.products

    const userEmail = order.user_id
      ? emailById.get(order.user_id) ?? null
      : null

    return {
      id: order.id,
      status: order.status,
      total_cents: order.total_cents,
      created_at: order.created_at,

      userEmail,

      productName: product?.name ?? null,
    }
  })

  const productOptions: AdminProductOption[] =
    productList.map((product) => ({
      id: product.id,
      name: product.name,
    }))

  const customerOptions = customers.map((customer) => ({
    id: customer.id,

    label:
      customer.email ??
      customer.full_name ??
      customer.id,
  }))

  return (
    <div className="flex min-h-dvh flex-col bg-background">

      <DashboardNavbar
        email={
          profile.email ??
          user.email ??
          null
        }
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">

        <div className="mb-6">

          <h1 className="text-2xl font-bold tracking-tight">
            Painel Administrativo
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie clientes, códigos de ativação e pedidos.
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
