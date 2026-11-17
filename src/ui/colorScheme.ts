import { useSyncExternalStore } from 'react'
import { useAppState } from '../state/appState'

const query = window.matchMedia('(prefers-color-scheme: dark)')

function subscribe(listener: () => void) {
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

/** The appearance on screen: the Appearance menu's pick, or the system's. */
export function useColorScheme(): 'light' | 'dark' {
  const systemDark = useSyncExternalStore(subscribe, () => query.matches)
  const appearance = useAppState((s) => s.appearance)
  if (appearance === 'system') return systemDark ? 'dark' : 'light'
  return appearance
}
