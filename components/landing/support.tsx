import { MessageCircle, Mail, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { whatsappLink } from '@/lib/format'

export function Support() {
  return (
    <section id="suporte" className="scroll-mt-20 bg-secondary/30 py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="rounded-2xl border border-border/60 bg-card p-8 md:p-12">
          <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
                Precisa de ajuda? Fale com a gente
              </h2>
              <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
                Nossa equipe de suporte está pronta para ajudar com ativação, dúvidas sobre planos e
                qualquer problema técnico. Atendimento rápido e humanizado.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <a
                    href={whatsappLink('Olá! Preciso de suporte com a JN TELAS.')}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="size-5" /> Suporte no WhatsApp
                  </a>
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              {[
                { icon: MessageCircle, title: 'WhatsApp', desc: 'Resposta rápida no chat' },
                { icon: Mail, title: 'E-mail', desc: 'Contato pelo WhatsApp' },
                { icon: Clock, title: 'Horário', desc: 'Todos os dias, 8h às 22h' },
              ].map((c) => (
                <div
                  key={c.title}
                  className="flex items-center gap-4 rounded-xl border border-border/60 bg-background/50 p-4"
                >
                  <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <c.icon className="size-5" />
                  </div>
                  <div>
                    <p className="font-medium">{c.title}</p>
                    <p className="text-sm text-muted-foreground">{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
