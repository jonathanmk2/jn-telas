import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronDown, ChevronRight, Home, KeyRound, PackageCheck, Shield, ShieldCheck, ShoppingBag } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { CopyButton } from '@/components/copy-button'
import { CopyAllButton } from '@/components/copy-all-button'

type ActivationCode = {
  id: string
  code: string
  status: string
  created_at: string
  assigned_at: string | null
  order_id: string | null
  product: { name: string } | null
}

type Order = {
  id: string
  status: string
  total_cents: number
  quantity: number
  created_at: string
  product: { name: string } | null
  activation_codes: { id: string; code: string; status: string; assigned_at: string | null }[]
}

function formatBRL(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function shortId(id: string) {
  return id.replaceAll('-', '').slice(0, 8).toUpperCase()
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'delivered': return 'Entregue'
    case 'paid': return 'Pago'
    case 'pending': return 'Aguardando pagamento'
    case 'cancelled':
    case 'canceled': return 'Cancelado'
    default: return status
  }
}

function getStatusClasses(status: string) {
  switch (status) {
    case 'delivered':
    case 'paid': return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
    case 'pending': return 'border-amber-500/20 bg-amber-500/10 text-amber-600'
    case 'cancelled':
    case 'canceled': return 'border-red-500/20 bg-red-500/10 text-red-600'
    default: return 'border-border bg-muted text-muted-foreground'
  }
}

function getCodeStatusLabel(status: string) {
  switch (status) {
    case 'used': return 'USADO'
    case 'active': return 'ATIVO'
    case 'inactive': return 'DESATIVADO'
    default: return status.toUpperCase()
  }
}

function getCodeStatusClasses(status: string) {
  switch (status) {
    case 'used': return 'border-orange-500/20 bg-orange-500/10 text-orange-600'
    case 'active': return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
    case 'inactive': return 'border-red-500/20 bg-red-500/10 text-red-600'
    default: return 'border-border bg-muted text-muted-foreground'
  }
}

function normalizeProductName(name: string | null | undefined) {
  const normalized = name?.replace(/^\d+\s*Telas?\s*/i, '').replace(/^JN TELAS\s*[-·]?\s*/i, '').trim()
  return normalized || 'LD CLOUD VIP'
}

export default async function MinhaContaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/minha-conta')

  const [
    { data: profile },
    { data: activationCodes },
    { data: orders },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name, email, is_admin').eq('id', user.id).maybeSingle(),
    supabase.from('activation_codes').select(`id, code, status, created_at, assigned_at, order_id, product:products (name)`).eq('user_id', user.id).order('assigned_at', { ascending: false }),
    supabase.from('orders').select(`id, status, total_cents, quantity, created_at, product:products (name), activation_codes (id, code, status, assigned_at)`).eq('user_id', user.id).order('created_at', { ascending: false }),
  ])

  const codes = (activationCodes ?? []) as unknown as ActivationCode[]
  const userOrders = (orders ?? []) as unknown as Order[]
  const oldCodes = codes.filter((code) => code.order_id === null)
  const totalCodes = codes.length
  const activeCodes = codes.filter((code) => code.status === 'active').length
  const isAdmin = profile?.is_admin === true
  const firstName = profile?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'Cliente'

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 -z-0 size-96 -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
      <div className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">Área do cliente</div>
            <h1 className="mt-3 truncate text-2xl font-extrabold tracking-tight sm:text-3xl">Olá, {firstName} 👋</h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">Gerencie seus pedidos e códigos em um só lugar.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/" aria-label="Voltar para Home" className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-card shadow-sm transition hover:bg-muted sm:size-auto sm:px-3 sm:py-2">
              <Home className="size-4 sm:mr-2" /><span className="hidden text-sm font-medium sm:inline">Home</span>
            </Link>
            {isAdmin && <Link href="/admin" className="flex size-10 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition hover:opacity-90 sm:h-auto sm:w-auto sm:px-3 sm:py-2"><Shield className="size-4 sm:mr-2" /><span className="hidden text-sm sm:inline">Admin</span></Link>}
          </div>
        </header>

        <section className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
          <div className="rounded-2xl border border-border/60 bg-card/85 p-3 shadow-sm sm:p-5">
            <div className="mb-3 flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><KeyRound className="size-4" /></div>
            <p className="text-2xl font-extrabold leading-none sm:text-3xl">{totalCodes}</p><p className="mt-1 text-[11px] font-medium text-muted-foreground sm:text-xs">Códigos</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/85 p-3 shadow-sm sm:p-5">
            <div className="mb-3 flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><ShieldCheck className="size-4" /></div>
            <p className="text-2xl font-extrabold leading-none sm:text-3xl">{activeCodes}</p><p className="mt-1 text-[11px] font-medium text-muted-foreground sm:text-xs">Ativos</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/85 p-3 shadow-sm sm:p-5">
            <div className="mb-3 flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600"><ShoppingBag className="size-4" /></div>
            <p className="text-2xl font-extrabold leading-none sm:text-3xl">{userOrders.length}</p><p className="mt-1 text-[11px] font-medium text-muted-foreground sm:text-xs">Pedidos</p>
          </div>
        </section>

        <div className="mb-8">
          <Link href="/" className="group flex w-full items-center justify-between rounded-2xl border border-primary/20 bg-primary px-4 py-4 text-primary-foreground shadow-lg shadow-primary/15 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/20 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/15"><ShoppingBag className="size-5" /></div>
              <div className="text-left"><p className="text-sm font-bold sm:text-base">Comprar mais telas</p><p className="text-xs text-primary-foreground/75">Adicione novos códigos à sua conta</p></div>
            </div>
            <ChevronRight className="size-5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div><h2 className="text-lg font-extrabold sm:text-xl">Meus pedidos</h2><p className="mt-1 text-xs text-muted-foreground sm:text-sm">Seus pedidos e códigos entregues.</p></div>
            <PackageCheck className="size-5 text-primary/70" />
          </div>

          {userOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center shadow-sm"><PackageCheck className="mx-auto mb-3 size-9 text-muted-foreground" /><p className="font-bold">Nenhum pedido ainda</p><p className="mt-1 text-sm text-muted-foreground">Quando você comprar, seus pedidos aparecerão aqui.</p></div>
          ) : (
            <div className="space-y-3">
              {userOrders.map((order) => {
                const quantity = order.quantity || order.activation_codes?.length || 1
                const productName = normalizeProductName(order.product?.name)
                const orderCodes = order.activation_codes ?? []
                return (
                  <details key={order.id} className="group overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-shadow open:shadow-md">
                    <summary className="cursor-pointer list-none p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-extrabold tracking-wide">#{shortId(order.id)}</span>
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${getStatusClasses(order.status)}`}>{getStatusLabel(order.status)}</span>
                            <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">{quantity} {quantity === 1 ? 'código' : 'códigos'}</span>
                          </div>
                          <p className="truncate text-sm font-bold sm:text-base">{productName} · {quantity} {quantity === 1 ? 'tela' : 'telas'}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><span>Comprado em {formatDate(order.created_at)}</span><span>•</span><span className="font-bold text-foreground">{formatBRL(order.total_cents)}</span></div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 pt-1"><span className="hidden text-xs font-semibold text-muted-foreground sm:block">Ver códigos</span><ChevronDown className="size-5 text-muted-foreground transition-transform group-open:rotate-180" /></div>
                      </div>
                    </summary>

                    <div className="border-t border-border/60 bg-muted/20 p-3 sm:p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2"><div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><KeyRound className="size-4" /></div><div className="min-w-0"><p className="text-sm font-bold">Códigos deste pedido</p><p className="text-[11px] text-muted-foreground">{orderCodes.length} {orderCodes.length === 1 ? 'código' : 'códigos'}</p></div></div>
                        {orderCodes.length > 0 && <div className="shrink-0"><CopyAllButton codes={orderCodes.map((item) => item.code)} /></div>}
                      </div>
                      {orderCodes.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-background p-4 text-center text-sm text-muted-foreground">Os códigos deste pedido ainda não foram vinculados.</div>
                      ) : (
                        <div className="space-y-2">
                          {orderCodes.map((item) => {
                            const codeStatus = item.status || 'active'
                            return (
                              <div key={item.id} className="rounded-xl border border-border/70 bg-background p-3 shadow-sm">
                                <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="truncate font-mono text-sm font-bold tracking-wide">{item.code}</p></div><div className="flex shrink-0 items-center gap-2"><span className={`whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-bold ${getCodeStatusClasses(codeStatus)}`}>{getCodeStatusLabel(codeStatus)}</span><CopyButton code={item.code} /></div></div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </details>
                )
              })}
            </div>
          )}
        </section>

        {oldCodes.length > 0 && (
          <section className="mt-8">
            <div className="mb-3"><h2 className="text-lg font-extrabold">Outros códigos</h2><p className="mt-1 text-xs text-muted-foreground sm:text-sm">Códigos adicionados anteriormente.</p></div>
            <div className="space-y-2">
              {oldCodes.map((item) => (
                <div key={item.id} className="rounded-xl border border-border/60 bg-card p-3 shadow-sm"><div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="truncate font-mono text-sm font-bold">{item.code}</p></div><div className="flex shrink-0 items-center gap-2"><span className={`whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-bold ${getCodeStatusClasses(item.status)}`}>{getCodeStatusLabel(item.status)}</span><CopyButton code={item.code} /></div></div></div>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-10 border-t border-border/60 pt-5 text-center"><p className="text-[11px] text-muted-foreground">Seus códigos ficam vinculados à sua conta.</p></footer>
      </div>
    </main>
  )
}
