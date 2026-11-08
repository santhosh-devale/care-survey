import { useState } from 'react'
import { PARTS } from './data'
import { downloadCsv, fmtDate, reasonText, score, sendToSheet, summaryText } from './lib'
import type { Call } from './types'
import { btnGhost, btnPrimary, Card, RatingBadge } from './ui'

interface Props {
  calls: Call[]
  sheetUrl: string
  onBack: () => void
  onDelete: (id: string) => void
  onSent: (id: string) => void
}

export default function History({ calls, sheetUrl, onBack, onDelete, onSent }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const unsent = calls.filter((c) => !c.sentAt)

  const sendMany = async (list: Call[]) => {
    if (!sheetUrl || !list.length) return
    setBusy(true)
    setNote('')
    let ok = 0
    for (const c of list) {
      try {
        await sendToSheet(sheetUrl, c)
        onSent(c.id)
        ok++
      } catch {
        /* keep going: unsent calls stay marked unsent */
      }
    }
    setBusy(false)
    setNote(ok === list.length ? `Sent ${ok} call${ok === 1 ? '' : 's'} to the Sheet.` : `Sent ${ok} of ${list.length}. Check your internet and try again.`)
  }

  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur">
        <button type="button" onClick={onBack} className="-ml-2 rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100">
          ← Home
        </button>
        <span className="text-sm font-medium text-slate-500">{calls.length} saved</span>
      </header>

      <div className="flex-1 space-y-4 px-4 py-5">
        <h1 className="text-xl font-bold text-slate-900">History and export</h1>

        <div className="space-y-2">
          <button type="button" className={btnGhost} disabled={!calls.length} onClick={() => downloadCsv(calls)}>
            Download all calls as CSV
          </button>
          {sheetUrl && (
            <button type="button" className={btnPrimary} disabled={busy || !unsent.length} onClick={() => sendMany(unsent)}>
              {busy ? 'Sending…' : unsent.length ? `Send ${unsent.length} unsent to Google Sheet` : 'All calls sent to Google Sheet'}
            </button>
          )}
          {note && <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{note}</p>}
        </div>

        {calls.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No calls saved yet.</p>}

        <div className="space-y-2">
          {calls.map((c) => {
            const s = score(c.answers)
            const open = openId === c.id
            const no = PARTS.filter((p) => c.answers[p.id]?.filling === 'no')
            return (
              <Card key={c.id} className="!p-0 overflow-hidden">
                <button type="button" className="flex w-full items-center justify-between gap-3 p-3 text-left" onClick={() => setOpenId(open ? null : c.id)}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{c.details.hospital}</p>
                    <p className="truncate text-xs text-slate-500">
                      {c.details.district ? c.details.district + ' · ' : ''}
                      {fmtDate(c.details.callAt)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">{c.sentAt ? 'Sent to Sheet' : 'Only on this phone'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <RatingBadge rating={s.rating} />
                    <span className="text-xs text-slate-500">
                      {s.yes}/{s.applicable} filling
                    </span>
                  </div>
                </button>
                {open && (
                  <div className="space-y-3 border-t border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs text-slate-600">
                      Spoke to {c.details.spokeTo}
                      {c.details.designation ? ` (${c.details.designation})` : ''}. Called by {c.details.caller} ({c.details.callerRole}).
                    </p>
                    {no.length === 0 ? (
                      <p className="text-sm text-emerald-700">Every part is being filled.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {no.map((p) => (
                          <li key={p.id} className="text-sm text-slate-800">
                            <span className="font-semibold">
                              {p.num} {p.title}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {reasonText(c.answers[p.id].reason)}
                              {c.answers[p.id].remarks ? ` · ${c.answers[p.id].remarks}` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {c.closing.followUp && <p className="text-xs text-slate-600">Follow-up: {c.closing.followUp}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        className="rounded-xl border border-slate-300 bg-white py-2 text-center text-sm font-semibold text-slate-700"
                        href={`https://wa.me/?text=${encodeURIComponent(summaryText(c))}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        WhatsApp
                      </a>
                      <button
                        type="button"
                        className="rounded-xl border border-rose-200 bg-white py-2 text-sm font-semibold text-rose-700"
                        onClick={() => {
                          if (window.confirm(`Delete the call for ${c.details.hospital}? This only removes it from this phone.`)) onDelete(c.id)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </>
  )
}
