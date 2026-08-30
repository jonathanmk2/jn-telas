import Link from 'next/link'
import { ShieldCheck, Zap, Headphones, MonitorSmartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent)]" />
      <div className="relative mx-auto max-w-6xl px-4 py-20 text-center md:py-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <MonitorSmartphone className="size-3.5" /> Telas virtuais e acesso remoto
        </span>
        <h1 className="mx-auto mt-6 max-w-4xl text-balance text-4xl font-bold leading-tight tracking-tight md:text-6xl">
          Mais telas, mais praticidade, <span className="text-primary">do seu jeito</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
          Na JN TELAS você encontra soluções de acesso por telas virtuais, ativação por código e suporte para acompanhar sua compra em um só lugar.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto"><Link href="#planos">Ver planos</Link></Button>
          <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto"><Link href="#beneficios">Como funciona</Link></Button>
        </div>
        <dl className="mx-auto mt-14 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, label: 'Compra organizada', value: 'Área do cliente' },
            { icon: Zap, label: 'Processo simples', value: 'Ativação por código' },
            { icon: Headphones, label: 'Atendimento', value: 'Suporte dedicado' },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1 rounded-2xl border border-border/60 bg-card/70 p-5 backdrop-blur">
              <s.icon className="mb-1 size-6 text-primary" /><dd className="text-lg font-semibold">{s.value}</dd><dt className="text-sm text-muted-foreground">{s.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
