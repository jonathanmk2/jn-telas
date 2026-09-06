'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Search, ChevronDown, ChevronUp, Copy } from 'lucide-react'

import { setOrderStatus } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { formatBRL, formatDate } from '@/lib/format'

type OrderCode = {
  id: string
  code: string
  status: string
  created_at: string
  assigned_at: string | null
}

type Order = {
  id: string
  status: string
  total_cents: number
  quantity: number
  created_at: string
  userEmail: string | null
  userName: string | null
  productName: string | null
  codes: OrderCode[]
}

type OrderFilter = 'all' | 'pending' | 'paid' | 'delivered' | 'cancelled'

type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string }

const filterItems: Array<{ id: OrderFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Pendentes' },
  { id: 'paid', label: 'Pagos' },
  { id: 'delivered', label: 'Entregues' },
  { id: 'cancelled', label: 'Cancelados' },
]

function getOrderStatusLabel(status: string) {
  switch (status) {
    case 'pending': return 'PENDENTE'
    case 'paid': return 'PAGO'
    case 'delivered': return 'ENTREGUE'
    case 'cancelled': return 'CANCELADO'
    default: return status.toUpperCase()
  }
}

function getOrderStatusClasses(status: string) {
  switch (status) {
    case 'pending': return 'border-yellow-500/20 bg-yellow-500/10 text-yellow-600'
    case 'paid': return 'border-blue-500/20 bg-blue-500/10 text-blue-600'
    case 'delivered': return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
    case 'cancelled': return 'border-red-500/20 bg-red-500/10 text-red-600'
    default: return 'border-border bg-muted text-muted-foreground'
  }
}

export function AdminOrdersPanel({ orders }: { orders: Order[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<OrderFilter>('all')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  const filteredOrders = useMemo(() => {
    const normalized = search.trim().toLowerCase()

    return orders.filter((order) => {
      if (filter !== 'all' && order.status !== filter) return false
      if (!normalized) return true

      const searchable = [
        order.id,
        order.userEmail,
        order.userName,
        order.productName,
        ...order.codes.map((code) => code.code),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchable.includes(normalized)
    })
  }, [orders, search, filter])

  const counts = useMemo(() => ({
    all: orders.length,
    pending: orders.filter((order) => order.status === 'pending').length,
    paid: orders.filter((order) => order.status === 'paid').length,
    delivered: orders.filter((order) => order.status === 'delivered').length,
    cancelled: orders.filter((order) => order.status === 'cancelled').length,
  }), [orders])

  function saveStatus(orderId: string, status: string, form: HTMLFormElement) {
    const formData = new FormData(form)
    formData.set('orderId', orderId)
    formData.set('status', status)

    startTransition(() => {
      void setOrderStatus(formData)
        .then((result: ActionResult) => {
          if (!result.ok) {
            toast.error(result.error)
            return
          }

          toast.success(result.message ?? 'Status do pedido atualizado.')
          router.refresh()
        })
        .catch((error) => {
          console.error('Erro ao atualizar pedido:', error)
          toast.error('Não foi possível atualizar o pedido.')
        })
    })
  }

  async function copyCodes(order: Order) {
    if (order.codes.length === 0) {
      toast.error('Este pedido não possui códigos vinculados.')
      return
    }

    try {
      await navigator.clipboard.writeText(order.codes.map((code) => code.code).join('\n'))
      toast.success(`${order.codes.length} código(s) copiado(s).`)
    } catch (error) {
      console.error('Erro ao copiar códigos do pedido:', error)
      toast.error('Não foi possível copiar os códigos.')
    }
  }

  return (
    <section id="admin-orders-panel" className="min-w-0 lg:col-start-2 lg:row-start-1">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Pedidos ({orders.length})</h2>
            <p className="text-sm text-muted-foreground">
              Pesquise, filtre e abra um pedido para ver os códigos entregues.
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            {filteredOrders.length} encontrado(s)
          </span>
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por pedido, cliente, e-mail ou código..."
            aria-label="Buscar pedidos"
            className="h-11 w-full rounded-lg border bg-background pl-10 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {filterItems.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={filter === item.id ? 'default' : 'outline'}
              onClick={() => setFilter(item.id)}
            >
              {item.label} ({counts[item.id]})
            </Button>
          ))}
        </div>

        {(search || filter !== 'all') && (
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch('')
                setFilter('all')
              }}
            >
              Limpar filtros
            </Button>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm font-medium">Nenhum pedido encontrado.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Tente outro termo ou remova os filtros.
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isExpanded = expandedOrder === order.id

              return (
                <div key={order.id} className="rounded-xl border border-border/60 bg-background overflow-hidden">
                  <div className="p-4">
                    <div className="grid gap-4 lg:grid-cols-[1.2fr_1.5fr_auto_auto_auto] lg:items-center">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Pedido</p>
                        <p className="mt-1 truncate font-mono text-sm font-semibold">
                          #{order.id.replaceAll('-', '').slice(0, 8).toUpperCase()}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Cliente</p>
                        <p className="mt-1 truncate text-sm font-medium">
                          {order.userName ?? order.userEmail ?? 'Cliente não identificado'}
                        </p>
                        {order.userName && order.userEmail && (
                          <p className="truncate text-xs text-muted-foreground">{order.userEmail}</p>
                        )}
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Valor</p>
                        <p className="mt-1 text-sm font-bold">{formatBRL(order.total_cents)}</p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Data</p>
                        <p className="mt-1 text-sm">{formatDate(order.created_at)}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${getOrderStatusClasses(order.status)}`}>
                          {getOrderStatusLabel(order.status)}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        >
                          {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                          <span className="sr-only">{isExpanded ? 'Fechar detalhes' : 'Abrir detalhes'}</span>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border/60 bg-card/40 p-4 sm:p-5">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Produto</p>
                          <p className="mt-1 text-sm font-medium">{order.productName ?? 'Plano'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Quantidade</p>
                          <p className="mt-1 text-sm font-medium">{order.quantity}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Códigos vinculados</p>
                          <p className="mt-1 text-sm font-medium">{order.codes.length}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">ID completo</p>
                          <p className="mt-1 break-all font-mono text-xs">{order.id}</p>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold">Códigos do pedido</h3>
                          <p className="text-xs text-muted-foreground">Os códigos permanecem vinculados ao pedido.</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={order.codes.length === 0}
                          onClick={() => void copyCodes(order)}
                        >
                          <Copy className="mr-2 size-4" />
                          Copiar códigos
                        </Button>
                      </div>

                      {order.codes.length === 0 ? (
                        <div className="mt-3 rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                          Nenhum código vinculado a este pedido.
                        </div>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {order.codes.map((code) => (
                            <div key={code.id} className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <code className="break-all rounded bg-secondary px-2 py-1 font-mono text-sm">{code.code}</code>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  Comprado em {formatDate(code.assigned_at ?? order.created_at)}
                                </p>
                              </div>
                              <span className={`w-fit rounded-full border px-2 py-1 text-[10px] font-bold ${code.status === 'used' ? 'border-orange-500/20 bg-orange-500/10 text-orange-600' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'}`}>
                                {code.status === 'used' ? 'USADO' : 'ATIVO'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <form
                        className="mt-5 flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between"
                        onSubmit={(event) => {
                          event.preventDefault()
                          saveStatus(order.id, event.currentTarget.status.value, event.currentTarget)
                        }}
                      >
                        <div>
                          <p className="text-sm font-medium">Alterar status</p>
                          <p className="text-xs text-muted-foreground">Use apenas para ajustes administrativos.</p>
                        </div>
                        <div className="flex gap-2">
                          <select
                            name="status"
                            defaultValue={order.status}
                            disabled={isPending}
                            className="h-9 rounded-md border bg-background px-2 text-sm"
                          >
                            {filterItems.slice(1).map((item) => (
                              <option key={item.id} value={item.id}>{item.label.replace('s', '').toUpperCase()}</option>
                            ))}
                          </select>
                          <Button type="submit" size="sm" disabled={isPending}>
                            {isPending ? 'Salvando...' : 'Salvar'}
                          </Button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}
