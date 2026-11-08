import { useCallback, useEffect, useMemo, useState } from 'react'
import { PARTS, REASONS } from './data'
import { supabase } from './supabase'
import { describeError } from './sync'
import type { Rating, UserPermissions } from './types'
import { Card, RatingBadge } from './ui'

interface AnswerRow {
  part_id: string
  filling: boolean
  reason_code: string | null
  remarks: string | null
}

interface CallRow {
  id: string
  hospital: string
  district: string | null
  called_at: string | null
  caller_name: string
  caller_role: string
  spoke_to: string
  designation: string | null
  phone: string | null
  rating: Rating
  percent: number
  overall_result: string
  responsible: string | null
  help_needed: boolean | null
  help_for: string | null
  follow_up: string | null
  remarks: string | null
  call_answers: AnswerRow[]
}

const PAGE_SIZE = 500
const barColor = (pct: number) => (pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500')
const escapeCsv = (value: string | number | boolean | null) => `"${String(value ?? '').replace(/"/g, '""')}"`

function downloadRows(rows: CallRow[]) {
  const columns = [
    'Survey date',
    'Hospital',
    'District',
    'Caller',
    'Caller role',
    'Spoke to',
    'Contact designation',
    'Contact phone',
    'Rating',
    'Percent filling',
    'Overall result',
    'Responsible per shift',
    'Help needed',
    'Help needed for',
    'Follow-up date',
    'Call remarks',
    ...PARTS.flatMap((part) => [`${part.num} ${part.title}`, `${part.num} reason`, `${part.num} remarks`]),
  ]
  const lines = rows.map((row) => {
    const answers = new Map(row.call_answers.map((answer) => [answer.part_id, answer]))
    const values: (string | number | boolean | null)[] = [
      row.called_at,
      row.hospital,
      row.district,
      row.caller_name,
      row.caller_role,
      row.spoke_to,
      row.designation,
      row.phone,
      row.rating,
      row.percent,
      row.overall_result,
      row.responsible,
      row.help_needed,
      row.help_for,
      row.follow_up,
      row.remarks,
    ]
    for (const part of PARTS) {
      const answer = answers.get(part.id)
      values.push(answer ? (answer.filling ? 'Yes' : 'No') : '')
      values.push(answer?.reason_code ?? '')
      values.push(answer?.remarks ?? '')
    }
    return values.map(escapeCsv).join(',')
  })
  const csv = `\uFEFF${[columns.map(escapeCsv).join(','), ...lines].join('\r\n')}`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `care-survey-report-${new Date().toLocaleDateString('en-CA')}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export default function Reports({
  onBack,
  permissions,
}: {
  onBack: () => void
  permissions: UserPermissions
}) {
  const [rows, setRows] = useState<CallRow[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [district, setDistrict] = useState('')
  const [hospitalSearch, setHospitalSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const load = useCallback(async () => {
    if (!supabase) return
    const allRows: CallRow[] = []

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error: queryError } = await supabase
        .from('hospital_calls')
        .select('id, hospital, district, called_at, caller_name, caller_role, spoke_to, designation, phone, rating, percent, overall_result, responsible, help_needed, help_for, follow_up, remarks, call_answers(part_id, filling, reason_code, remarks)')
        .order('called_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)

      if (queryError) {
        setError(describeError(queryError))
        setRows(null)
        setLoading(false)
        return
      }

      const batch = (data ?? []) as unknown as CallRow[]
      allRows.push(...batch)
      if (batch.length < PAGE_SIZE) break
    }

    setError('')
    setRows(allRows)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const districts = useMemo(
    () => Array.from(new Set((rows ?? []).map((row) => (row.district ?? '').trim()).filter(Boolean))).sort(),
    [rows],
  )

  const report = useMemo(() => {
    const search = hospitalSearch.trim().toLocaleLowerCase()
    const inScope = (rows ?? []).filter((row) => {
      const date = row.called_at?.slice(0, 10) ?? ''
      return (
        (!district || (row.district ?? '').trim() === district) &&
        (!startDate || date >= startDate) &&
        (!endDate || date <= endDate) &&
        (!search || row.hospital.toLocaleLowerCase().includes(search))
      )
    })

    const latestByHospital = new Map<string, CallRow>()
    for (const row of inScope) {
      const key = `${(row.district ?? '').trim().toLocaleLowerCase()}::${row.hospital.trim().toLocaleLowerCase()}`
      if (!latestByHospital.has(key)) latestByHospital.set(key, row)
    }
    const latest = Array.from(latestByHospital.values())
    const ratings: Record<Rating, number> = { Compliant: 0, 'Needs follow-up': 0, Escalate: 0 }
    for (const row of latest) ratings[row.rating]++

    const parts = PARTS.map((part) => {
      let yes = 0
      let no = 0
      for (const row of latest) {
        const answer = row.call_answers.find((item) => item.part_id === part.id)
        if (!answer) continue
        if (answer.filling) yes++
        else if (answer.reason_code !== 'R6') no++
      }
      const applicable = yes + no
      return { part, yes, applicable, pct: applicable ? Math.round((yes / applicable) * 100) : null }
    })
      .filter((item) => item.pct !== null)
      .sort((a, b) => (a.pct as number) - (b.pct as number))

    const reasonCounts = new Map<string, number>()
    for (const row of inScope) {
      for (const answer of row.call_answers) {
        if (!answer.filling && answer.reason_code && answer.reason_code !== 'R6') {
          reasonCounts.set(answer.reason_code, (reasonCounts.get(answer.reason_code) ?? 0) + 1)
        }
      }
    }
    const reasons = REASONS.filter((reason) => reason.code !== 'R6')
      .map((reason) => ({ ...reason, n: reasonCounts.get(reason.code) ?? 0 }))
      .filter((reason) => reason.n > 0)
      .sort((a, b) => b.n - a.n)

    const followUps = latest
      .filter((row) => row.rating !== 'Compliant')
      .sort((a, b) => (a.follow_up ?? '9999').localeCompare(b.follow_up ?? '9999'))

    const monthMap = new Map<string, { calls: number; percent: number }>()
    for (const row of inScope) {
      if (!row.called_at) continue
      const month = row.called_at.slice(0, 7)
      const value = monthMap.get(month) ?? { calls: 0, percent: 0 }
      value.calls++
      value.percent += row.percent
      monthMap.set(month, value)
    }
    const trends = Array.from(monthMap, ([month, value]) => ({
      month,
      calls: value.calls,
      average: Math.round(value.percent / value.calls),
    }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)

    const statusOrder: Record<Rating, number> = { Escalate: 0, 'Needs follow-up': 1, Compliant: 2 }
    const hospitals = [...latest].sort(
      (a, b) => statusOrder[a.rating] - statusOrder[b.rating] || a.percent - b.percent || a.hospital.localeCompare(b.hospital),
    )
    const average = latest.length ? Math.round(latest.reduce((sum, row) => sum + row.percent, 0) / latest.length) : 0
    return { calls: inScope, latest, ratings, parts, reasons, followUps, trends, hospitals, average }
  }, [rows, district, hospitalSearch, startDate, endDate])

  const [today] = useState(() => new Date().toLocaleDateString('en-CA'))
  const maxReason = Math.max(1, ...report.reasons.map((reason) => reason.n))
  const maxCalls = Math.max(1, ...report.trends.map((trend) => trend.calls))
  const canReadDashboard = permissions.can_view_reports

  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3.5 backdrop-blur sm:px-6 lg:px-10">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50" aria-label="Back to home">←</button>
          <div>
            <p className="text-sm font-bold text-slate-900">CARE Forms</p>
            <p className="text-xs text-slate-500">Karnataka operations</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setLoading(true); void load() }}
          disabled={loading}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-800 disabled:opacity-50"
        >
          <span aria-hidden="true" className="mr-1.5">↻</span>{loading ? 'Refreshing…' : 'Refresh data'}
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:px-10 lg:py-9">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-800">{canReadDashboard ? 'Performance overview' : 'Data tools'}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{canReadDashboard ? 'Hospital analytics' : 'Export survey data'}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {canReadDashboard ? 'Spot low-compliance areas, follow-ups, and repeated problems across Karnataka.' : 'Download survey records for analysis.'}
            </p>
          </div>
          {permissions.can_export && (
            <button type="button" onClick={() => downloadRows(report.calls)} disabled={!report.calls.length || loading} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:opacity-50">
              <span aria-hidden="true">↓</span> Export {report.calls.length} calls
            </button>
          )}
        </div>

        {error && !loading && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">Could not load survey data: {error}.</p>}
        {!rows && !error && <p className="py-10 text-center text-sm text-slate-500">Loading survey data…</p>}
        {rows && rows.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No calls in the database yet. Submitted surveys will appear here.</p>}

        {rows && rows.length > 0 && (
          <>
            <Card className="!p-4 sm:!p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Filter survey data</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Adjust the date range and hospital area.</p>
                </div>
                {(district || hospitalSearch || startDate || endDate) && (
                  <button type="button" className="text-xs font-semibold text-emerald-800 hover:text-emerald-950" onClick={() => { setDistrict(''); setHospitalSearch(''); setStartDate(''); setEndDate('') }}>
                    Clear filters
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {canReadDashboard && (
                  <label className="text-xs font-semibold text-slate-600">
                    Hospital
                    <input className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100" value={hospitalSearch} onChange={(event) => setHospitalSearch(event.target.value)} placeholder="Search hospital name" />
                  </label>
                )}
                {canReadDashboard && (
                  <label className="text-xs font-semibold text-slate-600">
                    District
                    <select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100" value={district} onChange={(event) => setDistrict(event.target.value)}>
                      <option value="">All districts</option>
                      {districts.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                )}
                <label className="text-xs font-semibold text-slate-600">
                  From date
                  <input className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  To date
                  <input className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </label>
              </div>
            </Card>

            {canReadDashboard && (
              <>
                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {[
                    { label: 'Hospitals surveyed', value: report.latest.length, tone: 'text-slate-900' },
                    { label: 'Calls in selected period', value: report.calls.length, tone: 'text-slate-900' },
                    { label: 'Average current score', value: `${report.average}%`, tone: 'text-slate-900' },
                    { label: 'Need follow-up', value: report.ratings['Needs follow-up'], tone: 'text-amber-700' },
                    { label: 'Escalate', value: report.ratings.Escalate, tone: 'text-rose-700' },
                  ].map((item, index) => (
                    <Card key={item.label} className={`relative overflow-hidden !p-5 ${index === 3 ? 'border-amber-100' : index === 4 ? 'border-rose-100' : ''}`}>
                      <span className={`absolute right-4 top-4 h-2.5 w-2.5 rounded-full ${index === 3 ? 'bg-amber-400' : index === 4 ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                      <p className={`mt-3 text-3xl font-bold tracking-tight ${item.tone}`}>{item.value}</p>
                    </Card>
                  ))}
                </section>

                <div className="grid gap-6 xl:grid-cols-2">
                  <section>
                    <h2 className="mb-2 text-base font-semibold text-slate-800">Survey trend by month</h2>
                    <Card className="space-y-3">
                      {report.trends.length === 0 ? (
                        <p className="text-sm text-slate-500">No dated surveys in this period.</p>
                      ) : report.trends.map((trend) => (
                        <div key={trend.month} className="grid grid-cols-[5.5rem_1fr_6rem] items-center gap-3 text-sm">
                          <span className="font-medium text-slate-600">
                            {new Date(`${trend.month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                          </span>
                          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(trend.calls / maxCalls) * 100}%` }} />
                          </div>
                          <span className="text-right text-xs text-slate-600">{trend.calls} calls · {trend.average}% avg</span>
                        </div>
                      ))}
                    </Card>
                  </section>

                  <section>
                    <h2 className="mb-2 text-base font-semibold text-slate-800">Most repeated problems</h2>
                    <Card className="space-y-3">
                      {report.reasons.length === 0 ? (
                        <p className="text-sm text-slate-500">No problem reason codes in this period.</p>
                      ) : report.reasons.map((reason) => (
                        <div key={reason.code}>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm text-slate-800">
                              <span className="mr-1.5 rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-bold text-white">{reason.code}</span>
                              {reason.label}
                            </span>
                            <span className="text-xs font-semibold text-slate-600">{reason.n} occurrences</span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-rose-500" style={{ width: `${(reason.n / maxReason) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-slate-500">Counts No answers across all calls in the selected date and district filters.</p>
                    </Card>
                  </section>
                </div>

                <section>
                  <h2 className="mb-2 text-base font-semibold text-slate-800">Weakest form areas</h2>
                  <Card className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                    {report.parts.map(({ part, yes, applicable, pct }) => (
                      <div key={part.id}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm text-slate-800"><span className="text-slate-400">{part.num}</span> {part.title}</span>
                          <span className="shrink-0 text-xs font-semibold text-slate-600">{pct}% <span className="font-normal text-slate-400">({yes}/{applicable})</span></span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${barColor(pct as number)}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </Card>
                </section>

                <section>
                  <h2 className="mb-2 text-base font-semibold text-slate-800">Hospital status</h2>
                  {report.hospitals.length === 0 ? (
                    <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600">No hospitals match these filters.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Hospital</th>
                            <th className="px-4 py-3">District</th>
                            <th className="px-4 py-3">Latest survey</th>
                            <th className="px-4 py-3">Caller</th>
                            <th className="px-4 py-3">Score</th>
                            <th className="px-4 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {report.hospitals.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-semibold text-slate-900">{row.hospital}</td>
                              <td className="px-4 py-3 text-slate-600">{row.district || '—'}</td>
                              <td className="px-4 py-3 text-slate-600">{row.called_at ? new Date(row.called_at).toLocaleDateString('en-IN') : '—'}</td>
                              <td className="px-4 py-3 text-slate-600">{row.caller_name}</td>
                              <td className="px-4 py-3 font-semibold text-slate-800">{row.percent}%</td>
                              <td className="px-4 py-3"><RatingBadge rating={row.rating} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-slate-500">{report.latest.length} hospital(s) shown. Status is based on each hospital’s latest call within the selected period.</p>
                </section>

                <section>
                  <h2 className="mb-2 text-base font-semibold text-slate-800">Hospitals needing follow-up</h2>
                  {report.followUps.length === 0 ? (
                    <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Every hospital in this view is compliant.</p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {report.followUps.map((row) => {
                        const overdue = !!row.follow_up && row.follow_up < today
                        return (
                          <Card key={row.id} className="!p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">{row.hospital}</p>
                                <p className="truncate text-xs text-slate-500">{row.district ? `${row.district} · ` : ''}{row.percent}% filling · {row.caller_name}</p>
                              </div>
                              <RatingBadge rating={row.rating} />
                            </div>
                            <p className={`mt-2 text-xs font-medium ${overdue ? 'text-rose-600' : 'text-slate-600'}`}>
                              {row.follow_up ? `Follow-up: ${row.follow_up}${overdue ? ' (overdue)' : ''}` : 'No follow-up date set'}
                            </p>
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </main>
    </>
  )
}
