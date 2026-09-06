import { MonitorPlay, Gauge, Lock, Clock, Wallet, RefreshCw } from 'lucide-react'

const benefits = [
  { icon: MonitorPlay, title: 'Tudo em um só lugar', desc: 'Acompanhe pedidos e códigos diretamente pela sua conta.' },
  { icon: Gauge, title: 'Compra simples', desc: 'Escolha a quantidade, pague com PIX e acompanhe o status.' },
  { icon: Lock, title: 'Conta protegida', desc: 'Seus códigos ficam vinculados à sua conta de cliente.' },
  { icon: Clock, title: 'Códigos organizados', desc: 'Consulte seus acessos sem procurar mensagens antigas.' },
  { icon: Wallet, title: 'Preço por quantidade', desc: 'Quanto mais telas, menor o valor por tela.' },
  { icon: RefreshCw, title: 'Suporte direto', desc: 'Fale com a equipe pelo WhatsApp quando precisar.' },
]

export function Benefits() {
  return (
    <section id="beneficios" className="relative mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:py-24">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-24 -z-10 size-80 -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Por que a JN TELAS</span>
        <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight md:text-4xl">Tudo pensado para facilitar sua compra</h2>
        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">Uma experiência organizada para comprar, receber e acompanhar seus acessos.</p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {benefits.map((b) => (
          <div key={b.title} className="group rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10 transition-transform group-hover:scale-105">
              <b.icon className="size-6" />
            </div>
            <h3 className="mt-5 text-lg font-bold">{b.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{b.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
