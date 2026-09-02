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
            <div className="flex flex-col gap-0.5">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {l.label}
                </a>
              ))}
            </div>

            {/* Área da conta */}
            <div className="mt-2 border-t border-border/60 pt-3">
              {user ? (
                <div className="flex flex-col gap-2">
                  {/* Admin */}
                  {user.isAdmin && (
                    <Button
                      asChild
                      className="h-10 w-full justify-start rounded-lg bg-primary font-semibold text-primary-foreground shadow-sm"
                    >
                      <Link
                        href="/admin"
                        onClick={() => setOpen(false)}
                      >
                        <Shield className="size-5" />
                        Admin
                      </Link>
                    </Button>
                  )}

                  {/* Minha Conta */}
                  <Button
                    asChild
                    variant="secondary"
                    className="h-10 w-full justify-start rounded-lg font-semibold"
                  >
                    <Link
                      href="/minha-conta"
                      onClick={() => setOpen(false)}
                    >
                      <LayoutDashboard className="size-5" />
                      Minha Conta
                    </Link>
                  </Button>

                  {/* Sair */}
                  <Button
                    variant="ghost"
                    className="h-9 w-full justify-start rounded-lg text-muted-foreground"
                    onClick={handleLogout}
                  >
                    <LogOut className="size-4" />
                    Sair
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    asChild
                    variant="outline"
                    className="h-10"
                  >
                    <Link
                      href="/auth/login"
                      onClick={() => setOpen(false)}
                    >
                      Entrar
                    </Link>
                  </Button>

                  <Button
                    asChild
                    className="h-10"
                  >
                    <Link
                      href="/auth/sign-up"
                      onClick={() => setOpen(false)}
                    >
                      Criar Conta
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
