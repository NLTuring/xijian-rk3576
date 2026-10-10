import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialData } from '../domain/data'
import { enforceRetention } from './retention'
import { deleteAudio } from './storage'
vi.mock('./storage', () => ({ deleteAudio: vi.fn(async () => undefined) }))
describe('retention', () => {
  beforeEach(() => vi.clearAllMocks())
  it('keeps demo data and recent live captures unchanged', async () => {
    const data = createInitialData()
    expect(await enforceRetention(data, new Date('2026-10-04T12:00:00'))).toBe(data)
    expect(deleteAudio).not.toHaveBeenCalled()
    data.nights[29] = { ...data.nights[29], source: 'live', captureAudioId: 'live-file' }
    expect(await enforceRetention(data, new Date('2026-10-04T12:00:00'))).toBe(data)
  })
  it('deletes expired ordinary audio and keeps summaries and favorites', async () => {
    const data = createInitialData()
    const night = {
      ...data.nights[0],
      source: 'live' as const,
      captureAudioId: 'raw-1',
      events: data.nights[0].events
        .slice(0, 2)
        .map((e, i) => ({ ...e, audioId: `audio-${i}`, favorite: i === 1, offline: true })),
    }
    data.nights = [night]
    data.retentionDays = 7
    const next = await enforceRetention(data, new Date('2026-10-04T12:00:00'))
    expect(deleteAudio).toHaveBeenCalledWith('raw-1')
    expect(deleteAudio).toHaveBeenCalledWith('audio-0')
    expect(deleteAudio).not.toHaveBeenCalledWith('audio-1')
    expect(next.nights[0].captureDeleted).toBe(true)
    expect(next.nights[0].events[0]).toMatchObject({ audioDeleted: true, offline: false })
    expect(next.nights[0].events[1].audioDeleted).toBeUndefined()
    expect(night.captureDeleted).toBeUndefined()
    expect(next.nights[0].coughCount).toBe(night.coughCount)
    vi.clearAllMocks()
    expect(await enforceRetention(next, new Date('2026-10-04T12:00:00'))).toBe(next)
    expect(deleteAudio).not.toHaveBeenCalled()
  })
  it('surfaces deletion errors without claiming completion', async () => {
    const data = createInitialData()
    data.nights = [{ ...data.nights[0], source: 'live', captureAudioId: 'raw-1' }]
    data.retentionDays = 7
    vi.mocked(deleteAudio).mockRejectedValueOnce(new Error('disk'))
    await expect(enforceRetention(data, new Date('2026-10-04T12:00:00'))).rejects.toThrow('disk')
    expect(data.nights[0].captureDeleted).toBeUndefined()
  })
})
