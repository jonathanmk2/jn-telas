import Image from 'next/image'
import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <Image
        src="/jn-telas-logo.svg"
        alt="JN TELAS"
        width={44}
        height={44}
        className="size-10 object-contain"
        priority
      />
      <span className="text-lg font-bold tracking-tight sm:text-xl">
        JN <span className="text-primary">TELAS</span>
      </span>
    </span>
  )
}
