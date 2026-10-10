import { describe, expect, it, vi } from 'vitest'
import { createDemoAudio, waveformFromBlob } from './demoAudio'

const bytes = (blob: Blob) =>
  new Promise<ArrayBuffer>((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as ArrayBuffer)
    r.readAsArrayBuffer(blob)
  })
describe('clearly labeled synthetic demo audio', () => {
  it.each([
    ['cough', 6],
    ['wheeze', 8],
  ] as const)('creates a quiet %s WAV with the declared duration', async (kind, seconds) => {
    const blob = createDemoAudio(kind)
    const buffer = await bytes(blob),
      view = new DataView(buffer)
    expect(blob.type).toBe('audio/wav')
    expect(new TextDecoder().decode(buffer.slice(0, 4))).toBe('RIFF')
    expect(view.getUint32(24, true)).toBe(16000)
    expect(buffer.byteLength).toBe(44 + 16000 * seconds * 2)
    let peak = 0
    for (let i = 44; i < buffer.byteLength; i += 2)
      peak = Math.max(peak, Math.abs(view.getInt16(i, true)) / 32768)
    expect(peak).toBeGreaterThan(0)
    expect(peak).toBeLessThanOrEqual(0.2)
  })
  it('extracts the actual normalized envelope and closes the audio context', async () => {
    const close = vi.fn(async () => undefined)
    vi.stubGlobal(
      'AudioContext',
      class {
        close = close
        decodeAudioData = vi.fn(async () => ({
          getChannelData: () => new Float32Array([0, 0.2, 0.4, 0.1, -0.6, 0]),
        }))
      },
    )
    const blob = { arrayBuffer: async () => new ArrayBuffer(12) } as Blob
    expect(await waveformFromBlob(blob, 3)).toEqual([
      expect.closeTo(1 / 3),
      expect.closeTo(2 / 3),
      1,
    ])
    expect(close).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })
  it('closes the context when decoding fails', async () => {
    const close = vi.fn(async () => undefined)
    vi.stubGlobal(
      'AudioContext',
      class {
        close = close
        decodeAudioData = vi.fn(async () => {
          throw new Error('bad audio')
        })
      },
    )
    await expect(
      waveformFromBlob({ arrayBuffer: async () => new ArrayBuffer(12) } as Blob),
    ).rejects.toThrow('波形')
    expect(close).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })
  it('reports unsupported decoding', async () => {
    vi.stubGlobal('AudioContext', undefined)
    await expect(waveformFromBlob(new Blob())).rejects.toThrow('波形')
    vi.unstubAllGlobals()
  })
})
