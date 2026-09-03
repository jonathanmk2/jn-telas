'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type ActionResult =
  | {
      ok: true
      message?: string
    }
  | {
      ok: false
      error: string
    }

/* =========================================================
   RESULTADO DA SINCRONIZAÇÃO
========================================================= */

export type SyncUsedCodesResult =
  | {
      ok: true
      found: number
      updated: number
      notFound: string[]
      message: string
    }
  | {
      ok: false
      error: string
    }

/* =========================================================
   VERIFICA SE O USUÁRIO É ADMIN
========================================================= */

async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error(
      'Erro ao verificar administrador:',
      error,
    )

    return null
  }

  if (!profile?.is_admin) {
    return null
  }

  return user.id
}

/* =========================================================
   GERA CÓDIGO ALEATÓRIO
========================================================= */

function randomCode(): string {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

  const block = () =>
    Array.from(
      { length: 4 },
      () =>
        chars[
          Math.floor(
            Math.random() * chars.length,
          )
        ],
    ).join('')

  return `LD-${block()}-${block()}-${block()}`
}

/* =========================================================
   NORMALIZA LISTA DE CÓDIGOS
========================================================= */

function normalizeCodes(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]+/)
        .map((code) => code.trim())
        .filter(Boolean),
    ),
  )
}

/* =========================================================
   CRIAR CÓDIGOS
   ESTOQUE ÚNICO
========================================================= */

export async function createCodes(
  formData: FormData,
): Promise<ActionResult> {
  const adminId = await requireAdmin()

  if (!adminId) {
    return {
      ok: false,
      error: 'Acesso não autorizado.',
    }
  }

  const quantityRaw = Number(
    formData.get('quantity'),
  )

  const customCodes = (
    (formData.get('codes') as string) || ''
  ).trim()

  const admin = createAdminClient()

  let rows: {
    code: string
    product_id: string | null
    status: string
  }[] = []

  /* =====================================================
     CÓDIGOS PERSONALIZADOS
  ===================================================== */

  if (customCodes) {
    const codes = normalizeCodes(customCodes)

    if (codes.length === 0) {
      return {
        ok: false,
        error:
          'Nenhum código válido informado.',
      }
    }

    if (codes.length > 500) {
      return {
        ok: false,
        error:
          'Máximo de 500 códigos por vez.',
      }
    }

    rows = codes.map((code) => ({
      code,
      product_id: null,
      status: 'active',
    }))
  } else {
    /* =================================================
       CÓDIGOS AUTOMÁTICOS
    ================================================= */

    const quantity =
      Number.isInteger(quantityRaw)
        ? quantityRaw
        : 0

    if (quantity < 1 || quantity > 500) {
      return {
        ok: false,
        error:
          'Informe uma quantidade entre 1 e 500.',
      }
    }

    rows = Array.from(
      { length: quantity },
      () => ({
        code: randomCode(),
        product_id: null,
        status: 'active',
      }),
    )
  }

  /* =====================================================
     INSERE NO ESTOQUE
  ===================================================== */

  const { error } = await admin
    .from('activation_codes')
    .insert(rows)

  if (error) {
    console.error(
      'Erro ao criar códigos:',
      error,
    )

    if (error.code === '23505') {
      return {
        ok: false,
        error:
          'Um ou mais códigos já existem. Tente novamente.',
      }
    }

    return {
      ok: false,
      error:
        `Erro Supabase: ${error.message}`,
    }
  }

  revalidatePath('/admin')

  return {
    ok: true,
    message:
      `${rows.length} código(s) adicionado(s) ao estoque.`,
  }
}

/* =========================================================
   ATRIBUIR CÓDIGO A UM CLIENTE
========================================================= */

export async function assignCode(
  formData: FormData,
): Promise<ActionResult> {
  const adminId = await requireAdmin()

  if (!adminId) {
    return {
      ok: false,
      error: 'Acesso não autorizado.',
    }
  }

  const codeId = formData.get(
    'codeId',
  ) as string

  const userId =
    (formData.get('userId') as string) ||
    null

  const admin = createAdminClient()

  const { error } = await admin
    .from('activation_codes')
    .update({
      user_id: userId,
      assigned_at: userId
        ? new Date().toISOString()
        : null,
    })
    .eq('id', codeId)

  if (error) {
    console.error(
      'Erro ao atribuir código:',
      error,
    )

    return {
      ok: false,
      error:
        `Erro Supabase: ${error.message}`,
    }
  }

  revalidatePath('/admin')
  revalidatePath('/minha-conta')

  return {
    ok: true,
    message: userId
      ? 'Código atribuído ao cliente.'
      : 'Código removido do cliente.',
  }
}

/* =========================================================
   ATIVAR / DESATIVAR / USAR CÓDIGO
========================================================= */

export async function setCodeStatus(
  formData: FormData,
): Promise<ActionResult> {
  const adminId = await requireAdmin()

  if (!adminId) {
    return {
      ok: false,
      error: 'Acesso não autorizado.',
    }
  }

  const codeId = formData.get(
    'codeId',
  ) as string

  const status = formData.get(
    'status',
  ) as string

  if (
    ![
      'active',
      'inactive',
      'used',
    ].includes(status)
  ) {
    return {
      ok: false,
      error: 'Status inválido.',
    }
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('activation_codes')
    .update({
      status,
    })
    .eq('id', codeId)

  if (error) {
    console.error(
      'Erro ao atualizar código:',
      error,
    )

    return {
      ok: false,
      error:
        `Erro Supabase: ${error.message}`,
    }
  }

  revalidatePath('/admin')
  revalidatePath('/minha-conta')

  const messages: Record<string, string> = {
    active: 'Código ativado.',
    inactive: 'Código desativado.',
    used: 'Código marcado como usado.',
  }

  return {
    ok: true,
    message:
      messages[status] ??
      'Código atualizado.',
  }
}

/* =========================================================
   SINCRONIZAR CÓDIGOS USADOS EM MASSA

   IMPORTANTE:
   - NÃO cria códigos
   - NÃO altera cliente
   - NÃO altera pedido
   - NÃO altera data de compra
   - somente muda status para "used"
========================================================= */

export async function syncUsedCodes(
  formData: FormData,
): Promise<SyncUsedCodesResult> {
  const adminId = await requireAdmin()

  if (!adminId) {
    return {
      ok: false,
      error: 'Acesso não autorizado.',
    }
  }

  const rawCodes =
    (formData.get('codes') as string) || ''

  const codes = normalizeCodes(rawCodes)

  if (codes.length === 0) {
    return {
      ok: false,
      error:
        'Cole pelo menos um código para sincronizar.',
    }
  }

  if (codes.length > 5000) {
    return {
      ok: false,
      error:
        'Máximo de 5.000 códigos por sincronização.',
    }
  }

  const admin = createAdminClient()

  /*
   * Busca somente códigos que já existem.
   *
   * Não existe INSERT nesta função.
   */
  const { data: existingCodes, error } =
    await admin
      .from('activation_codes')
      .select('id, code, status')
      .in('code', codes)

  if (error) {
    console.error(
      'Erro ao localizar códigos para sincronização:',
      error,
    )

    return {
      ok: false,
      error:
        `Erro Supabase: ${error.message}`,
    }
  }

  const existing =
    existingCodes ?? []

  const existingMap = new Map(
    existing.map((item) => [
      item.code,
      item,
    ]),
  )

  const notFound = codes.filter(
    (code) =>
      !existingMap.has(code),
  )

  /*
   * Atualiza em lotes de 500.
   *
   * O update altera APENAS o status.
   * user_id, order_id, assigned_at e
   * todas as demais informações permanecem intactas.
   */
  const idsToUpdate = existing
    .filter(
      (item) =>
        item.status !== 'used',
    )
    .map((item) => item.id)

  let updated = 0

  for (
    let index = 0;
    index < idsToUpdate.length;
    index += 500
  ) {
    const batch = idsToUpdate.slice(
      index,
      index + 500,
    )

    if (batch.length === 0) {
      continue
    }

    const { data: updatedRows, error: updateError } =
      await admin
        .from('activation_codes')
        .update({
          status: 'used',
        })
        .in('id', batch)
        .select('id')

    if (updateError) {
      console.error(
        'Erro ao marcar lote de códigos como usados:',
        updateError,
      )

      return {
        ok: false,
        error:
          `Erro ao atualizar códigos: ${updateError.message}`,
      }
    }

    updated +=
      updatedRows?.length ?? 0
  }

  /*
   * "found" representa todos os códigos
   * que realmente existem no banco.
   *
   * "updated" representa os que precisaram
   * ser alterados para used.
   */
  const found = existing.length

  revalidatePath('/admin')
  revalidatePath('/minha-conta')

  return {
    ok: true,
    found,
    updated,
    notFound,
    message:
      `Sincronização concluída: ${found} encontrado(s), ${updated} atualizado(s) e ${notFound.length} não encontrado(s).`,
  }
}

/* =========================================================
   EXCLUIR CÓDIGO
========================================================= */

export async function deleteCode(
  formData: FormData,
): Promise<ActionResult> {
  const adminId = await requireAdmin()

  if (!adminId) {
    return {
      ok: false,
      error: 'Acesso não autorizado.',
    }
  }

  const codeId = formData.get(
    'codeId',
  ) as string

  const admin = createAdminClient()

  const { error } = await admin
    .from('activation_codes')
    .delete()
    .eq('id', codeId)

  if (error) {
    console.error(
      'Erro ao excluir código:',
      error,
    )

    return {
      ok: false,
      error:
        `Erro Supabase: ${error.message}`,
    }
  }

  revalidatePath('/admin')
  revalidatePath('/minha-conta')

  return {
    ok: true,
    message: 'Código excluído.',
  }
}

/* =========================================================
   ALTERAR STATUS DO PEDIDO
========================================================= */

export async function setOrderStatus(
  formData: FormData,
): Promise<ActionResult> {
  const adminId = await requireAdmin()

  if (!adminId) {
    return {
      ok: false,
      error: 'Acesso não autorizado.',
    }
  }

  const orderId = formData.get(
    'orderId',
  ) as string

  const status = formData.get(
    'status',
  ) as string

  if (
    ![
      'pending',
      'paid',
      'delivered',
      'cancelled',
    ].includes(status)
  ) {
    return {
      ok: false,
      error: 'Status inválido.',
    }
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('orders')
    .update({
      status,
    })
    .eq('id', orderId)

  if (error) {
    console.error(
      'Erro ao atualizar pedido:',
      error,
    )

    return {
      ok: false,
      error:
        `Erro Supabase: ${error.message}`,
    }
  }

  revalidatePath('/admin')
  revalidatePath('/minha-conta')

  return {
    ok: true,
    message: 'Pedido atualizado.',
  }
}
