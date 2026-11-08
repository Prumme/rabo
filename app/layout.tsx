import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './style.css'

export const metadata: Metadata = {
  title: 'Rabo · Liste de courses',
  description: 'Ta liste de courses et ta réserve de produits habituels.',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Rabo" },
}

export const viewport: Viewport = { themeColor: "#f8f6ee" }


export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="fr"><body>{children}</body></html>
}
