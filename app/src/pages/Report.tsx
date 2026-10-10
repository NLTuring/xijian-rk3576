import { useState } from 'react'
import { Download, FileText, Headphones, ShieldCheck } from 'lucide-react'
import type { DailyNote, Night } from '../domain/types'
import { selectNights, summarize } from '../domain/stats'
import { exportReport } from '../services/report'
import { TrendChart } from '../components/Charts'
import { EmptyState, GlassButton } from '../components/ui'

export function Report({
  nights,
  notes,
  notify,
}: {
  nights: Night[]
  notes: Record<string, DailyNote>
  notify: (message: string) => void
}) {
  const [days, setDays] = useState(7)
  const [busy, setBusy] = useState(false)
  const selected = selectNights(nights, days)
  const summary = summarize(selected)
  const favorites = selected.flatMap((n) => n.events).filter((e) => e.favorite)
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">MORE THAN A CONVERSATION</span>
        <h1>
          带上这些记录，
          <br />
          去见医生。
        </h1>
        <p>把不容易描述的一整夜，整理成一份清楚的记录。</p>
      </div>
      <div className="report-grid">
        <div>
          <div className="range-toolbar">
            <div className="segmented" aria-label="报告时间范围">
              {[7, 14, 30].map((value) => (
                <button
                  key={value}
                  className={days === value ? 'selected' : ''}
                  aria-pressed={days === value}
                  onClick={() => setDays(value)}
                >
                  近{value}天
                </button>
              ))}
            </div>
            <span>
              {selected[0]?.date.slice(5).replace('-', '.')} —{' '}
              {selected.at(-1)?.date.slice(5).replace('-', '.')}
            </span>
          </div>
          {selected.length ? (
            <section className="report-paper">
              <div className="report-paper-header">
                <div>
                  <FileText size={22} />
                  <span>息间 · 呼吸声学记录摘要</span>
                </div>
                <small>{nights[0]?.source === 'demo' ? '示例报告' : '个人记录'}</small>
              </div>
              <h2>每一夜，都有据可循。</h2>
              <p className="muted report-range">
                {selected[0].date} 至 {selected.at(-1)!.date}
              </p>
              <div className="report-metrics">
                <div>
                  <strong>{selected.length}</strong>
                  <span>个记录夜晚</span>
                </div>
                <div>
                  <strong>{summary.analyzedNights ? summary.validHours.toFixed(0) : '—'}</strong>
                  <span>有效小时</span>
                </div>
              </div>
              <div className="report-chart-heading">
                <span>咳嗽频次</span>
                <strong>
                  均值 {summary.coughRate?.toFixed(1) ?? '待分析'} <small>次 / 有效小时</small>
                </strong>
              </div>
              <TrendChart nights={selected} />
              <div className="report-data-row">
                <span>
                  疑似喘息 {summary.analyzedNights ? `${summary.wheezeCount} 段` : '待分析'}
                </span>
                <span>
                  {summary.analyzedNights
                    ? `有效采集 ${summary.completeness?.toFixed(0)}%`
                    : '质量待分析'}
                </span>
              </div>
              <div className="report-note">
                <ShieldCheck size={16} />
                <span>记录供复诊时讨论，不替代临床诊断。</span>
              </div>
            </section>
          ) : (
            <EmptyState title="还没有可导出的记录" text="完成一次采集后，可以整理成复诊报告。" />
          )}
        </div>
        <aside className="report-aside">
          <span className="eyebrow">BEFORE YOUR VISIT</span>
          <h2>把细节准备好。</h2>
          <ul className="report-checklist">
            <li>
              <span>01</span>
              <div>
                <strong>客观的声音统计</strong>
                <p>频次、发生时段和记录质量。</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>你自己的感受</strong>
                <p>已填写的用药、症状与备注。</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>值得讨论的片段</strong>
                <p>
                  {favorites.length} 段已收藏，
                  {favorites.filter((e) => e.offline && !e.audioDeleted).length} 段已在本机保存。
                </p>
              </div>
            </li>
          </ul>
          <div className="notice">
            <Headphones size={18} />
            <span>PDF 包含事件索引。声音可在 APP 中回听，保存到本机后也可离线播放。</span>
          </div>
          <GlassButton
            dark
            className="full-width"
            disabled={busy || !selected.length}
            onClick={async () => {
              setBusy(true)
              try {
                await exportReport(selected, notes)
                notify('报告已生成，请查看下载文件。')
              } catch (e) {
                notify(e instanceof Error ? e.message : '报告导出失败，请重试。')
              } finally {
                setBusy(false)
              }
            }}
          >
            <Download size={18} />
            {busy ? '正在整理报告…' : '导出 PDF 报告'}
          </GlassButton>
          <p className="privacy-caption">仅导出当前范围，包含你填写的个人记录。</p>
        </aside>
      </div>
    </>
  )
}
