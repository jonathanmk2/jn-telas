'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function CopyButton({
  value,
  className,
  label = 'Copiar código',
}: {
  value: string
  className?: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={handleCopy}
      aria-label={label}
      className={cn('gap-1.5', className)}
    >
      {copied ? (
        <>
          <Check className="size-4 text-primary" /> Copiado
        </>
      ) : (
        <>
          <Copy className="size-4" /> Copiar
        </>
      )}
    </Button>
  )
}
