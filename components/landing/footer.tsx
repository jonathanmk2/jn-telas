import Link from 'next/link'
import { Logo } from '@/components/logo'

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Plataforma independente para compra e acompanhamento de soluções por telas virtuais.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Rodapé">
          <a href="#planos" className="text-muted-foreground hover:text-foreground">
            Planos
          </a>
          <a href="#beneficios" className="text-muted-foreground hover:text-foreground">
            Benefícios
          </a>
          <a href="#faq" className="text-muted-foreground hover:text-foreground">
            FAQ
          </a>
          <a href="#suporte" className="text-muted-foreground hover:text-foreground">
            Suporte
          </a>
          <Link href="/minha-conta" className="text-muted-foreground hover:text-foreground">
            Minha Conta
          </Link>
        </nav>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-4 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} JN TELAS. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  )
}
