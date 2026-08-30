import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/auth/auth-shell'

export default function SignUpSuccessPage() {
  return (
    <AuthShell title="Confira seu e-mail" subtitle="Estamos quase lá!">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="size-7" />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Enviamos um link de confirmação para o seu e-mail. Clique no link para ativar sua conta e
          depois faça login.
        </p>
        <Button asChild className="mt-2 w-full">
          <Link href="/auth/login">Ir para o login</Link>
        </Button>
      </div>
    </AuthShell>
  )
}
