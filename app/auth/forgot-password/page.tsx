'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/auth/auth-shell'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo:
        process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
        `${window.location.origin}/auth/callback?next=/auth/update-password`,
    })
    if (error) {
      setError('Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.')
      setLoading(false)
      return
    }
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <AuthShell title="Verifique seu e-mail" subtitle="Link de recuperação enviado">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="size-7" />
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Se existir uma conta com este e-mail, você receberá um link para redefinir sua senha.
          </p>
          <Button asChild className="mt-2 w-full">
            <Link href="/auth/login">Voltar ao login</Link>
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Enviaremos um link para redefinir sua senha"
      footer={
        <Link href="/auth/login" className="font-medium text-primary hover:underline">
          Voltar ao login
        </Link>
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

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="mt-2">
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Enviando...
            </>
          ) : (
            'Enviar link de recuperação'
          )}
        </Button>
      </form>
    </AuthShell>
  )
}
