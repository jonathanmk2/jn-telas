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
    const codes = customCodes
      .split(/[\n,;]+/)
      .map((code) => code.trim())
      .filter(Boolean)

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
   ATIVAR / DESATIVAR / MARCAR COMO USADO
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

  /*
   * Status permitidos:
   *
   * active   = disponível
   * inactive = desativado
   * used     = usado
   */

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

  /*
   * Atualiza o Admin e também a área
   * do cliente.
   *
   * Assim, quando um código for marcado
   * como usado no Admin, o cliente poderá
   * receber o novo status no pedido.
   */

  revalidatePath('/admin')
  revalidatePath('/minha-conta')

  return {
    ok: true,
    message:
      status === 'active'
        ? 'Código ativado.'
        : status === 'inactive'
          ? 'Código desativado.'
          : 'Código marcado como usado.',
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
