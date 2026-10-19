import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
import './globals.css'

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-noto-sans-kr',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://popple-five.vercel.app'),
  title: '팝플(Popple) - 우리 동네 축제 & 팝업스토어 정보 플랫폼',
  description:
    '전국 지역 축제와 팝업스토어 정보, 현장 상생 할인 쿠폰까지 한눈에 확인하는 팝플(Popple)입니다.',
  keywords: ['팝플', 'popple', '지역축제', '축제정보', '팝업스토어', '축제쿠폰'],
  alternates: {
    canonical: 'https://popple-five.vercel.app',
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://popple-five.vercel.app',
    siteName: '팝플 (Popple)',
    title: '팝플(Popple) - 우리 동네 축제 & 팝업스토어 정보 플랫폼',
    description:
      '전국 지역 축제와 팝업스토어 정보, 현장 상생 할인 쿠폰까지 한눈에 확인하는 팝플(Popple)입니다.',
    images: [
      {
        url: '/images/popple-logo.png',
        width: 800,
        height: 400,
        alt: '팝플 Popple 로고',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '팝플(Popple) - 우리 동네 축제 & 팝업스토어 정보 플랫폼',
    description:
      '전국 지역 축제와 팝업스토어 정보, 현장 상생 할인 쿠폰까지 한눈에 확인하는 팝플(Popple)입니다.',
    images: ['/images/popple-logo.png'],
  },
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className={notoSansKr.variable}>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
