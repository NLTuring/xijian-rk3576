import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { DailyNote, Night } from '../domain/types'
import { coughRate, formatDate, formatHours, selectNights, summarize } from '../domain/stats'
import { TrendChart } from '../components/Charts'
import { EmptyState, SectionTitle } from '../components/ui'

export function Trends({
  nights,
  notes,
  onNight,
}: {
  nights: Night[]
  notes: Record<string, DailyNote>
  onNight: (n: Night) => void
}) {
  const [days, setDays] = useState(7)
  const selected = selectNights(nights, days)
  const summary = summarize(selected)
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">A LONGER VIEW</span>
        <h1>
          把每一晚，
          <br />
          连成对自己的了解。
        </h1>
        <p>观察自己的变化，让复诊时的描述更清楚。</p>
      </div>
      <div className="range-toolbar">
        <div className="segmented" aria-label="趋势时间范围">
          {[7, 14, 30].map((value) => (
            <button
              key={value}
              aria-pressed={days === value}
              className={days === value ? 'selected' : ''}
              onClick={() => setDays(value)}
            >
              {value}天
            </button>
          ))}
        </div>
        <span>{selected.length}个夜晚</span>
      </div>
      {!selected.length ? (
        <EmptyState title="趋势会从第一晚开始" text="有了可用的记录，这里会按日期展示变化。" />
      ) : (
        <>
          <section className="surface trend-surface">
            <div className="section-heading">
              <div>
                <span className="eyebrow">COUGH FREQUENCY</span>
                <h2>咳嗽频次</h2>
              </div>
              <div className="chart-summary">
                <strong>{summary.coughRate?.toFixed(1) ?? '—'}</strong>
                <span>平均 次 / 有效小时</span>
              </div>
            </div>
            <TrendChart nights={selected} onNight={onNight} />
            <p className="chart-footnote">仅使用已分析的有效时长计算 · 缺失记录保留断点</p>
          </section>
          <div className="trend-mini-grid">
            <section className="surface mini-stat">
              <span>疑似喘息</span>
              <strong>
                {summary.analyzedNights ? summary.wheezeCount : '—'}
                <small>段</small>
              </strong>
              <p>
                点击下方夜晚，查看发生时段 <ArrowUpRight size={13} />
              </p>
            </section>
            <section className="surface mini-stat">
              <span>有效记录</span>
              <strong>
                {summary.analyzedNights ? summary.validHours.toFixed(1) : '—'}
                <small>小时</small>
              </strong>
              <p>{summary.analyzedNights}个夜晚已完成分析</p>
            </section>
          </div>
          <SectionTitle title="按夜查看" label="NIGHT BY NIGHT" />
          <div className="night-history">
            {[...selected].reverse().map((night) => (
              <button
                key={night.id}
                className="history-row"
                onClick={() => onNight(night)}
                aria-label={`查看${formatDate(night.date)}记录`}
              >
                <span className="history-date">
                  {night.date.slice(5).replace('-', '.')}
                  <small>
                    {night.analysis === 'pending'
                      ? '有效时长待分析'
                      : `${formatHours(night.validMinutes)}有效`}
                  </small>
                </span>
                <span>
                  <strong>{coughRate(night)?.toFixed(1) ?? '待分析'}</strong>
                  <small>次 / 有效小时</small>
                </span>
                <span className="history-note">
                  {notes[night.id] ? '已记录感受' : '未记录感受'}
                  <small>疑似喘息 {night.wheezeCount ?? '—'} 段</small>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
