import { sendToSheet, toSubmitPayload } from './lib'
import { supabase, supabaseConfigured } from './supabase'
import type { Call } from './types'

/** Turns a Supabase or network error into a short phrase a coordinator can act on. */
export function describeError(e: unknown): string {
  const msg =
    e instanceof Error
      ? e.message
      : typeof e === 'object' && e !== null && 'message' in e
        ? String((e as { message: unknown }).message)
        : ''
  if (/failed to fetch|network|load failed/i.test(msg)) return 'no internet connection'
  if (/jwt|not authenticated|permission denied|row-level security|auth/i.test(msg)) return 'please sign out and sign in again'
  if (/submit_call|schema cache|does not exist/i.test(msg)) return 'the database script has not been run yet'
  return msg || 'unknown error'
}

/** Sends one call to Supabase through the submit_call function (see supabase/schema.sql). */
export async function sendToSupabase(call: Call): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.rpc('submit_call', { payload: toSubmitPayload(call) })
  // Throw a real Error so the screens can show its message.
  if (error) throw new Error(describeError(error))
}

/**
 * Sends a call to the database when Supabase is set up (a failure is reported to the caller),
 * and also to the optional Google Sheet as an extra copy (a failure there is ignored).
 * With no Supabase, it sends to the Google Sheet only.
 */
export async function syncCall(call: Call, sheetUrl: string): Promise<void> {
  if (supabaseConfigured) {
    await sendToSupabase(call)
    if (sheetUrl) sendToSheet(sheetUrl, call).catch(() => undefined)
  } else if (sheetUrl) {
    await sendToSheet(sheetUrl, call)
  }
}
