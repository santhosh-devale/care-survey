import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from './supabase'
import { btnPrimary, Field, inputCls } from './ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(/invalid login/i.test(error.message) ? 'Wrong email or password.' : error.message)
    setBusy(false)
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-5 pb-10 pt-12 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-100">10BedICU TeleICU</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight">CARE Forms Survey</h1>
        <p className="mt-2 text-sm text-emerald-50">Sign in with the account your admin created for you.</p>
      </div>
      <form onSubmit={submit} className="-mt-5 mx-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
        <Field label="Email" required>
          <input className={inputCls} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" required>
          <input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <button type="submit" className={btnPrimary} disabled={busy || !email || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-center text-xs text-slate-500">Sign in once while you have internet. After that you can save calls offline and send them later.</p>
      </form>
    </div>
  )
}
