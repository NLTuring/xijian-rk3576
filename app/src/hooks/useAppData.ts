import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppData } from '../domain/types'
import { createInitialData } from '../domain/data'
import { loadData, saveData } from '../services/storage'

export function useAppData() {
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState('')
  const current = useRef<AppData | null>(null)
  const queue = useRef(Promise.resolve())
  const reload = useCallback(async () => {
    setError('')
    try {
      const value = (await loadData()) ?? createInitialData()
      current.current = value
      setData(value)
    } catch (e) {
      setError(e instanceof Error ? e.message : '无法读取本地数据。')
    }
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])
  const persist = useCallback((mutate: (previous: AppData) => AppData): Promise<void> => {
    const operation = queue.current.then(async () => {
      if (!current.current) throw new Error('数据尚未准备好。')
      const next = mutate(current.current)
      await saveData(next)
      current.current = next
      setData(next)
    })
    queue.current = operation.catch(() => undefined)
    return operation
  }, [])
  return { data, error, persist, reload }
}
