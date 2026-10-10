import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Check,
  FileText,
  Moon,
  TrendingUp,
  UserRound,
  X,
} from 'lucide-react'
import type { AppData, DailyNote, Night, SoundEvent } from './domain/types'
import { createInitialData } from './domain/data'
import { clearAll, saveData } from './services/storage'
import { enforceRetention } from './services/retention'
import { useAppData } from './hooks/useAppData'
import { GlassButton, Mark } from './components/ui'
import { DailyNoteDialog } from './components/DailyNoteDialog'
import { Today } from './pages/Today'
import { Trends } from './pages/Trends'
import { Report } from './pages/Report'
import { Settings } from './pages/Settings'
import { SoundDetail } from './pages/SoundDetail'
import { Monitor } from './pages/Monitor'

type Tab = 'today' | 'trends' | 'report' | 'settings'
type Screen = 'main' | 'sound' | 'monitor'
const navigation = [
  { id: 'today', label: '今天', icon: Activity },
  { id: 'trends', label: '趋势', icon: TrendingUp },
  { id: 'report', label: '报告', icon: FileText },
  { id: 'settings', label: '我的', icon: UserRound },
] as const

export default function App() {
  const { data, error, persist, reload } = useAppData()
  const [tab, setTab] = useState<Tab>('today')
  const [screen, setScreen] = useState<Screen>('main')
  const [nightId, setNightId] = useState('')
  const [eventId, setEventId] = useState<string | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const retentionRun = useRef(false)
  const notify = useCallback((message: string) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 5500)
  }, [])
  useEffect(() => () => clearTimeout(toastTimer.current), [])
  useEffect(() => {
    if (!data || retentionRun.current) return
    retentionRun.current = true
    void enforceRetention(data)
      .then(async (next) => {
        if (next !== data)
          await persist((previous) => ({
            ...previous,
            nights: previous.nights.map((n) => next.nights.find((x) => x.id === n.id) ?? n),
          }))
      })
      .catch(() => notify('部分过期声音未能清理，请在隐私设置中重试。'))
  }, [data, persist, notify])
  useEffect(() => {
    document.documentElement.dataset.theme = screen === 'monitor' ? 'night' : 'day'
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [tab, screen])
  const completeRecording = useCallback(
    async (night: Night) => {
      await persist((previous) => ({ ...previous, nights: [...previous.nights, night] }))
      setNightId(night.id)
    },
    [persist],
  )
  if (error)
    return (
      <main className="startup">
        <Mark />
        <h1>本地记录暂时无法打开</h1>
        <p role="alert">{error}</p>
        <p>现有数据未被删除。</p>
        <GlassButton onClick={() => void reload()}>重新读取</GlassButton>
      </main>
    )
  if (!data)
    return (
      <main className="startup" aria-busy="true">
        <Mark />
        <p>正在打开息间…</p>
      </main>
    )
  const nights = data.nights.filter((n) => n.source === data.mode)
  const night = nights.find((n) => n.id === nightId) ?? nights.at(-1)
  const event = night?.events.find((e) => e.id === eventId)
  const go = (target: Tab) => {
    setScreen('main')
    setTab(target)
  }
  const openEvent = (selected: SoundEvent) => {
    setEventId(selected.id)
    setScreen('sound')
  }
  const updateEvent = async (patch: Partial<SoundEvent>) => {
    if (!night || !event) return
    await persist((previous) => ({
      ...previous,
      nights: previous.nights.map((n) =>
        n.id === night.id
          ? { ...n, events: n.events.map((e) => (e.id === event.id ? { ...e, ...patch } : e)) }
          : n,
      ),
    }))
  }
  return (
    <div className={`app-shell ${screen === 'monitor' ? 'night-theme' : ''}`}>
      <header className="app-header">
        <button
          className="brand"
          onClick={() => {
            if (screen !== 'monitor') go('today')
          }}
          aria-label="息间首页"
          disabled={screen === 'monitor'}
        >
          <Mark />
          <span>
            息间<small>XIJIAN</small>
          </span>
        </button>
        <span className="header-motto">安静记录，清楚了解。</span>
        <div className="header-actions">
          <span className="mode-badge">
            <i />
            {data.mode === 'demo' ? '示例体验' : '本地采集'}
          </span>
          {screen !== 'monitor' && (
            <button
              className="header-profile small-glass"
              onClick={() => go('settings')}
              aria-label="个人与设备设置"
            >
              <UserRound size={19} />
            </button>
          )}
        </div>
      </header>
      <main
        id="main-content"
        className={`main-content ${screen === 'sound' ? 'detail-content' : ''}`}
      >
        {screen === 'monitor' ? (
          <Monitor
            mode={data.mode}
            onBack={() => {
              setScreen('main')
              setTab('today')
            }}
            onComplete={completeRecording}
            notify={notify}
          />
        ) : screen === 'sound' && night ? (
          <SoundDetail
            night={night}
            event={event}
            onBack={() => setScreen('main')}
            onChange={updateEvent}
            notify={notify}
            onDeleteRaw={async () => {
              await persist((previous) => ({
                ...previous,
                nights: previous.nights.map((n) =>
                  n.id === night.id ? { ...n, captureDeleted: true } : n,
                ),
              }))
            }}
          />
        ) : tab === 'today' ? (
          <Today
            night={night}
            note={night ? data.notes[night.id] : undefined}
            onPrepare={() => setScreen('monitor')}
            onEvent={openEvent}
            onNote={() => setNoteOpen(true)}
            onTrends={() => go('trends')}
            onRaw={() => {
              setEventId(null)
              setScreen('sound')
            }}
          />
        ) : tab === 'trends' ? (
          <Trends
            nights={nights}
            notes={data.notes}
            onNight={(n) => {
              setNightId(n.id)
              go('today')
            }}
          />
        ) : tab === 'report' ? (
          <Report nights={nights} notes={data.notes} notify={notify} />
        ) : (
          <Settings
            data={data}
            onMode={async (mode) => {
              await persist((previous) => ({ ...previous, mode }))
              setNightId('')
            }}
            onDeviceUrl={async (deviceUrl) => {
              await persist((previous) => ({ ...previous, deviceUrl }))
            }}
            onRetention={async (retentionDays) => {
              const next = await enforceRetention({ ...data, retentionDays })
              await persist((previous) => ({
                ...previous,
                retentionDays,
                nights: previous.nights.map((n) => next.nights.find((x) => x.id === n.id) ?? n),
              }))
            }}
            onClear={async () => {
              await clearAll()
              const fresh: AppData = { ...createInitialData(), mode: 'live', nights: [] }
              await saveData(fresh)
              retentionRun.current = false
              await reload()
              setNightId('')
            }}
            notify={notify}
          />
        )}
        {screen !== 'monitor' && (
          <footer className="page-footer">
            <span>
              <Mark small />
              留一点时间，了解自己。
            </span>
            <span>息间 · 个人呼吸声学记录</span>
          </footer>
        )}
      </main>
      {screen !== 'monitor' && (
        <nav className="floating-nav" aria-label="主要导航">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={tab === id ? 'page' : undefined}
              className={tab === id ? 'selected' : ''}
              onClick={() => go(id)}
            >
              <Icon size={21} strokeWidth={1.65} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
      {noteOpen && night && (
        <DailyNoteDialog
          night={night}
          initial={data.notes[night.id]}
          onClose={() => setNoteOpen(false)}
          onSave={async (note: DailyNote) => {
            await persist((previous) => ({
              ...previous,
              notes: { ...previous.notes, [note.nightId]: note },
            }))
            notify('用药与感受已保存。')
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button onClick={() => setToast('')} aria-label="关闭提示">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
