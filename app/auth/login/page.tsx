'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/auth/auth-shell'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/minha-conta'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      setError('O sistema de contas ainda não está configurado. Configure o Supabase na Vercel.')
      return
    }

    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setError('Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.')
      } else if (error.status === 429) {
        setError('Muitas tentativas. Aguarde um momento e tente novamente.')
      } else {
        setError('E-mail ou senha inválidos.')
      }
      setLoading(false)
      return
    }
    router.push(next)
    router.refresh()
  }

  return (
    <AuthShell
      title="Entrar"
      subtitle="Acesse sua conta JN TELAS"
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link href="/auth/sign-up" className="font-medium text-primary hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="voce@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link
              href="/auth/forgot-password"
              className="text-xs text-muted-foreground hover:text-primary"
            >
              Esqueceu a senha?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="mt-2">
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Entrando...
            </>
          ) : (
            'Entrar'
          )}
        </Button>
      </form>
    </AuthShell>
  )
}
