export type Mode = 'demo' | 'live'
export type EventKind = 'cough' | 'wheeze'
export interface SoundEvent {
  id: string
  nightId: string
  kind: EventKind
  offsetMinutes: number
  durationSeconds: number
  time: string
  favorite: boolean
  audioId: string
  feedback?: 'incorrect'
  audioDeleted?: boolean
  offline?: boolean
}
export interface Night {
  id: string
  date: string
  startTime: string
  endTime: string
  totalMinutes: number
  validMinutes: number
  coughCount: number | null
  wheezeCount: number | null
  events: SoundEvent[]
  gaps: { startMinute: number; endMinute: number; reason: string }[]
  source: Mode
  analysis: 'complete' | 'pending'
  captureAudioId?: string
  captureDeleted?: boolean
}
export interface DailyNote {
  nightId: string
  medication: 'as-planned' | 'changed' | 'unrecorded'
  symptom: 'none' | 'mild' | 'obvious'
  text: string
  updatedAt: string
}
export interface AppData {
  version: 1
  mode: Mode
  nights: Night[]
  notes: Record<string, DailyNote>
  retentionDays: number
  deviceUrl: string
}
export interface ReportSummary {
  nights: number
  validHours: number
  completeness: number | null
  coughRate: number | null
  coughCount: number
  wheezeCount: number
  analyzedNights: number
}
