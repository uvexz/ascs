import { useEffect, useState } from 'react'

/**
 * Delays fast-changing input (search boxes) before it reaches a query key.
 * Without it every keystroke becomes its own cache entry and its own request,
 * and paginated lists unmount into a loading state on each character.
 */
export function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
