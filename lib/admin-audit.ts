import { createAdminClient } from '@/lib/supabase/admin'

type AuditInput = {
  adminId: string
  action: string
  entityType: string
  entityId?: string | null
  description: string
  metadata?: Record<string, unknown>
}

export async function createAdminAuditLog({
  adminId,
  action,
  entityType,
  entityId = null,
  description,
  metadata = {},
}: AuditInput) {
  try {
    const admin = createAdminClient()

    const { error } = await admin
      .from('admin_audit_logs')
      .insert({
        admin_id: adminId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        description,
        metadata,
      })

    if (error) {
      console.error(
        'Erro ao registrar auditoria administrativa:',
        error,
      )
    }
  } catch (error) {
    console.error(
      'Erro inesperado ao registrar auditoria administrativa:',
      error,
    )
  }
}
