import Link from 'next/link'
import { MailCheck, TriangleAlert, Search, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/auth/auth-shell'

export default function SignUpSuccessPage() {
  return (
    <AuthShell
      title="Confira seu e-mail"
      subtitle="Estamos quase lá!"
      className="max-w-2xl"
      outerClassName="justify-start pt-8 md:pt-10"
    >
      <div className="flex flex-col gap-7 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="size-8" />
          </div>
          <p className="max-w-xl text-base leading-7 text-muted-foreground">
            Enviamos um link de confirmação para o seu e-mail. Clique no link para ativar sua conta e depois faça login.
          </p>
        </div>

        <div
          className="overflow-hidden rounded-2xl border-2 border-amber-400/80 bg-amber-400/10 text-left shadow-[0_0_28px_rgba(251,191,36,0.16)]"
          role="alert"
        >
          <div className="flex flex-col items-center gap-3 border-b border-amber-400/20 px-6 py-6 text-center">
            <TriangleAlert className="size-16 shrink-0 animate-[pulse_1.1s_ease-in-out_infinite] text-amber-400 drop-shadow-[0_0_18px_rgba(251,191,36,1)]" />
            <p className="text-xl font-extrabold tracking-wide text-amber-300">NÃO RECEBEU O E-MAIL?</p>
            <p className="text-base leading-7 text-foreground">
              Verifique sua <strong>Caixa de Spam / Lixo Eletrônico</strong>. O e-mail de confirmação pode estar lá.
            </p>
          </div>

          <div className="flex items-center gap-4 border-b border-amber-400/20 px-6 py-5">
            <Search className="size-6 shrink-0 text-amber-300" />
            <p className="text-base leading-7 text-foreground">
              Procure por <strong>“JN TELAS”</strong>.
            </p>
          </div>

          <div className="mx-5 my-5 flex items-center gap-4 rounded-xl border border-red-500/80 bg-red-500/15 px-5 py-5 text-left">
            <LockKeyhole className="size-7 shrink-0 text-red-300" />
            <p className="text-base font-bold leading-7 text-red-100">
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
