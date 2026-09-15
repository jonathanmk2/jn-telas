import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function normalize(value: string) { return Array.from(new Set(value.split(/[\n,;]+/).map((v) => v.trim()).filter(Boolean))) }

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Acesso não autorizado.' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (!profile?.is_admin) return NextResponse.json({ ok: false, error: 'Acesso não autorizado.' }, { status: 403 })

  const body = await request.json().catch(() => null) as { platform?: string; codes?: string } | null
  const platform = body?.platform === 'vsphone' ? 'vsphone' : body?.platform === 'ldcloud' ? 'ldcloud' : null
  const codes = normalize(body?.codes ?? '')
  if (!platform) return NextResponse.json({ ok: false, error: 'Selecione LD CLOUD ou VSPHONE.' }, { status: 400 })
  if (!codes.length || codes.length > 500) return NextResponse.json({ ok: false, error: 'Informe de 1 a 500 códigos.' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('activation_codes').insert(codes.map((code) => ({ code, status: 'active', platform, user_id: null, order_id: null, assigned_at: null })))
  if (error) return NextResponse.json({ ok: false, error: error.code === '23505' ? 'Um ou mais códigos já existem no estoque.' : error.message }, { status: 409 })
  return NextResponse.json({ ok: true, count: codes.length, platform })
}
