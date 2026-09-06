import { Clock, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { whatsappLink } from '@/lib/format'

function WhatsAppIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  )
}

export function Support() {
  return (
    <section id="suporte" className="scroll-mt-20 border-y border-border/40 bg-secondary/20 py-14 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card p-5 shadow-xl shadow-primary/5 sm:p-8 md:p-10">
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative grid grid-cols-1 items-center gap-8 md:grid-cols-[1fr_auto] md:gap-12">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                <ShieldCheck className="size-3.5" /> Suporte JN TELAS
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Precisou de ajuda?</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                Nossa equipe está pronta para ajudar com ativação, planos e dúvidas técnicas.
              </p>
            </div>

            <div className="w-full md:w-[360px]">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-sm sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#25D366] shadow-lg shadow-[#25D366]/10"><WhatsAppIcon className="size-7 text-white" /></div>
                  <div><p className="font-bold">WhatsApp</p><p className="text-sm text-muted-foreground">Resposta rápida no chat</p></div>
                </div>
                <Button asChild className="mt-4 h-11 w-full bg-[#25D366] font-bold text-white shadow-lg shadow-[#25D366]/20 transition-all hover:bg-[#20bd5a] hover:shadow-xl hover:shadow-[#25D366]/25" size="lg">
                  <a href={whatsappLink('Olá! Preciso de suporte com a JN TELAS.')} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
                    <WhatsAppIcon className="size-5" />
                    Falar pelo WhatsApp
                  </a>
                </Button>
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border/60 bg-background/50 p-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Clock className="size-5" /></div>
                <div><p className="text-sm font-semibold">Horário de atendimento</p><p className="text-xs text-muted-foreground">Todos os dias, das 8h às 22h</p></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
