export interface Part {
  id: string
  num: string
  group: string
  title: string
  /** Fields inside this part of the CARE form, shown so the caller can describe it on the phone. */
  covers: string[]
  /** Only some patients need this part (ABG, insulin, dialysis). */
  conditional?: boolean
}

export const PARTS: Part[] = [
  {
    id: 'io',
    num: '1',
    group: 'Input / Output',
    title: 'Input and Output Balance',
    covers: ['Intake: type, value, unit', 'Output: type, value, unit'],
  },
  {
    id: 'symptoms',
    num: '2a',
    group: 'Examination',
    title: 'Symptoms',
    covers: ['Symptom', 'Onset date', 'Status', 'Severity', 'Verification'],
  },
  {
    id: 'diagnosis',
    num: '2b',
    group: 'Examination',
    title: 'Diagnosis',
    covers: ['Diagnosis', 'Onset date', 'Status', 'Severity', 'Verification'],
  },
  {
    id: 'physical',
    num: '2c',
    group: 'Examination',
    title: 'Physical Examination Info',
    covers: ['Physical examination notes'],
  },
  {
    id: 'position',
    num: '2d',
    group: 'Examination',
    title: "Patient's Body Position",
    covers: ['Body position'],
  },
  {
    id: 'loc',
    num: '3a',
    group: 'Neurological',
    title: 'Level of Consciousness',
    covers: ['Level of consciousness'],
  },
  {
    id: 'pupil',
    num: '3b',
    group: 'Neurological',
    title: 'Pupil Size',
    covers: ['Left pupil size', 'Right pupil size'],
  },
  {
    id: 'plr',
    num: '3c',
    group: 'Neurological',
    title: 'Pupillary Reaction to Light',
    covers: ['Pupillary reaction to light'],
  },
  {
    id: 'gcs',
    num: '3d',
    group: 'Neurological',
    title: 'Glasgow Coma Scale',
    covers: ['Eye opening', 'Verbal response', 'Motor response', 'Total GCS'],
  },
  {
    id: 'dtr',
    num: '3e',
    group: 'Neurological',
    title: 'Deep Tendon Reflexes',
    covers: ['Biceps', 'Triceps', 'Patellar', 'Achilles', 'Plantar'],
  },
  {
    id: 'resp',
    num: '4',
    group: 'Respiratory',
    title: 'Respiratory Support',
    covers: [
      'Breath sounds',
      'If decreased breath sounds',
      'EtCO2 (mmHg)',
      'Respiratory support',
      'Other details',
    ],
  },
  {
    id: 'abg',
    num: '5',
    group: 'Blood Gas',
    title: 'Arterial Blood Gas Analysis',
    covers: ['Upload ABG report'],
    conditional: true,
  },
  {
    id: 'sugar',
    num: '6',
    group: 'Blood Sugar',
    title: 'Blood Sugar and Insulin Intake',
    covers: ['Blood sugar level (mg/dL)', 'Insulin intake: type, value, unit'],
    conditional: true,
  },
  {
    id: 'dialysis',
    num: '7',
    group: 'Dialysis',
    title: 'Dialysis',
    covers: ['Fluid balance', 'Net balance'],
    conditional: true,
  },
  {
    id: 'sore',
    num: '8',
    group: 'Skin and Nursing',
    title: 'Pressure Sore',
    covers: ['Pressure sore: Yes / No'],
  },
  {
    id: 'nursing',
    num: '9',
    group: 'Skin and Nursing',
    title: 'Nursing Care Given',
    covers: ['Nursing care given'],
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
  { code: 'R6', label: 'Not applicable to the patient', hint: '"No dialysis patient in the ICU"' },
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
  'Input / Output': 'bg-sky-100 text-sky-800',
  Examination: 'bg-blue-100 text-blue-800',
  Neurological: 'bg-violet-100 text-violet-800',
  Respiratory: 'bg-teal-100 text-teal-800',
  'Blood Gas': 'bg-rose-100 text-rose-800',
  'Blood Sugar': 'bg-amber-100 text-amber-800',
  Dialysis: 'bg-cyan-100 text-cyan-800',
  'Skin and Nursing': 'bg-emerald-100 text-emerald-800',
}
