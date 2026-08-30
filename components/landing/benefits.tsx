import { MonitorPlay, Gauge, Lock, Clock, Wallet, RefreshCw } from 'lucide-react'

const benefits = [
  {
    icon: MonitorPlay,
    title: 'Gestão em um só lugar',
    desc: 'Acompanhe pedidos e códigos diretamente na sua conta.',
  },
  {
    icon: Gauge,
    title: 'Processo simples',
    desc: 'Escolha seu plano e acompanhe o status da sua solicitação.',
  },
  {
    icon: Lock,
    title: 'Conta protegida',
    desc: 'Seus códigos ficam vinculados à sua conta de cliente.',
  },
  {
    icon: Clock,
    title: 'Códigos organizados',
    desc: 'Consulte os códigos liberados sem precisar procurar mensagens antigas.',
  },
  {
    icon: Wallet,
    title: 'Opções por quantidade',
    desc: 'Escolha a quantidade que melhor atende sua necessidade.',
  },
  {
    icon: RefreshCw,
    title: 'Suporte direto',
    desc: 'Fale com a equipe pelo WhatsApp quando precisar de ajuda.',
  },
]

export function Benefits() {
  return (
    <section id="beneficios" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
          Por que escolher a JN TELAS
        </h2>
        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
          Uma experiência simples para comprar, organizar e acompanhar seus acessos.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {benefits.map((b) => (
          <div
            key={b.title}
            className="rounded-xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/40"
          >
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <b.icon className="size-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{b.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
