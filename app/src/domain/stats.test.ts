import { describe, expect, it } from 'vitest'
import { createDemoNights, createInitialData } from './data'
import {
  coughRate,
  summarize,
  selectNights,
  formatHours,
  formatDate,
  formatDuration,
} from './stats'

describe('night statistics', () => {
  it('uses valid capture hours and keeps missing data distinct from zero', () => {
    const night = createDemoNights().at(-1)!
    expect(coughRate(night)).toBe(1.5)
    expect(coughRate({ ...night, validMinutes: 0 })).toBeNull()
    expect(coughRate({ ...night, analysis: 'pending', coughCount: null })).toBeNull()
    expect(coughRate({ ...night, coughCount: 0 })).toBe(0)
  })
  it('builds the approved seven-night report with weighted rates', () => {
    const nights = selectNights(createDemoNights(), 7)
    const summary = summarize(nights)
    expect(summary.nights).toBe(7)
    expect(summary.validHours).toBe(56)
    expect(summary.coughCount).toBe(90)
    expect(summary.coughRate).toBeCloseTo(90 / 56)
    expect(summary.wheezeCount).toBe(9)
    expect(summary.completeness).toBeCloseTo((480 / 510) * 100)
  })
  it('does not dilute rates with unanalyzed recordings', () => {
    const n = createDemoNights().at(-1)!
    expect(
      summarize([n, { ...n, analysis: 'pending', coughCount: null, wheezeCount: null }]).coughRate,
    ).toBe(1.5)
    expect(summarize([]).coughRate).toBeNull()
    expect(summarize([]).completeness).toBeNull()
  })
  it('weights unequal captures and reports unavailable analysis separately', () => {
    const n = createDemoNights().at(-1)!
    const summary = summarize([n, { ...n, validMinutes: 60, coughCount: 6, wheezeCount: null }])
    expect(summary.coughRate).toBe(2)
    expect(summary.analyzedNights).toBe(2)
    expect(summary.wheezeCount).toBe(2)
    expect(coughRate({ ...n, coughCount: null })).toBeNull()
    expect(summarize([{ ...n, validMinutes: 0, coughCount: 20 }]).coughCount).toBe(0)
  })
  it('filters by calendar days without mutating or pretending missing nights exist', () => {
    const nights = createDemoNights()
    const chosen = selectNights([nights[29], nights[0]], 7)
    expect(chosen).toHaveLength(1)
    expect(nights[0].date).toBe('2026-09-03')
    expect(selectNights([], 14)).toEqual([])
    expect(selectNights(nights, 30)).toHaveLength(30)
    expect(selectNights(nights, 0)).toEqual([])
    expect(selectNights(nights, Number.NaN)).toEqual([])
  })
  it('produces demo-only events with consistent time bounds', () => {
    const state = createInitialData()
    expect(state.mode).toBe('demo')
    expect(state.nights.every((n) => n.source === 'demo')).toBe(true)
    expect(state.nights.at(-1)!.events.filter((e) => e.kind === 'cough')).toHaveLength(12)
    expect(state.nights.at(-1)!.events.find((e) => e.offsetMinutes === 266)?.time).toBe('03:26')
    expect(new Set(state.nights.flatMap((n) => n.events.map((e) => e.id))).size).toBe(
      state.nights.flatMap((n) => n.events).length,
    )
    for (const night of state.nights) {
      expect(night.events.filter((e) => e.kind === 'cough')).toHaveLength(night.coughCount!)
      expect(night.events.filter((e) => e.kind === 'wheeze')).toHaveLength(night.wheezeCount!)
      expect(
        night.events.every((e) => e.offsetMinutes >= 0 && e.offsetMinutes < night.totalMinutes),
      ).toBe(true)
      expect(
        night.events.every(
          (e) =>
            !night.gaps.some(
              (g) => e.offsetMinutes >= g.startMinute && e.offsetMinutes < g.endMinute,
            ),
        ),
      ).toBe(true)
    }
  })
  it('formats durations including zero and long captures', () => {
    expect(formatHours(480)).toBe('8小时')
    expect(formatHours(495)).toBe('8小时15分')
    expect(formatHours(15)).toBe('15分钟')
    expect(formatHours(0)).toBe('0分钟')
    expect(formatDate('2026-10-02')).toBe('10月2日')
    expect(formatDuration(3661)).toBe('01:01:01')
    expect(formatDuration(-1)).toBe('00:00:00')
    expect(formatDuration(Number.NaN)).toBe('00:00:00')
    expect(formatHours(Number.NaN)).toBe('0分钟')
  })
})
