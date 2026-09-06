import Link from 'next/link'
import { Logo } from '@/components/logo'
import { MessageCircle, ShieldCheck } from 'lucide-react'
import { whatsappLink } from '@/lib/format'

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
            Plataforma independente para compra e acompanhamento de soluções por telas virtuais.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" /> Compra e atendimento organizados em um só lugar.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm sm:grid-cols-3">
          <div className="col-span-2 mb-1 text-xs font-bold uppercase tracking-wider text-foreground sm:col-span-3">Navegação</div>
          <a href="#planos" className="text-muted-foreground transition-colors hover:text-foreground">Planos</a>
          <a href="#beneficios" className="text-muted-foreground transition-colors hover:text-foreground">Benefícios</a>
          <a href="#faq" className="text-muted-foreground transition-colors hover:text-foreground">FAQ</a>
          <a href="#suporte" className="text-muted-foreground transition-colors hover:text-foreground">Suporte</a>
          <Link href="/minha-conta" className="text-muted-foreground transition-colors hover:text-foreground">Minha Conta</Link>
          <a href={whatsappLink('Olá! Preciso de suporte com a JN TELAS.')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"><MessageCircle className="size-3.5" /> WhatsApp</a>
        </div>
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-center text-xs text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between md:text-left">
          <span>&copy; {new Date().getFullYear()} JN TELAS. Todos os direitos reservados.</span>
          <span>Atendimento todos os dias, das 8h às 22h.</span>
        </div>
      </div>
    </footer>
  )
}
