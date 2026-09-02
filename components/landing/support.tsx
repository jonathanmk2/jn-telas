import { Clock, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { whatsappLink } from '@/lib/format'

function WhatsAppIcon({
  className = 'size-6',
}: {
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M16.002 3C8.82 3 3 8.82 3 16.002c0 2.287.598 4.435 1.646 6.3L3 29l6.876-1.604A12.94 12.94 0 0 0 16.002 29C23.182 29 29 23.182 29 16.002S23.182 3 16.002 3Z"
        fill="currentColor"
      />
      <path
        d="M21.475 18.734c-.3-.15-1.775-.875-2.05-.975-.275-.1-.475-.15-.675.15-.2.3-.775.975-.95 1.175-.175.2-.35.225-.65.075-.3-.15-1.267-.467-2.417-1.492-.894-.797-1.498-1.78-1.673-2.08-.175-.3-.019-.462.131-.612.134-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.585-.491-.505-.675-.515l-.575-.01c-.2 0-.525.075-.8.375-.275.3-1.05 1.025-1.05 2.5s1.075 2.9 1.225 3.1c.15.2 2.115 3.23 5.12 4.53.716.31 1.275.495 1.71.633.719.229 1.373.197 1.89.12.577-.086 1.775-.725 2.025-1.425.25-.7.25-1.3.175-1.425-.075-.125-.275-.2-.575-.35Z"
        fill="white"
      />
    </svg>
  )
}

export function Support() {
  return (
    <section
      id="suporte"
      className="scroll-mt-20 bg-secondary/30 py-10 sm:py-16"
    >
      <div className="mx-auto max-w-5xl px-3 sm:px-4">
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-8">
          <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-[1fr_auto] md:gap-10">

            {/* TEXTO */}
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                Suporte JN TELAS
              </span>

              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
                Precisa de ajuda?
                <br />
                Fale com a gente
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:mt-4 sm:text-base">
                Nossa equipe está pronta para ajudar com ativação,
                dúvidas sobre planos e problemas técnicos.
              </p>
            </div>

            {/* WHATSAPP */}
            <div className="w-full md:w-[360px]">
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4 sm:p-5">

                <div className="flex items-center gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#25D366]">
                    <WhatsAppIcon className="size-7" />
                  </div>

                  <div className="min-w-0">
                    <p className="font-semibold">
                      WhatsApp
                    </p>

                    <p className="text-sm text-muted-foreground">
                      Resposta rápida no chat
                    </p>
                  </div>
                </div>

                <Button
                  asChild
                  className="mt-4 w-full"
                  size="lg"
                >
                  <a
                    href={whatsappLink(
                      'Olá! Preciso de suporte com a JN TELAS.',
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <WhatsAppIcon className="size-5" />
                    Falar pelo WhatsApp
                    <ExternalLink className="ml-auto size-4" />
                  </a>
                </Button>
              </div>

              {/* HORÁRIO */}
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Clock className="size-5" />
                </div>

                <div>
                  <p className="text-sm font-medium">
                    Horário de atendimento
                  </p>

                  <p className="text-xs text-muted-foreground">
                    Todos os dias, das 8h às 22h
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
