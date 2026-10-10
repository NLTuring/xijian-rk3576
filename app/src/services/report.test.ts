import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailyNote, Night, SoundEvent } from '../domain/types'
import { buildReportRows, exportReport } from './report'

const pdf = vi.hoisted(() => ({
  addPage: vi.fn(),
  addImage: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  setProperties: vi.fn(),
}))
vi.mock('jspdf', () => ({
  jsPDF: vi.fn(function () {
    return pdf
  }),
}))

function night(overrides: Partial<Night> = {}): Night {
  return {
    id: 'n1',
    date: '2026-10-03',
    startTime: '23:00',
    endTime: '07:30',
    totalMinutes: 510,
    validMinutes: 480,
    coughCount: 12,
    wheezeCount: 2,
    events: [],
    gaps: [{ startMinute: 420, endMinute: 450, reason: '采集中断' }],
    source: 'live',
    analysis: 'complete',
    ...overrides,
  }
}

function event(overrides: Partial<SoundEvent> = {}): SoundEvent {
  return {
    id: 'e1',
    nightId: 'n1',
    kind: 'cough',
    offsetMinutes: 130,
    durationSeconds: 6,
    time: '01:10',
    favorite: true,
    audioId: 'audio-1',
    ...overrides,
  }
}

function note(overrides: Partial<DailyNote> = {}): DailyNote {
  return {
    nightId: 'n1',
    medication: 'changed',
    symptom: 'mild',
    text: '按医生原方案记录\n夜间醒来一次',
    updatedAt: '2026-10-04T07:45:00Z',
    ...overrides,
  }
}

describe('buildReportRows', () => {
  it('keeps demonstration and real recordings in separate summaries', () => {
    const report = buildReportRows(
      [night({ id: 'demo', source: 'demo', coughCount: 120 }), night()],
      {},
    )
    expect(report.groups).toHaveLength(2)
    expect(report.groups.find((group) => group.source === 'demo')?.summary.join(' ')).toContain(
      '120 次',
    )
    expect(report.groups.find((group) => group.source === 'live')?.summary.join(' ')).toContain(
      '12 次',
    )
    expect(report.label).toContain('分别')
  })

  it('does not turn pending or absent results into zero events', () => {
    const report = buildReportRows(
      [
        night({ id: 'pending', analysis: 'pending', coughCount: 200, wheezeCount: 20 }),
        night({ id: 'absent', coughCount: null, wheezeCount: null }),
      ],
      {},
    )
    const rows = report.groups[0].nights
    expect(rows.find((row) => row.id === 'pending')?.cough).toBe('待分析')
    expect(rows.find((row) => row.id === 'pending')?.wheeze).toBe('待分析')
    expect(rows.find((row) => row.id === 'absent')?.cough).toBe('未提供')
    expect(report.groups[0].summary.join(' ')).toContain('暂无可用咳嗽统计')
    expect(report.groups[0].summary.join(' ')).not.toContain('200')
  })

  it('keeps unknown capture quality pending and prints each event time intact', () => {
    const pending = buildReportRows(
      [
        night({
          analysis: 'pending',
          validMinutes: 0,
          gaps: [],
          coughCount: null,
          wheezeCount: null,
        }),
      ],
      {},
    )
    expect(pending.groups[0].nights[0].effective).toBe('待分析')
    expect(pending.groups[0].nights[0].completeness).toBe('待分析')
    expect(pending.groups[0].nights[0].quality).toContain('尚未分析')
    expect(pending.groups[0].summary[0]).toContain('有效时长 待分析')
    const report = buildReportRows(
      [
        night({
          events: [
            event({ kind: 'wheeze', time: '01:31' }),
            event({
              kind: 'wheeze',
              id: 'e2',
              time: '04:22',
              offsetMinutes: 322,
              feedback: 'incorrect',
            }),
          ],
        }),
      ],
      {},
    )
    expect(report.groups[0].nights[0].wheezeTimes).toBe('01:31\n04:22')
  })

  it('uses only analyzed effective hours for the cough rate', () => {
    const report = buildReportRows(
      [night(), night({ id: 'pending', validMinutes: 480, analysis: 'pending', coughCount: null })],
      {},
    )
    expect(report.groups[0].summary.join(' ')).toContain('1.50 次/有效小时')
    expect(report.groups[0].nights[0].quality).toContain('06:00—06:30')
    expect(report.groups[0].nights[0].quality).toContain('采集中断')
    expect(report.groups[0].nights[0].completeness).toBe('94.1%')
  })

  it('distinguishes zero detections from no effective recording', () => {
    const report = buildReportRows(
      [
        night({ id: 'zero', coughCount: 0, wheezeCount: 0 }),
        night({ id: 'invalid', validMinutes: 0, coughCount: 0, wheezeCount: 0 }),
        night({ id: 'empty', totalMinutes: 0, validMinutes: 0, gaps: [] }),
      ],
      {},
    )
    const rows = report.groups[0].nights
    expect(rows.find((row) => row.id === 'zero')?.cough).toBe('0 次')
    expect(rows.find((row) => row.id === 'invalid')?.cough).toBe('无有效记录')
    expect(rows.find((row) => row.id === 'empty')?.completeness).toBe('未记录')
  })

  it('includes notes only for selected nights and keeps their literal content', () => {
    const report = buildReportRows([night()], {
      n1: note(),
      hidden: note({ nightId: 'hidden', text: '不在所选范围' }),
    })
    expect(report.notes).toHaveLength(1)
    expect(report.notes[0]).toMatchObject({
      medication: '用药有变化',
      symptom: '轻微',
      text: note().text,
    })
    expect(JSON.stringify(report)).not.toContain('不在所选范围')
  })

  it('keeps favorite event status honest when audio is deleted or a type was corrected', () => {
    const report = buildReportRows(
      [
        night({
          events: [
            event({ audioDeleted: true, feedback: 'incorrect' }),
            event({ id: 'e2', kind: 'wheeze', offline: true }),
            event({ id: 'e3', favorite: false }),
          ],
        }),
      ],
      {},
    )
    expect(report.favorites).toHaveLength(2)
    expect(report.favorites[0]).toMatchObject({ audio: '声音已删除', feedback: '用户反馈识别有误' })
    expect(report.favorites[1]).toMatchObject({ kind: '疑似喘息', audio: '手机可离线回听' })
  })

  it('exports detected wheeze times without requiring those events to be favorites', () => {
    const report = buildReportRows(
      [night({ events: [event({ kind: 'wheeze', favorite: false, time: '02:18' })] })],
      {},
    )
    expect(report.groups[0].nights[0].wheezeTimes).toContain('02:18')
    expect(report.favorites).toHaveLength(0)
    const pending = buildReportRows(
      [night({ analysis: 'pending', events: [event({ kind: 'wheeze' })] })],
      {},
    )
    expect(pending.groups[0].nights[0].wheezeTimes).toBe('待分析')
  })

  it('sorts the report date range without mutating its input', () => {
    const nights = [night({ id: 'new' }), night({ id: 'old', date: '2026-10-01' })]
    const report = buildReportRows(nights, {})
    expect(report.range).toBe('2026-10-01 至 2026-10-03')
    expect(report.groups[0].nights.map((row) => row.id)).toEqual(['old', 'new'])
    expect(nights[0].id).toBe('new')
  })

  it('rejects an empty selection before building a misleading report', () => {
    expect(() => buildReportRows([], {})).toThrow('请选择至少一晚记录')
  })
})

describe('exportReport', () => {
  let printed: string[]

  beforeEach(() => {
    vi.clearAllMocks()
    printed = []
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () =>
        ({
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          font: '',
          textBaseline: '',
          fillRect: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          stroke: vi.fn(),
          fillText: vi.fn((text: string) => printed.push(text)),
          measureText: (text: string) => ({ width: Array.from(text).length * 12 }),
        }) as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA')
  })

  afterEach(() => vi.restoreAllMocks())

  it('downloads a Chinese PDF with its data label, quality, notes, and event index', async () => {
    await exportReport([night({ source: 'demo', events: [event()] })], { n1: note() })
    expect(pdf.save).toHaveBeenCalledWith(expect.stringMatching(/息间.*2026-10-03.*\.pdf$/), {
      returnPromise: true,
    })
    expect(pdf.addImage).toHaveBeenCalled()
    const text = printed.join('')
    expect(text).toContain('示例数据')
    expect(text).toContain('采集中断')
    expect(text).toContain('夜间醒来一次')
    expect(text).toContain('收藏事件索引')
    expect(text).toContain('不能作为疾病诊断或用药依据')
  })

  it('paginates long tables and preserves a note longer than a page', async () => {
    const nights = Array.from({ length: 35 }, (_, index) =>
      night({
        id: `n${index}`,
        date: `2026-09-${String((index % 28) + 1).padStart(2, '0')}`,
      }),
    )
    await exportReport(nights, { n1: note({ text: `${'夜间症状记录'.repeat(1500)}备注结束标记` }) })
    expect(pdf.addPage.mock.calls.length).toBeGreaterThan(3)
    expect(pdf.addImage.mock.calls.length).toBe(pdf.addPage.mock.calls.length + 1)
    expect(printed.join('')).toContain('备注结束标记')
    expect(printed.filter((text) => text.includes('逐夜记录')).length).toBeGreaterThan(1)
  })

  it('reports unavailable canvas rendering without creating an empty PDF', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
    await expect(exportReport([night()], {})).rejects.toThrow('无法生成报告')
    expect(pdf.save).not.toHaveBeenCalled()
  })

  it('propagates download failures so the application can show a real error', async () => {
    pdf.save.mockRejectedValueOnce(new Error('保存失败'))
    await expect(exportReport([night()], {})).rejects.toThrow('保存失败')
  })
})
