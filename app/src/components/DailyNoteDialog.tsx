import { useState } from 'react'
import { Check } from 'lucide-react'
import type { DailyNote, Night } from '../domain/types'
import { Dialog, GlassButton } from './ui'
import { formatDate } from '../domain/stats'

export function DailyNoteDialog({
  night,
  initial,
  onSave,
  onClose,
}: {
  night: Night
  initial?: DailyNote
  onSave: (note: DailyNote) => Promise<void>
  onClose: () => void
}) {
  const [medication, setMedication] = useState<DailyNote['medication']>(
    initial?.medication ?? 'unrecorded',
  )
  const [symptom, setSymptom] = useState<DailyNote['symptom'] | ''>(initial?.symptom ?? '')
  const [text, setText] = useState(initial?.text ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <Dialog
      title="记录昨晚的状态"
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <p className="dialog-intro">{formatDate(night.date)}晚 · 花半分钟，留下一点自己的感受。</p>
      {night.source === 'demo' && (
        <p className="notice small-notice">这是示例夜晚，请用示例内容体验。</p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!symptom) {
            setError('请选择昨晚的症状感受。')
            return
          }
          setBusy(true)
          try {
            await onSave({
              nightId: night.id,
              medication,
              symptom,
              text: text.trim(),
              updatedAt: new Date().toISOString(),
            })
            onClose()
          } catch {
            setError('保存失败，请检查本地存储后重试。')
          } finally {
            setBusy(false)
          }
        }}
      >
        <fieldset>
          <legend>用药情况</legend>
          <div className="choice-stack">
            {(
              [
                ['as-planned', '按原计划使用'],
                ['changed', '有变化'],
                ['unrecorded', '暂不记录'],
              ] as const
            ).map(([value, label]) => (
              <label className={`choice ${medication === value ? 'chosen' : ''}`} key={value}>
                <input
                  type="radio"
                  name="medication"
                  value={value}
                  checked={medication === value}
                  onChange={() => setMedication(value)}
                />
                <span>{label}</span>
                {medication === value && <Check size={17} />}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>症状感受</legend>
          <div className="choice-row">
            {(
              [
                ['none', '无明显不适'],
                ['mild', '轻微不适'],
                ['obvious', '明显不适'],
              ] as const
            ).map(([value, label]) => (
              <label className={`choice ${symptom === value ? 'chosen' : ''}`} key={value}>
                <input
                  type="radio"
                  name="symptom"
                  value={value}
                  checked={symptom === value}
                  onChange={() => setSymptom(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field-label" htmlFor="note-text">
          备注 <span>选填</span>
        </label>
        <textarea
          id="note-text"
          aria-label="备注"
          maxLength={500}
          rows={3}
          placeholder="例如：比平时晚睡了一点……"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="character-count">{text.length} / 500</div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <GlassButton type="submit" dark className="full-width" disabled={busy}>
          {busy ? '正在保存…' : '保存记录'}
        </GlassButton>
      </form>
    </Dialog>
  )
}
