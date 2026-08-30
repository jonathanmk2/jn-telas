'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

/** Verifies the caller is an authenticated admin. Returns the user id or null. */
async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  return profile?.is_admin ? user.id : null
}

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const block = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `LD-${block()}-${block()}-${block()}`
}

export async function createCodes(formData: FormData): Promise<ActionResult> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, error: 'Acesso não autorizado.' }

  const productId = (formData.get('productId') as string) || null
  const quantityRaw = Number(formData.get('quantity'))
  const customCodes = ((formData.get('codes') as string) || '').trim()

  const admin = createAdminClient()

  let rows: { code: string; product_id: string | null; status: string }[] = []

  if (customCodes) {
    const codes = customCodes
      .split(/[\n,;]+/)
      .map((c) => c.trim())
      .filter(Boolean)
    if (codes.length === 0) return { ok: false, error: 'Nenhum código válido informado.' }
    if (codes.length > 500) return { ok: false, error: 'Máximo de 500 códigos por vez.' }
    rows = codes.map((code) => ({ code, product_id: productId, status: 'active' }))
  } else {
    const quantity = Number.isInteger(quantityRaw) ? quantityRaw : 0
    if (quantity < 1 || quantity > 500) {
      return { ok: false, error: 'Informe uma quantidade entre 1 e 500.' }
    }
    rows = Array.from({ length: quantity }, () => ({
      code: randomCode(),
      product_id: productId,
      status: 'active',
    }))
  }

  const { error } = await admin.from('activation_codes').insert(rows)
  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'Um ou mais códigos já existem. Tente novamente.' }
    }
    return { ok: false, error: 'Não foi possível gerar os códigos.' }
  }

  revalidatePath('/admin')
  return { ok: true, message: `${rows.length} código(s) gerado(s).` }
}

export async function assignCode(formData: FormData): Promise<ActionResult> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, error: 'Acesso não autorizado.' }

  const codeId = formData.get('codeId') as string
  const userId = (formData.get('userId') as string) || null

  const admin = createAdminClient()
  const { error } = await admin
    .from('activation_codes')
    .update({
      user_id: userId,
      assigned_at: userId ? new Date().toISOString() : null,
    })
    .eq('id', codeId)

  if (error) return { ok: false, error: 'Não foi possível atribuir o código.' }

  revalidatePath('/admin')
  revalidatePath('/minha-conta')
  return { ok: true, message: userId ? 'Código atribuído.' : 'Atribuição removida.' }
}

export async function setCodeStatus(formData: FormData): Promise<ActionResult> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, error: 'Acesso não autorizado.' }

  const codeId = formData.get('codeId') as string
  const status = formData.get('status') as string
  if (!['active', 'inactive'].includes(status)) {
    return { ok: false, error: 'Status inválido.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('activation_codes').update({ status }).eq('id', codeId)
  if (error) return { ok: false, error: 'Não foi possível atualizar o status.' }

  revalidatePath('/admin')
  revalidatePath('/minha-conta')
  return { ok: true, message: status === 'active' ? 'Código ativado.' : 'Código desativado.' }
}

export async function deleteCode(formData: FormData): Promise<ActionResult> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, error: 'Acesso não autorizado.' }

  const codeId = formData.get('codeId') as string
  const admin = createAdminClient()
  const { error } = await admin.from('activation_codes').delete().eq('id', codeId)
  if (error) return { ok: false, error: 'Não foi possível excluir o código.' }

  revalidatePath('/admin')
  revalidatePath('/minha-conta')
  return { ok: true, message: 'Código excluído.' }
}

export async function setOrderStatus(formData: FormData): Promise<ActionResult> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, error: 'Acesso não autorizado.' }

  const orderId = formData.get('orderId') as string
  const status = formData.get('status') as string
  if (!['pending', 'paid', 'delivered', 'cancelled'].includes(status)) {
    return { ok: false, error: 'Status inválido.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('orders').update({ status }).eq('id', orderId)
  if (error) return { ok: false, error: 'Não foi possível atualizar o pedido.' }

  revalidatePath('/admin')
  revalidatePath('/minha-conta')
  return { ok: true, message: 'Pedido atualizado.' }
}
