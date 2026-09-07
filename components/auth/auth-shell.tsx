import Link from 'next/link'
import { Logo } from '@/components/logo'

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  className = '',
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_0%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
      />
      <div className={`relative w-full ${className || 'max-w-sm'}`}>
        <div className="mb-8 flex justify-center">
          <Link href="/" aria-label="Voltar à página inicial">
            <Logo />
          </Link>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-xl shadow-black/20 md:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </div>
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  )
}
