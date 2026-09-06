'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X, LayoutDashboard, LogOut, Shield, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type NavUser = { email: string | null; isAdmin: boolean } | null

const links = [
  { href: '#planos', label: 'Planos' },
  { href: '#beneficios', label: 'Como funciona' },
  { href: '#faq', label: 'FAQ' },
  { href: '#suporte', label: 'Suporte' },
]

export function SiteNavbar({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setOpen(false)
    router.push('/')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/85 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Página inicial JN TELAS" onClick={() => setOpen(false)} className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              {user.isAdmin && (
                <Button asChild variant="ghost" size="sm"><Link href="/admin"><Shield className="size-4" />Admin</Link></Button>
              )}
              <Button asChild size="sm" className="shadow-sm shadow-primary/15"><Link href="/minha-conta"><LayoutDashboard className="size-4" />Minha Conta</Link></Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="size-4" />Sair</Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link href="/auth/login">Entrar</Link></Button>
              <Button asChild size="sm" className="shadow-sm shadow-primary/15"><Link href="/auth/sign-up"><Sparkles className="size-4" />Criar Conta</Link></Button>
            </>
          )}
        </div>

        <button type="button" className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-card/50 text-foreground transition-colors hover:bg-secondary md:hidden" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border/50 bg-background/95 shadow-lg backdrop-blur-xl md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col px-4 py-4" aria-label="Navegação mobile">
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                  {l.label}
                </a>
              ))}
            </div>

            <div className="mt-3 border-t border-border/60 pt-3">
              {user ? (
                <div className="flex flex-col gap-2">
                  {user.isAdmin && <Link href="/admin" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm"><Shield className="size-5" />Admin</Link>}
                  <Link href="/minha-conta" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl bg-secondary px-4 text-sm font-semibold text-foreground"><LayoutDashboard className="size-5" />Minha Conta</Link>
                  <button type="button" onClick={handleLogout} className="flex min-h-10 items-center gap-3 rounded-xl px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"><LogOut className="size-4" />Sair</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/auth/login" onClick={() => setOpen(false)} className="flex min-h-11 items-center justify-center rounded-xl border border-border px-3 text-sm font-medium transition-colors hover:bg-secondary">Entrar</Link>
                  <Link href="/auth/sign-up" onClick={() => setOpen(false)} className="flex min-h-11 items-center justify-center rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm">Criar Conta</Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
