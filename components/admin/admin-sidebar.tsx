'use client'

import { useEffect, useState } from 'react'
import {
  BarChart3,
  Boxes,
  History,
  Menu,
  RefreshCw,
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

function applySection(section: AdminSection) {
  const dashboard = document.getElementById('admin-dashboard-content')
  const salesSummary = document.getElementById('admin-sales-summary')
  const auditLog = document.getElementById('admin-audit-log')

  if (!dashboard) return

  const allowed = sectionRules[section]

  dashboard.querySelectorAll('section').forEach((element) => {
    const title = getSectionTitle(element)

    const shouldShow = section === 'stock'
      ? allowed.some((name) => title.startsWith(name))
      : section === 'customers'
        ? title.startsWith('Clientes')
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
}

export function AdminSidebar() {
  const [active, setActive] = useState<AdminSection>('overview')

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
