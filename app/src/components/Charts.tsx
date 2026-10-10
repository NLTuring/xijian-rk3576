import { useId } from 'react'
import type { Night, SoundEvent } from '../domain/types'
import { coughRate } from '../domain/stats'

export function NightTimeline({
  night,
  onEvent,
}: {
  night: Night
  onEvent: (event: SoundEvent) => void
}) {
  const id = useId().replaceAll(':', '')
  if (!night.events.length)
    return (
      <div className="timeline-pending">
        {night.analysis === 'pending'
          ? '声音已采集，等待接入分析模型。'
          : '有效记录内未检出目标事件。'}
      </div>
    )
  return (
    <div className="night-timeline">
      <div className="timeline-header">
        <span>整夜声音分布</span>
        <span>
          {night.startTime} — 次日 {night.endTime}
        </span>
      </div>
      <svg
        viewBox="0 0 600 154"
        role="img"
        aria-label="整夜事件时间轴，短线代表咳嗽，纹理条代表疑似喘息，斜纹区域为记录缺口"
      >
        <defs>
          <pattern
            id={id}
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(30)"
          >
            <line x1="0" y1="0" x2="0" y2="7" stroke="#b1b1ae" strokeWidth="2" />
          </pattern>
        </defs>
        {[60, 180, 300, 420, 510].map((m) => (
          <line
            key={m}
            x1={72 + (m / night.totalMinutes) * 504}
            x2={72 + (m / night.totalMinutes) * 504}
            y1="12"
            y2="108"
            className="chart-grid"
          />
        ))}
        <text x="0" y="41">
          咳嗽
        </text>
        <text x="0" y="91">
          喘息
        </text>
        <line x1="72" x2="576" y1="36" y2="36" className="chart-baseline" />
        <line x1="72" x2="576" y1="86" y2="86" className="chart-baseline" />
        {night.gaps.map((gap, i) => (
          <rect
            key={i}
            x={72 + (gap.startMinute / night.totalMinutes) * 504}
            y="13"
            width={((gap.endMinute - gap.startMinute) / night.totalMinutes) * 504}
            height="95"
            fill={`url(#${id})`}
          />
        ))}
        {night.events.map((event) => (
          <g key={event.id} className="timeline-mark" onClick={() => onEvent(event)}>
            <title>
              {event.time} {event.kind === 'cough' ? '疑似咳嗽' : '疑似喘息'}
              ，请使用下方声音列表回听
            </title>
            <rect
              x={72 + (event.offsetMinutes / night.totalMinutes) * 504 - 10}
              y={event.kind === 'cough' ? 14 : 64}
              width="22"
              height="42"
              fill="transparent"
            />
            <rect
              x={72 + (event.offsetMinutes / night.totalMinutes) * 504}
              y={event.kind === 'cough' ? 27 : 81}
              width={event.kind === 'cough' ? 3 : 10}
              height={event.kind === 'cough' ? 18 : 10}
              rx="1.5"
              fill={event.kind === 'cough' ? '#252525' : '#7b7b78'}
            />
          </g>
        ))}
        <text x="72" y="140">
          {night.startTime}
        </text>
        <text x="310" y="140" textAnchor="middle">
          03:00
        </text>
        <text x="576" y="140" textAnchor="end">
          {night.endTime}
        </text>
      </svg>
      <div className="chart-legend">
        <span>
          <i className="legend-cough" />
          咳嗽事件
        </span>
        <span>
          <i className="legend-wheeze" />
          疑似喘息
        </span>
        <span>
          <i className="legend-gap" />
          记录缺口
        </span>
      </div>
    </div>
  )
}

export function TrendChart({
  nights,
  onNight,
}: {
  nights: Night[]
  onNight?: (night: Night) => void
}) {
  const values = nights.map(coughRate)
  const max = Math.max(3, ...values.filter((v): v is number => v !== null))
  const width = 620,
    height = 205,
    left = 34,
    right = 600,
    top = 22,
    bottom = 160
  const x = (i: number) =>
    nights.length === 1
      ? (left + right) / 2
      : left + (i / Math.max(1, nights.length - 1)) * (right - left)
  const y = (v: number) => bottom - (v / max) * (bottom - top)
  return (
    <div className="trend-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="每有效小时咳嗽频次趋势。可在下方日期列表打开记录。"
      >
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1={left}
              x2={right}
              y1={y((i * max) / 3)}
              y2={y((i * max) / 3)}
              className="chart-grid"
            />
            <text x="5" y={y((i * max) / 3) + 4}>
              {((i * max) / 3).toFixed(0)}
            </text>
          </g>
        ))}
        {values.map(
          (v, i) =>
            v !== null && (
              <g key={nights[i].id} onClick={() => onNight?.(nights[i])}>
                {i > 0 &&
                  values[i - 1] !== null &&
                  Date.parse(nights[i].date) - Date.parse(nights[i - 1].date) <= 86400000 && (
                    <line
                      x1={x(i - 1)}
                      y1={y(values[i - 1]!)}
                      x2={x(i)}
                      y2={y(v)}
                      stroke="#242424"
                      strokeWidth="2"
                    />
                  )}
                <circle cx={x(i)} cy={y(v)} r={nights.length < 15 ? 4 : 2.5} fill="#242424" />
                {nights.length <= 7 && (
                  <text x={x(i)} y={y(v) - 14} textAnchor="middle">
                    {v.toFixed(1)}
                  </text>
                )}
              </g>
            ),
        )}
        {nights.map(
          (n, i) =>
            (nights.length <= 7 || i % 5 === 0 || i === nights.length - 1) && (
              <text key={n.id} x={x(i)} y="194" textAnchor="middle">
                {n.date.slice(5).replace('-', '.')}
              </text>
            ),
        )}
      </svg>
    </div>
  )
}
