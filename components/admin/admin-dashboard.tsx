'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { assignCode, createCodes, deleteCode, setCodeStatus, setOrderStatus } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/status-badge'
import { formatBRL, formatDate } from '@/lib/format'

type Customer = { id: string; email: string | null; full_name: string | null; created_at: string; codeCount: number; orderCount: number }
type Code = { id: string; code: string; status: string; created_at: string; assigned_at: string | null; user_id: string | null; userEmail: string | null; productName: string | null; productId: string | null }
type Order = { id: string; status: string; total_cents: number; created_at: string; userEmail: string | null; productName: string | null }
type ProductOption = { id: string; name: string }
type CustomerOption = { id: string; label: string }

async function runAction(action: (fd: FormData) => Promise<{ ok: boolean; message?: string; error?: string }>, fd: FormData, done: () => void) {
  const result = await action(fd)
  if (result.ok) { toast.success(result.message ?? 'Atualizado com sucesso.'); done() }
  else toast.error(result.error ?? 'Não foi possível concluir a ação.')
}

export function AdminDashboard({ customers, codes, orders, productOptions, customerOptions }: {
  customers: Customer[]; codes: Code[]; orders: Order[]; productOptions: ProductOption[]; customerOptions: CustomerOption[]
}) {
  const [isPending, startTransition] = useTransition()
  const submit = (action: (fd: FormData) => Promise<{ ok: boolean; message?: string; error?: string }>) => (form: HTMLFormElement) => {
    const fd = new FormData(form)
    startTransition(() => { void runAction(action, fd, () => form.reset()) })
  }

  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-border/60 bg-card p-5">
        <h2 className="text-lg font-semibold">Gerar códigos</h2>
        <p className="mt-1 text-sm text-muted-foreground">Crie códigos automaticamente ou informe códigos personalizados.</p>
        <form className="mt-4 grid gap-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); submit(createCodes)(e.currentTarget) }}>
          <div><Label htmlFor="productId">Produto</Label><select id="productId" name="productId" className="mt-1 h-10 w-full rounded-md border bg-background px-3"><option value="">Sem produto</option>{productOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><Label htmlFor="quantity">Quantidade</Label><Input id="quantity" name="quantity" type="number" min="1" max="500" defaultValue="1" className="mt-1" /></div>
          <div className="flex items-end"><Button type="submit" disabled={isPending} className="w-full">{isPending ? 'Processando...' : 'Gerar códigos'}</Button></div>
          <div className="sm:col-span-3"><Label htmlFor="codes">Ou códigos personalizados (um por linha)</Label><textarea id="codes" name="codes" className="mt-1 min-h-24 w-full rounded-md border bg-background p-3 text-sm" placeholder="LD-XXXX-XXXX-XXXX" /></div>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Clientes ({customers.length})</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border/60"><table className="w-full text-sm"><thead className="bg-card text-left text-muted-foreground"><tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Códigos</th><th className="px-4 py-3">Pedidos</th><th className="px-4 py-3">Cadastro</th></tr></thead><tbody>{customers.map(c => <tr key={c.id} className="border-t"><td className="px-4 py-3">{c.email ?? c.full_name ?? c.id}</td><td className="px-4 py-3">{c.codeCount}</td><td className="px-4 py-3">{c.orderCount}</td><td className="px-4 py-3 text-muted-foreground">{formatDate(c.created_at)}</td></tr>)}</tbody></table></div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Códigos ({codes.length})</h2>
        <div className="mt-3 space-y-3">{codes.map(c => <div key={c.id} className="rounded-xl border border-border/60 bg-card p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><code className="rounded bg-secondary px-2 py-1">{c.code}</code><div className="mt-2"><StatusBadge status={c.status} type="code" /></div><p className="mt-2 text-xs text-muted-foreground">{c.productName ?? 'Sem produto'} · {c.userEmail ?? 'Não atribuído'} · {formatDate(c.created_at)}</p></div><div className="flex flex-wrap gap-2"><form onSubmit={(e)=>{e.preventDefault(); submit(assignCode)(e.currentTarget)}}><input type="hidden" name="codeId" value={c.id}/><select name="userId" defaultValue={c.user_id ?? ''} className="h-9 rounded-md border bg-background px-2 text-sm"><option value="">Não atribuído</option>{customerOptions.map(u=><option key={u.id} value={u.id}>{u.label}</option>)}</select><Button type="submit" size="sm" variant="secondary" disabled={isPending} className="ml-2">Salvar</Button></form><form onSubmit={(e)=>{e.preventDefault(); submit(setCodeStatus)(e.currentTarget)}}><input type="hidden" name="codeId" value={c.id}/><input type="hidden" name="status" value={c.status === 'active' ? 'inactive' : 'active'}/><Button type="submit" size="sm" variant="outline" disabled={isPending}>{c.status === 'active' ? 'Desativar' : 'Ativar'}</Button></form><form onSubmit={(e)=>{e.preventDefault(); if(confirm('Excluir este código?')) submit(deleteCode)(e.currentTarget)}}><input type="hidden" name="codeId" value={c.id}/><Button type="submit" size="sm" variant="destructive" disabled={isPending}>Excluir</Button></form></div></div></div>)}</div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Pedidos ({orders.length})</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border/60"><table className="w-full text-sm"><thead className="bg-card text-left text-muted-foreground"><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{orders.map(o => <tr key={o.id} className="border-t"><td className="px-4 py-3">{o.productName ?? 'Plano'}</td><td className="px-4 py-3">{o.userEmail ?? '—'}</td><td className="px-4 py-3">{formatBRL(o.total_cents)}</td><td className="px-4 py-3">{formatDate(o.created_at)}</td><td className="px-4 py-3"><form className="flex gap-2" onSubmit={(e)=>{e.preventDefault(); submit(setOrderStatus)(e.currentTarget)}}><input type="hidden" name="orderId" value={o.id}/><select name="status" defaultValue={o.status} className="h-9 rounded-md border bg-background px-2 text-sm">{['pending','paid','delivered','cancelled'].map(s=><option key={s} value={s}>{s}</option>)}</select><Button type="submit" size="sm" variant="secondary" disabled={isPending}>Salvar</Button></form></td></tr>)}</tbody></table></div>
      </section>
    </div>
  )
}
