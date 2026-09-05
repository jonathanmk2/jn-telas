type AuditLog = {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  description: string
  metadata: Record<string, unknown> | null
  created_at: string
}

type AdminAuditLogProps = {
  logs: AuditLog[]
}

const actionLabels: Record<string, string> = {
  create_codes: 'Criação de códigos',
  assign_code: 'Atribuição de código',
  unassign_code: 'Remoção de atribuição',
  set_code_status: 'Alteração de status',
  sync_used_codes: 'Sincronização de códigos',
  delete_code: 'Exclusão de código',
  set_order_status: 'Alteração de pedido',
}

const entityLabels: Record<string, string> = {
  activation_code: 'Código',
  order: 'Pedido',
  codes: 'Códigos',
}

export function AdminAuditLog({ logs }: AdminAuditLogProps) {
  return (
    <section className="mb-8 rounded-xl border border-border/60 bg-card">
      <div className="border-b border-border/60 px-5 py-4">
        <h2 className="font-semibold">Histórico administrativo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Últimas ações realizadas no painel administrativo.
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="px-5 py-6 text-sm text-muted-foreground">
          Nenhuma ação administrativa registrada ainda.
        </div>
      ) : (
        <div className="divide-y">
          {logs.map((log) => (
            <div key={log.id} className="px-5 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                      {actionLabels[log.action] ?? log.action}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {entityLabels[log.entity_type] ?? log.entity_type}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium break-words">
                    {log.description}
                  </p>
                  {log.entity_id ? (
                    <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                      ID: {log.entity_id}
                    </p>
                  ) : null}
                </div>
                <time
                  dateTime={log.created_at}
                  className="shrink-0 text-xs text-muted-foreground"
                >
                  {new Date(log.created_at).toLocaleString('pt-BR')}
                </time>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
