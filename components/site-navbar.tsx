'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Menu,
  X,
  LayoutDashboard,
  LogOut,
  Shield,
} from 'lucide-react'
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
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 md:py-3">
        <Link
          href="/"
          aria-label="Página inicial JN TELAS"
          onClick={() => setOpen(false)}
        >
          <Logo />
        </Link>

        {/* Navegação desktop */}
        <nav
          className="hidden items-center gap-8 md:flex"
          aria-label="Navegação principal"
        >
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

        {/* Ações desktop */}
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              {user.isAdmin && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin">
                    <Shield className="size-4" />
                    Admin
                  </Link>
                </Button>
              )}

              <Button asChild variant="secondary" size="sm">
                <Link href="/minha-conta">
                  <LayoutDashboard className="size-4" />
                  Minha Conta
                </Link>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
              >
                <LogOut className="size-4" />
                Sair
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/auth/login">
                  Entrar
                </Link>
              </Button>

              <Button asChild size="sm">
                <Link href="/auth/sign-up">
                  Criar Conta
                </Link>
              </Button>
            </>
          )}
        </div>

        {/* Botão menu mobile */}
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
        >
          {open ? (
            <X className="size-5" />
          ) : (
            <Menu className="size-5" />
          )}
        </button>
      </div>

      {/* Menu mobile */}
      {open && (
        <div className="border-t border-border/60 bg-background md:hidden">
          <nav
            className="mx-auto flex max-w-6xl flex-col px-4 py-3"
            aria-label="Navegação mobile"
          >
            {/* Links principais */}
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-10 w-full items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {l.label}
                </a>
              ))}
            </div>

            {/* Área da conta */}
            <div className="mt-2 border-t border-border/60 pt-3">
              {user ? (
                <div className="flex flex-col gap-2">
                  {/* ADMIN */}
                  {user.isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setOpen(false)}
                      className="flex min-h-11 w-full items-center gap-3 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-transform active:scale-[0.98]"
                    >
                      <Shield className="size-5 shrink-0" />
                      <span>Admin</span>
                    </Link>
                  )}

                  {/* MINHA CONTA */}
                  <Link
                    href="/minha-conta"
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl bg-secondary px-4 text-sm font-semibold text-foreground shadow-sm transition-transform active:scale-[0.98]"
                  >
                    <LayoutDashboard className="size-5 shrink-0" />
                    <span>Minha Conta</span>
                  </Link>

                  {/* SAIR */}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex min-h-10 w-full items-center gap-3 rounded-xl px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <LogOut className="size-4 shrink-0" />
                    <span>Sair</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/auth/login"
                    onClick={() => setOpen(false)}
                    className="flex min-h-10 w-full items-center justify-center rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-secondary"
                  >
                    Entrar
                  </Link>

                  <Link
                    href="/auth/sign-up"
                    onClick={() => setOpen(false)}
                    className="flex min-h-10 w-full items-center justify-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
                  >
                    Criar Conta
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
