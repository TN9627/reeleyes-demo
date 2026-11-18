/**
 * Tab + push navigation over hash routes, like the iOS TabView with a NavigationStack per tab.
 *
 *   const nav = useNav()
 *   nav.push(`/spot/${id}`)      push a Spot (or `/spot/${id}/prep`) onto the current tab's stack
 *   nav.back()                   pop one level (the back button; also the browser's back)
 *   nav.selectTab('saved')       switch tabs, restoring that tab's stack; the active tab pops to its root
 *   nav.tab                      the tab the current stack belongs to
 *   const { isTop, depth } = useLayer()   the screen's place in its stack (depth 0 = tab root)
 *
 * Spot, Prep and Verdict read their id with react-router's `useParams()` (`/spot/:id`, `/spot/:id/prep`,
 * `/spot/:id/prep/verdict`).
 */

import { createContext, useContext } from 'react'
import { useLocation, useNavigate } from 'react-router'

export type Tab = 'today' | 'saved' | 'license'

export const tabRoots: Record<Tab, string> = { today: '/', saved: '/saved', license: '/license' }

export function tabForRoot(pathname: string): Tab | null {
  for (const tab of Object.keys(tabRoots) as Tab[]) if (tabRoots[tab] === pathname) return tab
  return null
}

/** The paths of a stack, root first: `/spot/3/prep` on Today → `/`, `/spot/3`, `/spot/3/prep`. */
export function stackFor(pathname: string, tab: Tab): string[] {
  if (tabForRoot(pathname)) return [pathname]
  const verdict = pathname.match(/^\/spot\/([^/]+)\/prep\/verdict$/)
  if (verdict) return [tabRoots[tab], `/spot/${verdict[1]}`, `/spot/${verdict[1]}/prep`, pathname]
  const prep = pathname.match(/^\/spot\/([^/]+)\/prep$/)
  if (prep) return [tabRoots[tab], `/spot/${prep[1]}`, pathname]
  const spot = pathname.match(/^\/spot\/([^/]+)$/)
  if (spot) return [tabRoots[tab], pathname]
  return [tabRoots[tab]]
}

/** Shell-owned memory: which tab is showing and each tab's last path. */
export const navMemory = {
  tab: (sessionStorage.getItem('reeleyes.tab') as Tab | null) ?? 'today',
  tabPaths: { today: '/', saved: '/saved', license: '/license' } as Record<Tab, string>,
  /** history.state.idx → pathname, to tell whether "back" is the previous entry. */
  pathAtIndex: new Map<number, string>(),
}

export function historyIndex(): number {
  return (window.history.state as { idx?: number } | null)?.idx ?? 0
}

export interface Nav {
  tab: Tab
  pathname: string
  push(path: string): void
  back(): void
  selectTab(tab: Tab): void
}

export function useNav(): Nav {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const tab = navMemory.tab
  return {
    tab,
    pathname,
    push: (path) => navigate(path),
    back: () => {
      const stack = stackFor(pathname, tab)
      const parent = stack.at(-2)
      if (!parent) return
      const index = historyIndex()
      if (index > 0 && navMemory.pathAtIndex.get(index - 1) === parent) navigate(-1)
      else navigate(parent, { replace: true })
    },
    selectTab: (next) => {
      if (next === tab) {
        if (pathname !== tabRoots[next]) navigate(tabRoots[next], { replace: true })
        else window.dispatchEvent(new CustomEvent('reeleyes:scroll-to-top', { detail: tabRoots[next] }))
        return
      }
      navMemory.tab = next
      sessionStorage.setItem('reeleyes.tab', next)
      navigate(navMemory.tabPaths[next], { replace: true })
    },
  }
}

export interface Layer {
  /** The screen's own path (`/spot/3` while Prep sits on it). */
  path: string
  /** 0 for a tab root. */
  depth: number
  /** The visible, interactive screen. */
  isTop: boolean
}

export const LayerContext = createContext<Layer>({ path: '/', depth: 0, isTop: true })

export function useLayer(): Layer {
  return useContext(LayerContext)
}
