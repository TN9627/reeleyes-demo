import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createHashRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import LicenseScreen from './screens/LicenseScreen'
import PrepScreen from './screens/PrepScreen'
import SavedScreen from './screens/SavedScreen'
import SpotScreen from './screens/SpotScreen'
import TodayScreen from './screens/TodayScreen'
import WelcomeScreen from './screens/WelcomeScreen'
import { SignInSheet } from './screens/signin/SignInSheet'
import { useAppState } from './state/appState'
import { useColorScheme } from './ui/colorScheme'
import { historyIndex, LayerContext, navMemory, stackFor, tabForRoot, tabRoots, type Tab } from './ui/navigation'
import { SampleDataNote, TabBar } from './ui/TabBar'

const router = createHashRouter([{ path: '*', element: <Shell /> }])

export default function App() {
  return <RouterProvider router={router} />
}

const backgrounds = { light: '#FAF8F3', dark: '#1C1B1A' }

/** The Appearance pick on <html>, and the browser chrome's color with it. */
function useAppearance() {
  const appearance = useAppState((s) => s.appearance)
  const scheme = useColorScheme()
  useEffect(() => {
    const html = document.documentElement
    if (appearance === 'system') html.removeAttribute('data-appearance')
    else html.setAttribute('data-appearance', appearance)
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) meta.content = backgrounds[scheme]
  }, [appearance, scheme])
}

function isAppPath(pathname: string): boolean {
  return tabForRoot(pathname) !== null || /^\/spot\/\d+(\/prep)?$/.test(pathname)
}

/** Welcome on first launch, then the three tabs, each with its own push stack. */
function Shell() {
  useAppearance()
  const { pathname } = useLocation()
  const welcomed = useAppState((s) => s.welcomed)

  useEffect(() => {
    navMemory.pathAtIndex.set(historyIndex(), pathname)
  }, [pathname])

  if (!welcomed) {
    if (pathname !== '/welcome') return <Navigate to="/welcome" replace />
    return (
      <div className="app">
        <div className="layer is-welcome">
          <WelcomeScreen />
        </div>
        <div className="bottom-chrome is-welcome">
          <SampleDataNote />
        </div>
      </div>
    )
  }
  if (!isAppPath(pathname)) return <Navigate to="/" replace />
  return <Tabs pathname={pathname} />
}

const exitMs = 420

function Tabs({ pathname }: { pathname: string }) {
  // Which tab a pushed Spot belongs to is remembered, not encoded in the URL.
  const rootTab = tabForRoot(pathname)
  if (rootTab) navMemory.tab = rootTab
  const tab = navMemory.tab
  navMemory.tabPaths[tab] = pathname
  const stack = stackFor(pathname, tab)

  const [visited, setVisited] = useState<Set<Tab>>(() => new Set([tab]))
  if (!visited.has(tab)) setVisited(new Set([...visited, tab]))

  // Push slides the new screen in; pop slides the old one out while it stays mounted briefly.
  const previous = useRef({ tab, stack })
  const [exiting, setExiting] = useState<string[]>([])
  const before = previous.current.stack
  const sameTab = previous.current.tab === tab
  const pushed = sameTab && stack.length > before.length && before.every((path, i) => stack[i] === path) ? stack.at(-1) : undefined
  const popped = sameTab && stack.length < before.length && stack.every((path, i) => before[i] === path) ? before.slice(stack.length) : []

  useLayoutEffect(() => {
    previous.current = { tab, stack }
    sessionStorage.setItem('reeleyes.tab', tab)
    if (popped.length === 0) return
    setExiting(popped)
    const timer = setTimeout(() => setExiting([]), exitMs)
    return () => clearTimeout(timer)
    // Runs once per navigation; `stack` and `popped` derive from pathname and tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, tab])
  const leaving = [...new Set([...popped, ...exiting])].filter((path) => !stack.includes(path))

  return (
    <div className="app">
      {(Object.keys(tabRoots) as Tab[])
        .filter((t) => visited.has(t))
        .map((t) => {
          const active = t === tab
          const isTop = active && stack.length === 1
          return (
            <Layer key={t} path={tabRoots[t]} depth={0} isTop={isTop} className={!active ? 'is-hidden' : isTop ? '' : 'is-under'}>
              {screenFor(tabRoots[t])}
            </Layer>
          )
        })}
      {stack.slice(1).map((path, i) => {
        const isTop = i === stack.length - 2
        return (
          <Layer key={`${tab}:${path}`} path={path} depth={i + 1} isTop={isTop} enter={path === pushed} className={isTop ? '' : 'is-under'}>
            {screenFor(path)}
          </Layer>
        )
      })}
      {leaving.map((path) => (
        <Layer key={`${tab}:${path}`} path={path} depth={stackFor(path, tab).length - 1} isTop={false} className="is-exit">
          {screenFor(path)}
        </Layer>
      ))}
      <div className="bottom-chrome">
        <TabBar />
        <SampleDataNote />
      </div>
      {/* iOS RootView's `.sheet(item: $app.signInRequest)`: the heart's sign-in sheet, over any tab. */}
      <SignInSheet />
    </div>
  )
}

function Layer({
  path,
  depth,
  isTop,
  enter = false,
  className,
  children,
}: {
  path: string
  depth: number
  isTop: boolean
  enter?: boolean
  className: string
  children: ReactNode
}) {
  const [entering] = useState(enter)
  return (
    <div className={`layer ${entering ? 'is-enter' : ''} ${className}`} inert={!isTop} aria-hidden={!isTop}>
      <LayerContext.Provider value={{ path, depth, isTop }}>{children}</LayerContext.Provider>
    </div>
  )
}

/** A screen rendered for its own path, so `useParams()` works in every layer of a stack. */
function screenFor(path: string) {
  return (
    <Routes location={path}>
      <Route path="/" element={<TodayScreen />} />
      <Route path="/saved" element={<SavedScreen />} />
      <Route path="/license" element={<LicenseScreen />} />
      <Route path="/spot/:id" element={<SpotScreen />} />
      <Route path="/spot/:id/prep" element={<PrepScreen />} />
    </Routes>
  )
}
