import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Glyph, type GlyphName } from './Glyph'
import { useLayer, useNav } from './navigation'

/** Scroll offsets of screens that unmounted (a tab's pushed stack while another tab shows). */
const savedScroll = new Map<string, number>()

export interface ScreenProps {
  /** The navigation title. */
  title: string
  /** `large` on tab roots (Today, Saved, License); `inline` on pushed screens (the default there). */
  titleDisplay?: 'large' | 'inline'
  /** iOS `navigationSubtitle`: Prep shows the Spot's name under its title. */
  subtitle?: string
  /** Bar items before the title (after the automatic back button on pushed screens). */
  leading?: ReactNode
  /** Bar items after the title. */
  trailing?: ReactNode
  /**
   * `overlay`: the bar is clear and content starts under the status bar (the Spot hero);
   * bar buttons switch to media glass. The inline title shows only while `barTitleVisible`.
   */
  bar?: 'standard' | 'overlay'
  barTitleVisible?: boolean
  /** Pushed screens get a back button unless hidden. */
  hideBack?: boolean
  /** Content's horizontal inset (14px, the screen inset); false for edge-to-edge content. */
  inset?: boolean
  /** Bottom padding after content, above the tab bar: 24 on tabs, 28 on Spot and Prep. */
  bottomPadding?: number
  onScroll?: (scrollTop: number) => void
  children: ReactNode
}

const BarContext = createContext<{ overlay: boolean }>({ overlay: false })

/**
 * One screen: the iOS 26 navigation bar (large title that collapses into the bar on scroll,
 * scroll edge effect, back button on pushed screens) over its own scroll view, padded for
 * the safe areas and the tab bar.
 */
export function Screen({
  title,
  titleDisplay,
  subtitle,
  leading,
  trailing,
  bar = 'standard',
  barTitleVisible = false,
  hideBack = false,
  inset = true,
  bottomPadding,
  onScroll,
  children,
}: ScreenProps) {
  const layer = useLayer()
  const nav = useNav()
  const overlay = bar === 'overlay'
  const large = !overlay && (titleDisplay ?? (layer.depth === 0 ? 'large' : 'inline')) === 'large'
  const scrollRef = useRef<HTMLDivElement>(null)
  const largeTitleRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [collapsed, setCollapsed] = useState(!large)
  const onScrollRef = useRef(onScroll)
  onScrollRef.current = onScroll

  // Restore the offset this path had before it unmounted; save it when it goes.
  useLayoutEffect(() => {
    const scroller = scrollRef.current!
    const top = savedScroll.get(layer.path)
    if (top) scroller.scrollTop = top
    return () => {
      savedScroll.set(layer.path, scroller.scrollTop)
    }
  }, [layer.path])

  useEffect(() => {
    const scroller = scrollRef.current!
    let frame = 0
    const measure = () => {
      frame = 0
      const top = scroller.scrollTop
      setScrolled(top > 1)
      if (large && largeTitleRef.current && barRef.current) {
        const titleBottom = largeTitleRef.current.offsetTop + largeTitleRef.current.offsetHeight
        setCollapsed(top + barRef.current.offsetHeight > titleBottom - 4)
      }
      onScrollRef.current?.(top)
    }
    const handle = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    scroller.addEventListener('scroll', handle, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', handle)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [large])

  // Tapping the active tab on its root scrolls to the top.
  useEffect(() => {
    const handle = (event: Event) => {
      if ((event as CustomEvent<string>).detail === layer.path && layer.isTop) {
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
    window.addEventListener('reeleyes:scroll-to-top', handle)
    return () => window.removeEventListener('reeleyes:scroll-to-top', handle)
  }, [layer.path, layer.isTop])

  const showsBack = layer.depth > 0 && !hideBack
  const showsBarTitle = overlay ? barTitleVisible : collapsed
  const edge = overlay ? barTitleVisible : scrolled

  return (
    <BarContext.Provider value={{ overlay }}>
      <div className="screen">
        <div
          ref={scrollRef}
          className={`screen-scroll scroll-y ${overlay ? 'is-overlay' : ''}`}
          style={{ paddingBottom: `calc(var(--chrome-bottom) + ${bottomPadding ?? (layer.depth === 0 ? 24 : 28)}px)` }}
        >
          {large && (
            <div ref={largeTitleRef} className="screen-large-title">
              <h1 className="t-large-title">{title}</h1>
              {subtitle && <p className="t-subheadline c-ink-secondary">{subtitle}</p>}
            </div>
          )}
          <div className={inset ? 'screen-content is-inset' : 'screen-content'}>{children}</div>
        </div>

        <header ref={barRef} className={`nav-bar ${edge ? 'has-edge' : ''} ${overlay ? 'is-overlay' : ''}`}>
          <div className="nav-bar-row">
            <div className="nav-bar-side">
              {showsBack && <BarButton glyph="back" ariaLabel="Back" tone="ink" onClick={nav.back} />}
              {leading}
            </div>
            <div className={`nav-bar-title ${showsBarTitle ? 'is-visible' : ''}`} aria-hidden={!showsBarTitle}>
              <span className="t-headline truncate">{title}</span>
              {subtitle && <span className="t-footnote c-ink-secondary truncate">{subtitle}</span>}
            </div>
            <div className="nav-bar-side is-trailing">{trailing}</div>
          </div>
        </header>
      </div>
    </BarContext.Provider>
  )
}

const GroupContext = createContext(false)

/** Bar items that share one glass capsule (iOS 26 groups a placement's items). */
export function ToolbarGroup({ children }: { children: ReactNode }) {
  const { overlay } = useContext(BarContext)
  return (
    <div className={`toolbar-group ${overlay ? 'glass-media' : 'glass'}`}>
      <GroupContext.Provider value={true}>{children}</GroupContext.Provider>
    </div>
  )
}

export interface BarButtonProps {
  glyph?: GlyphName
  glyphVariant?: 'none' | 'fill' | 'circle' | 'circleFill'
  /** Text beside the glyph ("2 hr") or alone ("Done"). */
  title?: string
  ariaLabel?: string
  onClick?: () => void
  /** Count badge (Filters with toggles on). */
  badge?: number
  disabled?: boolean
  /** Brick (the tint, default) or Ink (back). */
  tone?: 'accent' | 'ink'
  /** Semibold title, as Done is. */
  prominent?: boolean
}

/** A 44pt toolbar button: in a ToolbarGroup it shares the group's glass, alone it is its own glass circle or capsule. */
export function BarButton({ glyph, glyphVariant, title, ariaLabel, onClick, badge, disabled, tone = 'accent', prominent }: BarButtonProps) {
  const inGroup = useContext(GroupContext)
  const { overlay } = useContext(BarContext)
  const button = (
    <button
      type="button"
      className={`bar-button ${title ? 'has-title' : ''} ${tone === 'ink' ? 'c-ink' : 'c-accent'}`}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
    >
      {glyph && <Glyph name={glyph} variant={glyphVariant} size="1.3em" weight={glyph === 'back' ? 2.2 : 1.85} />}
      {title && <span className={prominent ? 't-headline' : 't-subheadline-semibold'}>{title}</span>}
      {badge !== undefined && badge > 0 && <span className="bar-badge">{badge}</span>}
    </button>
  )
  if (inGroup) return button
  return <div className={`toolbar-group ${overlay ? 'glass-media' : 'glass'}`}>{button}</div>
}

export interface GlassCircleButtonProps {
  glyph: GlyphName
  glyphVariant?: 'none' | 'fill'
  ariaLabel: string
  onClick?: () => void
  tone?: 'accent' | 'ink'
  /** 22pt glyph by default (the hero's map button and ⓘ); back and heart use 17. */
  glyphSize?: number
}

/** A 44pt media-glass circle over a photo or map (The Glass On Media Rule). */
export function GlassCircleButton({ glyph, glyphVariant, ariaLabel, onClick, tone = 'ink', glyphSize = 22 }: GlassCircleButtonProps) {
  return (
    <button type="button" className={`glass-circle glass-media ${tone === 'ink' ? 'c-ink' : 'c-accent'}`} aria-label={ariaLabel} onClick={onClick}>
      <Glyph name={glyph} variant={glyphVariant} size={glyphSize} />
    </button>
  )
}
