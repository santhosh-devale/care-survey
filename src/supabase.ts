import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

/** True when the .env file has both values. Without them the app still works, saving on the phone only. */
export const supabaseConfigured = Boolean(url && key && !url.includes('your-project-ref'))

export const supabase = supabaseConfigured ? createClient(url as string, key as string) : null
