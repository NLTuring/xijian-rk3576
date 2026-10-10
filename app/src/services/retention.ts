import type { AppData } from '../domain/types'
import { deleteAudio } from './storage'

/** Delete expired ordinary audio on opening the app; summaries and favorites stay. */
export async function enforceRetention(data: AppData, now = new Date()): Promise<AppData> {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  cutoff.setDate(cutoff.getDate() - data.retentionDays)
  let changed = false
  const nights = []
  for (const night of data.nights) {
    if (night.source === 'demo' || new Date(`${night.date}T00:00:00`) >= cutoff) {
      nights.push(night)
      continue
    }
    let next = night
    if (night.captureAudioId && !night.captureDeleted) {
      await deleteAudio(night.captureAudioId)
      next = { ...next, captureDeleted: true }
      changed = true
    }
    const events = []
    for (const event of night.events) {
      if (event.favorite || event.audioDeleted) {
        events.push(event)
        continue
      }
      await deleteAudio(event.audioId)
      events.push({ ...event, audioDeleted: true, offline: false })
      changed = true
    }
    nights.push(events.some((event, i) => event !== night.events[i]) ? { ...next, events } : next)
  }
  return changed ? { ...data, nights } : data
}
