'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function PlatformStockManager({ ldAvailable, vsAvailable }: { ldAvailable: number; vsAvailable: number }) {
  const router = useRouter()
  const [platform, setPlatform] = useState<'ldcloud' | 'vsphone'>('ldcloud')
  const [codes, setCodes] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setPending(true)
    try {
      const response = await fetch('/api/admin/codes/platform', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform, codes }) })
      const data = await response.json()
      if (!response.ok || !data.ok) return toast.error(data.error ?? 'Não foi possível adicionar os códigos.')
      toast.success(`${data.count} código(s) adicionados ao estoque ${platform === 'vsphone' ? 'VSPHONE' : 'LD CLOUD'}.`)
      setCodes(''); router.refresh()
    } catch { toast.error('Erro ao adicionar códigos.') } finally { setPending(false) }
  }

  return <section className="mb-8 rounded-xl border border-primary/30 bg-card p-5 shadow-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h2 className="text-lg font-semibold">Adicionar códigos ao estoque</h2><p className="mt-1 text-sm text-muted-foreground">Escolha a plataforma antes de inserir os códigos. Os estoques são separados.</p></div>
      <div className="flex gap-2 text-xs"><span className="rounded-full border px-3 py-1">LD CLOUD: <b>{ldAvailable}</b></span><span className="rounded-full border px-3 py-1">VSPHONE: <b>{vsAvailable}</b></span></div>
    </div>
    <form onSubmit={submit} className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setPlatform('ldcloud')} className={`rounded-lg border p-3 text-sm font-bold ${platform === 'ldcloud' ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}>LD CLOUD</button>
        <button type="button" onClick={() => setPlatform('vsphone')} className={`rounded-lg border p-3 text-sm font-bold ${platform === 'vsphone' ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}>VSPHONE</button>
      </div>
      <div className="rounded-lg border bg-secondary/30 px-3 py-2 text-xs">Destino selecionado: <b>{platform === 'vsphone' ? 'VSPHONE VIP • 30 DIAS' : 'LD CLOUD VIP • 30 DIAS'}</b></div>
      <textarea required value={codes} onChange={(e) => setCodes(e.target.value)} disabled={pending} className="min-h-36 w-full rounded-md border bg-background p-3 font-mono text-sm" placeholder={'Cole um código por linha\nCODIGO-001\nCODIGO-002'} />
      <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? 'Adicionando...' : `Adicionar ao ${platform === 'vsphone' ? 'VSPHONE' : 'LD CLOUD'}`}</Button></div>
    </form>
  </section>
}
