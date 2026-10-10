import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  Mic,
  Moon,
  Pause,
  Play,
  Smartphone,
  Square,
  Unplug,
} from 'lucide-react'
import type { Mode, Night } from '../domain/types'
import { formatDuration } from '../domain/stats'
import { AudioCapture } from '../services/recorder'
import { saveAudio } from '../services/storage'
import { Dialog, GlassButton } from '../components/ui'

export function Monitor({
  mode,
  onBack,
  onComplete,
  notify,
}: {
  mode: Mode
  onBack: () => void
  onComplete: (night: Night) => Promise<void>
  notify: (text: string) => void
}) {
  const [state, setState] = useState<'ready' | 'running' | 'paused' | 'done'>('ready')
  const [elapsed, setElapsed] = useState(0)
  const [busy, setBusy] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [error, setError] = useState('')
  const [interrupted, setInterrupted] = useState(false)
  const capture = useRef<AudioCapture | null>(null)
  const started = useRef(0)
  const activeAt = useRef(0)
  const accumulated = useRef(0)
  const finishing = useRef(false)
  const pending = useRef<{ night: Night; blob: Blob } | null>(null)
  const demo = mode === 'demo'
  const finish = useCallback(async () => {
    if (finishing.current) return
    finishing.current = true
    setBusy(true)
    setConfirmEnd(false)
    setError('')
    try {
      if (!demo) {
        if (!pending.current) {
          const recorded = await capture.current!.stop()
          const start = new Date(started.current),
            end = new Date()
          const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
          const clock = (d: Date) =>
            `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          const id = `live-${crypto.randomUUID()}`
          pending.current = {
            blob: recorded.blob,
            night: {
              id,
              date,
              startTime: clock(start),
              endTime: clock(end),
              totalMinutes: Math.max(
                recorded.durationSeconds / 60,
                (end.getTime() - start.getTime()) / 60000,
              ),
              validMinutes: 0,
              coughCount: null,
              wheezeCount: null,
              events: [],
              gaps: [],
              source: 'live',
              analysis: 'pending',
              captureAudioId: `raw-${id}`,
            },
          }
        }
        await saveAudio(pending.current.night.captureAudioId!, pending.current.blob)
        await onComplete(pending.current.night)
        pending.current = null
      }
      setState('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : '无法保存这次采集，请重试。')
      setState('paused')
    } finally {
      setBusy(false)
      finishing.current = false
    }
  }, [demo, onComplete])
  useEffect(() => {
    if (state !== 'running') return
    const timer = window.setInterval(() => {
      const seconds = accumulated.current + (Date.now() - activeAt.current) / 1000
      setElapsed(seconds)
      if (!demo && seconds >= 300) void finish()
    }, 250)
    return () => window.clearInterval(timer)
  }, [state, demo, finish])
  useEffect(() => {
    return () => capture.current?.dispose()
  }, [])
  useEffect(() => {
    if (state !== 'running' && state !== 'paused') return
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    const hidden = () => {
      if (document.hidden && state === 'running' && !demo) {
        accumulated.current += (Date.now() - activeAt.current) / 1000
        setElapsed(accumulated.current)
        try {
          capture.current?.pause()
        } catch {
          /* Recorder releases on pause failures. */
        }
        setState('paused')
        setError('页面已进入后台，采集已暂停。回到页面后可继续，或结束保存。')
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [state, demo])
  const active = state === 'running' || state === 'paused'
  return (
    <section className="monitor-page">
      <button
        className="back-button"
        aria-label="返回"
        disabled={busy}
        onClick={() => {
          if (active) setConfirmEnd(true)
          else onBack()
        }}
      >
        <span className="small-glass">
          <ArrowLeft size={21} />
        </span>
        今晚的记录
      </button>
      <div className="monitor-grid">
        <div className="page-heading">
          <span className="eyebrow">LET THE NIGHT BE QUIET</span>
          <p className="greeting">{demo ? '示例体验' : '前台收音检查'} · 默认单人睡眠</p>
          <h1>
            {state === 'ready' ? (
              <>
                准备开始
                <br />
                今晚的记录。
              </>
            ) : state === 'running' ? (
              '安静记录中。'
            ) : state === 'paused' ? (
              '记录已暂停。'
            ) : demo ? (
              '本次演示已结束。'
            ) : (
              '这段声音，已留存。'
            )}
          </h1>
          <p>
            {state === 'ready'
              ? '把手机放在床头，麦克风保持通畅。'
              : state === 'done'
                ? demo
                  ? '演示不会生成新的监测结果。'
                  : '原声已加密保存在本机，分析结果仍待模型接入。'
                : '给自己一段安静的时间。'}
          </p>
          {active && (
            <div className="capture-timer">
              <span>
                {state === 'running' ? (
                  <Circle size={8} fill="currentColor" />
                ) : (
                  <Pause size={12} />
                )}{' '}
                {demo ? '演示计时' : '前台已采集'}
              </span>
              <strong>{formatDuration(elapsed)}</strong>
            </div>
          )}
          <div className="quiet-footnote">
            <Moon size={18} />
            <p>
              {demo
                ? '示例体验不会打开麦克风。'
                : '当前为前台短录音，最长 5 分钟。锁屏或切至后台会暂停，不用于整夜监测。'}
            </p>
          </div>
        </div>
        <div className="monitor-controls">
          <div className="device-diagram">
            <div>
              <Smartphone size={43} strokeWidth={1} />
              <span>手机采集</span>
            </div>
            <div className="device-path">
              <span>{demo ? '示例链路' : '本机保存'}</span>
              <i />
              <i />
              <i />
              <ArrowRight size={13} />
            </div>
            <div>
              <div className="device-box">
                <i />
                <i />
                <i />
              </div>
              <span>本地分析设备</span>
            </div>
          </div>
          <div className="preflight">
            <div>
              <span>
                <Mic size={17} />
                麦克风
              </span>
              <strong>
                {demo ? '演示模式' : active ? '已授权' : '开始时请求授权'}
                {demo && <Check size={16} />}
              </strong>
            </div>
            <div>
              <span>
                <Unplug size={17} />
                声音分析
              </span>
              <strong>{demo ? '示例数据' : '待接入模型'}</strong>
            </div>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {state === 'ready' && (
            <GlassButton
              className="full-width monitor-start"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                setError('')
                setInterrupted(false)
                try {
                  if (!demo) {
                    capture.current = new AudioCapture(() => {
                      accumulated.current += (Date.now() - activeAt.current) / 1000
                      setElapsed(accumulated.current)
                      setInterrupted(true)
                      setState('paused')
                      setError('麦克风采集已中断，请结束并保存可用片段。')
                    })
                    await capture.current.start()
                  }
                  started.current = Date.now()
                  activeAt.current = started.current
                  accumulated.current = 0
                  setState('running')
                } catch (e) {
                  setError(e instanceof Error ? e.message : '无法启动麦克风。')
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? '正在准备…' : demo ? '开始监测演示' : '开始前台采集'}
              <ArrowRight size={19} />
            </GlassButton>
          )}
          {active && (
            <div className="monitor-actions">
              <GlassButton
                disabled={busy || !!pending.current || interrupted}
                onClick={() => {
                  try {
                    if (state === 'running') {
                      if (!demo) capture.current?.pause()
                      accumulated.current += (Date.now() - activeAt.current) / 1000
                      setElapsed(accumulated.current)
                      setState('paused')
                    } else {
                      if (!demo) capture.current?.resume()
                      activeAt.current = Date.now()
                      setError('')
                      setState('running')
                    }
                  } catch (e) {
                    notify(e instanceof Error ? e.message : '采集状态切换失败。')
                  }
                }}
              >
                {state === 'running' ? <Pause size={18} /> : <Play size={18} />}
                {state === 'running' ? '暂停' : '继续记录'}
              </GlassButton>
              <GlassButton disabled={busy} onClick={() => setConfirmEnd(true)}>
                <Square size={16} />
                {busy ? '正在保存…' : pending.current ? '重试保存' : '结束记录'}
              </GlassButton>
            </div>
          )}
          {state === 'done' && (
            <GlassButton className="full-width" onClick={onBack}>
              返回今天
              <ArrowRight size={18} />
            </GlassButton>
          )}
          <p className="monitor-caption">
            {demo ? '夜间安静记录，晨间集中查看变化' : '采集音频只保存在本机，不上传外网。'}
          </p>
        </div>
      </div>
      {confirmEnd && (
        <Dialog title="结束本次记录？" onClose={() => setConfirmEnd(false)}>
          <p className="dialog-intro">
            {demo ? '结束演示计时，保留原有示例夜晚。' : '停止使用麦克风，并加密保存已采集的原声。'}
          </p>
          <GlassButton dark className="full-width" onClick={() => void finish()} disabled={busy}>
            确认结束
          </GlassButton>
          {error && (
            <button
              className="delete-link"
              disabled={busy}
              onClick={() => {
                capture.current?.dispose()
                onBack()
              }}
            >
              放弃本次采集并返回
            </button>
          )}
        </Dialog>
      )}
    </section>
  )
}
