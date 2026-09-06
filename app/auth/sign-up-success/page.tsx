import Link from 'next/link'
import { MailCheck, TriangleAlert } from 'lucide-react'
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
            Enviamos um link de confirmação para o seu e-mail. Clique no link para ativar sua conta e
            depois faça login.
          </p>
        </div>

        <div
          className="rounded-xl border-2 border-amber-400/70 bg-amber-400/10 px-4 py-4 text-left shadow-sm"
          role="alert"
        >
          <div className="flex gap-3">
            <TriangleAlert className="mt-0.5 size-6 shrink-0 text-amber-400" />
            <div className="space-y-2">
              <p className="font-bold text-amber-300">🚨 AVISO IMPORTANTE</p>
              <p className="text-sm leading-relaxed text-foreground">
                📧 <strong>NÃO RECEBEU O E-MAIL DE CONFIRMAÇÃO?</strong>
              </p>
              <p className="text-sm leading-relaxed text-foreground">
                Verifique também a sua <strong>CAIXA DE SPAM / LIXO ELETRÔNICO</strong>.
              </p>
              <p className="text-sm leading-relaxed text-foreground">
                O e-mail pode ser direcionado para lá automaticamente.{' '}
                <strong>Procure por “JN TELAS”</strong> e marque como <strong>“Não é spam”</strong> para
                receber nossos próximos e-mails normalmente.
              </p>
              <p className="text-sm font-semibold leading-relaxed text-amber-200">
                ⚠️ Sem confirmar seu e-mail, sua conta não poderá ser ativada.
              </p>
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
