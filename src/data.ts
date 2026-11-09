/** A sub-question asked only when the hospital answers Yes for a part. */
export interface FollowUp {
  /** Key the answer is stored under. Do not change once calls are saved. */
  id: string
  /** Shown to the caller in the survey. */
  question: string
  /** Short column name used in exports and reports. */
  label: string
  options: string[]
}

export interface Part {
  id: string
  num: string
  group: string
  title: string
  /** What the caller checks in this part, shown so they can describe it on the phone. */
  covers: string[]
  /** Only some patients need this part (re-admission, respiratory support). */
  conditional?: boolean
  /** Sub-questions asked, in order, when the answer is Yes. */
  followUps?: FollowUp[]
}

const YES_NO = ['Yes', 'No']

export const PARTS: Part[] = [
  {
    id: 'admission',
    num: '1',
    group: 'Admission',
    title: 'Patient Admission / Registration',
    covers: ['Is patient registration happening in CARE?', 'If yes: through ABHA or manual registration'],
    followUps: [
      {
        id: 'method',
        question: 'How are patients being registered?',
        label: 'Registration method',
        options: ['ABHA', 'Manual', 'Both'],
      },
    ],
  },
  {
    id: 'bed',
    num: '2',
    group: 'Admission',
    title: 'Bed Allocation',
    covers: ['Is a bed allocated to the patient in CARE?'],
  },
  {
    id: 'care_team',
    num: '3',
    group: 'Care Team',
    title: 'Manage Care Team',
    covers: ['Treating doctor added to the care team'],
  },
  {
    id: 'diagnosis',
    num: '4',
    group: 'Clinical',
    title: 'Diagnosis',
    covers: ['Diagnosis added through forms', 'If yes: is severity mentioned?'],
    followUps: [
      { id: 'severity', question: 'Are they mentioning the severity?', label: 'Severity mentioned', options: YES_NO },
    ],
  },
  {
    id: 'readmission',
    num: '5',
    group: 'Admission',
    title: 'Re-admission',
    covers: ['Is re-admission being marked for returning patients?'],
    conditional: true,
  },
  {
    id: 'resp',
    num: '6',
    group: 'Clinical',
    title: 'Respiratory Support',
    covers: ['Respiratory support details recorded'],
    conditional: true,
  },
  {
    id: 'log_update',
    num: '7',
    group: 'Monitoring',
    title: 'Log Update',
    covers: ['At least one log update per patient'],
  },
  {
    id: 'vitals',
    num: '8',
    group: 'Monitoring',
    title: 'Vitals Update',
    covers: ['Vitals updated'],
  },
  {
    id: 'io',
    num: '9',
    group: 'Monitoring',
    title: 'Input and Output Balance',
    covers: ['a. Intake', 'b. Output', 'c. Total balance'],
    followUps: [
      { id: 'intake', question: 'a. Is intake being recorded?', label: 'Intake', options: YES_NO },
      { id: 'output', question: 'b. Is output being recorded?', label: 'Output', options: YES_NO },
      { id: 'balance', question: 'c. Is the total balance being recorded?', label: 'Total balance', options: YES_NO },
    ],
  },
  {
    id: 'discharge',
    num: '10',
    group: 'Discharge',
    title: 'Discharge',
    covers: ['a. Proper discharge reason given', 'b. "Mark as complete" done after discharge'],
    followUps: [
      { id: 'reason', question: 'a. Is a proper discharge reason given?', label: 'Discharge reason', options: YES_NO },
      {
        id: 'complete',
        question: 'b. After discharge, are they doing the "Mark as complete" step?',
        label: 'Mark as complete',
        options: YES_NO,
      },
    ],
  },
]

export interface Reason {
  code: string
  label: string
  hint: string
}

export const REASONS: Reason[] = [
  { code: 'R1', label: 'No time / staff shortage', hint: '"Too many patients, not enough nurses"' },
  { code: 'R2', label: 'Not aware it is required', hint: '"We did not know it is required"' },
  { code: 'R3', label: 'Not trained', hint: '"New staff joined after the training"' },
  { code: 'R4', label: 'Device / internet problem', hint: '"No tablet or network at the bedside"' },
  { code: 'R5', label: 'Form too long', hint: '"Too many fields to fill"' },
  { code: 'R6', label: 'Not applicable to the patient', hint: '"No re-admitted patient in the ICU"' },
  { code: 'R7', label: 'Nobody is assigned', hint: '"Nobody is responsible for this"' },
  { code: 'R8', label: 'Other', hint: 'Write the reason in the remarks' },
]

export const DESIGNATIONS = [
  'Doctor',
  'Nurse in charge',
  'Staff nurse',
  'Medical Superintendent',
  'Data entry operator',
  'Other',
]

/** Chip colours per group. Full class names are written out so Tailwind can see them. */
export const GROUP_STYLE: Record<string, string> = {
  Admission: 'bg-sky-100 text-sky-800',
  'Care Team': 'bg-violet-100 text-violet-800',
  Clinical: 'bg-blue-100 text-blue-800',
  Monitoring: 'bg-teal-100 text-teal-800',
  Discharge: 'bg-emerald-100 text-emerald-800',
}
