'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, MailCheck } from 'lucide-react'
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
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      setError('O sistema de contas ainda não está configurado. Configure o Supabase na Vercel.')
      return
    }

    setLoading(true)
    setError(null)
    setResendMessage(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setError('Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada ou reenvie o e-mail abaixo.')
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

  async function resendConfirmation() {
    if (!email) {
      setError('Digite seu e-mail para reenviar a confirmação.')
      return
    }

    setResending(true)
    setError(null)
    setResendMessage(null)
    const supabase = createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })

    if (error) {
      if (error.status === 429) {
        setError('Aguarde um momento antes de solicitar outro e-mail de confirmação.')
      } else {
        setError('Não foi possível reenviar o e-mail agora. Tente novamente em alguns instantes.')
      }
    } else {
      setResendMessage('Novo e-mail de confirmação enviado. Verifique também a pasta de spam.')
    }
    setResending(false)
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

        {resendMessage && (
          <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary" role="status">
            {resendMessage}
          </p>
        )}

        <Button type="submit" disabled={loading || resending} className="mt-2">
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Entrando...
            </>
          ) : (
            'Entrar'
          )}
        </Button>

        {error?.toLowerCase().includes('confirme seu e-mail') && (
          <Button
            type="button"
            variant="outline"
            disabled={resending}
            onClick={resendConfirmation}
            className="w-full"
          >
            {resending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Reenviando...
              </>
            ) : (
              <>
                <MailCheck className="size-4" /> Reenviar confirmação por e-mail
              </>
            )}
          </Button>
        )}
      </form>
    </AuthShell>
  )
}
