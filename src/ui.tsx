import type { ReactNode } from 'react'
import type { Rating, SyncTarget } from './types'

export const TARGET_LABEL: Record<SyncTarget, string> = {
  database: 'the database',
  sheet: 'Google Sheet',
}

export const RATING_STYLE: Record<Rating, { chip: string; ring: string; dot: string }> = {
  Compliant: { chip: 'bg-emerald-100 text-emerald-800', ring: 'stroke-emerald-500', dot: 'bg-emerald-500' },
  'Needs follow-up': { chip: 'bg-amber-100 text-amber-800', ring: 'stroke-amber-500', dot: 'bg-amber-500' },
  Escalate: { chip: 'bg-rose-100 text-rose-800', ring: 'stroke-rose-500', dot: 'bg-rose-500' },
}

export const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100'

export const btnPrimary =
  'block w-full rounded-xl bg-emerald-700 px-5 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none'

export const btnGhost =
  'block w-full rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-center text-base font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50'

export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={`mx-auto flex min-h-dvh w-full flex-col bg-slate-50 ${wide ? 'max-w-md lg:max-w-[1440px] lg:shadow-none' : 'max-w-md sm:shadow-xl'}`}>
      {children}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)] ${className}`}>
      {children}
    </div>
  )
}

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export function RatingBadge({ rating }: { rating: Rating }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${RATING_STYLE[rating].chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${RATING_STYLE[rating].dot}`} />
      {rating}
    </span>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | ''
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
            value === o.value
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ScoreRing({ percent, rating }: { percent: number; rating: Rating }) {
  const c = 2 * Math.PI * 42
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" strokeWidth="10" className="stroke-slate-200" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className={RATING_STYLE[rating].ring}
          strokeDasharray={`${(percent / 100) * c} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-900">{percent}%</span>
        <span className="text-[11px] font-medium text-slate-500">filling</span>
      </div>
    </div>
  )
}
