import type { Night, ReportSummary } from './types'

export function coughRate(night: Night): number | null {
  if (night.analysis !== 'complete' || night.coughCount === null || night.validMinutes <= 0)
    return null
  return night.coughCount / (night.validMinutes / 60)
}

export function summarize(nights: Night[]): ReportSummary {
  const analyzed = nights.filter((n) => coughRate(n) !== null)
  const validMinutes = nights.reduce((sum, n) => sum + n.validMinutes, 0)
  const totalMinutes = nights.reduce((sum, n) => sum + n.totalMinutes, 0)
  const analyzedMinutes = analyzed.reduce((sum, n) => sum + n.validMinutes, 0)
  const coughCount = analyzed.reduce((sum, n) => sum + n.coughCount!, 0)
  return {
    nights: nights.length,
    validHours: validMinutes / 60,
    completeness: totalMinutes > 0 ? (validMinutes / totalMinutes) * 100 : null,
    coughRate: analyzedMinutes > 0 ? coughCount / (analyzedMinutes / 60) : null,
    coughCount,
    wheezeCount: nights
      .filter((n) => n.analysis === 'complete' && n.validMinutes > 0)
      .reduce((sum, n) => sum + (n.wheezeCount ?? 0), 0),
    analyzedNights: analyzed.length,
  }
}

export function selectNights(nights: Night[], days: number): Night[] {
  if (!nights.length || !Number.isFinite(days) || days < 1) return []
  const sorted = [...nights].sort((a, b) => a.date.localeCompare(b.date))
  const newest = Date.parse(`${sorted.at(-1)!.date}T00:00:00Z`)
  const oldest = newest - (Math.floor(days) - 1) * 86_400_000
  return sorted.filter((n) => Date.parse(`${n.date}T00:00:00Z`) >= oldest)
}

export function formatHours(minutes: number): string {
  const total = Math.max(0, Math.round(Number.isFinite(minutes) ? minutes : 0))
  const hours = Math.floor(total / 60)
  const remainder = total % 60
  if (!hours) return `${remainder}分钟`
  return `${hours}小时${remainder ? `${remainder}分` : ''}`
}

export function formatDate(date: string): string {
  const [, month, day] = date.split('-')
  return `${Number(month)}月${Number(day)}日`
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')
}
