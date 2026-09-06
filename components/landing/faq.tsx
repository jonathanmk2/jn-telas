import { CircleHelp } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

const faqs = [
  { q: 'Como recebo meu código de ativação?', a: 'Após a confirmação da compra, seus códigos ficam disponíveis na área "Meus Códigos" dentro da sua conta. É só copiar e usar.' },
  { q: 'Em quantos aparelhos posso usar?', a: 'Depende do plano escolhido. O plano de 1 tela permite 1 acesso simultâneo, o de 5 telas permite 5, e o de 10 telas permite 10 acessos ao mesmo tempo.' },
  { q: 'Preciso pagar mensalmente?', a: 'Os planos são mensais e sem fidelidade. Você renova quando quiser, sem multas ou taxas escondidas.' },
  { q: 'Como acompanho meus códigos após a compra?', a: 'Sim. Nossa solução é compatível com smart TVs, celulares, tablets, TV Box e computadores.' },
  { q: 'Como funciona o suporte?', a: 'Nosso suporte é feito pelo WhatsApp, com atendimento humanizado todos os dias para tirar dúvidas e ajudar com a ativação.' },
  { q: 'Posso trocar de plano depois?', a: 'Sim. Você pode adquirir um novo plano com mais telas a qualquer momento pela nossa página de planos.' },
]

export function Faq() {
  return (
    <section id="faq" className="relative mx-auto max-w-4xl scroll-mt-20 px-4 py-20 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10">
          <CircleHelp className="size-5" />
        </div>
        <span className="mt-4 block text-xs font-bold uppercase tracking-[0.2em] text-primary">Dúvidas</span>
        <h2 className="mt-2 text-balance text-3xl font-extrabold tracking-tight md:text-4xl">Perguntas frequentes</h2>
        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">As principais informações antes de contratar.</p>
      </div>

      <Accordion type="single" collapsible className="mt-10 overflow-hidden rounded-2xl border border-border/60 bg-card/60 px-5 shadow-sm sm:px-7">
        {faqs.map((f, i) => (
          <AccordionItem key={i} value={`item-${i}`}>
            <AccordionTrigger className="py-5 text-left text-sm font-semibold sm:text-base">{f.q}</AccordionTrigger>
            <AccordionContent className="pb-5 leading-6 text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
