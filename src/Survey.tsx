import { useEffect, useState } from 'react'
import { DESIGNATIONS, GROUP_STYLE, PARTS, REASONS } from './data'
import {
  emptyClosing,
  emptyDetails,
  fmtDate,
  inDays,
  reasonText,
  score,
  summaryText,
  uid,
} from './lib'
import type { Answer, Answers, Call, CallerRole, Closing, Details, Draft, SyncTarget } from './types'
import {
  btnGhost,
  btnPrimary,
  Card,
  Field,
  inputCls,
  RatingBadge,
  ScoreRing,
  Segmented,
  TARGET_LABEL,
} from './ui'

interface Props {
  draft: Draft | null
  caller: { name: string; role: CallerRole }
  /** Where to send a saved call, or null when there is nowhere to send it right now. */
  target: SyncTarget | null
  onSync: (c: Call) => Promise<void>
  /** Shown under the Save button when target is null. */
  noSyncHint: string
  onDraft: (d: Draft | null) => void
  onSave: (c: Call) => void
  onSent: (id: string) => void
  onHome: () => void
  onNew: () => void
}

export default function Survey({
  draft,
  caller,
  target,
  onSync,
  noSyncHint,
  onDraft,
  onSave,
  onSent,
  onHome,
  onNew,
}: Props) {
  const total = PARTS.length
  const summaryStep = total + 1

  const [step, setStep] = useState(draft?.step ?? 0)
  const [details, setDetails] = useState<Details>(draft?.details ?? emptyDetails(caller.name, caller.role))
  const [answers, setAnswers] = useState<Answers>(draft?.answers ?? {})
  const [closing, setClosing] = useState<Closing>(draft?.closing ?? emptyClosing())
  const [saved, setSaved] = useState<Call | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  // Keep the half-finished call on the phone so a dropped call or closed tab loses nothing.
  useEffect(() => {
    if (!saved) onDraft({ step, details, answers, closing })
  }, [saved, step, details, answers, closing, onDraft])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [step, saved])

  const goTo = (n: number, a: Answers = answers) => {
    if (n === summaryStep && !closing.followUp && score(a).rating !== 'Compliant') {
      setClosing({ ...closing, followUp: inDays(7) })
    }
    setStep(n)
  }

  const finish = async (send: boolean) => {
    const call: Call = { id: uid(), createdAt: new Date().toISOString(), details, answers, closing }
    onSave(call)
    onDraft(null)
    setSaved(call)
    if (send && target) {
      setBusy(true)
      try {
        await onSync(call)
        onSent(call.id)
        setNote(
          target === 'database'
            ? 'Saved to the database.'
            : 'Sent to your Google Sheet. Open the Responses tab to confirm it landed.',
        )
      } catch (e) {
        const why = e instanceof Error ? e.message : ''
        setNote(`Saved on this phone, but sending failed${why ? ` (${why})` : ''}. Retry from History when you are online.`)
      } finally {
        setBusy(false)
      }
    }
  }

  /* ---------- saved screen ---------- */
  if (saved) {
    const s = score(saved.answers)
    return (
      <div className="flex flex-1 flex-col px-5 pb-8 pt-10">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
          ✓
        </div>
        <h1 className="text-center text-2xl font-bold text-slate-900">Call saved</h1>
        <p className="mt-1 text-center text-slate-600">{saved.details.hospital}</p>
        <div className="mt-4 flex justify-center">
          <RatingBadge rating={s.rating} />
        </div>
        <p className="mt-4 text-center text-sm text-slate-600">
          {s.yes} of {s.applicable} applicable parts are being filled ({s.percent}%).
        </p>
        {note && <p className="mt-4 rounded-xl bg-slate-100 p-3 text-center text-sm text-slate-700">{note}</p>}
        <div className="mt-8 space-y-3">
          <a
            className={btnGhost}
            href={`https://wa.me/?text=${encodeURIComponent(summaryText(saved))}`}
            target="_blank"
            rel="noreferrer"
          >
            Share summary on WhatsApp
          </a>
          <button type="button" className={btnPrimary} onClick={onNew}>
            Start next hospital
          </button>
          <button type="button" className={btnGhost} onClick={onHome}>
            Back to home
          </button>
        </div>
      </div>
    )
  }

  const pct = Math.round((step / summaryStep) * 100)

  const header = (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 pb-3 pt-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => (step === 0 ? onHome() : setStep(step - 1))}
          className="-ml-2 rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
        >
          ← {step === 0 ? 'Home' : 'Back'}
        </button>
        <span className="text-sm font-medium text-slate-500">
          {step === 0 ? 'Call details' : step === summaryStep ? 'Summary' : `Part ${step} of ${total}`}
        </span>
        <button
          type="button"
          onClick={onHome}
          className="-mr-2 rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
        >
          Exit
        </button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </header>
  )

  /* ---------- step 0: call details ---------- */
  if (step === 0) {
    const up = <K extends keyof Details>(k: K, v: Details[K]) => setDetails({ ...details, [k]: v })
    const ok = !!details.hospital.trim() && !!details.spokeTo.trim() && !!details.caller.trim()
    return (
      <>
        {header}
        <div className="flex-1 space-y-4 px-4 py-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Who are you calling?</h1>
            <p className="mt-1 text-sm text-slate-600">Start the call, then record the hospital's answers one part at a time.</p>
          </div>
          <Field label="Hospital" required>
            <input className={inputCls} value={details.hospital} onChange={(e) => up('hospital', e.target.value)} placeholder="e.g. District Hospital Mysuru" />
          </Field>
          <Field label="District / Taluk">
            <input className={inputCls} value={details.district} onChange={(e) => up('district', e.target.value)} />
          </Field>
          <Field label="Spoke to (name)" required>
            <input className={inputCls} value={details.spokeTo} onChange={(e) => up('spokeTo', e.target.value)} />
          </Field>
          <Field label="Designation" hint="Nurses in charge often fill these forms, so ask for them too.">
            <select className={inputCls} value={details.designation} onChange={(e) => up('designation', e.target.value)}>
              <option value="">Select</option>
              {DESIGNATIONS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="Phone">
            <input className={inputCls} type="tel" inputMode="tel" value={details.phone} onChange={(e) => up('phone', e.target.value)} />
          </Field>
          <Field label="Your name" required>
            <input className={inputCls} value={details.caller} onChange={(e) => up('caller', e.target.value)} />
          </Field>
          <Field label="Your role">
            <Segmented<CallerRole>
              value={details.callerRole}
              onChange={(v) => up('callerRole', v)}
              options={[
                { value: 'FSM', label: 'FSM' },
                { value: 'Hub Engg', label: 'Hub Engg' },
                { value: 'Other', label: 'Other' },
              ]}
            />
          </Field>
          <Field label="Call date and time">
            <input className={inputCls} type="datetime-local" value={details.callAt} onChange={(e) => up('callAt', e.target.value)} />
          </Field>
        </div>
        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
          <button type="button" className={btnPrimary} disabled={!ok} onClick={() => goTo(1)}>
            Start survey
          </button>
        </div>
      </>
    )
  }

  /* ---------- steps 1..16: one part each ---------- */
  if (step <= total) {
    const part = PARTS[step - 1]
    const a: Answer | undefined = answers[part.id]
    const setAnswer = (next: Answer, all: Answers = { ...answers, [part.id]: next }) => {
      setAnswers(all)
      return all
    }
    const pickYes = () => {
      const all = setAnswer({ filling: 'yes' })
      window.setTimeout(() => goTo(step + 1, all), 220)
    }
    const canNext = !!a && (a.filling === 'yes' || (!!a.reason && (a.reason !== 'R8' || !!a.remarks?.trim())))

    return (
      <>
        {header}
        <div className="flex-1 space-y-5 px-4 py-5">
          <div>
            <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${GROUP_STYLE[part.group] ?? 'bg-slate-100 text-slate-700'}`}>
              {part.group}
            </span>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              <span className="text-slate-400">{part.num}</span> {part.title}
            </h1>
          </div>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What this part covers</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {part.covers.map((c) => (
                <li key={c} className="rounded-lg bg-slate-100 px-2 py-1 text-sm text-slate-700">
                  {c}
                </li>
              ))}
            </ul>
            {part.conditional && (
              <p className="mt-3 text-xs text-slate-500">
                Only some patients need this. If no patient needed it, choose No and then R6.
              </p>
            )}
          </Card>

          <div>
            <p className="mb-3 text-base font-medium text-slate-800">
              Are your doctors and nurses filling this in CARE for ICU patients?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                aria-pressed={a?.filling === 'yes'}
                onClick={pickYes}
                className={`rounded-2xl border-2 py-5 text-lg font-bold transition active:scale-[0.98] ${
                  a?.filling === 'yes'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                aria-pressed={a?.filling === 'no'}
                onClick={() => setAnswer({ filling: 'no', reason: a?.reason, remarks: a?.remarks })}
                className={`rounded-2xl border-2 py-5 text-lg font-bold transition active:scale-[0.98] ${
                  a?.filling === 'no'
                    ? 'border-rose-600 bg-rose-600 text-white'
                    : 'border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-400'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {a?.filling === 'no' && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Main reason</p>
              <div className="space-y-2">
                {REASONS.map((r) => (
                  <button
                    key={r.code}
                    type="button"
                    aria-pressed={a.reason === r.code}
                    onClick={() => setAnswer({ ...a, reason: r.code })}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                      a.reason === r.code
                        ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-200'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="mt-0.5 rounded-md bg-slate-800 px-1.5 py-0.5 text-xs font-bold text-white">{r.code}</span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{r.label}</span>
                      <span className="block text-xs text-slate-500">{r.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
              <Field label={a.reason === 'R8' ? 'Remarks (required for Other)' : 'Remarks (optional)'}>
                <textarea
                  rows={2}
                  className={inputCls}
                  value={a.remarks ?? ''}
                  onChange={(e) => setAnswer({ ...a, remarks: e.target.value })}
                />
              </Field>
            </div>
          )}
        </div>
        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
          <button type="button" className={btnPrimary} disabled={!canNext} onClick={() => goTo(step + 1)}>
            {step === total ? 'See summary' : 'Next part'}
          </button>
        </div>
      </>
    )
  }

  /* ---------- summary ---------- */
  const s = score(answers)
  const notFilling = PARTS.filter((p) => answers[p.id]?.filling === 'no')
  const upC = <K extends keyof Closing>(k: K, v: Closing[K]) => setClosing({ ...closing, [k]: v })

  return (
    <>
      {header}
      <div className="flex-1 space-y-5 px-4 py-5">
        <Card className="flex items-center gap-4">
          <ScoreRing percent={s.percent} rating={s.rating} />
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-slate-900">{details.hospital}</p>
            <p className="truncate text-sm text-slate-500">{details.district || 'District not entered'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <RatingBadge rating={s.rating} />
              <span className="text-xs font-semibold text-slate-600">{s.result}</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {s.yes} filling · {s.no} not filling · {s.exempt} not applicable
            </p>
          </div>
        </Card>

        {notFilling.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Not filling</h2>
            <div className="space-y-2">
              {notFilling.map((p) => (
                <Card key={p.id} className="flex items-start justify-between gap-3 !p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      <span className="text-slate-400">{p.num}</span> {p.title}
                    </p>
                    {answers[p.id].remarks && <p className="mt-0.5 text-xs text-slate-500">{answers[p.id].remarks}</p>}
                  </div>
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {reasonText(answers[p.id].reason)}
                  </span>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Close the call</h2>
          <Field label="Person responsible for the forms in each shift">
            <input className={inputCls} value={closing.responsible} onChange={(e) => upC('responsible', e.target.value)} placeholder="Name and designation" />
          </Field>
          <Field label="Do they need help or training?">
            <Segmented<'yes' | 'no'>
              value={closing.helpNeeded}
              onChange={(v) => upC('helpNeeded', v)}
              options={[
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
              ]}
            />
          </Field>
          {closing.helpNeeded === 'yes' && (
            <Field label="Help needed for">
              <input className={inputCls} value={closing.helpFor} onChange={(e) => upC('helpFor', e.target.value)} placeholder="e.g. Nurses training, tablet at bedside" />
            </Field>
          )}
          <Field label="Follow-up date" hint={s.rating !== 'Compliant' ? 'Set to one week from today. Change it if needed.' : undefined}>
            <input className={inputCls} type="date" value={closing.followUp} onChange={(e) => upC('followUp', e.target.value)} />
          </Field>
          <Field label="Caller remarks">
            <textarea rows={3} className={inputCls} value={closing.remarks} onChange={(e) => upC('remarks', e.target.value)} />
          </Field>
        </div>

        <p className="text-xs text-slate-500">
          Call time: {fmtDate(details.callAt)}. Rating uses parts marked Yes out of applicable parts: 80% or more is
          Compliant, 50 to 79% Needs follow-up, below 50% Escalate.
        </p>
      </div>
      <div className="sticky bottom-0 space-y-2 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
        {target ? (
          <>
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => finish(true)}>
              {busy ? 'Sending…' : `Save and send to ${TARGET_LABEL[target]}`}
            </button>
            <button type="button" className={btnGhost} disabled={busy} onClick={() => finish(false)}>
              Save on this phone only
            </button>
          </>
        ) : (
          <>
            <button type="button" className={btnPrimary} onClick={() => finish(false)}>
              Save call
            </button>
            <p className="text-center text-xs text-slate-500">{noSyncHint}</p>
          </>
        )}
      </div>
    </>
  )
}
