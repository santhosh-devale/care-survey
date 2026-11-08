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
    <div className="flex flex-1 flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_#d1fae5_0%,_#f8fafc_48%,_#f1f5f9_100%)] px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700 text-2xl font-bold text-white shadow-lg shadow-emerald-900/15">
            C
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">TeleICU</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">CARE Forms Survey</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Sign in with the account your administrator created for you.</p>
        </div>
        <form onSubmit={submit} className="space-y-5 rounded-3xl border border-white bg-white p-5 shadow-xl shadow-slate-900/10 sm:p-7">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500">Enter your team account to continue.</p>
          </div>
          <Field label="Email address" required>
            <input className={inputCls} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@organization.org" />
          </Field>
          <Field label="Password" required>
            <input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Enter your password" />
          </Field>
          {error && <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <button type="submit" className={btnPrimary} disabled={busy || !email || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-center text-xs leading-5 text-slate-500">Need access? Contact your CARE Forms Survey administrator.</p>
        </form>
      </div>
    </div>
  )
}
