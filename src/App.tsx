import { useCallback, useEffect, useState } from 'react'
import History from './History'
import Home from './Home'
import { load, save } from './lib'
import Survey from './Survey'
import type { Call, CallerRole, Draft } from './types'
import { Shell } from './ui'

type Screen = 'home' | 'survey' | 'history'

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

  useEffect(() => save(K.calls, calls), [calls])
  useEffect(() => save(K.draft, draft), [draft])
  useEffect(() => save(K.url, sheetUrl), [sheetUrl])
  useEffect(() => save(K.caller, caller), [caller])

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

  return (
    <Shell>
      {screen === 'home' && (
        <Home
          calls={calls}
          draft={draft}
          sheetUrl={sheetUrl}
          caller={caller}
          onStart={startNew}
          onResume={() => {
            setResume(true)
            setSurveyKey((k) => k + 1)
            setScreen('survey')
          }}
          onHistory={() => setScreen('history')}
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
          sheetUrl={sheetUrl}
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
          sheetUrl={sheetUrl}
          onBack={() => setScreen('home')}
          onDelete={(id) => setCalls((prev) => prev.filter((c) => c.id !== id))}
          onSent={onSent}
        />
      )}
    </Shell>
  )
}
