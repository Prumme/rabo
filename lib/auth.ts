import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const cookieName = 'rabo_session'
export const sessionAge = 30 * 24 * 60 * 60

export function matches(value: string, expected: string | undefined) {
  if (!expected) return false
  const digest = (input: string) => createHash('sha256').update(input).digest()
  return timingSafeEqual(digest(value), digest(expected))
}

function sign(expiry: string, secret: string) {
  return createHmac('sha256', secret).update(expiry).digest('base64url')
}

export function newSession() {
  const secret = process.env.RABO_SESSION_SECRET
  if (!secret) throw new Error('Missing RABO_SESSION_SECRET')
  const expiry = String(Math.floor(Date.now() / 1000) + sessionAge)
  return `${expiry}.${sign(expiry, secret)}`
}

export function validSession(value = '') {
  const secret = process.env.RABO_SESSION_SECRET
  const [expiry, signature, extra] = value.split('.')
  return Boolean(secret && signature && extra === undefined &&
    /^\d+$/.test(expiry) && Number(expiry) > Date.now() / 1000 &&
    matches(signature, sign(expiry, secret)))
}
