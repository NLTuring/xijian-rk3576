import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  Download,
  Headphones,
  Pause,
  Play,
  Repeat2,
  Star,
  Trash2,
} from 'lucide-react'
import type { Night, SoundEvent } from '../domain/types'
import { formatDate } from '../domain/stats'
import { deleteAudio, loadAudio, saveAudio } from '../services/storage'
import { createDemoAudio, waveformFromBlob } from '../services/demoAudio'
import { Dialog, GlassButton } from '../components/ui'

export function SoundDetail({
  night,
  event,
  onBack,
  onChange,
  onDeleteRaw,
  notify,
}: {
  night: Night
  event?: SoundEvent
  onBack: () => void
  onChange: (patch: Partial<SoundEvent>) => Promise<void>
  onDeleteRaw: () => Promise<void>
  notify: (text: string) => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState('')
  const [waveform, setWaveform] = useState<number[]>([])
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(event?.durationSeconds ?? 0)
  const [speed, setSpeed] = useState(1)
  const [loop, setLoop] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<'feedback' | 'delete' | null>(null)
  const deleted = event ? event.audioDeleted : night.captureDeleted
  const audioId = event?.audioId ?? night.captureAudioId!
  const demo = night.source === 'demo'
  useEffect(() => {
    let disposed = false,
      objectUrl = ''
    setError('')
    setBlob(null)
    setUrl('')
    setWaveform([])
    setPosition(0)
    setPlaying(false)
    if (deleted) return
    void (async () => {
      try {
        let source = await loadAudio(audioId)
        if (!source && demo && event) source = createDemoAudio(event.kind)
        if (!source) throw new Error('声音文件暂不可用，事件摘要仍然保留。')
        if (disposed) return
        objectUrl = URL.createObjectURL(source)
        setUrl(objectUrl)
        setBlob(source)
        try {
          const values = await waveformFromBlob(source, 78)
          if (!disposed) setWaveform(values)
        } catch {
          /* Playback may still work even when waveform decoding is unsupported. */
        }
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : '无法读取声音。')
      }
    })()
    return () => {
      disposed = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [audioId, deleted, demo, event?.id, event?.kind])
  async function change(patch: Partial<SoundEvent>) {
    setBusy(true)
    try {
      await onChange(patch)
    } catch {
      notify('保存失败，请重试。')
    } finally {
      setBusy(false)
    }
  }
  const time = (seconds: number) =>
    `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')}:${Math.floor(seconds % 60)
      .toString()
      .padStart(2, '0')}`
  return (
    <div className="sound-detail">
      <button className="back-button" onClick={onBack} aria-label="返回">
        <span className="small-glass">
          <ArrowLeft size={21} />
        </span>
        声音片段
      </button>
      <div className="page-heading">
        <span className="eyebrow">A MOMENT, HEARD CLEARLY</span>
        <p className="greeting">
          {formatDate(night.date)}晚{' '}
          {event ? `· ${event.offsetMinutes >= 60 ? '次日 ' : ''}${event.time}` : ''}
        </p>
        <h1>{event ? `疑似${event.kind === 'cough' ? '咳嗽' : '喘息'}记录` : '本次采集原声'}</h1>
        <p>
          {event ? `${event.durationSeconds}秒片段` : '前台采集 · 尚未分析'} ·{' '}
          {deleted ? '声音已删除，摘要保留' : event?.offline || !demo ? '已保存在本机' : '示例声音'}
        </p>
      </div>
      <div className="sound-grid">
        <section className="audio-player">
          <div className="audio-top">
            <span>
              <Headphones size={17} />
              {demo ? '合成试听音' : '采集原声'}
            </span>
            <span>
              {time(position)} <small>/ {time(duration)}</small>
            </span>
          </div>
          <div className="waveform-area">
            {waveform.length ? (
              <svg viewBox="0 0 624 150" aria-label="当前声音的音频波形" role="img">
                {waveform.map((value, i) => (
                  <line
                    key={i}
                    x1={i * 8 + 3}
                    x2={i * 8 + 3}
                    y1={75 - Math.max(1, value * 60)}
                    y2={75 + Math.max(1, value * 60)}
                    stroke={i / waveform.length < position / duration ? '#fff' : '#82827f'}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                ))}
              </svg>
            ) : (
              <p>
                {deleted ? '这段声音已删除' : error || (url ? '声音已准备好' : '正在准备声音…')}
              </p>
            )}
          </div>
          <label className="visually-hidden" htmlFor="audio-progress">
            播放进度
          </label>
          <input
            id="audio-progress"
            className="audio-progress"
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={Math.min(position, duration || 1)}
            disabled={!url}
            onChange={(e) => {
              const next = Number(e.target.value)
              if (audioRef.current) audioRef.current.currentTime = next
              setPosition(next)
            }}
          />
          <div className="audio-controls">
            <button
              className="audio-secondary"
              onClick={() => {
                const next = speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : 1
                setSpeed(next)
                if (audioRef.current) audioRef.current.playbackRate = next
              }}
              aria-label={`播放速度 ${speed}倍`}
            >
              {speed}×
            </button>
            <GlassButton
              className="play-button"
              disabled={!url}
              aria-label={playing ? '暂停播放' : '播放声音'}
              onClick={async () => {
                const audio = audioRef.current
                if (!audio) return
                if (playing) audio.pause()
                else
                  try {
                    await audio.play()
                  } catch {
                    notify('当前浏览器无法播放这段声音。')
                  }
              }}
            >
              {playing ? (
                <Pause size={27} fill="currentColor" />
              ) : (
                <Play size={27} fill="currentColor" />
              )}
            </GlassButton>
            <button
              className={`audio-secondary ${loop ? 'selected' : ''}`}
              aria-label="循环播放"
              aria-pressed={loop}
              onClick={() => setLoop(!loop)}
            >
              <Repeat2 size={21} />
            </button>
          </div>
          <audio
            ref={audioRef}
            src={url || undefined}
            preload="metadata"
            loop={loop}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => {
              if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration)
            }}
            onError={() => {
              if (url) setError('此浏览器不支持该声音格式。')
            }}
          />
        </section>
        <aside className="sound-aside">
          <span className="eyebrow">KEEP WHAT MATTERS</span>
          <h2>
            听见细节，
            <br />
            也留住依据。
          </h2>
          <p>
            {demo
              ? '这是一段合成试听音，用于体验播放器，并非咳嗽或喘息的监测原声。'
              : '原声仅保存在当前浏览器。接入本地模型前，不对声音作医学判断。'}
          </p>
          <div className="sound-action-stack">
            {event && (
              <GlassButton
                dark
                disabled={busy}
                onClick={() => change({ favorite: !event.favorite })}
              >
                {event.favorite ? <Check size={18} /> : <Star size={18} />}
                {event.favorite ? '已收藏' : '收藏片段'}
              </GlassButton>
            )}
            <GlassButton
              disabled={!blob || busy || event?.offline || !event}
              onClick={async () => {
                if (!blob || !event) return
                setBusy(true)
                try {
                  const id = `saved-${event.id}`
                  await saveAudio(id, blob)
                  await onChange({ audioId: id, offline: true })
                  notify('片段已加密保存，可在本机离线回听。')
                } catch {
                  notify('离线保存失败，请检查存储空间。')
                } finally {
                  setBusy(false)
                }
              }}
            >
              <Download size={18} />
              {event?.offline || !event ? '已在本机保存' : '离线保存'}
            </GlassButton>
          </div>
          {event?.feedback ? (
            <div className="feedback-note">
              <p>已反馈识别有误，原始统计保留。</p>
              <button onClick={() => change({ feedback: undefined })} disabled={busy}>
                撤销反馈
              </button>
            </div>
          ) : (
            event && (
              <button className="feedback-link" onClick={() => setDialog('feedback')}>
                识别有误？
              </button>
            )
          )}
          <button
            className="delete-link"
            disabled={deleted || busy}
            onClick={() => setDialog('delete')}
          >
            <Trash2 size={14} />
            {deleted ? '声音已删除' : '删除这段声音'}
          </button>
        </aside>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {dialog === 'feedback' && (
        <Dialog title="反馈识别有误" onClose={() => setDialog(null)}>
          <p className="dialog-intro">
            将这条事件标记为“识别有误”。原始检测记录与统计会保留，你可以随时撤销反馈。
          </p>
          <GlassButton
            dark
            className="full-width"
            disabled={busy}
            onClick={async () => {
              await change({ feedback: 'incorrect' })
              setDialog(null)
            }}
          >
            确认反馈
          </GlassButton>
        </Dialog>
      )}
      {dialog === 'delete' && (
        <Dialog title="删除声音片段？" onClose={() => setDialog(null)}>
          <p className="dialog-intro">
            将删除本机保存的这段声音。事件时间与统计摘要会保留，删除后无法回听。
          </p>
          <GlassButton
            dark
            className="full-width"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await deleteAudio(audioId)
                if (event) await onChange({ audioDeleted: true, offline: false })
                else await onDeleteRaw()
                setDialog(null)
                notify('声音已删除，摘要保留。')
              } catch {
                notify('删除失败，请重试。')
              } finally {
                setBusy(false)
              }
            }}
          >
            确认删除声音
          </GlassButton>
        </Dialog>
      )}
    </div>
  )
}
