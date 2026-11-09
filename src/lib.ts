import { PARTS, REASONS } from './data'
import type { Answers, Call, CallerRole, Closing, Details, Rating, Result, Score } from './types'

/* ---------- small helpers ---------- */

export function uid(): string {
  // crypto.randomUUID is missing on plain http (e.g. a LAN address), so keep a fallback.
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function nowLocal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function inDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('en-CA') // YYYY-MM-DD
}

export function fmtDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export function emptyDetails(caller = '', callerRole: CallerRole = 'FSM'): Details {
  return {
    hospital: '',
    state: 'Karnataka',
    district: '',
    taluk: '',
    spokeTo: '',
    designation: '',
    phone: '',
    caller,
    callerRole,
    callAt: nowLocal(),
  }
}

export function emptyClosing(): Closing {
  return { responsible: '', helpNeeded: '', helpFor: '', followUp: '', remarks: '' }
}

export function reasonText(code?: string): string {
  const r = REASONS.find((x) => x.code === code)
  return r ? `${r.code} · ${r.label}` : ''
}

/* ---------- scoring ---------- */

export function score(answers: Answers): Score {
  let yes = 0
  let no = 0
  let exempt = 0
  for (const p of PARTS) {
    const a = answers[p.id]
    if (!a) continue
    if (a.filling === 'yes') yes++
    else if (a.reason === 'R6') exempt++
    else no++
  }
  const applicable = yes + no
  const percent = applicable ? Math.round((yes / applicable) * 100) : 100
  const rating: Rating = percent >= 80 ? 'Compliant' : percent >= 50 ? 'Needs follow-up' : 'Escalate'
  const result: Result = no === 0 ? 'Started' : yes === 0 ? 'Not started' : 'Partly'
  return { yes, no, exempt, applicable, percent, rating, result }
}

/* ---------- export: one flat row per call ---------- */

export function toRow(call: Call): Record<string, string | number> {
  const s = score(call.answers)
  const d = call.details
  const row: Record<string, string | number> = {
    'Call ID': call.id,
    'Saved at': call.createdAt,
    'Call date/time': d.callAt,
    Caller: d.caller,
    'Caller role': d.callerRole,
    Hospital: d.hospital,
    State: d.state || 'Karnataka',
    District: d.district,
    Taluk: d.taluk ?? '',
    'Spoke to': d.spokeTo,
    Designation: d.designation,
    Phone: d.phone,
  }
  const notes: string[] = []
  for (const p of PARTS) {
    const a = call.answers[p.id]
    row[`${p.num} ${p.title}`] = a ? (a.filling === 'yes' ? 'Yes' : 'No') : ''
    row[`${p.num} Reason`] = a?.filling === 'no' ? reasonText(a.reason) : ''
    for (const f of p.followUps ?? []) {
      row[`${p.num} ${f.label}`] = a?.filling === 'yes' ? (a.details?.[f.id] ?? '') : ''
    }
    if (a?.remarks?.trim()) notes.push(`${p.num}: ${a.remarks.trim()}`)
  }
  row['Part remarks'] = notes.join(' | ')
  row['Parts Yes'] = s.yes
  row['Parts applicable'] = s.applicable
  row['Percent filling'] = s.percent
  row.Rating = s.rating
  row['Overall result'] = s.result
  row['Person responsible per shift'] = call.closing.responsible
  row['Help needed'] = call.closing.helpNeeded === 'yes' ? 'Yes' : call.closing.helpNeeded === 'no' ? 'No' : ''
  row['Help needed for'] = call.closing.helpFor
  row['Follow-up date'] = call.closing.followUp
  row['Caller remarks'] = call.closing.remarks
  return row
}

/** The JSON sent to the Supabase submit_call function (see supabase/schema.sql). */
export function toSubmitPayload(call: Call) {
  const s = score(call.answers)
  const d = call.details
  const c = call.closing
  const when = new Date(d.callAt)
  return {
    client_id: call.id,
    called_at: Number.isNaN(when.getTime()) ? null : when.toISOString(),
    caller_name: d.caller,
    caller_role: d.callerRole,
    hospital: d.hospital,
    state: d.state || 'Karnataka',
    district: d.district,
    taluk: d.taluk ?? '',
    spoke_to: d.spokeTo,
    designation: d.designation,
    phone: d.phone,
    parts_yes: s.yes,
    parts_applicable: s.applicable,
    percent: s.percent,
    rating: s.rating,
    overall_result: s.result,
    responsible: c.responsible,
    help_needed: c.helpNeeded === '' ? null : c.helpNeeded === 'yes',
    help_for: c.helpFor,
    follow_up: c.followUp,
    remarks: c.remarks,
    answers: PARTS.flatMap((p) => {
      const a = call.answers[p.id]
      if (!a) return []
      return [
        {
          part_id: p.id,
          part_num: p.num,
          part_title: p.title,
          filling: a.filling === 'yes',
          reason_code: a.filling === 'no' ? (a.reason ?? '') : '',
          remarks: a.remarks ?? '',
          details: a.filling === 'yes' && a.details ? a.details : null,
        },
      ]
    }),
  }
}

function csvCell(v: string | number): string {
  return `"${String(v).replace(/"/g, '""')}"`
}

export function toCsv(calls: Call[]): string {
  if (!calls.length) return ''
  const rows = calls.map(toRow)
  const keys = Object.keys(rows[0])
  const lines = [keys.map(csvCell).join(',')]
  for (const r of rows) lines.push(keys.map((k) => csvCell(r[k] ?? '')).join(','))
  return '﻿' + lines.join('\r\n') // BOM so Excel reads UTF-8 correctly
}

export function downloadCsv(calls: Call[]): void {
  const blob = new Blob([toCsv(calls)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `care-survey-${new Date().toLocaleDateString('en-CA')}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/* ---------- share text (for WhatsApp) ---------- */

export function summaryText(call: Call): string {
  const s = score(call.answers)
  const d = call.details
  const location = [d.taluk, d.district, d.state || 'Karnataka'].filter(Boolean).join(', ')
  const lines = [
    `CARE forms survey: ${d.hospital}${location ? `, ${location}` : ''}`,
    `Called by ${d.caller} (${d.callerRole}) on ${fmtDate(d.callAt)}`,
    `Spoke to: ${d.spokeTo}${d.designation ? ' (' + d.designation + ')' : ''}`,
    `Result: ${s.result} | ${s.yes}/${s.applicable} parts filling (${s.percent}%) | ${s.rating}`,
  ]
  for (const p of PARTS) {
    const a = call.answers[p.id]
    if (a?.filling !== 'yes') continue
    for (const f of p.followUps ?? []) {
      if (a.details?.[f.id]) lines.push(`${p.num} ${f.label}: ${a.details[f.id]}`)
    }
  }
  const no = PARTS.filter((p) => call.answers[p.id]?.filling === 'no')
  if (no.length) {
    lines.push('', 'Not filling:')
    for (const p of no) {
      const a = call.answers[p.id]
      lines.push(`- ${p.num} ${p.title}: ${reasonText(a.reason)}${a.remarks ? ' (' + a.remarks + ')' : ''}`)
    }
  }
  if (call.closing.responsible) lines.push('', `Responsible per shift: ${call.closing.responsible}`)
  if (call.closing.helpNeeded === 'yes') lines.push(`Help needed: ${call.closing.helpFor || 'yes'}`)
  if (call.closing.followUp) lines.push(`Follow-up: ${call.closing.followUp}`)
  return lines.join('\n')
}

/* ---------- Google Sheet (Apps Script web app) ---------- */

/**
 * Posts one row to a Google Apps Script web app (see apps-script/Code.gs).
 * The request is "no-cors" because Apps Script does not send CORS headers, so the
 * browser cannot read the reply: a resolved promise means the request left the phone,
 * not that the Sheet confirmed it.
 */
export async function sendToSheet(url: string, call: Call): Promise<void> {
  await fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(toRow(call)),
  })
}

/* ---------- local storage ---------- */

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked: the app still works for this session */
  }
}
