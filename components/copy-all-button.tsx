'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

export function CopyAllButton({
  codes,
}: {
  codes: string[]
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (codes.length === 0) {
      toast.error(
        'Nenhum código disponível para copiar.',
      )
      return
    }

    try {
      // Um código por linha
      const text = codes.join('\n')

      await navigator.clipboard.writeText(text)

      setCopied(true)

      toast.success(
        `${codes.length} ${
          codes.length === 1
            ? 'código copiado!'
            : 'códigos copiados!'
        }`,
      )

      setTimeout(() => {
        setCopied(false)
      }, 2000)
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
      disabled={copied}
    >
      {copied ? (
        <>
          <Check className="size-4" />
          Copiados!
        </>
      ) : (
        <>
          <Copy className="size-4" />
          Copiar todos
        </>
      )}
    </Button>
  )
}
