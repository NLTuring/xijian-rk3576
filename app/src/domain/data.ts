import type { AppData, Night, SoundEvent } from './types'

const latestOffsets = [18, 28, 43, 71, 106, 173, 221, 266, 339, 386, 463, 491]
const lastWeekCoughs = [16, 12, 15, 10, 14, 11, 12]
const lastWeekWheezes = [2, 1, 1, 1, 1, 1, 2]

function clockTime(offset: number): string {
  const minute = (23 * 60 + offset) % (24 * 60)
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

/** Fixed, explicitly synthetic history keeps demonstrations reproducible. */
export function createDemoNights(): Night[] {
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 8, 3 + index)).toISOString().slice(0, 10)
    const id = `demo-${date}`
    const recent = index >= 23
    const coughCount = recent ? lastWeekCoughs[index - 23] : 12 + ((index * 7) % 14)
    const wheezeCount = recent ? lastWeekWheezes[index - 23] : 1 + (index % 3)
    const validMinutes = recent ? 480 : 450 + ((index * 11) % 40)
    const offsets =
      index === 29
        ? latestOffsets
        : Array.from({ length: coughCount }, (_, event) => {
            const minute = 12 + Math.floor((event * 485) / coughCount)
            return minute >= 420 && minute < 510 - validMinutes + 420 ? minute - 60 : minute
          })
    const events: SoundEvent[] = [
      ...offsets.map((offsetMinutes, event) => ({
        id: `${id}-cough-${event}`,
        nightId: id,
        kind: 'cough' as const,
        offsetMinutes,
        durationSeconds: 6,
        time: clockTime(offsetMinutes),
        favorite: false,
        audioId: 'demo-cough',
      })),
      ...Array.from({ length: wheezeCount }, (_, event) => {
        const offsetMinutes = 151 + event * 171
        return {
          id: `${id}-wheeze-${event}`,
          nightId: id,
          kind: 'wheeze' as const,
          offsetMinutes,
          durationSeconds: 8,
          time: clockTime(offsetMinutes),
          favorite: false,
          audioId: 'demo-wheeze',
        }
      }),
    ].sort((a, b) => a.offsetMinutes - b.offsetMinutes)
    return {
      id,
      date,
      startTime: '23:00',
      endTime: '07:30',
      totalMinutes: 510,
      validMinutes,
      coughCount,
      wheezeCount,
      events,
      gaps: [{ startMinute: 420, endMinute: 420 + 510 - validMinutes, reason: '收音中断' }],
      source: 'demo',
      analysis: 'complete',
    }
  })
}

export function createInitialData(): AppData {
  return {
    version: 1,
    mode: 'demo',
    nights: createDemoNights(),
    notes: {},
    retentionDays: 30,
    deviceUrl: '',
  }
}
