import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import { PendingPayment } from '@/components/pending-payment'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: 'JN TELAS | Soluções por Telas Virtuais',
  description:
    'JN TELAS é uma plataforma independente para compra e acompanhamento de soluções por telas virtuais, com planos, códigos e suporte.',
  generator: 'v0.app',
  icons: {
    icon: '/jn-telas-logo.svg',
    shortcut: '/jn-telas-logo.svg',
    apple: '/jn-telas-logo.svg',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0b1020',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} bg-background`}>
      <body className="font-sans antialiased">
        <Suspense fallback={null}>{children}</Suspense>
        <PendingPayment />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
