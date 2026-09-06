'use client'

import { useEffect, useState } from 'react'
import {
  BarChart3,
  Boxes,
  History,
  Menu,
  ShoppingBag,
  Users,
} from 'lucide-react'

type AdminSection =
  | 'overview'
  | 'stock'
  | 'customers'
  | 'orders'
  | 'history'

const items: Array<{
  id: AdminSection
  label: string
  icon: typeof BarChart3
}> = [
  { id: 'overview', label: 'Visão geral', icon: BarChart3 },
  { id: 'stock', label: 'Estoque e códigos', icon: Boxes },
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
  customers: ['Clientes'],
  orders: ['Pedidos'],
  history: [],
}

function applySection(section: AdminSection) {
  const dashboard = document.getElementById('admin-dashboard-content')
  const salesSummary = document.getElementById('admin-sales-summary')
  const auditLog = document.getElementById('admin-audit-log')

  if (!dashboard) return

  const allowed = sectionRules[section]

  // AdminDashboard usa um wrapper interno. Portanto, as seções podem
  // estar aninhadas e não necessariamente serem filhas diretas do dashboard.
  dashboard.querySelectorAll('section').forEach((element) => {
    const title = element.querySelector(':scope > h2')?.textContent?.trim() ?? ''

    const shouldShow = section === 'stock'
      ? allowed.some((name) => title.startsWith(name))
      : section === 'customers'
        ? title.startsWith('Clientes')
        : section === 'orders'
          ? title.startsWith('Pedidos')
          : false

    element.style.display = shouldShow ? '' : 'none'
  })

  if (salesSummary) {
    salesSummary.style.display = section === 'overview' ? '' : 'none'
  }

  if (auditLog) {
    auditLog.style.display = section === 'overview' || section === 'history' ? '' : 'none'
  }
}

export function AdminSidebar() {
  const [active, setActive] = useState<AdminSection>('overview')

  useEffect(() => {
    let attempts = 0
    let timer: number | undefined

    const applyWhenReady = () => {
      const dashboard = document.getElementById('admin-dashboard-content')
      const salesSummary = document.getElementById('admin-sales-summary')

      if (!dashboard || !salesSummary) {
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
  )
}
