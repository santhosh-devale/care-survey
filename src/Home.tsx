import { useState } from 'react'
import { fmtDate, score } from './lib'
import { supabaseConfigured } from './supabase'
import type { Call, CallerRole, Draft } from './types'
import { btnGhost, Card, Field, inputCls, RatingBadge, Segmented } from './ui'

interface Props {
  calls: Call[]
  draft: Draft | null
  sheetUrl: string
  caller: { name: string; role: CallerRole }
  /** Signed-in account, or null when the app runs without Supabase. */
  email: string | null
  canSubmitSurveys: boolean
  canViewReports: boolean
  canExport: boolean
  canManageUsers: boolean
  onStart: () => void
  onResume: () => void
  onHistory: () => void
  onReports: () => void
  onManageUsers: () => void
  onSignOut: () => void
  onSettings: (s: { sheetUrl: string; name: string; role: CallerRole }) => void
}

export default function Home({
  calls,
  draft,
  sheetUrl,
  caller,
  email,
  canSubmitSurveys,
  canViewReports,
  canExport,
  canManageUsers,
  onStart,
  onResume,
  onHistory,
  onReports,
  onManageUsers,
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
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 lg:px-10">
        <div className="flex items-center gap-3">
          <img
            src="/10bedicu-logo.png"
            alt="10BedICU"
            className="h-10 w-24 shrink-0 object-contain"
          />
          <div>
            <p className="text-sm font-bold text-slate-900">CARE Forms</p>
            <p className="text-xs text-slate-500">TeleICU</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <img
            src="/egov-foundation.png"
            alt="eGov Foundation"
            className="h-6 w-16 shrink-0 object-contain sm:h-8 sm:w-auto"
          />
          {email && <span className="hidden max-w-64 truncate rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 sm:inline">{email}</span>}
          {supabaseConfigured && email && (
            <button type="button" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-rose-700" onClick={onSignOut}>
              Sign out
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:px-10 lg:py-9">
        <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-emerald-800">Hospital operations</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">CARE Forms Survey</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {canViewReports
                ? 'Capture hospital progress and see where teams need support across India.'
                : 'Record whether ICU forms are being completed and capture the reason when they are not.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 sm:self-auto">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-800">{supabaseConfigured ? 'Connected to shared database' : 'On-device mode'}</span>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
        {canSubmitSurveys && draft && (
          <Card className="flex flex-col justify-between gap-4 border-amber-200 bg-amber-50 lg:col-span-3 lg:flex-row lg:items-center">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-lg text-amber-800">↗</span>
              <div>
                <p className="font-semibold text-amber-950">Survey in progress</p>
                <p className="mt-1 text-sm text-amber-800">
                  {draft.details.hospital || 'Hospital not entered yet'} · Part {Math.min(Math.max(draft.step, 1), 16)} of 16
                </p>
              </div>
            </div>
            <button type="button" className="rounded-xl bg-amber-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-800" onClick={onResume}>
              Continue survey <span aria-hidden="true">→</span>
            </button>
          </Card>
        )}

          {canSubmitSurveys && (
            <button type="button" className="group flex min-h-40 flex-col items-start justify-between rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-950 p-5 text-left text-white shadow-lg shadow-emerald-950/10 transition hover:-translate-y-0.5 hover:from-emerald-800 hover:to-emerald-950 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200" onClick={onStart}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-2xl">+</span>
              <span>
                <span className="block text-lg font-bold">{draft ? 'Start a new survey' : 'Start hospital survey'}</span>
                <span className="mt-1 block text-sm text-emerald-100">
                  {draft ? 'Discard the current draft and begin a new survey' : 'Record the latest ICU forms status'}
                </span>
              </span>
              <span className="text-sm font-semibold text-emerald-100">Begin survey <span aria-hidden="true">→</span></span>
            </button>
          )}

          {supabaseConfigured && (canViewReports || canExport) && (
            <button type="button" className="hidden min-h-40 flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 lg:flex" onClick={onReports}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-xl text-sky-800">▥</span>
              <span>
                <span className="block text-lg font-bold text-slate-900">{canViewReports ? 'Analytics dashboard' : 'Export survey data'}</span>
                <span className="mt-1 block text-sm text-slate-500">{canViewReports ? 'Find trends and hospitals needing support' : 'Download filtered survey records'}</span>
              </span>
              <span className="text-sm font-semibold text-emerald-800">Open dashboard <span aria-hidden="true">→</span></span>
            </button>
          )}

          {supabaseConfigured && canManageUsers && (
            <button type="button" className="hidden min-h-40 flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 lg:flex" onClick={onManageUsers}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-xl text-violet-800">♙</span>
              <span>
                <span className="block text-lg font-bold text-slate-900">Team access</span>
                <span className="mt-1 block text-sm text-slate-500">Set permissions for survey users</span>
              </span>
              <span className="text-sm font-semibold text-emerald-800">Manage team <span aria-hidden="true">→</span></span>
            </button>
          )}
        </section>

        {!canSubmitSurveys && !canViewReports && !canExport && !canManageUsers && (
          <Card className="border-amber-200 bg-amber-50">
            <p className="text-sm text-amber-900">Your account does not have app permissions yet. Ask an administrator to assign access.</p>
          </Card>
        )}
        {(canViewReports || canExport) && (
          <Card className="border-emerald-200 bg-emerald-50 lg:hidden">
            <p className="text-sm text-emerald-900">Dashboard and export tools are available on desktop. Survey entry remains available here if your account has survey permission.</p>
          </Card>
        )}

        {(canViewReports || canExport) && (
          <Card className="border-sky-100 bg-sky-50 lg:hidden">
            <p className="text-sm font-semibold text-sky-950">Manager tools are ready on desktop</p>
            <p className="mt-1 text-sm text-sky-800">Open this app on a computer for analytics, hospital filters, and exports.</p>
          </Card>
        )}

        {canSubmitSurveys && calls.length > 0 && (
          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Activity on this device</h2>
                <p className="mt-0.5 text-xs text-slate-500">{supabaseConfigured ? 'Locally saved surveys; shared analytics are in the dashboard.' : 'Summary of surveys saved in this browser.'}</p>
              </div>
              <button type="button" className="text-sm font-semibold text-emerald-800 hover:text-emerald-950" onClick={onHistory}>History <span aria-hidden="true">→</span></button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Hospitals', value: hospitals, color: 'text-slate-950', dot: 'bg-slate-400' },
            { label: 'Compliant', value: count('Compliant'), color: 'text-emerald-800', dot: 'bg-emerald-500' },
            { label: 'Follow-up', value: count('Needs follow-up'), color: 'text-amber-800', dot: 'bg-amber-500' },
            { label: 'Escalate', value: count('Escalate'), color: 'text-rose-800', dot: 'bg-rose-500' },
          ].map((s) => (
              <Card key={s.label} className="!p-4">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                  <p className="text-xs font-medium text-slate-500">{s.label}</p>
                </div>
                <p className={`mt-2 text-2xl font-bold ${s.color}`}>{s.value}</p>
              </Card>
          ))}
            </div>
          </section>
        )}

        {canSubmitSurveys && calls.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Recent surveys</h2>
                <p className="mt-0.5 text-xs text-slate-500">Your latest work on this device</p>
              </div>
              <button type="button" className="text-sm font-semibold text-emerald-800" onClick={onHistory}>See history →</button>
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              {calls.slice(0, 3).map((c) => (
                <Card key={c.id} className="flex items-center justify-between gap-3 !p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-600">H</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{c.details.hospital}</p>
                      <p className="truncate text-xs text-slate-500">
                        {[c.details.taluk, c.details.district, c.details.state || 'Karnataka'].filter(Boolean).join(' · ')}
                        {' · '}{fmtDate(c.details.callAt)}
                      </p>
                    </div>
                  </div>
                  <RatingBadge rating={score(c.answers).rating} />
                </Card>
              ))}
            </div>
          </section>
        )}

        <Card className="lg:mt-2">
          <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setOpen(!open)}>
            <span>
              <span className="block text-sm font-semibold text-slate-900">Preferences and integrations</span>
              <span className="block text-xs text-slate-500">
                {supabaseConfigured
                  ? `Shared database connected${email ? ` · signed in as ${email}` : ''}`
                  : sheetUrl
                    ? 'Google Sheet connected'
                    : 'Google Sheet not connected'}
              </span>
            </span>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition ${open ? 'rotate-180' : ''}`}>⌄</span>
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
            </div>
          )}
        </Card>
      </main>
    </>
  )
}
