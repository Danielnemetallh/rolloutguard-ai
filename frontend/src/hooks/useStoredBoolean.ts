import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'

function readStoredBoolean(storageKey: string, fallback: boolean) {
  try {
    const value = localStorage.getItem(storageKey)
    if (value === 'true') return true
    if (value === 'false') return false
    return fallback
  } catch {
    return fallback
  }
}

export function useStoredBoolean(
  storageKey: string,
  fallback: boolean,
): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [value, setValue] = useState(() => readStoredBoolean(storageKey, fallback))
  const update = useCallback<Dispatch<SetStateAction<boolean>>>(
    (nextValue) => {
      setValue((current) => {
        const resolved =
          typeof nextValue === 'function' ? nextValue(current) : nextValue
        try {
          localStorage.setItem(storageKey, String(resolved))
        } catch {
          // The in-memory preference remains usable when browser storage is unavailable.
        }
        return resolved
      })
    },
    [storageKey],
  )
  return [value, update]
}
