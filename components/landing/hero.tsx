import Link from 'next/link'
import { ShieldCheck, Zap, Headphones, MonitorSmartphone, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/40">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_55%_at_50%_0%,color-mix(in_oklch,var(--primary)_24%,transparent),transparent_72%)]" />
      <div aria-hidden className="pointer-events-none absolute -left-32 top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-32 top-10 size-72 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-16 sm:pb-20 sm:pt-20 md:pb-24 md:pt-28">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary shadow-sm">
            <MonitorSmartphone className="size-3.5" />
            LD CLOUD VIP • Ativação por código
          </span>

          <h1 className="mx-auto mt-6 max-w-4xl text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Sua tela virtual,
            <span className="block bg-gradient-to-r from-primary via-primary to-foreground bg-clip-text text-transparent">
              simples e rápida.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            Escolha a quantidade de telas, pague com PIX e acompanhe tudo pela sua conta. Seus códigos ficam organizados em um só lugar.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 w-full px-7 text-sm font-bold shadow-lg shadow-primary/20 sm:w-auto">
              <Link href="#planos">
                Comprar agora
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 w-full px-7 sm:w-auto">
              <Link href="#beneficios">Como funciona</Link>
            </Button>
          </div>

          <div className="mx-auto mt-9 flex max-w-2xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-primary" /> Pagamento PIX</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-primary" /> Entrega automática</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-primary" /> Área do cliente</span>
          </div>
        </div>

        <dl className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {[
            { icon: ShieldCheck, label: 'Compra organizada', value: 'Área do cliente' },
            { icon: Zap, label: 'Processo simples', value: 'Ativação por código' },
            { icon: Headphones, label: 'Atendimento', value: 'Suporte direto' },
          ].map((s) => (
            <div key={s.label} className="group rounded-2xl border border-border/60 bg-card/70 p-5 text-center shadow-sm backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="size-5" />
              </div>
              <dd className="mt-3 text-sm font-bold sm:text-base">{s.value}</dd>
              <dt className="mt-1 text-xs text-muted-foreground">{s.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
