import type { NextRequest } from 'next/server'
import { cookieName, matches, newSession, sessionAge, validSession } from '../../../lib/auth'
import { failure, json, payload } from '../../../lib/http'
import { mutate, products } from '../../../lib/store'

const cookieOptions = { httpOnly: true, sameSite: 'strict' as const, path: '/' }

function authenticated(request: NextRequest) {
  return validSession(request.cookies.get(cookieName)?.value)
}

export function GET(request: NextRequest) {
  if (!authenticated(request)) return json({ error: 'Connecte-toi pour ouvrir Rabo.' }, 401)
  try {
    return json({ products: products() })
  } catch (error) {
    return failure(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await payload(request)
    if (body.action === 'login') {
      if (typeof body.password !== 'string' || !matches(body.password, process.env.RABO_PASSWORD)) {
        return json({ error: 'Mot de passe incorrect.' }, 401)
      }
      const response = json({ products: products() })
      response.cookies.set(cookieName, newSession(), {
        ...cookieOptions,
        secure: process.env.NODE_ENV === 'production',
        maxAge: sessionAge,
      })
      return response
    }
    if (!authenticated(request)) return json({ error: 'Ta session a expiré.' }, 401)
    if (body.action === 'logout') {
      const response = json({})
      response.cookies.set(cookieName, '', { ...cookieOptions, maxAge: 0 })
      return response
    }
    return json({ ...mutate(body), products: products() })
  } catch (error) {
    return failure(error)
  }
}
