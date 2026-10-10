import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkDevice, validateDeviceUrl } from './device'

const healthy = {
  deviceId: 'rk-lab-01',
  name: '卧室设备',
  model: 'RK3576',
  apiVersion: '1',
  status: 'ready',
  modelReady: true,
}
const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('local device address validation', () => {
  it.each([
    [' https://192.168.1.20:8443/ ', 'https://192.168.1.20:8443'],
    ['https://10.0.0.1', 'https://10.0.0.1'],
    ['https://172.16.0.1', 'https://172.16.0.1'],
    ['https://172.31.255.254', 'https://172.31.255.254'],
    ['https://bedroom.local', 'https://bedroom.local'],
    ['https://[fd12::1]', 'https://[fd12::1]'],
    ['http://localhost:8000', 'http://localhost:8000'],
    ['http://127.0.0.1:8000', 'http://127.0.0.1:8000'],
    ['http://[::1]:8000', 'http://[::1]:8000'],
  ])('normalizes %s', (input, expected) => expect(validateDeviceUrl(input)).toBe(expected))
  it.each([
    '',
    '192.168.1.1',
    'http://192.168.1.1',
    'https://8.8.8.8',
    'https://172.32.0.1',
    'https://172.15.0.1',
    'https://example.com',
    'https://192.168.1.1.example.com',
    'https://rk.local.evil.com',
    'https://user:secret@192.168.1.1',
    'https://@192.168.1.1',
    'https://192.168.1.1/api',
    'https://192.168.1.1?token=x',
    'https://192.168.1.1#x',
    'https://192.168.1.1/a/..',
    'ftp://192.168.1.1',
    'https://[2001:4860:4860::8888]',
    'https://-bedroom.local',
  ])('rejects unsafe or malformed address %s', (input) =>
    expect(() => validateDeviceUrl(input)).toThrow(),
  )
})

describe('device health protocol', () => {
  it('fetches only the health endpoint and returns a validated device', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(healthy))
    vi.stubGlobal('fetch', fetcher)
    expect(await checkDevice('https://192.168.1.20')).toEqual(healthy)
    expect(fetcher).toHaveBeenCalledWith(
      'https://192.168.1.20/api/v1/health',
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      }),
    )
  })
  it('accepts busy and model-unavailable states as real device status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ ...healthy, status: 'busy', modelReady: false })),
    )
    expect((await checkDevice('https://bedroom.local')).modelReady).toBe(false)
  })
  it.each([
    null,
    [],
    {},
    { ...healthy, model: 'RK3588' },
    { ...healthy, apiVersion: 1 },
    { ...healthy, status: 'ok' },
    { ...healthy, status: ['ready'] },
    { ...healthy, modelReady: 'true' },
    { ...healthy, name: '' },
    { ...healthy, deviceId: 42 },
  ])('rejects malformed payload %#', async (payload) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(payload)))
    await expect(checkDevice('https://bedroom.local')).rejects.toThrow('设备返回的数据格式不正确')
  })
  it('rejects failed HTTP, HTML pages and invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 503)))
    await expect(checkDevice('https://bedroom.local')).rejects.toThrow('503')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html/>')))
    await expect(checkDevice('https://bedroom.local')).rejects.toThrow('JSON')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('{broken', { headers: { 'Content-Type': 'application/json' } }),
        ),
    )
    await expect(checkDevice('https://bedroom.local')).rejects.toThrow('JSON')
  })
  it('reports networking failures without exposing opaque fetch errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(checkDevice('https://bedroom.local')).rejects.toThrow('无法连接设备')
  })
  it('aborts after five seconds', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal!.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            )
          }),
      ),
    )
    const check = checkDevice('https://bedroom.local')
    const assertion = expect(check).rejects.toThrow('连接超时')
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
  })
  it('honors cancellation before and during a request', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetcher = vi.fn(
      (_url, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    vi.stubGlobal('fetch', fetcher)
    await expect(checkDevice('https://bedroom.local', controller.signal)).rejects.toThrow('已取消')
    expect(fetcher).not.toHaveBeenCalled()
    const active = new AbortController()
    const check = checkDevice('https://bedroom.local', active.signal)
    const assertion = expect(check).rejects.toThrow('已取消')
    active.abort()
    await assertion
  })
})
