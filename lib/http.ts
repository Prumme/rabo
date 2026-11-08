import { NextResponse } from 'next/server'
import { Invalid } from './store'

export function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function payload(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new Invalid('Format JSON requis.', 415)
  }
  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Invalid('JSON invalide.')
  return body as Record<string, unknown>
}

export function failure(error: unknown) {
  if (error instanceof Invalid) return json({ error: error.message }, error.status)
  console.error(error)
  return json({ error: 'Une erreur est survenue. Réessaie dans un instant.' }, 500)
}
