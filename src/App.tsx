import type { Session } from '@supabase/supabase-js'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import History from './History'
import Home from './Home'
import { load, save } from './lib'
import Login from './Login'
import { supabase, supabaseConfigured } from './supabase'
import Survey from './Survey'
import { syncCall } from './sync'
import type { Call, CallerRole, Draft, SyncTarget, UserPermissions } from './types'
import { Shell } from './ui'

const Reports = lazy(() => import('./Reports'))
const UserAccess = lazy(() => import('./UserAccess'))

type Screen = 'home' | 'survey' | 'history' | 'reports' | 'users'

const NO_PERMISSIONS: UserPermissions = {
  can_submit_surveys: false,
  can_view_reports: false,
  can_export: false,
  can_manage_users: false,
}

const LOCAL_PERMISSIONS: UserPermissions = {
  ...NO_PERMISSIONS,
  can_submit_surveys: true,
  can_export: true,
}

const K = {
  calls: 'care-survey:calls',
  draft: 'care-survey:draft',
  url: 'care-survey:sheet-url',
  caller: 'care-survey:caller',
}

interface Caller {
  name: string
  role: CallerRole
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [calls, setCalls] = useState<Call[]>(() => load<Call[]>(K.calls, []))
  const [draft, setDraft] = useState<Draft | null>(() => load<Draft | null>(K.draft, null))
  const [sheetUrl, setSheetUrl] = useState<string>(() => load<string>(K.url, ''))
  const [caller, setCaller] = useState<Caller>(() => load<Caller>(K.caller, { name: '', role: 'FSM' }))
  const [resume, setResume] = useState(false)
  const [surveyKey, setSurveyKey] = useState(0)
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabaseConfigured)
  const [permissions, setPermissions] = useState<UserPermissions | null>(
    supabaseConfigured ? null : LOCAL_PERMISSIONS,
  )
  const [permissionUserId, setPermissionUserId] = useState<string | null>(null)
  const [permissionError, setPermissionError] = useState('')
  const [permissionRevision, setPermissionRevision] = useState(0)

  useEffect(() => save(K.calls, calls), [calls])
  useEffect(() => save(K.draft, draft), [draft])
  useEffect(() => save(K.url, sheetUrl), [sheetUrl])
  useEffect(() => save(K.caller, caller), [caller])

  // Keep track of who is signed in. The session is stored by Supabase on this device.
  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!supabaseConfigured || !supabase || !userId) return
    let active = true
    void supabase
      .from('user_permissions')
      .select('can_submit_surveys, can_view_reports, can_export, can_manage_users')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setPermissionError(error.message)
          setPermissions(null)
        } else {
          setPermissionError('')
          setPermissions(data ?? NO_PERMISSIONS)
        }
        setPermissionUserId(userId)
      })

    return () => {
      active = false
    }
  }, [userId, permissionRevision])

  // An untouched first screen is not worth keeping as a "call in progress".
  const onDraft = useCallback((d: Draft | null) => {
    const untouched =
      !!d &&
      d.step === 0 &&
      !d.details.hospital.trim() &&
      !d.details.spokeTo.trim() &&
      Object.keys(d.answers).length === 0
    setDraft(untouched ? null : d)
  }, [])

  const startNew = () => {
    if (draft && !window.confirm('Discard the call in progress and start a new one?')) return
    setDraft(null)
    setResume(false)
    setSurveyKey((k) => k + 1)
    setScreen('survey')
  }

  const onSave = (c: Call) => {
    setCalls((prev) => [c, ...prev])
    setCaller({ name: c.details.caller, role: c.details.callerRole })
  }

  const onSent = (id: string) =>
    setCalls((prev) => prev.map((c) => (c.id === id ? { ...c, sentAt: new Date().toISOString() } : c)))

  const access = permissions ?? NO_PERMISSIONS
  // Where saved calls go: the database when allowed, otherwise the optional Google Sheet in local mode.
  const target: SyncTarget | null = supabaseConfigured
    ? access.can_submit_surveys ? 'database' : null
    : sheetUrl ? 'sheet' : null
  const onSync = useCallback((c: Call) => syncCall(c, sheetUrl), [sheetUrl])
  const noSyncHint = 'Add your Google Sheet link in Settings to send calls automatically.'

  if (supabaseConfigured && (!authReady || (!!session && permissionUserId !== session.user.id))) {
    return (
      <Shell>
        <p className="m-auto text-sm text-slate-500">Loading account access…</p>
      </Shell>
    )
  }

  if (supabaseConfigured && !session) {
    return (
      <Shell>
        <Login />
      </Shell>
    )
  }

  if (supabaseConfigured && session && permissionUserId === session.user.id && permissionError) {
    return (
      <Shell>
        <div className="m-auto space-y-4 p-6 text-center">
          <p role="alert" className="text-sm text-rose-700">Could not load your permissions: {permissionError}</p>
          <button type="button" className="text-sm font-semibold text-emerald-700" onClick={() => void supabase?.auth.signOut()}>
            Sign out and try again
          </button>
        </div>
      </Shell>
    )
  }

  if (supabaseConfigured && !access.can_submit_surveys && !access.can_view_reports && !access.can_export && !access.can_manage_users) {
    return (
      <Shell>
        <div className="m-auto space-y-4 p-6 text-center">
          <h1 className="text-xl font-bold text-slate-900">Access not assigned</h1>
          <p className="text-sm text-slate-600">Your account is signed in, but an administrator has not assigned app permissions yet.</p>
          <button type="button" className="text-sm font-semibold text-emerald-700" onClick={() => void supabase?.auth.signOut()}>
            Sign out
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell wide={screen === 'home' || screen === 'survey' || screen === 'reports' || screen === 'users'}>
      {screen === 'home' && (
        <Home
          calls={calls}
          draft={draft}
          sheetUrl={sheetUrl}
          caller={caller}
          email={session?.user.email ?? null}
          canSubmitSurveys={access.can_submit_surveys}
          canViewReports={access.can_view_reports}
          canExport={access.can_export}
          canManageUsers={access.can_manage_users}
          onStart={startNew}
          onResume={() => {
            setResume(true)
            setSurveyKey((k) => k + 1)
            setScreen('survey')
          }}
          onHistory={() => setScreen('history')}
          onReports={() => setScreen('reports')}
          onManageUsers={() => setScreen('users')}
          onSignOut={() => void supabase?.auth.signOut()}
          onSettings={(s) => {
            setSheetUrl(s.sheetUrl)
            setCaller({ name: s.name, role: s.role })
          }}
        />
      )}
      {screen === 'survey' && (
        <Survey
          key={surveyKey}
          draft={resume ? draft : null}
          caller={caller}
          target={target}
          onSync={onSync}
          noSyncHint={noSyncHint}
          onDraft={onDraft}
          onSave={onSave}
          onSent={onSent}
          onHome={() => setScreen('home')}
          onNew={() => {
            setResume(false)
            setSurveyKey((k) => k + 1)
          }}
        />
      )}
      {screen === 'history' && (
        <History
          calls={calls}
          target={target}
          onSync={onSync}
          onBack={() => setScreen('home')}
          onDelete={(id) => setCalls((prev) => prev.filter((c) => c.id !== id))}
          onSent={onSent}
          canExport={access.can_export}
        />
      )}
      {screen === 'reports' && (access.can_view_reports || access.can_export) && (
        <Suspense fallback={<p className="m-auto p-6 text-sm text-slate-500">Loading dashboard…</p>}>
          <Reports onBack={() => setScreen('home')} permissions={access} />
        </Suspense>
      )}
      {screen === 'users' && access.can_manage_users && (
        <Suspense fallback={<p className="m-auto p-6 text-sm text-slate-500">Loading user access…</p>}>
          <UserAccess
            onBack={() => setScreen('home')}
            onPermissionsChanged={() => {
              setPermissionUserId(null)
              setPermissionRevision((revision) => revision + 1)
            }}
          />
        </Suspense>
      )}
      {screen === 'reports' && !access.can_view_reports && !access.can_export && (
        <div className="m-auto space-y-3 p-6 text-center">
          <p className="text-sm text-slate-600">Your dashboard or export permission has been removed.</p>
          <button type="button" className="text-sm font-semibold text-emerald-700" onClick={() => setScreen('home')}>Back to home</button>
        </div>
      )}
      {screen === 'users' && !access.can_manage_users && (
        <div className="m-auto space-y-3 p-6 text-center">
          <p className="text-sm text-slate-600">Your user-management permission has been removed.</p>
          <button type="button" className="text-sm font-semibold text-emerald-700" onClick={() => setScreen('home')}>Back to home</button>
        </div>
      )}
    </Shell>
  )
}
