import { MonitorSmartphone } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5 font-bold tracking-tight', className)}>
      <span className="relative flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-1 ring-primary/20">
        <span className="absolute inset-0 rounded-xl bg-primary/20 blur-sm" aria-hidden />
        <MonitorSmartphone className="relative size-5" strokeWidth={2.5} />
      </span>
      <span className="text-lg sm:text-xl">
        JN <span className="text-primary">TELAS</span>
      </span>
    </span>
  )
}
