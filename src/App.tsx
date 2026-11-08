import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import History from './History'
import Home from './Home'
import { load, save } from './lib'
import Login from './Login'
import Reports from './Reports'
import { supabase, supabaseConfigured } from './supabase'
import Survey from './Survey'
import { syncCall } from './sync'
import type { Call, CallerRole, Draft, SyncTarget } from './types'
import { Shell } from './ui'

type Screen = 'home' | 'survey' | 'history' | 'reports'

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

  // Where saved calls go: the database when Supabase is set up, otherwise the optional Google Sheet.
  const target: SyncTarget | null = supabaseConfigured ? 'database' : sheetUrl ? 'sheet' : null
  const onSync = useCallback((c: Call) => syncCall(c, sheetUrl), [sheetUrl])
  const noSyncHint = 'Add your Google Sheet link in Settings to send calls automatically.'

  if (supabaseConfigured && !authReady) {
    return (
      <Shell>
        <p className="m-auto text-sm text-slate-500">Loading…</p>
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

  return (
    <Shell>
      {screen === 'home' && (
        <Home
          calls={calls}
          draft={draft}
          sheetUrl={sheetUrl}
          caller={caller}
          email={session?.user.email ?? null}
          onStart={startNew}
          onResume={() => {
            setResume(true)
            setSurveyKey((k) => k + 1)
            setScreen('survey')
          }}
          onHistory={() => setScreen('history')}
          onReports={() => setScreen('reports')}
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
        />
      )}
      {screen === 'reports' && <Reports onBack={() => setScreen('home')} />}
    </Shell>
  )
}
