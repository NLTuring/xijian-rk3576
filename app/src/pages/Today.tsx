import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Moon,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  Star,
} from 'lucide-react'
import { useState } from 'react'
import type { DailyNote, Night, SoundEvent } from '../domain/types'
import { coughRate, formatDate, formatHours } from '../domain/stats'
import { NightTimeline } from '../components/Charts'
import { EmptyState, GlassButton, SectionTitle, TextLink } from '../components/ui'

export function Today({
  night,
  note,
  onPrepare,
  onEvent,
  onNote,
  onTrends,
  onRaw,
}: {
  night?: Night
  note?: DailyNote
  onPrepare: () => void
  onEvent: (event: SoundEvent) => void
  onNote: () => void
  onTrends: () => void
  onRaw: () => void
}) {
  const [filter, setFilter] = useState<'all' | 'cough' | 'wheeze' | 'favorite'>('all')
  const [expanded, setExpanded] = useState(false)
  if (!night)
    return (
      <>
        <div className="page-heading">
          <span className="eyebrow">YOUR QUIET COMPANION</span>
          <h1>
            从今晚，
            <br />
            多了解自己一点。
          </h1>
          <p>把手机放在床头，开始你的第一份声音记录。</p>
        </div>
        <EmptyState
          title="还没有夜间记录"
          text="已切换为真实采集。先试一段前台录音，检查手机收音。"
        >
          <GlassButton dark onClick={onPrepare}>
            <Moon size={18} />
            准备今晚监测
          </GlassButton>
        </EmptyState>
      </>
    )
  const rate = coughRate(night)
  const featured = night.events.find((e) => e.offsetMinutes === 266) ?? night.events[0]
  const events = night.events.filter(
    (e) => filter === 'all' || (filter === 'favorite' ? e.favorite : e.kind === filter),
  )
  const isDemo = night.source === 'demo'
  return (
    <>
      <div className="page-heading morning-heading">
        <div>
          <span className="eyebrow">A LITTLE CLOSER TO YOURSELF</span>
          <p className="greeting">{formatDate(night.date)}晚 · 早安，慢慢开始今天。</p>
          <h1>
            {rate === null ? (
              <>
                这次的声音，
                <br />
                已好好留存。
              </>
            ) : (
              <>
                昨夜咳嗽频次
                <br />
                {night.coughCount! > 18 ? '比近期略多。' : '接近平常。'}
              </>
            )}
          </h1>
          <p>
            {isDemo
              ? '与你近 14 个有效夜晚相比 · 示例结论'
              : '音频保存在本机，接入分析模型后生成结果。'}
          </p>
        </div>
        <div className="date-signature">
          <span>{night.date.slice(0, 4)} / NIGHT RECORD</span>
          <strong>{night.date.slice(5).replace('-', '.')}</strong>
          <p>{formatDate(night.date)}晚的记录</p>
        </div>
      </div>
      <div className="home-grid">
        <section className="summary-card surface" aria-label="夜间监测摘要">
          <div className="card-kicker">
            <span>
              <i className="status-dot" />
              {isDemo ? '昨夜记录' : '采集记录'}
            </span>
            <span>{isDemo ? '示例数据' : '等待分析'}</span>
          </div>
          <div className="metrics">
            <div>
              <span className="metric-label">咳嗽事件</span>
              <div className="metric-value">
                {night.coughCount ?? '—'}
                <small>次</small>
              </div>
              <p>
                {rate === null ? (
                  '分析完成后生成频次'
                ) : (
                  <>
                    <b>{rate.toFixed(1)}</b> 次 / 有效小时
                  </>
                )}
              </p>
            </div>
            <div>
              <span className="metric-label">疑似喘息</span>
              <div className="metric-value">
                {night.wheezeCount ?? '—'}
                <small>段</small>
              </div>
              <button
                className="metric-link"
                disabled={!night.events.length}
                onClick={() => {
                  setFilter('wheeze')
                  document
                    .getElementById('sound-events')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                查看发生时段 <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
          <NightTimeline night={night} onEvent={onEvent} />
          <div className="quality-line">
            <span>
              <Clock3 size={14} />
              {night.analysis === 'pending'
                ? `采集窗口 ${night.totalMinutes < 1 ? '不足1分钟' : formatHours(night.totalMinutes)}`
                : `有效监测 ${formatHours(night.validMinutes)}`}
            </span>
            <span>
              {night.analysis === 'pending'
                ? '有效时长待分析'
                : `完整度 ${Math.round((night.validMinutes / night.totalMinutes) * 100)}%`}
            </span>
          </div>
          {night.gaps.length > 0 && (
            <p className="gap-note">
              斜纹区域有 {Math.round(night.totalMinutes - night.validMinutes)}{' '}
              分钟未有效记录，已从统计时长中排除。
            </p>
          )}
        </section>
        <aside className="home-aside">
          <section className="night-invitation">
            <div className="card-kicker">
              <span>给今晚，留一点准备</span>
              <Moon size={19} />
            </div>
            <h2>
              放下手机，
              <br />
              安心休息。
            </h2>
            <p>
              一段安静的记录，
              <br />
              留给明早慢慢了解。
            </p>
            <div className="night-lines" aria-hidden="true">
              {Array.from({ length: 26 }, (_, i) => (
                <i key={i} style={{ height: `${12 + Math.sin(i / 4) ** 2 * 39}px` }} />
              ))}
            </div>
            <GlassButton onClick={onPrepare} className="full-width">
              准备今晚监测
              <ArrowRight size={18} />
            </GlassButton>
          </section>
          <button className="note-entry surface" onClick={onNote}>
            <div className="note-symbol">
              {note ? <Check size={20} /> : <SlidersHorizontal size={20} />}
            </div>
            <div>
              <strong>{note ? '已记录用药与感受' : '补记用药与感受'}</strong>
              <span>{note ? '随时回来补充一点细节' : '约30秒，记下昨晚的状态'}</span>
            </div>
            <span className="small-glass">
              <ArrowUpRight size={20} />
            </span>
          </button>
          <div className="privacy-caption">
            <ShieldCheck size={15} />
            <span>你的声音与记录，留在本机。</span>
          </div>
        </aside>
      </div>
      {featured && (
        <section className="featured-sound">
          <div>
            <span className="eyebrow">A MOMENT FROM YOUR NIGHT</span>
            <h2>一整夜里，值得回听的一刻。</h2>
          </div>
          <button
            aria-label={`查看${featured.time}声音片段`}
            className="featured-sound-button"
            onClick={() => onEvent(featured)}
          >
            <span className="tiny-wave" aria-hidden="true">
              {[8, 15, 24, 13, 20, 10, 17, 7].map((height, i) => (
                <i key={i} style={{ height }} />
              ))}
            </span>
            <span>
              <strong>{featured.time}</strong>
              <small>
                疑似{featured.kind === 'cough' ? '咳嗽' : '喘息'} · {featured.durationSeconds}秒片段
              </small>
            </span>
            <span className="small-glass">
              <Play size={17} fill="currentColor" />
            </span>
          </button>
        </section>
      )}
      {night.captureAudioId && (
        <section className="featured-sound">
          <div>
            <span className="eyebrow">YOUR RECORDING</span>
            <h2>本次采集原声</h2>
            <p>尚未分析，不标注咳嗽或喘息事件。</p>
          </div>
          <GlassButton disabled={night.captureDeleted} onClick={onRaw}>
            <Play size={17} />
            {night.captureDeleted ? '原声已删除' : '回听采集原声'}
          </GlassButton>
        </section>
      )}
      {night.events.length > 0 && (
        <section id="sound-events" className="events-section">
          <SectionTitle
            title="声音片段"
            label="YOUR NIGHT, IN DETAIL"
            action={<TextLink onClick={onTrends}>查看长期趋势</TextLink>}
          />
          <div className="filter-row" aria-label="片段筛选">
            {(
              [
                ['all', '全部'],
                ['cough', '咳嗽'],
                ['wheeze', '喘息'],
                ['favorite', '已收藏'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={filter === value}
                className={filter === value ? 'active' : ''}
                onClick={() => {
                  setFilter(value)
                  setExpanded(false)
                }}
              >
                {label}
                {value === 'favorite' && <Star size={13} />}
              </button>
            ))}
          </div>
          <div className="event-list">
            {events.slice(0, expanded ? undefined : 4).map((event) => (
              <button
                className="event-row"
                key={event.id}
                onClick={() => onEvent(event)}
                aria-label={`打开${event.time}${event.kind === 'cough' ? '咳嗽' : '喘息'}片段`}
              >
                <span className="event-time">{event.time}</span>
                <span className="event-row-info">
                  <strong>疑似{event.kind === 'cough' ? '咳嗽' : '喘息'}</strong>
                  <small>
                    {event.audioDeleted
                      ? '声音已删除 · 摘要保留'
                      : `${event.durationSeconds}秒片段`}
                    {event.feedback ? ' · 已反馈' : ''}
                  </small>
                </span>
                {event.favorite && <Star size={15} fill="currentColor" />}
                <ArrowUpRight size={18} />
              </button>
            ))}
          </div>
          {events.length === 0 && (
            <p className="muted empty-inline">还没有收藏的片段，打开声音详情后可收藏。</p>
          )}
          {events.length > 4 && (
            <button className="show-more" onClick={() => setExpanded(!expanded)}>
              {expanded ? '收起片段' : `查看全部 ${events.length} 个片段`}
              <ArrowRight size={14} />
            </button>
          )}
        </section>
      )}
    </>
  )
}
