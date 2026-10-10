import type { AppData } from '../domain/types'

const databaseName = 'xijian-private'
const storeNames = ['keys', 'records', 'audio'] as const
type StoreName = (typeof storeNames)[number]
interface EncryptedRecord {
  iv: Uint8Array<ArrayBuffer>
  bytes: ArrayBuffer
  mime?: string
}

// The nonextractable key lives in this origin's IndexedDB. This protects the
// stored payload format, not against same-origin JavaScript or an unlocked device.
// No health data is written to localStorage or sent over a network here.
let operationQueue: Promise<void> = Promise.resolve()
function queued<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(operation)
  operationQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      for (const name of storeNames) request.result.createObjectStore(name)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('无法打开本地存储，请检查浏览器存储权限。'))
    request.onblocked = () =>
      reject(new Error('本地存储正在被其他页面占用，请关闭其他息间页面后重试。'))
  })
}

async function withDatabase<T>(operation: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openDatabase()
  try {
    return await operation(db)
  } finally {
    db.close()
  }
}

function read<T>(db: IDBDatabase, store: StoreName, id: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const request = tx.objectStore(store).get(id)
    tx.oncomplete = () => resolve(request.result as T | undefined)
    tx.onabort = () => reject(new Error('读取本地数据失败，请重试。'))
    tx.onerror = () => reject(new Error('读取本地数据失败，请重试。'))
  })
}

function write(
  db: IDBDatabase,
  store: StoreName,
  id: string,
  value?: EncryptedRecord,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    if (value === undefined) tx.objectStore(store).delete(id)
    else tx.objectStore(store).put(value, id)
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(new Error('保存本地数据失败，可能是存储空间不足。'))
    tx.onerror = () => reject(new Error('保存本地数据失败，可能是存储空间不足。'))
  })
}

async function encryptionKey(db: IDBDatabase, create: boolean): Promise<CryptoKey> {
  const existing = await read<CryptoKey>(db, 'keys', 'aes-gcm')
  if (existing) return existing
  if (!create) throw new Error('本地加密密钥缺失，现有数据已保留，无法解密。')
  const candidate = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ])
  return new Promise((resolve, reject) => {
    // A readwrite transaction chooses one key even when two tabs start together.
    const tx = db.transaction([...storeNames], 'readwrite')
    const keys = tx.objectStore('keys')
    const request = keys.get('aes-gcm')
    let selected = candidate
    request.onsuccess = () => {
      if (request.result) {
        selected = request.result as CryptoKey
        return
      }
      const records = tx.objectStore('records').count()
      records.onsuccess = () => {
        const audio = tx.objectStore('audio').count()
        audio.onsuccess = () => {
          if (records.result || audio.result) {
            tx.abort()
            return
          }
          keys.put(candidate, 'aes-gcm')
        }
      }
    }
    tx.oncomplete = () => resolve(selected)
    tx.onabort = () => reject(new Error('无法创建本地密钥，现有数据已保留。'))
    tx.onerror = () => reject(new Error('无法保存本地加密密钥。'))
  })
}

async function encrypt(db: IDBDatabase, id: string, bytes: ArrayBuffer): Promise<EncryptedRecord> {
  const key = await encryptionKey(db, true)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(id) },
    key,
    bytes,
  )
  return { iv, bytes: encrypted }
}

async function decrypt(db: IDBDatabase, id: string, record: EncryptedRecord): Promise<ArrayBuffer> {
  const key = await encryptionKey(db, false)
  try {
    return await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: record.iv, additionalData: new TextEncoder().encode(id) },
      key,
      record.bytes,
    )
  } catch {
    throw new Error('本地数据无法解密，可能已损坏；原始记录已保留。')
  }
}

type Rule = (value: unknown) => boolean
const recordObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const text: Rule = (value) => typeof value === 'string' && value.length <= 10_000
const flag: Rule = (value) => typeof value === 'boolean'
const nonnegative: Rule = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
const count: Rule = (value) => nonnegative(value) && Number.isInteger(value)
const oneOf =
  (...choices: unknown[]): Rule =>
  (value) =>
    choices.includes(value)
const optional =
  (rule: Rule): Rule =>
  (value) =>
    value === undefined || rule(value)
const nullable =
  (rule: Rule): Rule =>
  (value) =>
    value === null || rule(value)
const array =
  (rule: Rule): Rule =>
  (value) =>
    Array.isArray(value) && value.every(rule)
const shape =
  (fields: Record<string, Rule>): Rule =>
  (value) =>
    recordObject(value) && Object.entries(fields).every(([key, rule]) => rule(value[key]))
const clock: Rule = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
const date: Rule = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
const event = shape({
  id: text,
  nightId: text,
  kind: oneOf('cough', 'wheeze'),
  offsetMinutes: nonnegative,
  durationSeconds: nonnegative,
  time: clock,
  favorite: flag,
  audioId: text,
  feedback: optional(oneOf('incorrect')),
  audioDeleted: optional(flag),
  offline: optional(flag),
})
const night = shape({
  id: text,
  date,
  startTime: clock,
  endTime: clock,
  totalMinutes: nonnegative,
  validMinutes: nonnegative,
  coughCount: nullable(count),
  wheezeCount: nullable(count),
  events: array(event),
  source: oneOf('demo', 'live'),
  analysis: oneOf('complete', 'pending'),
  captureAudioId: optional(text),
  captureDeleted: optional(flag),
  gaps: array(shape({ startMinute: nonnegative, endMinute: nonnegative, reason: text })),
})
const note = shape({
  nightId: text,
  medication: oneOf('as-planned', 'changed', 'unrecorded'),
  symptom: oneOf('none', 'mild', 'obvious'),
  text,
  updatedAt: text,
})
const appData = shape({
  version: oneOf(1),
  mode: oneOf('demo', 'live'),
  nights: array(night),
  notes: (value) => recordObject(value) && Object.values(value).every(note),
  retentionDays: (value) => count(value) && Number(value) >= 1 && Number(value) <= 3650,
  deviceUrl: text,
})

function validateData(value: unknown): asserts value is AppData {
  if (!appData(value)) throw new Error('本地数据格式不受支持或已损坏，原始记录已保留。')
  const data = value as AppData
  const validBounds = data.nights.every(
    (n) =>
      n.validMinutes <= n.totalMinutes &&
      n.events.every((e) => e.nightId === n.id && e.offsetMinutes <= n.totalMinutes) &&
      n.gaps.every((g) => g.startMinute <= g.endMinute && g.endMinute <= n.totalMinutes),
  )
  if (!validBounds) throw new Error('本地记录的时间范围无效，原始记录已保留。')
}

/** Returns null only when no saved state exists; corrupted state is never reset. */
export function loadData(): Promise<AppData | null> {
  return queued(() =>
    withDatabase(async (db) => {
      const record = await read<EncryptedRecord>(db, 'records', 'app')
      if (!record) return null
      const bytes = await decrypt(db, 'app', record)
      let data: unknown
      try {
        data = JSON.parse(new TextDecoder().decode(bytes))
      } catch {
        throw new Error('本地数据无法读取，原始记录已保留。')
      }
      validateData(data)
      return data
    }),
  )
}

export function saveData(data: AppData): Promise<void> {
  // Capture the state at call time, so a later UI mutation cannot change a queued save.
  let snapshot: string
  try {
    validateData(data)
    snapshot = JSON.stringify(data)
  } catch (error) {
    return Promise.reject(error)
  }
  return queued(() =>
    withDatabase(async (db) => {
      const record = await encrypt(db, 'app', new TextEncoder().encode(snapshot).buffer)
      await write(db, 'records', 'app', record)
    }),
  )
}

async function blobBytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new Error('无法读取声音片段。'))
    reader.readAsArrayBuffer(blob)
  })
}

export function saveAudio(id: string, blob: Blob): Promise<void> {
  return queued(() =>
    withDatabase(async (db) => {
      const encrypted = await encrypt(db, `audio:${id}`, await blobBytes(blob))
      await write(db, 'audio', id, { ...encrypted, mime: blob.type })
    }),
  )
}

export function loadAudio(id: string): Promise<Blob | null> {
  return queued(() =>
    withDatabase(async (db) => {
      const record = await read<EncryptedRecord>(db, 'audio', id)
      if (!record) return null
      return new Blob([await decrypt(db, `audio:${id}`, record)], { type: record.mime })
    }),
  )
}

export function deleteAudio(id: string): Promise<void> {
  return queued(() => withDatabase((db) => write(db, 'audio', id)))
}

export function clearAll(): Promise<void> {
  return queued(() =>
    withDatabase(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction([...storeNames], 'readwrite')
          for (const name of storeNames) tx.objectStore(name).clear()
          tx.oncomplete = () => resolve()
          tx.onabort = () => reject(new Error('未能清除本地数据，请重试。'))
          tx.onerror = () => reject(new Error('未能清除本地数据，请重试。'))
        }),
    ),
  )
}
