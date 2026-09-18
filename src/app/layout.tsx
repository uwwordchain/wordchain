import type { Metadata, Viewport } from 'next'
import { GlobalInterstitial } from '@/components/player/GlobalInterstitial'
import './globals.css'

export const metadata: Metadata = {
  title: 'UW WordChain',
  description: 'The daily word chain game for UW Madison students',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <GlobalInterstitial />
      </body>
    </html>
  )
}
