import Link from 'next/link'
import { MailCheck, TriangleAlert, Mail, Search, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/auth/auth-shell'

export default function SignUpSuccessPage() {
  return (
    <AuthShell title="Confira seu e-mail" subtitle="Estamos quase lá!" className="max-w-md">
      <div className="flex flex-col gap-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="size-7" />
          </div>
          <p className="max-w-lg text-sm leading-6 text-muted-foreground">
            Enviamos um link de confirmação para o seu e-mail. Clique no link para ativar sua conta e depois faça login.
          </p>
        </div>

        <div
          className="overflow-hidden rounded-xl border-2 border-amber-400/80 bg-amber-400/10 text-left shadow-[0_0_22px_rgba(251,191,36,0.12)]"
          role="alert"
        >
          <div className="flex flex-col items-center gap-3 border-b border-amber-400/20 px-5 py-5 text-center">
            <TriangleAlert className="size-12 shrink-0 animate-[pulse_1.25s_ease-in-out_infinite] text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.95)]" />
            <p className="text-base font-extrabold tracking-wide text-amber-300">NÃO RECEBEU O E-MAIL?</p>
            <p className="text-sm leading-6 text-foreground">
              Verifique sua <strong>Caixa de Spam / Lixo Eletrônico</strong>. O e-mail de confirmação pode estar lá.
            </p>
          </div>

          <div className="flex items-center gap-3 border-b border-amber-400/20 px-5 py-4">
            <Search className="size-5 shrink-0 text-amber-300" />
            <p className="text-sm leading-6 text-foreground">
              Procure por <strong>“JN TELAS”</strong>.
            </p>
          </div>

          <div className="mx-4 my-4 flex items-center gap-3 rounded-lg border border-red-500/80 bg-red-500/15 px-4 py-4 text-left">
            <LockKeyhole className="size-6 shrink-0 text-red-300" />
            <p className="text-sm font-bold leading-6 text-red-100">
              A conta só pode ser criada após a confirmação do e-mail.
            </p>
          </div>
        </div>

        <Button asChild className="w-full">
          <Link href="/auth/login">Ir para o login</Link>
        </Button>
      </div>
    </AuthShell>
  )
}
