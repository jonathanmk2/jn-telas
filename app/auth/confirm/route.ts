import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function getSafeNext(request: NextRequest, rawNext: string | null) {
  if (!rawNext) return '/minha-conta'

  if (rawNext.startsWith('/') && !rawNext.startsWith('//')) {
    return rawNext
  }

  try {
    const parsed = new URL(rawNext)

    if (parsed.origin !== request.nextUrl.origin) {
      return '/minha-conta'
    }

    const nestedNext = parsed.searchParams.get('next')
    if (nestedNext?.startsWith('/') && !nestedNext.startsWith('//')) {
      return nestedNext
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/minha-conta'
  } catch {
    return '/minha-conta'
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = getSafeNext(request, searchParams.get('next'))

  if (tokenHash && type === 'email') {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type: 'email',
      token_hash: tokenHash,
    })

    if (!error) {
      return NextResponse.redirect(new URL(next, request.nextUrl.origin))
    }
  }

  return NextResponse.redirect(new URL('/auth/error', request.nextUrl.origin))
}
