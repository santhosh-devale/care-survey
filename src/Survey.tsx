import { useEffect, useState } from 'react'
import { DESIGNATIONS, GROUP_STYLE, PARTS, REASONS, type Part } from './data'
import { HOSPITALS, locationForHospital, OTHER_HOSPITAL_OPTION } from './hospitals'
import { INDIAN_STATES_AND_UTS, KARNATAKA_DISTRICTS, KARNATAKA_TALUKS } from './locations'
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
  const [details, setDetails] = useState<Details>(() => ({
    ...emptyDetails(caller.name, caller.role),
    ...draft?.details,
    state: draft?.details?.state || 'Karnataka',
    taluk: draft?.details?.taluk ?? '',
  }))
  const [manualHospital, setManualHospital] = useState(
    () =>
      !!draft?.details?.hospital &&
      !(draft.details.state === 'Karnataka' && HOSPITALS.some((hospital) => hospital === draft.details.hospital)),
  )
  const [customDistrict, setCustomDistrict] = useState(() => {
    const state = draft?.details?.state || 'Karnataka'
    const district = draft?.details?.district ?? ''
    return state === 'Karnataka' && !!district && !KARNATAKA_DISTRICTS.includes(district)
  })
  const [customTaluk, setCustomTaluk] = useState(() => {
    const state = draft?.details?.state || 'Karnataka'
    const district = draft?.details?.district ?? ''
    const taluk = draft?.details?.taluk ?? ''
    return state === 'Karnataka' && !!taluk && !(KARNATAKA_TALUKS[district] ?? []).includes(taluk)
  })
  const [answers, setAnswers] = useState<Answers>(draft?.answers ?? {})
  const [closing, setClosing] = useState<Closing>(draft?.closing ?? emptyClosing())
  const [saved, setSaved] = useState<Call | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const isDesktop = useIsDesktop()
  const answeredCount = PARTS.filter((p) => partComplete(p, answers[p.id])).length

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
      <div className="mx-auto flex w-full flex-1 flex-col px-5 pb-8 pt-10 lg:max-w-3xl">
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

  const onPartsPage = isDesktop && step >= 1 && step <= total
  const pct = onPartsPage
    ? Math.round(((1 + answeredCount) / (summaryStep + 1)) * 100)
    : Math.round((step / summaryStep) * 100)

  const header = (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 pb-3 pt-4 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <button
          type="button"
          onClick={() => (step === 0 ? onHome() : setStep(onPartsPage ? 0 : step - 1))}
          className="-ml-2 rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
        >
          ← {step === 0 ? 'Home' : 'Back'}
        </button>
        <span className="text-sm font-semibold text-slate-700">
          {step === 0 ? 'New survey' : step === summaryStep ? 'Review survey' : 'CARE forms'}
        </span>
        <button
          type="button"
          onClick={onHome}
          className="-mr-2 rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
        >
          Exit
        </button>
      </div>
      <div className="mx-auto mt-3 max-w-4xl">
        <div className="mb-1.5 flex justify-between text-[11px] font-medium text-slate-500">
          <span>{step === 0 ? 'Hospital details' : step === summaryStep ? 'Final review' : onPartsPage ? `${answeredCount} of ${total} parts answered` : `Part ${step} of ${total}`}</span>
          <span>{pct}% complete</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </header>
  )

  /* ---------- step 0: call details ---------- */
  if (step === 0) {
    const up = <K extends keyof Details>(k: K, v: Details[K]) => setDetails({ ...details, [k]: v })
    const phoneIncomplete = details.phone.length > 0 && details.phone.length !== 10
    const ok = !!details.hospital.trim() && !!details.spokeTo.trim() && !!details.caller.trim() && !phoneIncomplete
    const isKarnataka = details.state === 'Karnataka'
    const hospitalOptions = isKarnataka ? HOSPITALS : []
    const districtOptions = isKarnataka ? KARNATAKA_DISTRICTS : []
    const talukOptions = isKarnataka ? KARNATAKA_TALUKS[details.district] ?? [] : []
    const districtIsListed = districtOptions.includes(details.district)
    const talukIsListed = talukOptions.includes(details.taluk)
    return (
      <>
        {header}
        <div className="mx-auto grid w-full flex-1 gap-4 px-4 py-5 lg:max-w-4xl lg:grid-cols-2 lg:gap-x-6">
          <div className="lg:col-span-2">
            <h1 className="text-xl font-bold text-slate-900">Who are you calling?</h1>
            <p className="mt-1 text-sm text-slate-600">Start the call, then record the hospital's answers one part at a time.</p>
          </div>
          <Field label="State / Union Territory" required>
            <select
              className={inputCls}
              value={details.state || 'Karnataka'}
              onChange={(e) => {
                const state = e.target.value
                const clearHospital =
                  state !== 'Karnataka' && HOSPITALS.some((hospital) => hospital === details.hospital)
                setDetails({
                  ...details,
                  state,
                  hospital: clearHospital ? '' : details.hospital,
                  district: '',
                  taluk: '',
                })
                if (clearHospital) setManualHospital(false)
                setCustomDistrict(false)
                setCustomTaluk(false)
              }}
            >
              {INDIAN_STATES_AND_UTS.map((state) => <option key={state}>{state}</option>)}
            </select>
          </Field>
          <Field
            label="Hospital"
            required
            hint={
              manualHospital
                ? 'Enter the hospital name manually; it will be saved as entered.'
                : isKarnataka
                  ? 'Search the list; district and taluk fill automatically for listed hospitals.'
                  : 'No supplied hospital list for this state; enter the hospital name manually.'
            }
          >
            <input
              className={inputCls}
              list="care-hospital-options"
              value={details.hospital}
              onChange={(e) => {
                const value = e.target.value
                if (value === OTHER_HOSPITAL_OPTION) {
                  const wasListedHospital = HOSPITALS.some((hospital) => hospital === details.hospital)
                  setDetails({
                    ...details,
                    hospital: '',
                    district: wasListedHospital ? '' : details.district,
                    taluk: wasListedHospital ? '' : details.taluk,
                  })
                  setManualHospital(true)
                  if (wasListedHospital) {
                    setCustomDistrict(false)
                    setCustomTaluk(false)
                  }
                  return
                }
                const location = locationForHospital(value)
                const wasListedHospital = HOSPITALS.some((hospital) => hospital === details.hospital)
                setDetails({
                  ...details,
                  hospital: value,
                  district: location?.district ?? (wasListedHospital ? '' : details.district),
                  taluk: location?.taluk ?? (wasListedHospital ? '' : details.taluk),
                })
                setManualHospital(!!value && !hospitalOptions.some((hospital) => hospital === value))
                if (location || wasListedHospital) {
                  setCustomDistrict(false)
                  setCustomTaluk(false)
                }
              }}
              placeholder="Search or enter hospital name"
              autoComplete="off"
            />
            <datalist id="care-hospital-options">
              {hospitalOptions.map((hospital) => <option key={hospital} value={hospital} />)}
              {isKarnataka && <option value={OTHER_HOSPITAL_OPTION} label="Other / enter manually" />}
            </datalist>
          </Field>
          <div className="block">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">District</span>
              {isKarnataka ? (
                <select
                  className={inputCls}
                  value={customDistrict ? '__other__' : details.district}
                  onChange={(e) => {
                    const isOther = e.target.value === '__other__'
                    const district = isOther ? (districtIsListed ? '' : details.district) : e.target.value
                    setDetails({ ...details, district, taluk: '' })
                    setCustomDistrict(isOther)
                    setCustomTaluk(false)
                  }}
                >
                  <option value="">Select district</option>
                  {districtOptions.map((district) => <option key={district}>{district}</option>)}
                  <option value="__other__">Other / enter manually</option>
                </select>
              ) : (
                <input className={inputCls} value={details.district} onChange={(e) => up('district', e.target.value)} placeholder="Enter district" />
              )}
            </label>
            {isKarnataka && customDistrict && (
              <input
                className={`${inputCls} mt-2`}
                value={details.district}
                onChange={(e) => setDetails({ ...details, district: e.target.value, taluk: '' })}
                placeholder="Enter district"
                aria-label="Enter district"
              />
            )}
          </div>
          <div className="block">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Taluk</span>
              {isKarnataka ? (
                <select
                  className={inputCls}
                  value={customTaluk ? '__other__' : details.taluk}
                  disabled={!details.district}
                  onChange={(e) => {
                    const isOther = e.target.value === '__other__'
                    const taluk = isOther ? (talukIsListed ? '' : details.taluk) : e.target.value
                    up('taluk', taluk)
                    setCustomTaluk(isOther)
                  }}
                >
                  <option value="">Select taluk</option>
                  {talukOptions.map((taluk) => <option key={taluk}>{taluk}</option>)}
                  <option value="__other__">Other / enter manually</option>
                </select>
              ) : (
                <input className={inputCls} value={details.taluk} onChange={(e) => up('taluk', e.target.value)} placeholder="Enter taluk" />
              )}
            </label>
            {isKarnataka && customTaluk && (
              <input
                className={`${inputCls} mt-2`}
                value={details.taluk}
                onChange={(e) => up('taluk', e.target.value)}
                placeholder="Enter taluk"
                aria-label="Enter taluk"
              />
            )}
          </div>
          <Field label="Point of contact" required>
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
          <Field label="Phone" hint={phoneIncomplete ? 'Enter a 10-digit phone number.' : undefined}>
            <input
              className={inputCls}
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit number"
              aria-invalid={phoneIncomplete}
              value={details.phone}
              onChange={(e) => up('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
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
          <div className="mx-auto w-full max-w-md">
            <button type="button" className={btnPrimary} disabled={!ok} onClick={() => goTo(1)}>
              Start survey
            </button>
          </div>
        </div>
      </>
    )
  }

  /* ---------- steps 1..N: one part per screen on phones, all parts on one page on desktop ---------- */
  if (step <= total) {
    if (isDesktop) {
      const firstOpen = PARTS.find((p) => !partComplete(p, answers[p.id]))
      return (
        <>
          {header}
          <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-6 py-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">CARE form parts</h1>
              <p className="mt-1 text-sm text-slate-600">
                For each part, ask: are your doctors and nurses filling this in CARE for ICU patients?
              </p>
            </div>
            {PARTS.map((part) => {
              const a = answers[part.id]
              const done = partComplete(part, a)
              return (
                <div key={part.id} id={`part-${part.id}`} className="scroll-mt-28">
                  <Card className={`grid grid-cols-[2fr_3fr] gap-6 ${done ? '' : 'ring-1 ring-amber-200'}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${GROUP_STYLE[part.group] ?? 'bg-slate-100 text-slate-700'}`}>
                          {part.group}
                        </span>
                        {done && <span className="text-xs font-semibold text-emerald-700">✓ Answered</span>}
                      </div>
                      <h2 className="mt-2 text-lg font-bold text-slate-900">
                        <span className="text-slate-400">{part.num}</span> {part.title}
                      </h2>
                      <ul className="mt-2 space-y-1 text-sm text-slate-600">
                        {part.covers.map((c) => (
                          <li key={c}>• {c}</li>
                        ))}
                      </ul>
                      {part.conditional && (
                        <p className="mt-2 text-xs text-slate-500">Only some patients need this. If no patient needed it, choose No and then R6.</p>
                      )}
                    </div>
                    <PartForm part={part} answer={a} compact onChange={(next) => setAnswers((prev) => ({ ...prev, [part.id]: next }))} />
                  </Card>
                </div>
              )
            })}
          </div>
          <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
              <p className="text-sm text-slate-600">
                {answeredCount} of {total} parts answered
                {firstOpen && (
                  <>
                    {' · '}
                    <button
                      type="button"
                      className="font-semibold text-emerald-700 hover:underline"
                      onClick={() => document.getElementById(`part-${firstOpen.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    >
                      Go to part {firstOpen.num}
                    </button>
                  </>
                )}
              </p>
              <div className="w-full max-w-xs">
                <button type="button" className={btnPrimary} disabled={!!firstOpen} onClick={() => goTo(summaryStep)}>
                  See summary
                </button>
              </div>
            </div>
          </div>
        </>
      )
    }

    const part = PARTS[step - 1]
    const a: Answer | undefined = answers[part.id]
    const onChange = (next: Answer, advance: boolean) => {
      const all = { ...answers, [part.id]: next }
      setAnswers(all)
      if (advance) window.setTimeout(() => goTo(step + 1, all), 220)
    }

    return (
      <>
        {header}
        <div className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-5">
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

          <PartForm part={part} answer={a} onChange={onChange} />
        </div>
        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
          <button
            type="button"
            className={btnPrimary + ' mx-auto lg:max-w-4xl'}
            disabled={!partComplete(part, a)}
            onClick={() => goTo(step + 1)}
          >
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
      <div className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-5">
        <Card className="flex items-center gap-4">
          <ScoreRing percent={s.percent} rating={s.rating} />
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-slate-900">{details.hospital}</p>
            <p className="truncate text-sm text-slate-500">
              {[details.taluk, details.district, details.state || 'Karnataka'].filter(Boolean).join(' · ') || 'Location not entered'}
            </p>
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
                <Card key={p.id} className="flex items-start justify-between gap-3 p-3!">
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

        <div className="grid gap-4 lg:grid-cols-2">
          <h2 className="text-sm font-semibold text-slate-700 lg:col-span-2">Close the call</h2>
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
            <button type="button" className={btnPrimary + ' mx-auto lg:max-w-4xl'} disabled={busy} onClick={() => finish(true)}>
              {busy ? 'Sending…' : `Save and send to ${TARGET_LABEL[target]}`}
            </button>
            <button type="button" className={btnGhost + ' mx-auto lg:max-w-4xl'} disabled={busy} onClick={() => finish(false)}>
              Save on this phone only
            </button>
          </>
        ) : (
          <>
            <button type="button" className={btnPrimary + ' mx-auto lg:max-w-4xl'} onClick={() => finish(false)}>
              Save call
            </button>
            <p className="text-center text-xs text-slate-500">{noSyncHint}</p>
          </>
        )}
      </div>
    </>
  )
}

/* ---------- helpers ---------- */

const DESKTOP_QUERY = '(min-width: 1024px)'

/** True on screens 1024px and wider (Tailwind's lg breakpoint). */
function useIsDesktop(): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches)
  useEffect(() => {
    const m = window.matchMedia(DESKTOP_QUERY)
    const update = () => setMatch(m.matches)
    m.addEventListener('change', update)
    return () => m.removeEventListener('change', update)
  }, [])
  return match
}

/** A part is answered when it is Yes with every sub-question answered, or No with a reason (and remarks for Other). */
function partComplete(part: Part, a: Answer | undefined): boolean {
  if (!a) return false
  if (a.filling === 'yes') return (part.followUps ?? []).every((f) => !!a.details?.[f.id])
  return !!a.reason && (a.reason !== 'R8' || !!a.remarks?.trim())
}

/**
 * Yes / No, sub-questions and reason for one part.
 * onChange's second argument is true when the phone flow should move to the next part.
 */
function PartForm({
  part,
  answer: a,
  onChange,
  compact = false,
}: {
  part: Part
  answer: Answer | undefined
  onChange: (next: Answer, advance: boolean) => void
  compact?: boolean
}) {
  const followUps = part.followUps ?? []
  const allAnswered = (details: Record<string, string> | undefined) => followUps.every((f) => !!details?.[f.id])

  const pickYes = () => {
    // Parts with sub-questions wait for all of them before moving on.
    if (followUps.length) onChange({ filling: 'yes', details: a?.filling === 'yes' ? a.details : undefined }, false)
    else onChange({ filling: 'yes' }, true)
  }
  const pickDetail = (id: string, value: string) => {
    const details = { ...(a?.details ?? {}), [id]: value }
    // Move on only when this pick answers the last open sub-question, not when changing an earlier answer.
    onChange({ filling: 'yes', details }, !allAnswered(a?.details) && allAnswered(details))
  }

  const bigBtn = compact ? 'rounded-xl py-2.5 text-base' : 'rounded-2xl py-5 text-lg'
  const smallBtn = compact ? 'py-2 text-sm' : 'py-3 text-base'

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      <div>
        {!compact && (
          <p className="mb-3 text-base font-medium text-slate-800">Are your doctors and nurses filling this in CARE for ICU patients?</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            aria-pressed={a?.filling === 'yes'}
            onClick={pickYes}
            className={`${bigBtn} border-2 font-bold transition active:scale-[0.98] ${
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
            onClick={() => onChange({ filling: 'no', reason: a?.reason, remarks: a?.remarks }, false)}
            className={`${bigBtn} border-2 font-bold transition active:scale-[0.98] ${
              a?.filling === 'no'
                ? 'border-rose-600 bg-rose-600 text-white'
                : 'border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-400'
            }`}
          >
            No
          </button>
        </div>
      </div>

      {a?.filling === 'yes' &&
        followUps.map((f) => (
          <div key={f.id}>
            <p className={`mb-2 font-medium text-slate-800 ${compact ? 'text-sm' : 'text-base'}`}>{f.question}</p>
            <div className={`grid gap-2 ${f.options.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {f.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={a.details?.[f.id] === option}
                  onClick={() => pickDetail(f.id, option)}
                  className={`rounded-xl border-2 ${smallBtn} font-semibold transition active:scale-[0.98] ${
                    a.details?.[f.id] === option
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-200'
                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ))}

      {a?.filling === 'no' && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">Main reason</p>
          <div className={compact ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
            {REASONS.map((r) => (
              <button
                key={r.code}
                type="button"
                aria-pressed={a.reason === r.code}
                onClick={() => onChange({ ...a, reason: r.code }, false)}
                className={`flex w-full items-start gap-3 rounded-xl border text-left transition ${compact ? 'p-2' : 'p-3'} ${
                  a.reason === r.code
                    ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-200'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <span className="mt-0.5 rounded-md bg-slate-800 px-1.5 py-0.5 text-xs font-bold text-white">{r.code}</span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{r.label}</span>
                  {!compact && <span className="block text-xs text-slate-500">{r.hint}</span>}
                </span>
              </button>
            ))}
          </div>
          <Field label={a.reason === 'R8' ? 'Remarks (required for Other)' : 'Remarks (optional)'}>
            <textarea rows={2} className={inputCls} value={a.remarks ?? ''} onChange={(e) => onChange({ ...a, remarks: e.target.value }, false)} />
          </Field>
        </div>
      )}
    </div>
  )
}
