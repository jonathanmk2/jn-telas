import { redirect } from 'next/navigation'
import { DashboardNavbar } from '@/components/dashboard/dashboard-navbar'
import { AdminDashboard } from '@/components/admin/admin-dashboard'
import { AdminAuditLog } from '@/components/admin/admin-audit-log'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { AdminOrdersPanel } from '@/components/admin/admin-orders-panel'
import { PlatformStockManager } from '@/components/admin/platform-stock-manager'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/admin')
  const { data: profile } = await supabase.from('profiles').select('is_admin,email,full_name').eq('id', user.id).maybeSingle()
  if (profile?.is_admin !== true) redirect('/minha-conta')
  const admin = createAdminClient()
  const [profilesResult,codesResult,ordersResult,productsResult,auditLogsResult] = await Promise.all([
    admin.from('profiles').select('id,email,full_name,created_at').order('created_at',{ascending:false}),
    admin.from('activation_codes').select('id,code,status,created_at,assigned_at,user_id,product_id,order_id,platform').order('created_at',{ascending:false}),
    admin.from('orders').select('id,status,total_cents,quantity,created_at,user_id,product_id').order('created_at',{ascending:false}),
    admin.from('products').select('id,name,platform').order('name',{ascending:true}),
    admin.from('admin_audit_logs').select('id,action,entity_type,entity_id,description,metadata,created_at').order('created_at',{ascending:false}).limit(50),
  ])
  const profiles=profilesResult.data??[], codes=codesResult.data??[], orders=ordersResult.data??[], products=productsResult.data??[], auditLogs=auditLogsResult.data??[]
  const profileMap=new Map(profiles.map(p=>[p.id,p])), productMap=new Map(products.map(p=>[p.id,p]))
  const completed=orders.filter(o=>['paid','delivered'].includes(o.status))
  const customers=profiles.map(c=>({id:c.id,email:c.email??null,full_name:c.full_name??null,created_at:c.created_at,codeCount:codes.filter(x=>x.user_id===c.id).length,orderCount:orders.filter(x=>x.user_id===c.id).length}))
  const adminCodes=codes.map(c=>{const customer=c.user_id?profileMap.get(c.user_id):null;const product=c.product_id?productMap.get(c.product_id):null;return{id:c.id,code:c.code,status:c.status,created_at:c.created_at,assigned_at:c.assigned_at??null,user_id:c.user_id??null,userEmail:customer?.email??null,productName:product?.name??null,productId:c.product_id??null,orderId:c.order_id??null}})
  const adminOrders=orders.map(o=>{const customer=o.user_id?profileMap.get(o.user_id):null;const product=o.product_id?productMap.get(o.product_id):null;const orderCodes=codes.filter(c=>c.order_id===o.id).map(c=>({id:c.id,code:c.code,status:c.status,created_at:c.created_at,assigned_at:c.assigned_at??null}));return{id:o.id,status:o.status,total_cents:o.total_cents,quantity:o.quantity??orderCodes.length,created_at:o.created_at,userId:o.user_id??null,userEmail:customer?.email??null,userName:customer?.full_name??null,productName:product?.name??null,productId:o.product_id??null,codes:orderCodes}})
  const productOptions=products.map(p=>({id:p.id,name:p.name}))
  const customerOptions=profiles.map(c=>({id:c.id,label:c.email??c.full_name??c.id}))
  const available=codes.filter(c=>c.status==='active'&&!c.user_id)
  const ldAvailable=available.filter(c=>c.platform!=='vsphone').length
  const vsAvailable=available.filter(c=>c.platform==='vsphone').length
  const revenue=completed.reduce((n,o)=>n+(o.total_cents??0),0)

  return <div className="min-h-dvh bg-background">
    <DashboardNavbar user={{email:user.email??profile.email??null}} />
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8"><h1 className="text-2xl font-bold tracking-tight">Painel Administrativo</h1><p className="mt-1 text-sm text-muted-foreground">Gerencie clientes, códigos, estoque e pedidos.</p></div>
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
        <AdminSidebar customers={customers}/>
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <section id="admin-sales-summary" className="mb-8">
            <h2 className="text-lg font-semibold">Resumo de vendas</h2><p className="text-sm text-muted-foreground">Visão geral dos pedidos e estoques atuais.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">Faturamento</p><p className="mt-2 text-2xl font-bold">R$ {(revenue/100).toLocaleString('pt-BR',{minimumFractionDigits:2})}</p></div>
              <div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">Pedidos</p><p className="mt-2 text-2xl font-bold">{completed.length}</p></div>
              <div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">Códigos vendidos</p><p className="mt-2 text-2xl font-bold">{completed.reduce((n,o)=>n+(o.quantity??0),0)}</p></div>
              <div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">LD disponível</p><p className="mt-2 text-2xl font-bold text-primary">{ldAvailable}</p></div>
              <div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">VSPHONE disponível</p><p className="mt-2 text-2xl font-bold text-primary">{vsAvailable}</p></div>
            </div>
          </section>
          <PlatformStockManager ldAvailable={ldAvailable} vsAvailable={vsAvailable}/>
          <div id="admin-audit-log"><AdminAuditLog logs={auditLogs}/></div>
          <AdminOrdersPanel orders={adminOrders}/>
          <div id="admin-dashboard-content"><AdminDashboard customers={customers} codes={adminCodes} orders={adminOrders} productOptions={productOptions} customerOptions={customerOptions}/></div>
        </div>
      </div>
    </main>
  </div>
}
