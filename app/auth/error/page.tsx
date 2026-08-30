import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/auth/auth-shell'

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <AuthShell title="Algo deu errado" subtitle="Não foi possível concluir a autenticação">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {error ? `Erro: ${error}` : 'Ocorreu um erro inesperado. Tente novamente.'}
        </p>
        <Button asChild className="mt-2 w-full">
          <Link href="/auth/login">Voltar ao login</Link>
        </Button>
      </div>
    </AuthShell>
  )
}
