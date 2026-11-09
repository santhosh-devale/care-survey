export type Filling = 'yes' | 'no'

export interface Answer {
  filling: Filling
  /** Reason code (R1 to R8). Only set when filling is "no". */
  reason?: string
  remarks?: string
  /** Answers to the part's sub-questions, keyed by FollowUp id. Only set when filling is "yes". */
  details?: Record<string, string>
}

export type Answers = Record<string, Answer>

export type CallerRole = 'FSM' | 'Hub Engg' | 'Other'

export interface Details {
  hospital: string
  state: string
  district: string
  taluk: string
  spokeTo: string
  designation: string
  phone: string
  caller: string
  callerRole: CallerRole
  /** datetime-local value, e.g. 2026-11-08T09:30 */
  callAt: string
}

export interface Closing {
  responsible: string
  helpNeeded: '' | 'yes' | 'no'
  helpFor: string
  followUp: string
  remarks: string
}

export interface Call {
  id: string
  createdAt: string
  details: Details
  answers: Answers
  closing: Closing
  sentAt?: string
}

export interface Draft {
  step: number
  details: Details
  answers: Answers
  closing: Closing
}

export interface UserPermissions {
  can_submit_surveys: boolean
  can_view_reports: boolean
  can_export: boolean
  can_manage_users: boolean
}

export interface UserPermissionRow extends UserPermissions {
  user_id: string
  email: string
  updated_at: string
}

/** Where a saved call is sent: the Supabase database, or the optional Google Sheet. */
export type SyncTarget = 'database' | 'sheet'

export type Rating = 'Compliant' | 'Needs follow-up' | 'Escalate'
export type Result = 'Started' | 'Partly' | 'Not started'

export interface Score {
  yes: number
  no: number
  /** Parts marked No with reason R6 (not applicable). Not counted against the hospital. */
  exempt: number
  applicable: number
  percent: number
  rating: Rating
  result: Result
}
