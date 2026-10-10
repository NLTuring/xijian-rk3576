import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioCapture } from './recorder'

class FakeTrack extends EventTarget {
  stop = vi.fn()
}
class FakeRecorder extends EventTarget {
  static instances: FakeRecorder[] = []
  static isTypeSupported = vi.fn(() => true)
  state: RecordingState = 'inactive'
  mimeType = 'audio/webm;codecs=opus'
  ondataavailable: ((event: BlobEvent) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    super()
    FakeRecorder.instances.push(this)
    this.mimeType = options?.mimeType ?? 'audio/webm'
  }
  start = vi.fn(() => {
    this.state = 'recording'
  })
  pause = vi.fn(() => {
    this.state = 'paused'
  })
  resume = vi.fn(() => {
    this.state = 'recording'
  })
  stop = vi.fn(() => {
    this.state = 'inactive'
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(['audio'], { type: this.mimeType }) } as BlobEvent)
      this.onstop?.()
    })
  })
}

let track: FakeTrack
let stream: MediaStream
let media: ReturnType<typeof vi.fn>
let now = 0
beforeEach(() => {
  track = new FakeTrack()
  stream = { getTracks: () => [track] } as unknown as MediaStream
  media = vi.fn().mockResolvedValue(stream)
  vi.stubGlobal('isSecureContext', true)
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: media },
    configurable: true,
  })
  vi.stubGlobal('MediaRecorder', FakeRecorder)
  FakeRecorder.instances = []
  FakeRecorder.isTypeSupported.mockReturnValue(true)
  now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('microphone capture lifecycle', () => {
  it('records real microphone input and excludes paused time', async () => {
    const capture = new AudioCapture()
    await capture.start()
    expect(media).toHaveBeenCalledWith({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    })
    now = 2500
    capture.pause()
    now = 12_500
    capture.resume()
    now = 15_000
    const result = await capture.stop()
    expect(result.durationSeconds).toBe(5)
    expect(result.blob.size).toBe(5)
    expect(result.mimeType).toBe('audio/webm;codecs=opus')
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(FakeRecorder.instances[0].start).toHaveBeenCalledWith(1000)
  })
  it('handles a paused stop and repeated stop calls without double cleanup', async () => {
    const capture = new AudioCapture()
    await capture.start()
    now = 3500
    capture.pause()
    capture.pause()
    now = 20_000
    const one = capture.stop()
    expect(capture.stop()).toBe(one)
    expect((await one).durationSeconds).toBe(3.5)
    expect(track.stop).toHaveBeenCalledTimes(1)
    capture.dispose()
    expect(track.stop).toHaveBeenCalledTimes(1)
  })
  it('does not present a disconnected microphone as an active recording', async () => {
    const interrupted = vi.fn()
    const capture = new AudioCapture(interrupted)
    await capture.start()
    now = 7000
    track.dispatchEvent(new Event('ended'))
    expect(interrupted).toHaveBeenCalledTimes(1)
    expect((await capture.stop()).durationSeconds).toBe(7)
    expect(track.stop).toHaveBeenCalledTimes(1)
  })
  it('cleans up errors and lets the caller observe the failure', async () => {
    const interrupted = vi.fn()
    const capture = new AudioCapture(interrupted)
    await capture.start()
    FakeRecorder.instances[0].onerror?.()
    await expect(capture.stop()).rejects.toThrow('录音中断')
    expect(interrupted).toHaveBeenCalledTimes(1)
    expect(track.stop).toHaveBeenCalledTimes(1)
  })
  it('stops resources on dispose and rejects further use', async () => {
    const capture = new AudioCapture()
    await capture.start()
    capture.dispose()
    expect(track.stop).toHaveBeenCalledTimes(1)
    await expect(capture.start()).rejects.toThrow('已释放')
    await expect(capture.stop()).rejects.toThrow()
  })
  it('cleans up even when the browser throws while stopping', async () => {
    const capture = new AudioCapture()
    await capture.start()
    FakeRecorder.instances[0].stop.mockImplementation(() => {
      throw new Error('stop failed')
    })
    await expect(capture.stop()).rejects.toThrow('录音中断')
    expect(track.stop).toHaveBeenCalledTimes(1)
  })
  it('releases tracks on dispose even when MediaRecorder.stop throws', async () => {
    const capture = new AudioCapture()
    await capture.start()
    FakeRecorder.instances[0].stop.mockImplementation(() => {
      throw new Error('stop failed')
    })
    expect(() => capture.dispose()).not.toThrow()
    expect(track.stop).toHaveBeenCalledTimes(1)
  })
  it.each(['pause', 'resume'] as const)('cleans up when the encoder rejects %s', async (action) => {
    const interrupted = vi.fn()
    const capture = new AudioCapture(interrupted)
    await capture.start()
    if (action === 'resume') capture.pause()
    FakeRecorder.instances[0][action].mockImplementation(() => {
      throw new Error('encoder failed')
    })
    expect(() => capture[action]()).toThrow('录音中断')
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(interrupted).toHaveBeenCalledTimes(1)
    await expect(capture.stop()).rejects.toThrow('录音中断')
  })
  it('releases a stream if permission resolves after disposal', async () => {
    let resolveStream!: (stream: MediaStream) => void
    media.mockReturnValue(
      new Promise<MediaStream>((resolve) => {
        resolveStream = resolve
      }),
    )
    const capture = new AudioCapture()
    const starting = capture.start()
    capture.dispose()
    resolveStream(stream)
    await expect(starting).rejects.toThrow('已取消')
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(FakeRecorder.instances).toHaveLength(0)
  })
  it.each([
    ['NotAllowedError', '麦克风权限'],
    ['NotFoundError', '麦克风设备'],
    ['NotReadableError', '麦克风被占用'],
    ['UnknownError', '无法启动录音'],
  ])('explains permission and device failures: %s', async (name, message) => {
    media.mockRejectedValue(new DOMException('browser failure', name))
    await expect(new AudioCapture().start()).rejects.toThrow(message)
  })
  it('requires HTTPS and recording support', async () => {
    vi.stubGlobal('isSecureContext', false)
    await expect(new AudioCapture().start()).rejects.toThrow('HTTPS')
    vi.stubGlobal('isSecureContext', true)
    vi.stubGlobal('MediaRecorder', undefined)
    await expect(new AudioCapture().start()).rejects.toThrow('浏览器')
  })
  it('uses browser-selected encoding when preferred MIME types are unavailable', async () => {
    FakeRecorder.isTypeSupported.mockReturnValue(false)
    const capture = new AudioCapture()
    capture.pause()
    capture.resume()
    await expect(capture.stop()).rejects.toThrow('尚未开始')
    await capture.start()
    await expect(capture.start()).rejects.toThrow('已经开始')
    capture.resume()
    expect((await capture.stop()).mimeType).toBe('audio/webm')
  })
})
