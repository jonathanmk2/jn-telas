'use client'

import { Copy } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

export function CopyAllButton({
  codes,
}: {
  codes: string[]
}) {
  async function handleCopy() {
    if (codes.length === 0) {
      toast.error('Nenhum código disponível para copiar.')
      return
    }

    try {
      await navigator.clipboard.writeText(
        codes.join('\n'),
      )

      toast.success(
        `${codes.length} ${
          codes.length === 1
            ? 'código copiado'
            : 'códigos copiados'
        }!`,
      )
    } catch {
      toast.error(
        'Não foi possível copiar os códigos.',
      )
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
    >
      <Copy className="size-4" />
      Copiar todos
    </Button>
  )
}
