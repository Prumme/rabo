import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export type Product = { id: number; name: string; quantity: number }

export class Invalid extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export function productName(value: unknown) {
  if (typeof value !== 'string') throw new Invalid('Indique un nom de produit.')
  const name = value.trim().replace(/\s+/g, ' ')
  const key = name.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr')
  if (!key || name.length > 100) throw new Invalid('Le nom doit contenir entre 1 et 100 caractères.')
  return { name, key }
}

let connection: DatabaseSync | undefined

function db() {
  if (connection) return connection
  const path = process.env.RABO_DB_PATH || './data/rabo.sqlite'
  mkdirSync(dirname(path), { recursive: true })
  const sqlite = new DatabaseSync(path)
  sqlite.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      key TEXT NOT NULL UNIQUE,
      quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity BETWEEN 0 AND 9007199254740991)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS shortcut_requests (
      id TEXT PRIMARY KEY,
      product_key TEXT NOT NULL,
      response TEXT NOT NULL
    ) STRICT;
  `)
  connection = sqlite
  return sqlite
}

function transaction<T>(work: (sqlite: DatabaseSync) => T) {
  const sqlite = db()
  sqlite.exec('BEGIN IMMEDIATE')
  try {
    const result = work(sqlite)
    sqlite.exec('COMMIT')
    return result
  } catch (error) {
    sqlite.exec('ROLLBACK')
    throw error
  }
}

export function products() {
  return (db().prepare('SELECT id, name, quantity FROM products').all() as Product[])
    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
}

export function mutate(body: Record<string, unknown>) {
  return transaction(sqlite => {
    if (body.action === 'add') {
      const { name, key } = productName(body.name)
      sqlite.prepare(`
        INSERT INTO products (name, key, quantity) VALUES (?, ?, 1)
        ON CONFLICT (key) DO UPDATE SET quantity = quantity + 1
      `).run(name, key)
      return {}
    }
    const id = body.id
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) throw new Invalid('Produit invalide.')
    const current = sqlite.prepare('SELECT id, name, quantity FROM products WHERE id = ?').get(id) as Product | undefined
    if (!current) throw new Invalid('Produit introuvable.', 404)

    switch (body.action) {
      case 'rename': {
        const { name, key } = productName(body.name)
        if (sqlite.prepare('SELECT id FROM products WHERE key = ? AND id != ?').get(key, id)) {
          throw new Invalid('Ce nom est déjà utilisé.', 409)
        }
        sqlite.prepare('UPDATE products SET name = ?, key = ? WHERE id = ?').run(name, key, id)
        return {}
      }
      case 'check':
        sqlite.prepare('UPDATE products SET quantity = 0 WHERE id = ?').run(id)
        return { cleared: current.quantity }
      case 'increment':
      case 'decrement':
      case 'undo': {
        const delta = body.action === 'increment' ? 1 : body.action === 'decrement' ? -1 : body.quantity
        if (typeof delta !== 'number' || !Number.isSafeInteger(delta) || (body.action === 'undo' && delta < 1)) {
          throw new Invalid('Quantité invalide.')
        }
        sqlite.prepare('UPDATE products SET quantity = max(0, quantity + ?) WHERE id = ?').run(delta, id)
        return {}
      }
      default:
        throw new Invalid('Action inconnue.')
    }
  })
}

type ShortcutResult = { status: 'added'; name: string; quantity: number } |
  { status: 'needs_confirmation'; name: string }

export function shortcutAdd(body: Record<string, unknown>): ShortcutResult {
  const { name, key } = productName(body.name)
  const { requestId, confirmCreate } = body
  if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(requestId) ||
      (confirmCreate !== undefined && typeof confirmCreate !== 'boolean')) {
    throw new Invalid('Requête invalide.')
  }
  return transaction(sqlite => {
    const previous = sqlite.prepare('SELECT product_key, response FROM shortcut_requests WHERE id = ?').get(requestId)
    if (previous) {
      if (previous.product_key !== key) throw new Invalid('Identifiant de requête déjà utilisé.', 409)
      return JSON.parse(String(previous.response)) as ShortcutResult
    }

    const existing = sqlite.prepare('SELECT id FROM products WHERE key = ?').get(key)
    if (!existing && !confirmCreate) return { status: 'needs_confirmation', name }

    const product = sqlite.prepare(`
      INSERT INTO products (name, key, quantity) VALUES (?, ?, 1)
      ON CONFLICT (key) DO UPDATE SET quantity = quantity + 1
      RETURNING name, quantity
    `).get(name, key) as Pick<Product, 'name' | 'quantity'>
    const result = { status: 'added' as const, ...product }
    sqlite.prepare('INSERT INTO shortcut_requests VALUES (?, ?, ?)').run(requestId, key, JSON.stringify(result))
    return result
  })
}
