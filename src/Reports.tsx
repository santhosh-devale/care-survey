import { useCallback, useEffect, useMemo, useState } from 'react'
import { PARTS, REASONS } from './data'
import { supabase } from './supabase'
import { describeError } from './sync'
import type { Rating } from './types'
import { Card, RatingBadge } from './ui'

interface AnswerRow {
  part_id: string
  filling: boolean
  reason_code: string | null
}

interface CallRow {
  id: string
  hospital: string
  district: string | null
  called_at: string | null
  caller_name: string
  rating: Rating
  percent: number
  follow_up: string | null
  call_answers: AnswerRow[]
}

const barColor = (pct: number) => (pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500')

export default function Reports({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<CallRow[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [district, setDistrict] = useState('')

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('hospital_calls')
      .select('id, hospital, district, called_at, caller_name, rating, percent, follow_up, call_answers(part_id, filling, reason_code)')
      .order('called_at', { ascending: false, nullsFirst: false })
      .limit(2000)
    if (error) setError(describeError(error))
    else setRows((data ?? []) as unknown as CallRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const districts = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => (r.district ?? '').trim()).filter(Boolean))).sort(),
    [rows],
  )

  const report = useMemo(() => {
    const inScope = (rows ?? []).filter((r) => !district || (r.district ?? '').trim() === district)

    // Latest call per hospital is that hospital's current status. Rows arrive newest first.
    const latestByHospital = new Map<string, CallRow>()
    for (const r of inScope) {
      const k = r.hospital.trim().toLowerCase()
      if (!latestByHospital.has(k)) latestByHospital.set(k, r)
    }
    const latest = Array.from(latestByHospital.values())

    const ratings: Record<Rating, number> = { Compliant: 0, 'Needs follow-up': 0, Escalate: 0 }
    for (const r of latest) ratings[r.rating]++

    const parts = PARTS.map((p) => {
      let yes = 0
      let no = 0
      for (const r of latest) {
        const a = r.call_answers.find((x) => x.part_id === p.id)
        if (!a) continue
        if (a.filling) yes++
        else if (a.reason_code !== 'R6') no++
      }
      const applicable = yes + no
      return { part: p, yes, applicable, pct: applicable ? Math.round((yes / applicable) * 100) : null }
    })
      .filter((x) => x.pct !== null)
      .sort((a, b) => (a.pct as number) - (b.pct as number))

    const reasonCounts = new Map<string, number>()
    for (const r of latest) {
      for (const a of r.call_answers) {
        if (!a.filling && a.reason_code) reasonCounts.set(a.reason_code, (reasonCounts.get(a.reason_code) ?? 0) + 1)
      }
    }
    const reasons = REASONS.map((x) => ({ ...x, n: reasonCounts.get(x.code) ?? 0 }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)

    const followUps = latest
      .filter((r) => r.rating !== 'Compliant')
      .sort((a, b) => (a.follow_up ?? '9999').localeCompare(b.follow_up ?? '9999'))

    return { calls: inScope.length, latest, ratings, parts, reasons, followUps }
  }, [rows, district])

  const [today] = useState(() => new Date().toLocaleDateString('en-CA'))
  const maxReason = Math.max(1, ...report.reasons.map((r) => r.n))

  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur">
        <button type="button" onClick={onBack} className="-ml-2 rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100">
          ← Home
        </button>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="-mr-2 rounded-lg px-2 py-1 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      <div className="flex-1 space-y-5 px-4 py-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports</h1>
          <p className="mt-1 text-sm text-slate-600">Each hospital is counted by its most recent call.</p>
        </div>

        {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">Could not load the reports: {error}.</p>}
        {!rows && !error && <p className="py-10 text-center text-sm text-slate-500">Loading…</p>}

        {rows && rows.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-500">No calls in the database yet. Save a call and it will appear here.</p>
        )}

        {rows && rows.length > 0 && (
          <>
            <select
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              aria-label="District"
            >
              <option value="">All districts</option>
              {districts.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>

            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Hospitals', value: report.latest.length },
                { label: 'Compliant', value: report.ratings.Compliant },
                { label: 'Follow-up', value: report.ratings['Needs follow-up'] },
                { label: 'Escalate', value: report.ratings.Escalate },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-slate-200 bg-white px-1 py-3 shadow-sm">
                  <p className="text-xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-[11px] font-medium text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="-mt-2 text-xs text-slate-500">{report.calls} calls in total.</p>

            <section>
              <h2 className="mb-2 text-sm font-semibold text-slate-700">Which forms are filled least (weakest first)</h2>
              <Card className="space-y-3">
                {report.parts.map(({ part, yes, applicable, pct }) => (
                  <div key={part.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm text-slate-800">
                        <span className="text-slate-400">{part.num}</span> {part.title}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-slate-600">
                        {pct}% <span className="font-normal text-slate-400">({yes}/{applicable})</span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${barColor(pct as number)}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </Card>
            </section>

            {report.reasons.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-semibold text-slate-700">Why forms are not filled</h2>
                <Card className="space-y-3">
                  {report.reasons.map((r) => (
                    <div key={r.code}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm text-slate-800">
                          <span className="mr-1.5 rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-bold text-white">{r.code}</span>
                          {r.label}
                        </span>
                        <span className="text-xs font-semibold text-slate-600">{r.n}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-slate-700" style={{ width: `${(r.n / maxReason) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-slate-500">Counts every part marked No across hospitals' latest calls.</p>
                </Card>
              </section>
            )}

            <section>
              <h2 className="mb-2 text-sm font-semibold text-slate-700">Hospitals needing a follow-up</h2>
              {report.followUps.length === 0 ? (
                <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Every hospital in this view is compliant.</p>
              ) : (
                <div className="space-y-2">
                  {report.followUps.map((r) => {
                    const overdue = !!r.follow_up && r.follow_up < today
                    return (
                      <Card key={r.id} className="!p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{r.hospital}</p>
                            <p className="truncate text-xs text-slate-500">
                              {r.district ? r.district + ' · ' : ''}
                              {r.percent}% filling · called by {r.caller_name}
                            </p>
                          </div>
                          <RatingBadge rating={r.rating} />
                        </div>
                        <p className={`mt-2 text-xs font-medium ${overdue ? 'text-rose-600' : 'text-slate-600'}`}>
                          {r.follow_up ? `Follow-up: ${r.follow_up}${overdue ? ' (overdue)' : ''}` : 'No follow-up date set'}
                        </p>
                      </Card>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  )
}
