import { cn } from '@/lib/utils'

const codeStatusMap: Record<string, { label: string; className: string }> = {
  active: { label: 'Ativo', className: 'bg-primary/15 text-primary' },
  inactive: { label: 'Inativo', className: 'bg-muted text-muted-foreground' },
}

const orderStatusMap: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-amber-500/15 text-amber-400' },
  paid: { label: 'Pago', className: 'bg-primary/15 text-primary' },
  delivered: { label: 'Entregue', className: 'bg-primary/15 text-primary' },
  cancelled: { label: 'Cancelado', className: 'bg-destructive/15 text-destructive' },
}

export function StatusBadge({
  status,
  type = 'code',
}: {
  status: string
  type?: 'code' | 'order'
}) {
  const map = type === 'order' ? orderStatusMap : codeStatusMap
  const item = map[status] ?? { label: status, className: 'bg-muted text-muted-foreground' }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        item.className,
      )}
    >
      {item.label}
    </span>
  )
}
