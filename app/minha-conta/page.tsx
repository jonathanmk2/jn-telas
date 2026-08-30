import { redirect } from 'next/navigation'
import Link from 'next/link'
import { KeyRound, ShoppingBag, Ticket, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardNavbar } from '@/components/dashboard/dashboard-navbar'
import { CopyButton } from '@/components/copy-button'
import { StatusBadge } from '@/components/status-badge'
import { createClient } from '@/lib/supabase/server'
import { formatBRL, formatDate } from '@/lib/format'

export default async function MinhaContaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?next=/minha-conta')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, is_admin')
    .eq('id', user.id)
    .single()

  // RLS ensures only the user's own codes/orders are returned
  const { data: codes } = await supabase
    .from('activation_codes')
    .select('id, code, status, assigned_at, created_at, products(name, screens)')
    .order('created_at', { ascending: false })

  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, total_cents, created_at, products(name)')
    .order('created_at', { ascending: false })

  const codeList = codes ?? []
  const orderList = orders ?? []
  const firstName = (profile?.full_name || user.email || '').split(' ')[0]

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <DashboardNavbar email={profile?.email ?? user.email ?? null} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Minha Conta</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Olá{firstName ? `, ${firstName}` : ''}! Gerencie seus códigos e compras aqui.
            </p>
          </div>
          <div className="flex gap-2">
            {profile?.is_admin && (
              <Button asChild variant="secondary" size="sm">
                <Link href="/admin">
                  <Shield className="size-4" /> Painel Admin
                </Link>
              </Button>
            )}
            <Button asChild size="sm">
              <Link href="/#planos">Comprar mais</Link>
            </Button>
          </div>
        </div>

        {/* Resumo */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard icon={Ticket} label="Códigos" value={codeList.length} />
          <SummaryCard
            icon={KeyRound}
            label="Códigos ativos"
            value={codeList.filter((c) => c.status === 'active').length}
          />
          <SummaryCard icon={ShoppingBag} label="Pedidos" value={orderList.length} />
        </div>

        {/* Meus Códigos */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Meus Códigos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos os códigos de ativação vinculados à sua conta.
          </p>

          {codeList.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
              <Ticket className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Você ainda não possui códigos. Assim que sua compra for confirmada, eles aparecerão
                aqui.
              </p>
              <Button asChild className="mt-4" size="sm">
                <Link href="/#planos">Ver planos</Link>
              </Button>
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {codeList.map((c) => {
                const product = Array.isArray(c.products) ? c.products[0] : c.products
                return (
                  <li
                    key={c.id}
                    className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="truncate rounded-md bg-secondary px-2 py-1 font-mono text-sm">
                          {c.code}
                        </code>
                        <StatusBadge status={c.status} type="code" />
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {product?.name ?? 'Plano'} · Adquirido em {formatDate(c.created_at)}
                      </p>
                    </div>
                    <CopyButton value={c.code} className="shrink-0 self-start sm:self-auto" />
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Pedidos */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Meus Pedidos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Histórico das suas compras.</p>

          {orderList.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
              Nenhum pedido registrado ainda.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-card">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Plano</th>
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium">Valor</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orderList.map((o) => {
                    const product = Array.isArray(o.products) ? o.products[0] : o.products
                    return (
                      <tr key={o.id} className="border-t border-border/60 bg-card/40">
                        <td className="px-4 py-3">{product?.name ?? 'Plano'}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(o.created_at)}
                        </td>
                        <td className="px-4 py-3">{formatBRL(o.total_cents)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={o.status} type="order" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
