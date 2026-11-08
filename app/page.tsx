'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Product } from '../lib/store'

type Reply = { products?: Product[]; cleared?: number; error?: string }
type Undo = { id: number; name: string; quantity: number }

const searchKey = (value: string) =>
  value.trim().replace(/\s+/g, ' ').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr')

export default function Home() {
  const [products, setProducts] = useState<Product[]>([])
  const [session, setSession] = useState<'loading' | 'private' | 'open' | 'error'>('loading')
  const [tab, setTab] = useState<'list' | 'reserve'>('list')
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [undo, setUndo] = useState<Undo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const version = useRef(0)
  const writing = useRef(false)

  useEffect(() => {
    let active = true
    async function refresh() {
      if (writing.current) return
      const read = ++version.current
      try {
        const response = await fetch('/api/rabo', { cache: 'no-store' })
        if (!active || read !== version.current) return
        if (response.status === 401) {
          setSession('private')
          setProducts([])
        } else if (response.ok) {
          const data: Reply = await response.json()
          if (!active || read !== version.current) return
          setProducts(data.products ?? [])
          setSession('open')
        } else {
          throw new Error()
        }
      } catch {
        if (active && read === version.current) {
          setSession(current => current === 'loading' ? 'error' : current)
        }
      }
    }
    const onVisible = () => { if (!document.hidden) void refresh() }
    void refresh()
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  async function write(action: string, fields: Record<string, unknown> = {}) {
    if (writing.current) return
    writing.current = true
    version.current++
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/rabo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...fields }),
      })
      const data: Reply = await response.json()
      if (!response.ok) {
        if (response.status === 401 && action !== 'login') {
          setSession('private')
          setProducts([])
          setUndo(null)
        }
        throw new Error(data.error ?? 'Action impossible.')
      }
      if (data.products) setProducts(data.products)
      return data
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action impossible.')
    } finally {
      writing.current = false
      setBusy(false)
    }
  }

  async function login(event: FormEvent) {
    event.preventDefault()
    if (await write('login', { password })) {
      setPassword('')
      setSession('open')
    }
  }

  async function add(value: string) {
    if (await write('add', { name: value })) {
      setAdding(false)
      setQuery('')
      setTab('list')
    }
  }

  const list = products.filter(product => product.quantity > 0)
  const matching = products.filter(product => searchKey(product.name).includes(searchKey(query)))

  return (
    <main>
      <header>
        <div className="brand"><span className="mark" aria-hidden="true">r.</span><h1>Rabo</h1></div>
        {session === 'open' && <button className="subtle" disabled={busy} onClick={async () => {
          if (await write('logout')) {
            setSession('private')
            setProducts([])
            setUndo(null)
            setAdding(false)
            setEditing(null)
            setQuery('')
            setTab('list')
          }
        }}>Déconnexion</button>}
      </header>
      {session === 'loading' && <p role="status">Chargement…</p>}
      {session === 'error' && <p role="alert">Rabo est inaccessible. <button onClick={() => location.reload()}>Réessayer</button></p>}
      {session === 'private' && (
        <form className="card login" onSubmit={login}>
          <h2>Ta liste privée</h2>
          <label htmlFor="password">Mot de passe</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
          <button className="primary" disabled={busy}>Ouvrir Rabo</button>
        </form>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {session === 'open' && <>
        <nav aria-label="Liste et réserve">
          {(['list', 'reserve'] as const).map(value => (
            <button key={value} aria-pressed={tab === value} onClick={() => {
              setTab(value)
              setAdding(false)
              setEditing(null)
              setQuery('')
            }}>{value === 'list' ? 'À acheter' : 'Réserve'}</button>
          ))}
        </nav>
        <section aria-labelledby="section-title">
          <div className="section-heading">
            <h2 id="section-title">{tab === 'list' ? 'Mes courses' : 'Ma réserve'}</h2>
            <span>{(tab === 'list' ? list : products).length} produit{(tab === 'list' ? list : products).length !== 1 ? 's' : ''}</span>
          </div>
          {tab === 'reserve' && !adding && <input type="search" aria-label="Rechercher dans la réserve" placeholder="Rechercher dans la réserve" value={query} onChange={event => setQuery(event.target.value)} />}
          {adding ? (
            <div className="card picker">
              <form onSubmit={event => { event.preventDefault(); void add(query) }}>
                <label htmlFor="query">Quel produit ajouter ?</label>
                <input autoFocus id="query" type="search" maxLength={100} placeholder="Ex. Lait" value={query} onChange={event => setQuery(event.target.value)} />
                {searchKey(query) && !products.some(product => searchKey(product.name) === searchKey(query)) &&
                  <button className="primary" disabled={busy}>Créer et ajouter « {query.trim()} »</button>}
              </form>
              {matching.map(product => <button key={product.id} className="choice" disabled={busy} onClick={() => void add(product.name)}>{product.name}<span aria-hidden="true">+</span></button>)}
              <button className="subtle" onClick={() => { setAdding(false); setQuery('') }}>Fermer</button>
            </div>
          ) : (
            <>
              {(tab === 'list' ? list : matching).length === 0 && (
                <p className="card empty">{tab === 'list' ? 'Ta liste est vide.' : query ? 'Aucun produit trouvé.' : 'Ta réserve est vide.'}</p>
              )}
              <ul>
                {(tab === 'list' ? list : matching).map(product => (
                  <li className="card row" key={product.id}>
                    {editing === product.id ? (
                      <form className="rename" onSubmit={async event => {
                        event.preventDefault()
                        if (await write('rename', { id: product.id, name })) setEditing(null)
                      }}>
                        <input autoFocus aria-label="Nouveau nom" required maxLength={100} value={name} onChange={event => setName(event.target.value)} />
                        <button disabled={busy} className="primary">Enregistrer</button>
                        <button type="button" onClick={() => setEditing(null)}>Annuler</button>
                      </form>
                    ) : <>
                      {tab === 'list' && <button className="check" disabled={busy} aria-label={`Cocher ${product.name}`} onClick={async () => {
                        const result = await write('check', { id: product.id })
                        if (result?.cleared) setUndo({ id: product.id, name: product.name, quantity: result.cleared })
                      }}><span aria-hidden="true" /></button>}
                      <strong>{product.name}</strong>
                      {tab === 'reserve' ? <button className="subtle" onClick={() => { setEditing(product.id); setName(product.name) }}>Renommer</button> :
                        <button className="step" disabled={busy} aria-label={`Diminuer ${product.name}`} onClick={() => void write('decrement', { id: product.id })}>−</button>}
                      <span className="quantity" aria-label={`${product.quantity} à acheter`}>{product.quantity}</span>
                      <button className="step" disabled={busy} aria-label={`Ajouter une unité de ${product.name}`} onClick={() => void write('increment', { id: product.id })}>+</button>
                    </>}
                  </li>
                ))}
              </ul>
              <button className="primary add" onClick={() => { setQuery(''); setAdding(true); setEditing(null) }}>＋ Ajouter un produit</button>
            </>
          )}
        </section>
        {undo && <aside className="undo">
          <span role="status">{undo.name} coché.</span>
          <button disabled={busy} onClick={async () => {
            if (await write('undo', { id: undo.id, quantity: undo.quantity })) setUndo(null)
          }}>Annuler</button>
        </aside>}
      </>}
    </main>
  )
}
