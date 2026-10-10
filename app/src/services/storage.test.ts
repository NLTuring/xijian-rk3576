import { beforeEach, describe, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import { Blob as NodeBlob } from 'node:buffer'
import type { AppData } from '../domain/types'
import { createInitialData } from '../domain/data'
import { clearAll, deleteAudio, loadAudio, loadData, saveAudio, saveData } from './storage'

Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })

async function rawRecord(
  store: string,
  id: string,
  mutation?: { value: unknown } | { remove: true },
): Promise<unknown> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('xijian-private', 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, mutation ? 'readwrite' : 'readonly')
      const objectStore = tx.objectStore(store)
      const request = mutation
        ? 'remove' in mutation
          ? objectStore.delete(id)
          : objectStore.put(mutation.value, id)
        : objectStore.get(id)
      tx.oncomplete = () => resolve(request.result)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

async function encryptedFixture(payload: string): Promise<void> {
  const key = (await rawRecord('keys', 'aes-gcm')) as CryptoKey
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const bytes = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('app') },
    key,
    new TextEncoder().encode(payload),
  )
  await rawRecord('records', 'app', { value: { iv, bytes } })
}

describe('encrypted local persistence', () => {
  beforeEach(async () => {
    await clearAll()
  })
  it('returns no data on a new installation', async () => {
    expect(await loadData()).toBeNull()
  })
  it('roundtrips state and replaces it atomically', async () => {
    const state = createInitialData()
    await saveData(state)
    expect(await loadData()).toEqual(state)
    state.retentionDays = 7
    await saveData(state)
    expect((await loadData())?.retentionDays).toBe(7)
  })
  it('roundtrips audio and removes it independently of summaries', async () => {
    const blob = new Blob(['local audio'], { type: 'audio/webm' })
    await saveAudio('sample', blob)
    const restored = await loadAudio('sample')
    expect(restored?.type).toBe('audio/webm')
    expect(restored?.size).toBe(blob.size)
    await deleteAudio('sample')
    expect(await loadAudio('sample')).toBeNull()
  })
  it('clears all stored records and clips', async () => {
    await saveData(createInitialData())
    await saveAudio('sample', new Blob(['audio']))
    await clearAll()
    expect(await loadData()).toBeNull()
    expect(await loadAudio('sample')).toBeNull()
  })
  it('stores authenticated ciphertext with fresh IVs and a nonextractable persistent key', async () => {
    const data = createInitialData()
    await saveData(data)
    const first = (await rawRecord('records', 'app')) as { bytes: ArrayBuffer; iv: Uint8Array }
    expect(new TextDecoder().decode(first.bytes)).not.toContain('coughCount')
    const key = (await rawRecord('keys', 'aes-gcm')) as CryptoKey
    expect(key.extractable).toBe(false)
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow()
    await saveData(data)
    const second = (await rawRecord('records', 'app')) as { iv: Uint8Array }
    expect(second.iv).not.toEqual(first.iv)
    const reloaded = await import('./storage')
    expect(await reloaded.loadData()).toEqual(data)
    expect(localStorage.length).toBe(0)
  })
  it('preserves damaged ciphertext and can recover after an explicit later save', async () => {
    const data = createInitialData()
    await saveData(data)
    const record = (await rawRecord('records', 'app')) as { bytes: ArrayBuffer; iv: Uint8Array }
    new Uint8Array(record.bytes)[0] ^= 0xff
    await rawRecord('records', 'app', { value: record })
    await expect(loadData()).rejects.toThrow('无法解密')
    expect(await rawRecord('records', 'app')).toEqual(record)
    await saveData(data)
    expect(await loadData()).toEqual(data)
  })
  it('rejects a moved audio ciphertext because authentication includes its ID', async () => {
    await saveAudio('first', new Blob(['private clip']))
    await rawRecord('audio', 'second', { value: await rawRecord('audio', 'first') })
    await expect(loadAudio('second')).rejects.toThrow('无法解密')
    expect((await loadAudio('first'))?.size).toBe(12)
  })
  it('does not generate a replacement key when encrypted data lost its key', async () => {
    await saveData(createInitialData())
    await rawRecord('keys', 'aes-gcm', { remove: true })
    await expect(loadData()).rejects.toThrow('密钥缺失')
    await expect(saveData(createInitialData())).rejects.toThrow('无法创建本地密钥')
    expect(await rawRecord('records', 'app')).toBeDefined()
    expect(await rawRecord('keys', 'aes-gcm')).toBeUndefined()
  })
  it('validates decrypted JSON and rejects unsupported versions without wiping it', async () => {
    await saveData(createInitialData())
    await encryptedFixture('{broken')
    await expect(loadData()).rejects.toThrow('无法读取')
    await encryptedFixture(JSON.stringify({ ...createInitialData(), version: 999 }))
    await expect(loadData()).rejects.toThrow('格式不受支持')
    expect(await rawRecord('records', 'app')).toBeDefined()
  })
  it('rejects malformed nested records before replacing the prior state', async () => {
    const data = createInitialData()
    await saveData(data)
    const malformed: unknown[] = [
      null,
      [],
      { ...data, nights: {} },
      { ...data, notes: [] },
      { ...data, retentionDays: 0 },
      { ...data, retentionDays: 4000 },
      { ...data, deviceUrl: 1 },
      { ...data, nights: [{ ...data.nights[0], validMinutes: -1 }] },
      { ...data, nights: [{ ...data.nights[0], date: '2026-02-30' }] },
      { ...data, nights: [{ ...data.nights[0], startTime: '24:00' }] },
      { ...data, nights: [{ ...data.nights[0], coughCount: 0.5 }] },
      {
        ...data,
        nights: [{ ...data.nights[0], events: [{ ...data.nights[0].events[0], favorite: 'yes' }] }],
      },
      { ...data, notes: { sample: { nightId: 'sample', medication: 'unknown' } } },
    ]
    for (const value of malformed)
      await expect(saveData(value as AppData)).rejects.toThrow('格式不受支持')
    expect(await loadData()).toEqual(data)
  })
  it('rejects impossible time ranges and cross-night event references', async () => {
    const data = createInitialData()
    for (const n of [
      { ...data.nights[0], validMinutes: 900 },
      { ...data.nights[0], events: [{ ...data.nights[0].events[0], nightId: 'other' }] },
      { ...data.nights[0], events: [{ ...data.nights[0].events[0], offsetMinutes: 900 }] },
      { ...data.nights[0], gaps: [{ startMinute: 200, endMinute: 100, reason: '' }] },
      { ...data.nights[0], gaps: [{ startMinute: 200, endMinute: 900, reason: '' }] },
    ])
      await expect(saveData({ ...data, nights: [n] })).rejects.toThrow('时间范围无效')
  })
  it('preserves pending analysis, notes, feedback and audio deletion flags', async () => {
    const data = createInitialData()
    data.mode = 'live'
    data.nights = [
      {
        ...data.nights[0],
        source: 'live',
        analysis: 'pending',
        coughCount: null,
        wheezeCount: null,
      },
    ]
    data.nights[0].events[0] = {
      ...data.nights[0].events[0],
      feedback: 'incorrect',
      audioDeleted: true,
      offline: false,
    }
    data.notes[data.nights[0].id] = {
      nightId: data.nights[0].id,
      medication: 'changed',
      symptom: 'mild',
      text: '记录',
      updatedAt: '2026-10-04T00:00:00Z',
    }
    await saveData(data)
    expect(await loadData()).toEqual(data)
  })
  it('snapshots queued saves and accepts native Blob.arrayBuffer', async () => {
    const data = createInitialData()
    const saving = saveData(data)
    data.retentionDays = 7
    await saving
    expect((await loadData())?.retentionDays).toBe(30)
    await saveAudio('native', new NodeBlob(['native'], { type: 'audio/wav' }) as Blob)
    expect((await loadAudio('native'))?.size).toBe(6)
  })
})
