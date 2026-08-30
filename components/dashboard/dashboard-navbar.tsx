'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { createClient } from '@/lib/supabase/client'

export function DashboardNavbar({ email }: { email: string | null }) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="border-b border-border/60 bg-card/40">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" aria-label="Página inicial">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          {email && (
            <span className="hidden max-w-[160px] truncate text-sm text-muted-foreground sm:inline">
              {email}
            </span>
          )}
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <Home className="size-4" />
              <span className="hidden sm:inline">Início</span>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
