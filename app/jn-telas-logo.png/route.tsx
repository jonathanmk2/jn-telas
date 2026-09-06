import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const logoUrl = new URL('/jn-telas-logo.svg', request.url).toString()

  return new ImageResponse(
    (
      <div
        style={{
          width: '600px',
          height: '600px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
        }}
      >
        <img src={logoUrl} width="600" height="600" alt="JN TELAS" />
      </div>
    ),
    {
      width: 600,
      height: 600,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    },
  )
}
