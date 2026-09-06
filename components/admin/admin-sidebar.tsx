'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Boxes,
  History,
  Menu,
  RefreshCw,
  Search,
  ShoppingBag,
  Users,
} from 'lucide-react'

type AdminSection =
  | 'overview'
  | 'stock'
  | 'sync'
  | 'customers'
  | 'orders'
  | 'history'

type Customer = {
  id: string
  email: string | null
  full_name: string | null
  created_at: string
  codeCount: number
  orderCount: number
}

const items: Array<{
  id: AdminSection
  label: string
  icon: typeof BarChart3
}> = [
  { id: 'overview', label: 'Visão geral', icon: BarChart3 },
  { id: 'stock', label: 'Estoque e códigos', icon: Boxes },
  { id: 'sync', label: 'Sincronizar usados', icon: RefreshCw },
  { id: 'customers', label: 'Clientes', icon: Users },
  { id: 'orders', label: 'Pedidos', icon: ShoppingBag },
  { id: 'history', label: 'Histórico', icon: History },
]

const sectionRules: Record<AdminSection, string[]> = {
  overview: [],
  stock: [
    'Resumo do estoque',
    'Adicionar códigos ao estoque',
    'Códigos disponíveis',
    'Códigos entregues',
    'Gerenciar códigos',
  ],
  sync: [],
  customers: ['Clientes'],
  orders: ['Pedidos'],
  history: [],
}

function getSectionTitle(element: HTMLElement) {
  return Array.from(element.querySelectorAll('h2'))
    .map((heading) => heading.textContent?.trim() ?? '')
    .find(Boolean) ?? ''
}

function findDeliveredSection(dashboard: HTMLElement) {
  return Array.from(dashboard.querySelectorAll('section')).find((element) =>
    getSectionTitle(element).startsWith('Códigos entregues'),
  ) as HTMLElement | undefined
}

function findSyncDirectChild(deliveredSection: HTMLElement) {
  const syncHeading = Array.from(deliveredSection.querySelectorAll('h3')).find(
    (element) =>
      element.textContent?.trim().startsWith('Sincronizar códigos usados'),
  )

  if (!syncHeading) return null

  return Array.from(deliveredSection.children).find((child) =>
    child.contains(syncHeading),
  ) as HTMLElement | null
}

function ensureSyncCopyButton(
  syncContainer: HTMLElement,
  deliveredSection: HTMLElement,
) {
  let copyButton = document.getElementById(
    'admin-sync-copy-delivered',
  ) as HTMLButtonElement | null

  const originalButton = Array.from(
    deliveredSection.querySelectorAll('button'),
  ).find((button) =>
    button.textContent?.trim().startsWith('Copiar todos entregues'),
  ) as HTMLButtonElement | undefined

  if (!originalButton) return

  if (!copyButton) {
    const wrapper = document.createElement('div')
    wrapper.id = 'admin-sync-copy-delivered-wrapper'
    wrapper.className = 'mt-4 flex justify-end'

    copyButton = document.createElement('button')
    copyButton.id = 'admin-sync-copy-delivered'
    copyButton.type = 'button'
    copyButton.className = originalButton.className
    copyButton.textContent = 'Copiar todos os códigos entregues'
    copyButton.addEventListener('click', () => {
      originalButton.click()
    })

    wrapper.appendChild(copyButton)
    syncContainer.appendChild(wrapper)
  }

  copyButton.disabled = originalButton.disabled
}

export function AdminSidebar({ customers }: { customers: Customer[] }) {
  const [active, setActive] = useState<AdminSection>('overview')
  const [customerSearch, setCustomerSearch] = useState('')

  const filteredCustomers = useMemo(() => {
    const search = customerSearch.trim().toLowerCase()

    if (!search) return customers

    return customers.filter((customer) =>
      [
        customer.full_name,
        customer.email,
        customer.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search),
    )
  }, [customers, customerSearch])

  function applySection(section: AdminSection) {
    const dashboard = document.getElementById('admin-dashboard-content')
    const salesSummary = document.getElementById('admin-sales-summary')
    const auditLog = document.getElementById('admin-audit-log')
    const customerPanel = document.getElementById('admin-customers-panel')

    if (!dashboard) return

    const allowed = sectionRules[section]

    dashboard.querySelectorAll('section').forEach((element) => {
      const title = getSectionTitle(element)

      const shouldShow = section === 'stock'
        ? allowed.some((name) => title.startsWith(name))
        : section === 'customers'
          ? false
          : section === 'orders'
            ? title.startsWith('Pedidos')
            : false

      element.style.display = shouldShow ? '' : 'none'
    })

    const deliveredSection = findDeliveredSection(dashboard)
    const syncContainer = deliveredSection
      ? findSyncDirectChild(deliveredSection)
      : null

    if (deliveredSection) {
      deliveredSection.style.display = section === 'stock' ? '' : 'none'

      Array.from(deliveredSection.children).forEach((child) => {
        child.style.display = ''
      })
    }

    if (syncContainer && deliveredSection) {
      syncContainer.style.display = 'none'

      if (section === 'sync') {
        deliveredSection.style.display = ''

        Array.from(deliveredSection.children).forEach((child) => {
          child.style.display = child === syncContainer ? '' : 'none'
        })

        ensureSyncCopyButton(syncContainer, deliveredSection)
      } else if (section === 'stock') {
        Array.from(deliveredSection.children).forEach((child) => {
          if (child !== syncContainer) {
            child.style.display = ''
          }
        })
      }
    }

    if (salesSummary) {
      salesSummary.style.display = section === 'overview' ? '' : 'none'
    }

    if (auditLog) {
      auditLog.style.display = section === 'history' ? '' : 'none'
    }

    if (customerPanel) {
      customerPanel.style.display = section === 'customers' ? '' : 'none'
    }
  }

  useEffect(() => {
    let attempts = 0
    let timer: number | undefined

    const applyWhenReady = () => {
      const dashboard = document.getElementById('admin-dashboard-content')
      const salesSummary = document.getElementById('admin-sales-summary')
      const auditLog = document.getElementById('admin-audit-log')

      if (!dashboard || !salesSummary || !auditLog) {
        if (attempts < 20) {
          attempts += 1
          timer = window.setTimeout(applyWhenReady, 50)
        }
        return
      }

      applySection(active)
    }

    applyWhenReady()

    const dashboard = document.getElementById('admin-dashboard-content')
    if (!dashboard) return () => timer && window.clearTimeout(timer)

    const observer = new MutationObserver(() => applySection(active))
    observer.observe(dashboard, {
      childList: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
      if (timer) window.clearTimeout(timer)
    }
  }, [active])

  return (
    <div className="contents">
      <aside className="h-fit lg:sticky lg:top-24">
        <div className="rounded-2xl border border-border/60 bg-card p-2 shadow-sm">
          <div className="flex items-center gap-2 px-3 py-3 text-sm font-semibold">
            <Menu className="size-4 text-primary" />
            Menu administrativo
          </div>

          <nav className="grid gap-1" aria-label="Menu administrativo">
            {items.map((item) => {
              const Icon = item.icon
              const isActive = active === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActive(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </aside>

      <section
        id="admin-customers-panel"
        className="hidden min-w-0 lg:col-start-2 lg:row-start-1"
      >
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Clientes ({customers.length})
              </h2>
              <p className="text-sm text-muted-foreground">
                Cadastros realizados no site.
              </p>
            </div>

            <div className="text-sm text-muted-foreground">
              {filteredCustomers.length} encontrado(s)
            </div>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              aria-label="Buscar clientes por nome ou e-mail"
              className="h-11 w-full rounded-lg border bg-background pl-10 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Códigos</th>
                  <th className="px-4 py-3">Pedidos</th>
                  <th className="px-4 py-3">Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-muted-foreground"
                    >
                      Nenhum cadastro encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="border-t">
                      <td className="px-4 py-3 font-medium">
                        {customer.full_name ?? 'Nome não informado'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {customer.email ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {customer.codeCount}
                      </td>
                      <td className="px-4 py-3">
                        {customer.orderCount}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(customer.created_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
