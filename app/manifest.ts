import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Rabo · Liste de courses',
    short_name: 'Rabo',
    lang: 'fr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f8f6ee',
    theme_color: '#f8f6ee',
    icons: [
      { src: '/rabo-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/rabo-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
