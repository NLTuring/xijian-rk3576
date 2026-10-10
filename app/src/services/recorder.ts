export interface CaptureResult {
  blob: Blob
  durationSeconds: number
  mimeType: string
}
type Phase = 'idle' | 'starting' | 'recording' | 'paused' | 'stopping' | 'complete'

/** Foreground capture only. Browser background/lock-screen recording is not guaranteed. */
export class AudioCapture {
  private recorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private phase: Phase = 'idle'
  private disposed = false
  private chunks: Blob[] = []
  private elapsedMs = 0
  private activeSince: number | null = null
  private completion: Promise<CaptureResult> | null = null
  private resolveCompletion: ((result: CaptureResult) => void) | null = null
  private rejectCompletion: ((error: Error) => void) | null = null
  private failure: Error | null = null

  constructor(private readonly onInterrupted?: () => void) {}

  async start(): Promise<void> {
    if (this.disposed) throw new Error('录音资源已释放，请重新开始。')
    if (!['idle', 'complete'].includes(this.phase)) throw new Error('录音已经开始。')
    if (globalThis.isSecureContext === false)
      throw new Error('录音需要 HTTPS 安全连接，或本机 localhost 环境。')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
      throw new Error('当前浏览器不支持麦克风录音，请使用新版浏览器。')
    if (this.recorder) {
      this.recorder.ondataavailable = null
      this.recorder.onstop = null
      this.recorder.onerror = null
    }
    this.phase = 'starting'
    this.failure = null
    this.chunks = []
    this.elapsedMs = 0
    this.activeSince = null
    this.completion = null
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      })
      if (this.disposed) {
        stream.getTracks().forEach((track) => track.stop())
        throw new Error('录音启动已取消。')
      }
      this.stream = stream
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      )
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      this.recorder = recorder
      this.completion = new Promise((resolve, reject) => {
        this.resolveCompletion = resolve
        this.rejectCompletion = reject
      })
      // Errors may arrive before the UI asks for stop(); retain the error without an unhandled rejection.
      void this.completion.catch(() => undefined)
      recorder.ondataavailable = (event) => {
        if (event.data.size) this.chunks.push(event.data)
      }
      recorder.onstop = () => this.finished()
      recorder.onerror = () => this.failed()
      stream.getTracks().forEach((track) => track.addEventListener('ended', this.interrupted))
      recorder.start(1000)
      this.activeSince = performance.now()
      this.phase = 'recording'
    } catch (error) {
      this.releaseTracks()
      this.phase = 'idle'
      if (this.disposed) throw new Error('录音启动已取消。')
      const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : ''
      const messages: Record<string, string> = {
        NotAllowedError: '没有麦克风权限，请在浏览器设置中允许后重试。',
        NotFoundError: '没有找到可用的麦克风设备。',
        NotReadableError: '麦克风被占用或暂时不可用，请关闭其他录音应用后重试。',
      }
      const failure = new Error(messages[name] ?? '无法启动录音，请检查麦克风后重试。')
      this.rejectCompletion?.(failure)
      throw failure
    }
  }

  pause(): void {
    if (this.phase !== 'recording' || this.disposed) return
    try {
      this.recorder!.pause()
    } catch {
      this.failed()
      throw this.failure
    }
    this.freezeClock()
    this.phase = 'paused'
  }

  resume(): void {
    if (this.phase !== 'paused' || this.disposed) return
    try {
      this.recorder!.resume()
    } catch {
      this.failed()
      throw this.failure
    }
    this.activeSince = performance.now()
    this.phase = 'recording'
  }

  stop(): Promise<CaptureResult> {
    if (this.disposed) return Promise.reject(new Error('录音资源已释放。'))
    if (!this.completion) return Promise.reject(new Error('录音尚未开始。'))
    if (this.phase === 'recording' || this.phase === 'paused') {
      this.freezeClock()
      this.phase = 'stopping'
      try {
        this.recorder!.stop()
      } catch {
        this.failed()
      }
      this.releaseTracks()
    }
    return this.completion
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.freezeClock()
    if (this.recorder) {
      this.recorder.ondataavailable = null
      this.recorder.onerror = null
      this.recorder.onstop = null
      try {
        if (this.recorder.state !== 'inactive') this.recorder.stop()
      } catch {
        /* Releasing tracks below remains necessary if the encoder failed. */
      }
    }
    this.releaseTracks()
    this.rejectCompletion?.(new Error('录音已取消并释放资源。'))
    this.chunks = []
  }

  private freezeClock(): void {
    if (this.activeSince === null) return
    this.elapsedMs += Math.max(0, performance.now() - this.activeSince)
    this.activeSince = null
  }

  private releaseTracks(): void {
    this.stream?.getTracks().forEach((track) => {
      track.removeEventListener('ended', this.interrupted)
      track.stop()
    })
    this.stream = null
  }

  private interrupted = (): void => {
    if (this.disposed || !['recording', 'paused'].includes(this.phase)) return
    void this.stop().catch(() => undefined)
    this.onInterrupted?.()
  }

  private failed(): void {
    if (this.failure || this.disposed) return
    this.failure = new Error('录音中断，请检查麦克风后重新录制。')
    this.freezeClock()
    this.phase = 'complete'
    try {
      if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop()
    } catch {
      /* The stream is released regardless of recorder state. */
    }
    this.releaseTracks()
    this.rejectCompletion?.(this.failure)
    this.onInterrupted?.()
  }

  private finished(): void {
    const unexpected = this.phase === 'recording' || this.phase === 'paused'
    this.freezeClock()
    this.releaseTracks()
    this.phase = 'complete'
    if (this.failure || this.disposed) return
    const mimeType = this.recorder!.mimeType || this.chunks[0]?.type || 'audio/webm'
    this.resolveCompletion?.({
      blob: new Blob(this.chunks, { type: mimeType }),
      durationSeconds: this.elapsedMs / 1000,
      mimeType,
    })
    if (unexpected) this.onInterrupted?.()
  }
}
