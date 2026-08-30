'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X, LayoutDashboard, LogOut, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type NavUser = {
  email: string | null
  isAdmin: boolean
} | null

const links = [
  { href: '#planos', label: 'Planos' },
  { href: '#beneficios', label: 'Benefícios' },
  { href: '#faq', label: 'FAQ' },
  { href: '#suporte', label: 'Suporte' },
]

export function SiteNavbar({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" aria-label="Página inicial JN TELAS">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Navegação principal">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              {user.isAdmin && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin">
                    <Shield className="size-4" /> Admin
                  </Link>
                </Button>
              )}
              <Button asChild variant="secondary" size="sm">
                <Link href="/minha-conta">
                  <LayoutDashboard className="size-4" /> Minha Conta
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="size-4" /> Sair
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/auth/login">Entrar</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/auth/sign-up">Criar Conta</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="text-foreground md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3" aria-label="Navegação mobile">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border/60 pt-3">
              {user ? (
                <>
                  {user.isAdmin && (
                    <Button asChild variant="ghost" className="justify-start">
                      <Link href="/admin">
                        <Shield className="size-4" /> Admin
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="secondary" className="justify-start">
                    <Link href="/minha-conta">
                      <LayoutDashboard className="size-4" /> Minha Conta
                    </Link>
                  </Button>
                  <Button variant="ghost" className="justify-start" onClick={handleLogout}>
                    <LogOut className="size-4" /> Sair
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild variant="ghost" className="justify-start">
                    <Link href="/auth/login">Entrar</Link>
                  </Button>
                  <Button asChild className="justify-start">
                    <Link href="/auth/sign-up">Criar Conta</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
