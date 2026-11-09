import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const platformParam = new URL(request.url).searchParams.get('platform')
  const platform = platformParam === 'vsphone' ? 'vsphone' : 'ldcloud'
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: codes, error: codesError } = await admin
    .from('activation_codes')
    .select('id')
    .eq('platform', platform)
    .eq('status', 'active')
    .is('user_id', null)

  if (codesError) {
    console.error('Erro ao consultar estoque:', codesError)
    return NextResponse.json({ ok: false, error: 'Não foi possível consultar o estoque.' }, { status: 500 })
  }

  const { data: reservations, error: reservationsError } = await admin
    .from('activation_code_reservations')
    .select('activation_code_id')
    .gt('expires_at', now)

  if (reservationsError) {
    console.error('Erro ao consultar reservas do estoque:', reservationsError)
    return NextResponse.json({ ok: false, error: 'Não foi possível consultar o estoque.' }, { status: 500 })
  }

  const reservedIds = new Set((reservations ?? []).map((item) => item.activation_code_id))
  const available = (codes ?? []).filter((code) => !reservedIds.has(code.id)).length

  return NextResponse.json({ ok: true, platform, available }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
