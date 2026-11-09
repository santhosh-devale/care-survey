import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { describeError } from './sync'
import type { UserPermissionRow, UserPermissions } from './types'
import { btnGhost, btnPrimary, Card, inputCls } from './ui'

const PERMISSIONS: { key: keyof UserPermissions; label: string }[] = [
  { key: 'can_submit_surveys', label: 'Submit surveys' },
  { key: 'can_view_reports', label: 'View dashboard' },
  { key: 'can_export', label: 'Export data' },
  { key: 'can_manage_users', label: 'Manage users' },
]

const EMPTY: UserPermissions = {
  can_submit_surveys: false,
  can_view_reports: false,
  can_export: false,
  can_manage_users: false,
}

export default function UserAccess({
  onBack,
  onPermissionsChanged,
}: {
  onBack: () => void
  onPermissionsChanged: () => void
}) {
  const [users, setUsers] = useState<UserPermissionRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, UserPermissions>>({})
  const [email, setEmail] = useState('')
  const [newPermissions, setNewPermissions] = useState<UserPermissions>({ ...EMPTY })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadUsers = useCallback(async () => {
    if (!supabase) return
    const { data, error: queryError } = await supabase
      .from('user_permissions')
      .select('user_id, email, can_submit_surveys, can_view_reports, can_export, can_manage_users, updated_at')
      .order('email')
    if (queryError) {
      setError(describeError(queryError))
    } else {
      setError('')
      const rows = (data ?? []) as UserPermissionRow[]
      setUsers(rows)
      setDrafts(Object.fromEntries(rows.map((user) => [user.user_id, {
        can_submit_surveys: user.can_submit_surveys,
        can_view_reports: user.can_view_reports,
        can_export: user.can_export,
        can_manage_users: user.can_manage_users,
      }])))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const savePermissions = async (targetEmail: string, permissions: UserPermissions, rowId: string) => {
    if (!supabase) return
    setBusy(rowId)
    setError('')
    setMessage('')
    const { error: saveError } = await supabase.rpc('set_user_permissions', {
      target_email: targetEmail,
      allow_submit_surveys: permissions.can_submit_surveys,
      allow_view_reports: permissions.can_view_reports,
      allow_export: permissions.can_export,
      allow_manage_users: permissions.can_manage_users,
    })
    if (saveError) {
      setError(saveError.message)
    } else {
      setMessage(`Permissions saved for ${targetEmail}.`)
      setEmail('')
      setNewPermissions({ ...EMPTY })
      await loadUsers()
      onPermissionsChanged()
    }
    setBusy(null)
  }

  const toggle = (
    current: UserPermissions,
    update: (next: UserPermissions) => void,
    permission: keyof UserPermissions,
  ) => (
    <label key={permission} className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={current[permission]}
        onChange={(event) => update({ ...current, [permission]: event.target.checked })}
        className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
      />
      {PERMISSIONS.find((item) => item.key === permission)?.label}
    </label>
  )

  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3.5 backdrop-blur sm:px-6 lg:px-10">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50" aria-label="Back to home">←</button>
          <div>
            <p className="text-sm font-bold text-slate-900">CARE Forms</p>
            <p className="text-xs text-slate-500">Team administration</p>
          </div>
        </div>
        <button type="button" onClick={() => { setLoading(true); void loadUsers() }} disabled={loading} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-800 disabled:opacity-50">
          {loading ? 'Refreshing…' : 'Refresh users'}
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:px-10 lg:py-9">
        <div>
          <p className="text-sm font-semibold text-emerald-800">Administration</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Manage team access</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Give each team member only the tools they need. Accounts are created in Supabase; permissions are managed here.</p>
        </div>

        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

        <Card className="p-5! sm:p-6!">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg text-emerald-800">+</span>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Add a team member</h2>
          <p className="mt-1 text-sm text-slate-600">The account must already exist under Supabase Authentication → Users.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_2fr_auto] lg:items-end">
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input className={`${inputCls} mt-1.5`} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="person@example.org" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {PERMISSIONS.map(({ key }) => toggle(newPermissions, setNewPermissions, key))}
            </div>
            <button
              type="button"
              className={btnPrimary}
              disabled={!email.trim() || busy !== null}
              onClick={() => void savePermissions(email.trim(), newPermissions, 'new-user')}
            >
              {busy === 'new-user' ? 'Saving…' : 'Save access'}
            </button>
          </div>
        </Card>

        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Team members</h2>
              <p className="mt-0.5 text-xs text-slate-500">{users.length} account(s) with app permissions</p>
            </div>
          </div>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading users…</p>
          ) : users.length === 0 ? (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">No users have permissions yet. Bootstrap the first admin using the instructions in the README.</p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => {
                const current = drafts[user.user_id] ?? EMPTY
                const update = (next: UserPermissions) => setDrafts((existing) => ({ ...existing, [user.user_id]: next }))
                return (
                  <Card key={user.user_id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{user.email}</p>
                        <p className="text-xs text-slate-500">Updated {new Date(user.updated_at).toLocaleString()}</p>
                      </div>
                      <button
                        type="button"
                        className={btnGhost + ' w-auto! px-4! py-2!'}
                        disabled={busy !== null}
                        onClick={() => void savePermissions(user.email, current, user.user_id)}
                      >
                        {busy === user.user_id ? 'Saving…' : 'Save permissions'}
                      </button>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {PERMISSIONS.map(({ key }) => toggle(current, update, key))}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </>
  )
}
