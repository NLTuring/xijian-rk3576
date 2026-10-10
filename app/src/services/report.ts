import type { DailyNote, Night } from '../domain/types'

interface NightReportRow {
  id: string
  date: string
  source: string
  status: string
  period: string
  effective: string
  completeness: string
  cough: string
  rate: string
  wheeze: string
  wheezeTimes: string
  quality: string
}

export interface ReportRows {
  range: string
  label: string
  groups: {
    source: Night['source']
    label: string
    summary: string[]
    nights: NightReportRow[]
  }[]
  notes: {
    date: string
    source: string
    medication: string
    symptom: string
    text: string
    updatedAt: string
  }[]
  favorites: {
    id: string
    date: string
    source: string
    time: string
    kind: string
    duration: string
    audio: string
    feedback: string
  }[]
}

const sourceLabels = { demo: '示例数据', live: '实际采集' } as const
const medicationLabels = {
  'as-planned': '按原计划用药',
  changed: '用药有变化',
  unrecorded: '用药未记录',
} as const
const symptomLabels = { none: '无明显症状', mild: '轻微', obvious: '明显' } as const

function clockAt(startTime: string, offset: number): string {
  const [hour, minute] = startTime.split(':').map(Number)
  const total = (((hour * 60 + minute + Math.floor(offset)) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function result(night: Night, kind: 'cough' | 'wheeze'): string {
  if (night.analysis === 'pending') return '待分析'
  if (night.validMinutes <= 0) return '无有效记录'
  const count = kind === 'cough' ? night.coughCount : night.wheezeCount
  return count === null ? '未提供' : `${count} ${kind === 'cough' ? '次' : '段'}`
}

function reportNight(night: Night): NightReportRow {
  const completeness =
    night.analysis === 'pending'
      ? '待分析'
      : night.totalMinutes > 0
        ? `${((night.validMinutes / night.totalMinutes) * 100).toFixed(1)}%`
        : '未记录'
  const rate =
    night.analysis === 'pending'
      ? '待分析'
      : night.validMinutes <= 0
        ? '无有效记录'
        : night.coughCount === null
          ? '未提供'
          : `${(night.coughCount / (night.validMinutes / 60)).toFixed(2)}`
  const period = `${night.startTime}—${night.endTime}${night.endTime <= night.startTime ? '（跨日）' : ''}`
  const quality =
    night.analysis === 'pending'
      ? '音频已采集，质量尚未分析。'
      : night.gaps.length
        ? night.gaps
            .map(
              (gap) =>
                `${clockAt(night.startTime, gap.startMinute)}—${clockAt(night.startTime, gap.endMinute)} ${gap.reason}`,
            )
            .join('；')
        : night.validMinutes < night.totalMinutes
          ? `非有效时长 ${night.totalMinutes - night.validMinutes} 分钟；缺口原因未提供`
          : '未报告采集缺口'
  const wheezeTimes =
    night.analysis === 'pending'
      ? '待分析'
      : night.validMinutes <= 0
        ? '无有效记录'
        : night.events
            .filter((event) => event.kind === 'wheeze')
            .sort((a, b) => a.offsetMinutes - b.offsetMinutes)
            .map((event) => event.time)
            .join('\n') || (night.wheezeCount === 0 ? '未检出' : '未提供发生时段')
  return {
    id: night.id,
    date: night.date,
    source: sourceLabels[night.source],
    status:
      night.analysis === 'pending' ? '待分析' : night.validMinutes > 0 ? '已分析' : '无有效记录',
    period,
    effective:
      night.analysis === 'pending' ? '待分析' : `${(night.validMinutes / 60).toFixed(2)} 小时`,
    completeness,
    cough: result(night, 'cough'),
    rate,
    wheeze: result(night, 'wheeze'),
    wheezeTimes,
    quality,
  }
}

function summary(nights: Night[]): string[] {
  const analyzed = nights.filter((night) => night.analysis === 'complete')
  const validMinutes = analyzed.reduce((sum, night) => sum + night.validMinutes, 0)
  const totalMinutes = analyzed.reduce((sum, night) => sum + night.totalMinutes, 0)
  const pending = nights.filter((night) => night.analysis === 'pending').length
  const coughNights = nights.filter(
    (night) => night.analysis === 'complete' && night.validMinutes > 0 && night.coughCount !== null,
  )
  const wheezeNights = nights.filter(
    (night) =>
      night.analysis === 'complete' && night.validMinutes > 0 && night.wheezeCount !== null,
  )
  const coughs = coughNights.reduce((sum, night) => sum + night.coughCount!, 0)
  const coughHours = coughNights.reduce((sum, night) => sum + night.validMinutes, 0) / 60
  const wheezes = wheezeNights.reduce((sum, night) => sum + night.wheezeCount!, 0)
  const quality = !analyzed.length
    ? '待分析'
    : totalMinutes > 0
      ? `${((validMinutes / totalMinutes) * 100).toFixed(1)}%`
      : '未记录'
  return [
    `${nights.length} 晚记录 · 有效时长 ${analyzed.length ? `${(validMinutes / 60).toFixed(2)} 小时` : '待分析'} · 完整度 ${quality} · 待分析 ${pending} 晚`,
    coughNights.length
      ? `咳嗽合计 ${coughs} 次，${(coughs / coughHours).toFixed(2)} 次/有效小时（统计覆盖 ${coughNights.length} 晚、${coughHours.toFixed(2)} 有效小时）`
      : '暂无可用咳嗽统计；待分析、缺失结果及无有效记录未计为零。',
    wheezeNights.length
      ? `疑似喘息合计 ${wheezes} 段（统计覆盖 ${wheezeNights.length} 晚；具体时段可在应用中查看）`
      : '暂无可用疑似喘息统计。',
  ]
}

/** Pure report model: the selected nights are the only records allowed into the export. */
export function buildReportRows(nights: Night[], notes: Record<string, DailyNote>): ReportRows {
  if (!nights.length) throw new Error('请选择至少一晚记录')
  const ordered = [...nights].sort((a, b) => a.date.localeCompare(b.date))
  const sources = [...new Set(ordered.map((night) => night.source))]
  return {
    range: `${ordered[0].date} 至 ${ordered[ordered.length - 1].date}`,
    label: sources.length > 1 ? '示例数据与实际采集分别列示' : `${sourceLabels[sources[0]]}报告`,
    groups: sources.map((source) => {
      const selected = ordered.filter((night) => night.source === source)
      return {
        source,
        label: sourceLabels[source],
        summary: summary(selected),
        nights: selected.map(reportNight),
      }
    }),
    notes: ordered.flatMap((night) => {
      const note = notes[night.id]
      if (!note || note.nightId !== night.id) return []
      return [
        {
          date: night.date,
          source: sourceLabels[night.source],
          medication: medicationLabels[note.medication],
          symptom: symptomLabels[note.symptom],
          text: note.text,
          updatedAt: note.updatedAt,
        },
      ]
    }),
    favorites: ordered.flatMap((night) =>
      night.events
        .filter((event) => event.favorite)
        .map((event) => ({
          id: event.id,
          date: night.date,
          source: sourceLabels[night.source],
          time: event.time,
          kind: event.kind === 'cough' ? '疑似咳嗽' : '疑似喘息',
          duration: `${event.durationSeconds} 秒`,
          audio: event.audioDeleted
            ? '声音已删除'
            : night.source === 'demo'
              ? '示例声音'
              : event.offline
                ? '手机可离线回听'
                : '未标记离线可用',
          feedback: event.feedback === 'incorrect' ? '用户反馈识别有误' : '未提交类型反馈',
        })),
    ),
  }
}

const PAGE_WIDTH = 1240
const PAGE_HEIGHT = 1754
const MARGIN = 84
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const BOTTOM = PAGE_HEIGHT - 108
const FONT = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif'
const DISCLAIMER = '仅供记录与复诊沟通，不能作为疾病诊断或用药依据。'

/** Render one A4 page at a time so long histories do not retain every bitmap in memory. */
class ReportCanvas {
  private canvas: HTMLCanvasElement
  private context: CanvasRenderingContext2D
  private page = 0
  private y = 0

  constructor(
    private label: string,
    private range: string,
    private savePage: (canvas: HTMLCanvasElement, page: number) => void,
  ) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = PAGE_WIDTH
    this.canvas.height = PAGE_HEIGHT
    const context = this.canvas.getContext('2d')
    if (!context) throw new Error('当前浏览器无法生成报告，请使用支持 Canvas 的浏览器')
    this.context = context
    this.newPage()
  }

  private font(size = 22, weight = 400) {
    this.context.font = `${weight} ${size}px ${FONT}`
    this.context.textBaseline = 'top'
  }

  private write(text: string, x: number, y: number, size = 22, weight = 400, color = '#151515') {
    this.font(size, weight)
    this.context.fillStyle = color
    this.context.fillText(text, x, y)
  }

  private newPage() {
    if (this.page) this.flush()
    this.page += 1
    this.context.fillStyle = '#ffffff'
    this.context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
    this.write('息间 / 夜间呼吸记录', MARGIN, 52, 24, 600)
    this.write(this.label, MARGIN, 92, 19, 400, '#555555')
    this.write(this.range, PAGE_WIDTH - MARGIN - 310, 56, 18, 400, '#555555')
    this.context.fillStyle = '#d8d8d8'
    this.context.fillRect(MARGIN, 130, CONTENT_WIDTH, 1)
    this.y = 158
  }

  private flush() {
    this.context.fillStyle = '#d8d8d8'
    this.context.fillRect(MARGIN, BOTTOM + 24, CONTENT_WIDTH, 1)
    this.write(DISCLAIMER, MARGIN, BOTTOM + 42, 18, 400, '#626262')
    this.write(`第 ${this.page} 页`, PAGE_WIDTH - MARGIN - 100, BOTTOM + 42, 18, 400, '#626262')
    this.savePage(this.canvas, this.page)
  }

  finish() {
    this.flush()
    // Release the page bitmap after jsPDF has encoded it.
    this.canvas.width = 0
    this.canvas.height = 0
  }

  private ensure(height: number) {
    if (this.y + height > BOTTOM) this.newPage()
  }

  private wrap(text: string, width: number, size = 22): string[] {
    this.font(size)
    return text.split(/\r?\n/).flatMap((paragraph) => {
      const lines: string[] = []
      let current = ''
      for (const character of paragraph) {
        if (current && this.context.measureText(current + character).width > width) {
          lines.push(current)
          current = character
        } else current += character
      }
      lines.push(current)
      return lines
    })
  }

  heading(text: string, size = 30) {
    this.ensure(size + 54)
    this.write(text, MARGIN, this.y, size, 600)
    this.y += size + 24
  }

  paragraph(text: string, size = 22) {
    for (const line of this.wrap(text, CONTENT_WIDTH, size)) {
      this.ensure(size + 12)
      this.write(line, MARGIN, this.y, size)
      this.y += size + 12
    }
    this.y += 12
  }

  table(title: string, headers: string[], weights: number[], rows: string[][]) {
    const widths = weights.map((weight) => weight * CONTENT_WIDTH)
    const lineHeight = 30
    const padding = 14
    const header = (continued: boolean) => {
      this.heading(`${title}${continued ? '（续）' : ''}`)
      this.context.fillStyle = '#eeeeee'
      this.context.fillRect(MARGIN, this.y, CONTENT_WIDTH, 54)
      let x = MARGIN
      headers.forEach((text, index) => {
        this.write(text, x + padding, this.y + 15, 21, 600)
        x += widths[index]
      })
      this.y += 54
    }
    this.ensure(170)
    header(false)
    rows.forEach((row, rowIndex) => {
      const cells = row.map((cell, index) => this.wrap(cell, widths[index] - padding * 2, 21))
      const lineCount = Math.max(...cells.map((cell) => cell.length))
      let offset = 0
      while (offset < lineCount) {
        let available = Math.floor((BOTTOM - this.y - padding * 2) / lineHeight)
        if (available < 1) {
          this.newPage()
          header(true)
          available = Math.floor((BOTTOM - this.y - padding * 2) / lineHeight)
        }
        const count = Math.min(lineCount - offset, available)
        const height = count * lineHeight + padding * 2
        this.context.fillStyle = rowIndex % 2 ? '#f8f8f8' : '#ffffff'
        this.context.fillRect(MARGIN, this.y, CONTENT_WIDTH, height)
        let x = MARGIN
        cells.forEach((lines, index) => {
          const segment = lines.slice(offset, offset + count)
          // Keep a date visible when a very long note continues onto another page.
          if (offset > 0 && index === 0 && !segment.length) segment.push(lines[0])
          segment.forEach((line, lineIndex) =>
            this.write(line, x + padding, this.y + padding + lineIndex * lineHeight, 21),
          )
          x += widths[index]
        })
        this.y += height
        this.context.fillStyle = '#dedede'
        this.context.fillRect(MARGIN, this.y - 1, CONTENT_WIDTH, 1)
        offset += count
      }
    })
    this.y += 28
  }
}

/** Chinese glyphs are rendered using installed fonts, with no remote font request. */
export async function exportReport(
  nights: Night[],
  notes: Record<string, DailyNote>,
): Promise<void> {
  const report = buildReportRows(nights, notes)
  if (document.fonts) await document.fonts.ready
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  pdf.setProperties({
    title: '息间夜间呼吸记录',
    subject: report.label,
    creator: '息间',
    author: '本地记录',
  })
  const writer = new ReportCanvas(report.label, report.range, (canvas, page) => {
    if (page > 1) pdf.addPage()
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297, undefined, 'FAST')
  })
  writer.heading('复诊记录', 44)
  writer.paragraph(`日期范围：${report.range}`)
  writer.paragraph(`生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`, 20)
  writer.paragraph(report.label)
  writer.paragraph(
    '统计按有效采集时长计算。缺失、待分析与无有效记录分别呈现；示例数据不代表个人实测结果。',
    20,
  )

  for (const group of report.groups) {
    writer.heading(`${group.label} · 概览`)
    group.summary.forEach((line) => writer.paragraph(line))
    writer.table(
      `逐夜记录 · ${group.label}`,
      ['监测日期', '分析状态', '有效 / 完整度', '咳嗽', '次/有效小时', '疑似喘息'],
      [0.19, 0.15, 0.21, 0.13, 0.18, 0.14],
      group.nights.map((night) => [
        night.date,
        night.status,
        `${night.effective}\n${night.completeness}`,
        night.cough,
        night.rate,
        night.wheeze === night.wheezeTimes ? night.wheeze : `${night.wheeze}\n${night.wheezeTimes}`,
      ]),
    )
    writer.table(
      `记录质量 · ${group.label}`,
      ['监测日期', '监测时段', '缺失与质量说明'],
      [0.19, 0.26, 0.55],
      group.nights.map((night) => [night.date, night.period, night.quality]),
    )
  }

  if (report.notes.length) {
    writer.table(
      '用药与症状记录',
      ['日期 / 数据', '用药 / 症状', '个人备注'],
      [0.22, 0.25, 0.53],
      report.notes.map((note) => [
        `${note.date}\n${note.source}`,
        `${note.medication}\n症状：${note.symptom}`,
        `${note.text || '未填写备注'}\n记录时间：${note.updatedAt}`,
      ]),
    )
  } else {
    writer.heading('用药与症状记录')
    writer.paragraph('所选夜晚尚未填写用药与症状记录。未填写不代表未用药或没有症状。')
  }

  if (report.favorites.length) {
    writer.table(
      '收藏事件索引',
      ['日期 / 数据', '时间 / 类型', '声音与反馈'],
      [0.22, 0.26, 0.52],
      report.favorites.map((event) => [
        `${event.date}\n${event.source}`,
        `${event.time}\n${event.kind} · ${event.duration}`,
        `${event.audio}\n${event.feedback}\n事件：${event.id}`,
      ]),
    )
    writer.paragraph(
      '音频不嵌入 PDF。请在应用中按日期和事件时间查找片段，离线播放以实际保存状态为准。',
      20,
    )
  } else {
    writer.heading('收藏事件索引')
    writer.paragraph('所选夜晚未收藏声音事件。')
  }
  writer.paragraph('本报告保留导出时的记录状态。事件或个人记录更新后，请重新导出。', 20)
  writer.finish()
  const orderedDates = nights.map((night) => night.date).sort()
  await pdf.save(`息间-复诊记录-${orderedDates[0]}_${orderedDates[orderedDates.length - 1]}.pdf`, {
    returnPromise: true,
  })
}
