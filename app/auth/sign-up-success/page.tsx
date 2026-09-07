import Link from 'next/link'
import { LockKeyhole, MailCheck, Search, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/auth/auth-shell'

export default function SignUpSuccessPage() {
  return (
    <AuthShell title="Confira seu e-mail" subtitle="Estamos quase lá!">
      <div className="flex flex-col gap-5 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="size-7" />
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Enviamos um link de confirmação para o seu e-mail.
            <br />
            Clique no link para ativar sua conta e depois faça login.
          </p>
        </div>

        <div
          className="rounded-xl border-2 border-amber-400/70 bg-amber-400/10 px-4 py-4 text-left shadow-sm"
          role="alert"
        >
          <div className="flex gap-3">
            <TriangleAlert className="mt-0.5 size-6 shrink-0 animate-pulse text-amber-400" />
            <div className="min-w-0 flex-1 space-y-3">
              <p className="font-bold text-amber-300">NÃO RECEBEU O E-MAIL?</p>

              <div className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
                <MailCheck className="mt-0.5 size-4 shrink-0 text-amber-300" />
                <p>
                  Verifique sua <strong>Caixa de Spam / Lixo Eletrônico</strong>.
                  <br />
                  O e-mail de confirmação pode estar lá.
                </p>
              </div>

              <div className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
                <Search className="mt-0.5 size-4 shrink-0 text-amber-300" />
                <p>
                  Procure por <strong>“JN TELAS”</strong>.
                </p>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-red-500/70 bg-red-500/10 px-3 py-3 text-sm font-bold leading-relaxed text-red-100">
                <LockKeyhole className="mt-0.5 size-5 shrink-0 text-red-300" />
                <p>
                  A conta só pode ser criada após a <strong>confirmação do e-mail</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>

        <Button asChild className="mt-1 w-full">
          <Link href="/auth/login">Ir para o login</Link>
        </Button>
      </div>
    </AuthShell>
  )
}
