import Link from 'next/link'
import { MailCheck, TriangleAlert, Search, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/auth/auth-shell'

export default function SignUpSuccessPage() {
  return (
    <AuthShell
      title="Confira seu e-mail"
      subtitle="Estamos quase lá!"
      className="max-w-sm sm:max-w-md"
      outerClassName="justify-start pt-6 sm:pt-8 md:pt-10"
    >
      <div className="flex flex-col gap-5 text-center">
        <div className="flex flex-col items-center gap-3 sm:gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary sm:size-16">
            <MailCheck className="size-7 sm:size-8" />
          </div>
          <p className="max-w-lg text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
            Enviamos um link de confirmação para o seu e-mail. Clique no link para ativar sua conta e depois faça login.
          </p>
        </div>

        <div
          className="overflow-hidden rounded-xl border-2 border-amber-400/80 bg-amber-400/10 text-left shadow-[0_0_22px_rgba(251,191,36,0.14)]"
          role="alert"
        >
          <div className="flex flex-col items-center gap-2.5 border-b border-amber-400/20 px-4 py-4 text-center sm:gap-3 sm:px-5 sm:py-5">
            <TriangleAlert className="size-11 shrink-0 animate-[pulse_1.1s_ease-in-out_infinite] text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,1)] sm:size-14" />
            <p className="text-base font-extrabold tracking-wide text-amber-300 sm:text-lg">NÃO RECEBEU O E-MAIL?</p>
            <p className="text-sm leading-6 text-foreground sm:text-base sm:leading-7">
              Verifique sua <strong>Caixa de Spam / Lixo Eletrônico</strong>. O e-mail de confirmação pode estar lá.
            </p>
          </div>

          <div className="flex items-center gap-3 border-b border-amber-400/20 px-4 py-3.5 sm:gap-4 sm:px-5 sm:py-4">
            <Search className="size-5 shrink-0 text-amber-300 sm:size-6" />
            <p className="text-sm leading-6 text-foreground sm:text-base sm:leading-7">
              Procure por <strong>“JN TELAS”</strong>.
            </p>
          </div>

          <div className="mx-3 my-3 flex items-center gap-3 rounded-lg border border-red-500/80 bg-red-500/15 px-3 py-3.5 text-left sm:mx-4 sm:my-4 sm:gap-4 sm:px-4 sm:py-4">
            <LockKeyhole className="size-5 shrink-0 text-red-300 sm:size-6" />
            <p className="text-sm font-bold leading-6 text-red-100 sm:text-base sm:leading-7">
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
