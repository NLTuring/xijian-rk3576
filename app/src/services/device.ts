export interface DeviceStatus {
  deviceId: string
  name: string
  model: 'RK3576'
  apiVersion: '1'
  status: 'ready' | 'busy'
  modelReady: boolean
}

/** Only local origins are accepted. Browser DNS resolution still needs a trusted LAN. */
export function validateDeviceUrl(input: string): string {
  const address = input.trim()
  let url: URL
  try {
    url = new URL(address)
  } catch {
    throw new Error('请输入完整设备地址，例如 https://192.168.1.20。')
  }
  if (url.username || url.password || address.includes('@'))
    throw new Error('设备地址不能包含用户名或密码。')
  if (url.pathname !== '/' || !/^https?:\/\/[^/?#\\]+\/?$/i.test(address))
    throw new Error('只需填写 HTTPS 设备地址和端口，不要包含路径、查询参数或片段。')
  const host = url.hostname.toLowerCase()
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(host)
  const parts = host.split('.').map(Number)
  const ipv4 =
    /^\d+\.\d+\.\d+\.\d+$/.test(host) &&
    parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) &&
    (parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168))
  const ipv6 = /^\[(?:f[cd][0-9a-f]{2}|fe[89ab][0-9a-f]):/i.test(host)
  const localName =
    host.endsWith('.local') &&
    host.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
  if (!(loopback || ipv4 || ipv6 || localName))
    throw new Error('请使用局域网私有 IP 或以 .local 结尾的设备名称。')
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
    throw new Error('设备必须使用 HTTPS；HTTP 仅供本机 localhost 开发。')
  return url.origin
}

function parseStatus(value: unknown): DeviceStatus {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('设备返回的数据格式不正确。')
  const status = value as Record<string, unknown>
  if (
    typeof status.deviceId !== 'string' ||
    !status.deviceId.trim() ||
    status.deviceId.length > 128 ||
    typeof status.name !== 'string' ||
    !status.name.trim() ||
    status.name.length > 128 ||
    status.model !== 'RK3576' ||
    status.apiVersion !== '1' ||
    (status.status !== 'ready' && status.status !== 'busy') ||
    typeof status.modelReady !== 'boolean'
  ) {
    throw new Error('设备返回的数据格式不正确，请确认 RK3576 固件支持 API v1。')
  }
  return {
    deviceId: status.deviceId,
    name: status.name,
    model: 'RK3576',
    apiVersion: '1',
    status: status.status as DeviceStatus['status'],
    modelReady: status.modelReady,
  }
}

/** Health check only: does not upload audio, initiate inference, or authenticate pairing. */
export async function checkDevice(input: string, signal?: AbortSignal): Promise<DeviceStatus> {
  const origin = validateDeviceUrl(input)
  if (signal?.aborted) throw new Error('设备连接检查已取消。')
  const controller = new AbortController()
  let timedOut = false
  const cancel = () => controller.abort()
  signal?.addEventListener('abort', cancel, { once: true })
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, 5000)
  try {
    let response: Response
    try {
      response = await fetch(`${origin}/api/v1/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
      })
    } catch {
      if (timedOut) throw new Error('设备连接超时，请确认设备和手机处于同一局域网。')
      if (signal?.aborted) throw new Error('设备连接检查已取消。')
      throw new Error('无法连接设备，请检查地址、HTTPS 证书和局域网权限。')
    }
    if (!response.ok) throw new Error(`设备暂时无法响应（HTTP ${response.status}）。`)
    if (!response.headers.get('Content-Type')?.toLowerCase().includes('application/json'))
      throw new Error('设备没有返回 JSON，请确认设备服务地址。')
    let body: unknown
    try {
      body = await response.json()
    } catch {
      if (timedOut) throw new Error('设备连接超时，请重试。')
      if (signal?.aborted) throw new Error('设备连接检查已取消。')
      throw new Error('设备返回的 JSON 无法读取。')
    }
    return parseStatus(body)
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', cancel)
  }
}
