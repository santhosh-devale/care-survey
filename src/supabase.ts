import { createClient } from '@supabase/supabase-js'

const url = 'https://yihxezzdgyvlbfxgykwh.supabase.co'
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

/** True when the publishable key is configured. Without it, the app still works on this device only. */
export const supabaseConfigured = Boolean(key)

export const supabase = key ? createClient(url, key) : null
