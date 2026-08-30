import { MessageCircle } from 'lucide-react'
import { whatsappLink } from '@/lib/format'

export function WhatsAppButton() {
  return (
    <a
      href={whatsappLink('Olá! Tenho interesse nos planos da JN TELAS.')}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:scale-105"
    >
      <MessageCircle className="size-5" />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  )
}
