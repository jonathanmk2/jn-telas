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

  const [
    { data: profiles },
    { data: codes },
    { data: orders },
    { data: products },
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('id, email, full_name, created_at')
      .order('created_at', { ascending: false }),

    admin
      .from('activation_codes')
      .select(`
        id,
        code,
        status,
        created_at,
        assigned_at,
        user_id,
        profiles (
          id,
          email,
          full_name
        ),
        products (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false }),

    admin
      .from('orders')
      .select(`
        id,
        status,
        total_cents,
        created_at,
        user_id,
        profiles (
          id,
          email,
          full_name
        ),
        products (
          name
        )
      `)
      .order('created_at', { ascending: false }),

    admin
      .from('products')
      .select('id, name')
      .order('screens', { ascending: true }),
  ])

  const profileList = profiles ?? []
  const codeList = codes ?? []
  const orderList = orders ?? []

  const customers: AdminCustomer[] = profileList.map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    created_at: p.created_at,
    codeCount: codeList.filter(
      (c) => c.user_id === p.id,
    ).length,
    orderCount: orderList.filter(
      (o) => o.user_id === p.id,
    ).length,
  }))

  const adminCodes: AdminCode[] = codeList.map((c) => {
    const product = Array.isArray(c.products)
      ? c.products[0]
      : c.products

    const customer = Array.isArray(c.profiles)
      ? c.profiles[0]
      : c.profiles

    return {
      id: c.id,
      code: c.code,
      status: c.status,
      created_at: c.created_at,
      assigned_at: c.assigned_at,
      user_id: c.user_id,

      userEmail:
        customer?.email ??
        null,

      productName:
        product?.name ??
        null,

      productId:
        product?.id ??
        null,
    }
  })

  const adminOrders: AdminOrder[] = orderList.map((o) => {
    const product = Array.isArray(o.products)
      ? o.products[0]
      : o.products

    const customer = Array.isArray(o.profiles)
      ? o.profiles[0]
      : o.profiles

    return {
      id: o.id,
      status: o.status,
      total_cents: o.total_cents,
      created_at: o.created_at,

      userEmail:
        customer?.email ??
        null,

      productName:
        product?.name ??
        null,
    }
  })

  const productOptions: AdminProductOption[] =
    (products ?? []).map((p) => ({
      id: p.id,
      name: p.name,
    }))

  const customerOptions = customers.map((c) => ({
    id: c.id,
    label:
      c.email ??
      c.full_name ??
      c.id,
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
