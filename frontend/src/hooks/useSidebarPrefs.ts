import { useCallback, useEffect, useState } from 'react'

export const NAV_COLLAPSED_KEY = 'rolloutguard.sidebar.navigation.collapsed'
export const AGENT_COLLAPSED_KEY = 'rolloutguard.sidebar.agent.collapsed'
export const DESKTOP_MIN_PX = 1280

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === 'true') return true
    if (raw === 'false') return false
  } catch {
    /* private mode */
  }
  return fallback
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    /* private mode */
  }
}

function isDesktopWidth() {
  return typeof window !== 'undefined' && window.matchMedia(`(min-width: ${DESKTOP_MIN_PX}px)`).matches
}

export function useSidebarPrefs() {
  const [navCollapsed, setNavCollapsed] = useState(() =>
    isDesktopWidth() ? readFlag(NAV_COLLAPSED_KEY, false) : true,
  )
  const [agentCollapsed, setAgentCollapsed] = useState(() => readFlag(AGENT_COLLAPSED_KEY, true))
  const [desktop, setDesktop] = useState(isDesktopWidth)

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_MIN_PX}px)`)
    const sync = () => {
      const wide = mq.matches
      setDesktop(wide)
      if (wide) {
        setNavCollapsed(readFlag(NAV_COLLAPSED_KEY, false))
        setAgentCollapsed(readFlag(AGENT_COLLAPSED_KEY, true))
      } else {
        setNavCollapsed(true)
      }
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const toggleNav = useCallback(() => {
    setNavCollapsed((prev) => {
      const next = !prev
      writeFlag(NAV_COLLAPSED_KEY, next)
      return next
    })
  }, [])

  const toggleAgent = useCallback(() => {
    setAgentCollapsed((prev) => {
      const next = !prev
      writeFlag(AGENT_COLLAPSED_KEY, next)
      return next
    })
  }, [])

  return { navCollapsed, agentCollapsed, desktop, toggleNav, toggleAgent }
}
