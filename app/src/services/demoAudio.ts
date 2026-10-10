/** A quiet synthetic tone for demonstrating playback, never a clinical recording. */
export function createDemoAudio(kind: 'cough' | 'wheeze'): Blob {
  const sampleRate = 16000,
    seconds = kind === 'cough' ? 6 : 8
  const frames = sampleRate * seconds
  const buffer = new ArrayBuffer(44 + frames * 2),
    view = new DataView(buffer)
  const write = (offset: number, value: string) =>
    [...value].forEach((letter, i) => view.setUint8(offset + i, letter.charCodeAt(0)))
  write(0, 'RIFF')
  view.setUint32(4, buffer.byteLength - 8, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, frames * 2, true)
  for (let i = 0; i < frames; i++) {
    const time = i / sampleRate
    const envelope =
      Math.sin((Math.PI * time) / seconds) ** 2 *
      (0.35 + 0.65 * Math.sin((time * Math.PI) / 1.5) ** 2)
    const value = Math.sin(2 * Math.PI * 220 * time) * envelope * 0.14
    view.setInt16(44 + i * 2, Math.round(value * 32767), true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

export async function waveformFromBlob(blob: Blob, bins = 78): Promise<number[]> {
  if (typeof AudioContext === 'undefined') throw new Error('当前浏览器不支持生成波形。')
  const context = new AudioContext()
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer())
    const samples = audio.getChannelData(0)
    const count = Math.max(1, Math.min(500, Math.floor(bins)))
    const peaks = Array.from({ length: count }, (_, index) => {
      let peak = 0
      const start = Math.floor((index * samples.length) / count),
        end = Math.floor(((index + 1) * samples.length) / count)
      for (let i = start; i < end; i++) peak = Math.max(peak, Math.abs(samples[i]))
      return peak
    })
    const max = Math.max(...peaks, 0.0001)
    return peaks.map((value) => value / max)
  } catch {
    throw new Error('暂时无法读取声音波形。')
  } finally {
    await context.close()
  }
}
