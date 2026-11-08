import { matches } from '../../../../lib/auth'
import { failure, json, payload } from '../../../../lib/http'
import { shortcutAdd } from '../../../../lib/store'

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1]
  if (!token || !matches(token, process.env.RABO_SHORTCUT_TOKEN)) {
    return json({ error: 'Jeton invalide.' }, 401)
  }
  try {
    return json(shortcutAdd(await payload(request)))
  } catch (error) {
    return failure(error)
  }
}
