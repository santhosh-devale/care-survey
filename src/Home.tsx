import { useState } from 'react'
import { fmtDate, score } from './lib'
import { supabaseConfigured } from './supabase'
import type { Call, CallerRole, Draft } from './types'
import { btnGhost, btnPrimary, Card, Field, inputCls, RatingBadge, Segmented } from './ui'

interface Props {
  calls: Call[]
  draft: Draft | null
  sheetUrl: string
  caller: { name: string; role: CallerRole }
  /** Signed-in account, or null when the app runs without Supabase. */
  email: string | null
  onStart: () => void
  onResume: () => void
  onHistory: () => void
  onReports: () => void
  onSignOut: () => void
  onSettings: (s: { sheetUrl: string; name: string; role: CallerRole }) => void
}

export default function Home({
  calls,
  draft,
  sheetUrl,
  caller,
  email,
  onStart,
  onResume,
  onHistory,
  onReports,
  onSignOut,
  onSettings,
}: Props) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState(sheetUrl)
  const [name, setName] = useState(caller.name)
  const [role, setRole] = useState<CallerRole>(caller.role)
  const [saved, setSaved] = useState(false)

  const ratings = calls.map((c) => score(c.answers).rating)
  const count = (r: string) => ratings.filter((x) => x === r).length
  const hospitals = new Set(calls.map((c) => c.details.hospital.trim().toLowerCase())).size
  const urlLooksWrong = url.trim() !== '' && !url.trim().startsWith('https://script.google.com/')

  return (
    <>
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-5 pb-10 pt-10 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-100">10BedICU TeleICU</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight">CARE Forms Survey</h1>
        <p className="mt-2 text-sm text-emerald-50">
          Call a hospital, record whether the ICU forms are being filled, and note the reason if not.
        </p>
      </div>

      <div className="-mt-6 flex-1 space-y-4 px-4 pb-8">
        {draft && (
          <Card className="border-amber-200 bg-amber-50">
            <p className="text-sm font-semibold text-amber-900">Call in progress</p>
            <p className="mt-0.5 text-sm text-amber-800">
              {draft.details.hospital || 'Hospital not entered yet'}, part {Math.min(Math.max(draft.step, 1), 16)} of 16
            </p>
            <button type="button" className="mt-3 w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white" onClick={onResume}>
              Continue this call
            </button>
          </Card>
        )}

        <button type="button" className={btnPrimary + ' !py-4 !text-lg shadow-lg'} onClick={onStart}>
          {draft ? 'Discard and start a new call' : 'Start a new call'}
        </button>

        {supabaseConfigured && (
          <button type="button" className={btnGhost} onClick={onReports}>
            Reports: which forms are filled least
          </button>
        )}

        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: 'Hospitals', value: hospitals },
            { label: 'Compliant', value: count('Compliant') },
            { label: 'Follow-up', value: count('Needs follow-up') },
            { label: 'Escalate', value: count('Escalate') },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-200 bg-white px-1 py-3 shadow-sm">
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
              <p className="text-[11px] font-medium text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        {calls.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Recent calls</h2>
              <button type="button" className="text-sm font-semibold text-emerald-700" onClick={onHistory}>
                See all
              </button>
            </div>
            <div className="space-y-2">
              {calls.slice(0, 3).map((c) => (
                <Card key={c.id} className="flex items-center justify-between gap-3 !p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{c.details.hospital}</p>
                    <p className="truncate text-xs text-slate-500">{fmtDate(c.details.callAt)}</p>
                  </div>
                  <RatingBadge rating={score(c.answers).rating} />
                </Card>
              ))}
            </div>
          </div>
        )}

        <Card>
          <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setOpen(!open)}>
            <span>
              <span className="block text-sm font-semibold text-slate-900">Settings</span>
              <span className="block text-xs text-slate-500">
                {supabaseConfigured
                  ? `Database connected${email ? ` · ${email}` : ''}`
                  : sheetUrl
                    ? 'Google Sheet connected'
                    : 'Google Sheet not connected'}
              </span>
            </span>
            <span className="text-slate-400">{open ? '▲' : '▼'}</span>
          </button>
          {open && (
            <div className="mt-4 space-y-4">
              <Field label="Your name">
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Your role">
                <Segmented<CallerRole>
                  value={role}
                  onChange={setRole}
                  options={[
                    { value: 'FSM', label: 'FSM' },
                    { value: 'Hub Engg', label: 'Hub Engg' },
                    { value: 'Other', label: 'Other' },
                  ]}
                />
              </Field>
              <Field
                label={supabaseConfigured ? 'Google Sheet web app link (optional extra copy)' : 'Google Sheet web app link'}
                hint="Paste the link you get after deploying apps-script/Code.gs. Leave empty to skip the Sheet."
              >
                <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" />
              </Field>
              {urlLooksWrong && <p className="text-xs text-rose-600">This does not look like an Apps Script link. It should start with https://script.google.com/</p>}
              <button
                type="button"
                className={btnGhost}
                onClick={() => {
                  onSettings({ sheetUrl: url.trim(), name: name.trim(), role })
                  setSaved(true)
                  window.setTimeout(() => setSaved(false), 1800)
                }}
              >
                {saved ? 'Saved ✓' : 'Save settings'}
              </button>
              {supabaseConfigured && email && (
                <button type="button" className="w-full text-center text-sm font-semibold text-rose-600" onClick={onSignOut}>
                  Sign out ({email})
                </button>
              )}
            </div>
          )}
        </Card>

        {calls.length > 0 && (
          <button type="button" className={btnGhost} onClick={onHistory}>
            History and export
          </button>
        )}
      </div>
    </>
  )
}
