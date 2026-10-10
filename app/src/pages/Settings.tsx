import { useState } from 'react'
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Database,
  FlaskConical,
  HardDrive,
  LockKeyhole,
  Radio,
  ShieldCheck,
  Smartphone,
  Trash2,
  Wifi,
} from 'lucide-react'
import type { AppData, Mode } from '../domain/types'
import { checkDevice, type DeviceStatus } from '../services/device'
import { Dialog, GlassButton, SectionTitle } from '../components/ui'

export function Settings({
  data,
  onMode,
  onDeviceUrl,
  onRetention,
  onClear,
  notify,
}: {
  data: AppData
  onMode: (mode: Mode) => Promise<void>
  onDeviceUrl: (url: string) => Promise<void>
  onRetention: (days: number) => Promise<void>
  onClear: () => Promise<void>
  notify: (text: string) => void
}) {
  const [deviceOpen, setDeviceOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [url, setUrl] = useState(data.deviceUrl)
  const [status, setStatus] = useState<DeviceStatus | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingDays, setPendingDays] = useState<number | null>(null)
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">A SPACE THAT IS YOURS</span>
        <h1>
          简单一点，
          <br />
          也安心一点。
        </h1>
        <p>管理设备，以及只属于你的声音和记录。</p>
      </div>
      <div className="settings-grid">
        <div>
          <section className="surface mode-card">
            <span className="eyebrow">YOUR EXPERIENCE</span>
            <h2>当前体验</h2>
            <div className="mode-options">
              {(
                [
                  ['demo', '示例体验', '用30个示例夜晚，了解息间。', FlaskConical],
                  ['live', '真实采集', '开启前台收音，原声留在本机。', MicIcon],
                ] as const
              ).map(([mode, title, description, Icon]) => (
                <button
                  className={data.mode === mode ? 'active' : ''}
                  key={mode}
                  disabled={busy}
                  aria-pressed={data.mode === mode}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await onMode(mode)
                    } catch {
                      notify('切换失败，请重试。')
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  <Icon size={22} />
                  <strong>{title}</strong>
                  <span>{description}</span>
                  {data.mode === mode && <Check className="mode-check" size={17} />}
                </button>
              ))}
            </div>
            <p className="muted small-text">示例与实际记录独立显示。切换不会删除已有数据。</p>
          </section>
          <SectionTitle title="设备与数据" />
          <div className="settings-list">
            <button onClick={() => setDeviceOpen(true)}>
              <span className="settings-row-icon">
                <Wifi size={21} />
              </span>
              <div>
                <strong>本地分析设备</strong>
                <small>
                  {status
                    ? `${status.name} · ${status.status === 'ready' ? '已连接' : '忙碌中'}`
                    : data.deviceUrl
                      ? '已保存地址 · 尚未验证连接'
                      : '连接你的本地分析设备'}
                </small>
              </div>
              <ChevronRight size={18} />
            </button>
            <button onClick={() => setPrivacyOpen(true)}>
              <span className="settings-row-icon">
                <LockKeyhole size={21} />
              </span>
              <div>
                <strong>隐私与本地保存</strong>
                <small>加密存储、片段保留与删除</small>
              </div>
              <ChevronRight size={18} />
            </button>
            <div className="settings-row">
              <span className="settings-row-icon">
                <Database size={21} />
              </span>
              <div>
                <strong>普通声音保留期限</strong>
                <small>收藏事件单独保留；过期后保留摘要</small>
              </div>
              <select
                aria-label="声音保留期限"
                value={data.retentionDays}
                onChange={(e) => setPendingDays(Number(e.target.value))}
              >
                {[7, 30, 90].map((days) => (
                  <option value={days} key={days}>
                    {days}天
                  </option>
                ))}
              </select>
            </div>
            <button onClick={() => setClearOpen(true)}>
              <span className="settings-row-icon">
                <Trash2 size={21} />
              </span>
              <div>
                <strong>清除本机数据</strong>
                <small>删除声音、笔记及设备设置</small>
              </div>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <aside className="settings-aside">
          <div className="privacy-illustration" aria-hidden="true">
            <div>
              <ShieldCheck size={58} strokeWidth={1} />
            </div>
          </div>
          <span className="eyebrow">LOCAL BY DESIGN</span>
          <h2>
            记录你的夜晚，
            <br />
            尊重你的日常。
          </h2>
          <p>音频和个人记录在当前浏览器中加密保存。播放与导出由你主动发起。</p>
          <div className="settings-mini">
            <HardDrive size={18} />
            <span>
              {data.nights.filter((n) => n.source === data.mode).length} 个
              {data.mode === 'demo' ? '示例' : '实际'}夜晚
            </span>
            <span>
              {
                Object.values(data.notes).filter(
                  (note) => data.nights.find((n) => n.id === note.nightId)?.source === data.mode,
                ).length
              }{' '}
              条笔记
            </span>
          </div>
          <div className="notice">
            <Smartphone size={18} />
            <span>支持添加到手机主屏幕。真实采集需 HTTPS 或本机 localhost，保持页面在前台。</span>
          </div>
          <p className="app-version">
            息间 XIJIAN · 0.1.0
            <br />
            让每一夜，离自己近一点。
          </p>
        </aside>
      </div>
      {deviceOpen && (
        <Dialog
          title="连接本地分析设备"
          onClose={() => {
            if (!busy) setDeviceOpen(false)
          }}
        >
          <p className="dialog-intro">手机与设备需在同一局域网。连接检查会访问你填写的设备地址。</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              setError('')
              setStatus(null)
              try {
                const result = await checkDevice(url)
                await onDeviceUrl(url.trim())
                setStatus(result)
              } catch (e) {
                setError(e instanceof Error ? e.message : '设备暂时无法连接。')
              } finally {
                setBusy(false)
              }
            }}
          >
            <label className="field-label" htmlFor="device-url">
              设备地址
            </label>
            <input
              id="device-url"
              type="url"
              placeholder="https://192.168.1.100:8443"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setStatus(null)
              }}
              required
            />
            <p className="field-hint">支持局域网 HTTPS 地址，设备需提供兼容的连接接口。</p>
            {status && (
              <p className="notice">
                <Check size={18} />
                <span>
                  {status.name} · {status.model}
                  <br />
                  {status.modelReady
                    ? '设备报告模型已准备好；音频传输仍待联调。'
                    : '设备在线，模型尚未准备好。'}
                </span>
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <GlassButton dark className="full-width" disabled={busy}>
              {busy ? '正在检查连接…' : '检查并保存连接'}
              <ArrowUpRight size={16} />
            </GlassButton>
          </form>
        </Dialog>
      )}
      {privacyOpen && (
        <Dialog title="你的记录，保存在这里" onClose={() => setPrivacyOpen(false)}>
          <div className="privacy-details">
            <h3>当前浏览器的本地存储</h3>
            <p>
              声音和笔记使用 AES-GCM
              加密保存，不自动上传外网。密钥保存在同一浏览器中，加密不能防止已解锁设备或同源恶意脚本访问。
            </p>
            <h3>离线与保留</h3>
            <p>
              已保存的声音可在本机回听。普通声音按保留期限在下次打开应用时清理；收藏事件单独保留。声音删除后，统计摘要保留。
            </p>
            <h3>你可以决定带走什么</h3>
            <p>
              PDF
              导出包含当前范围的统计和个人笔记。浏览器清理网站数据或更换设备后，本机记录无法自动恢复。
            </p>
          </div>
        </Dialog>
      )}
      {clearOpen && (
        <Dialog
          title="清除全部本机数据？"
          onClose={() => {
            if (!busy) setClearOpen(false)
          }}
        >
          <p className="dialog-intro">
            将删除当前浏览器内的声音、收藏、用药症状笔记和设备地址，无法撤销。已经下载的报告文件不受影响。
          </p>
          <GlassButton
            dark
            className="full-width"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onClear()
                setClearOpen(false)
                setStatus(null)
                setUrl('')
                notify('本机数据已清除。')
              } catch {
                notify('清除未完成，请重试。')
              } finally {
                setBusy(false)
              }
            }}
          >
            确认清除本机数据
          </GlassButton>
        </Dialog>
      )}
      {pendingDays !== null && (
        <Dialog title="更新声音保留期限" onClose={() => setPendingDays(null)}>
          <p className="dialog-intro">
            普通声音将保留 {pendingDays}{' '}
            天，已经过期的真实录音会立即删除。收藏事件的声音与统计摘要保留。
          </p>
          <GlassButton
            dark
            className="full-width"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onRetention(pendingDays)
                setPendingDays(null)
                notify('保留期限已更新。')
              } catch {
                notify('更新失败，请重试。')
              } finally {
                setBusy(false)
              }
            }}
          >
            确认更新
          </GlassButton>
        </Dialog>
      )}
    </>
  )
}
function MicIcon({ size }: { size?: number }) {
  return <Radio size={size} />
}
