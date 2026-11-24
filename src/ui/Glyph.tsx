import {
  ArrowUp,
  Bug,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock,
  Compass,
  Contrast,
  Fish,
  Heart,
  House,
  IdCard,
  Image,
  Info,
  List,
  ListFilter,
  MapPin,
  MapPinned,
  Minimize2,
  Navigation,
  RefreshCwOff,
  Search,
  TriangleExclamationPoint,
  WifiOff,
  X,
  Undo2,
  ThermometerSun,
  Snowflake,
  CloudLightning,
  Wind,
  Sun,
  Cloud,
  CloudRain,
  Gauge,
  Sunrise,
  Sunset,
  type LucideIcon,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { isCommunityLake, type SpotSummary } from '../data/types'

/** The app's custom symbols (src/assets/glyphs/*.svg, from ios/icons), keyed by file name. */
const customSVGs = import.meta.glob<string>('../assets/glyphs/*.svg', { query: '?raw', import: 'default', eager: true })

function customInner(name: string): string {
  const svg = customSVGs[`../assets/glyphs/${name}.svg`]
  if (!svg) throw new Error(`Missing glyph SVG: ${name}`)
  return svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
}

/**
 * Drawn here: SF Symbols with no close lucide stand-in. Same 24-unit grid and
 * stroke as the custom set.
 */
const inlineSVGs = {
  // sun.horizon: a half sun with three rays on the horizon.
  sunHorizon: '<path d="M12 6v3"/><path d="m4.93 10.93 2.12 2.12"/><path d="m19.07 10.93-2.12 2.12"/><path d="M2 18h20"/><path d="M17 18a5 5 0 0 0-10 0"/>',
  // xmark.circle.fill: a filled disc with the x knocked out in the field's color.
  clearFill:
    '<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="m15 9-6 6M9 9l6 6" stroke="var(--glyph-knockout, var(--background))"/>',
  // moonrise / moonset: a crescent over the horizon with an up or down arrow, like the SF pair.
  moonrise:
    '<path d="M2 20h20"/><path d="M16 16.5A6 6 0 0 1 9.5 10a6 6 0 1 0 6.5 6.5z"/><path d="M19 9V3M17 5l2-2 2 2"/>',
  moonset:
    '<path d="M2 20h20"/><path d="M16 16.5A6 6 0 0 1 9.5 10a6 6 0 1 0 6.5 6.5z"/><path d="M19 3v6M17 7l2 2 2-2"/>',
  // moonphase.*: SF draws these hierarchically (dark side pale, lit side full), so a waxing crescent
  // can't read as a waning gibbous. Lit side on the right while waxing, as seen from Arizona.
  moonNew: moonPhase(''),
  moonWaxingCrescent: moonPhase('M12 3a9 9 0 0 1 0 18a6 9 0 0 0 0-18z'),
  moonFirstQuarter: moonPhase('M12 3a9 9 0 0 1 0 18z'),
  moonWaxingGibbous: moonPhase('M12 3a9 9 0 0 1 0 18a6 9 0 0 1 0-18z'),
  moonFull: moonPhase('M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18z'),
  moonWaningGibbous: moonPhase('M12 3a9 9 0 0 0 0 18a6 9 0 0 0 0-18z'),
  moonLastQuarter: moonPhase('M12 3a9 9 0 0 0 0 18z'),
  moonWaningCrescent: moonPhase('M12 3a9 9 0 0 0 0 18a6 9 0 0 1 0-18z'),
}

/** A moon disc: the dark side pale, `lit` (a path in the 24 grid) solid. */
function moonPhase(lit: string): string {
  return `<circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.22" stroke="none"/>${lit ? `<path d="${lit}" fill="currentColor" stroke="none"/>` : ''}<circle cx="12" cy="12" r="9"/>`
}

type Source =
  | { kind: 'lucide'; icon: LucideIcon; fillable?: boolean }
  | { kind: 'custom'; file: string }
  | { kind: 'inline'; svg: string }

/**
 * Every glyph the app draws, by meaning (Views/Glyph.swift's `Glyph` enum, same case names).
 * `sf` is the SF Symbol the iOS app uses; `source` is what the web draws for it: the app's
 * own custom symbols as-is, and the closest lucide-react icon where SF Symbols can't ship.
 */
export const GLYPHS = {
  // Navigation and actions
  today: { sf: 'sun.horizon', source: { kind: 'inline', svg: inlineSVGs.sunHorizon } },
  saved: { sf: 'heart', source: { kind: 'lucide', icon: Heart, fillable: true } },
  license: { sf: 'person.text.rectangle', source: { kind: 'lucide', icon: IdCard } },
  account: { sf: 'person.crop.circle', source: { kind: 'lucide', icon: CircleUserRound } },
  appearance: { sf: 'circle.lefthalf.filled', source: { kind: 'lucide', icon: Contrast } },
  developer: { sf: 'ladybug', source: { kind: 'lucide', icon: Bug } },
  search: { sf: 'magnifyingglass', source: { kind: 'lucide', icon: Search } },
  clear: { sf: 'xmark.circle.fill', source: { kind: 'inline', svg: inlineSVGs.clearFill } },
  remove: { sf: 'xmark', source: { kind: 'lucide', icon: X } },
  checked: { sf: 'checkmark', source: { kind: 'lucide', icon: Check } },
  disclosure: { sf: 'chevron.right', source: { kind: 'lucide', icon: ChevronRight } },
  filter: { sf: 'line.3.horizontal.decrease', source: { kind: 'lucide', icon: ListFilter } },
  prep: { sf: 'list.bullet', source: { kind: 'lucide', icon: List } },
  drive: { sf: 'car', source: { kind: 'lucide', icon: Car } },
  home: { sf: 'house', source: { kind: 'lucide', icon: House, fillable: true } },
  currentLocation: { sf: 'location.fill', source: { kind: 'lucide', icon: Navigation, fillable: true } },
  place: { sf: 'mappin.and.ellipse', source: { kind: 'lucide', icon: MapPinned } },
  windDirection: { sf: 'arrow.up', source: { kind: 'lucide', icon: ArrowUp } },
  back: { sf: 'chevron.backward', source: { kind: 'lucide', icon: ChevronLeft } },
  close: { sf: 'xmark', source: { kind: 'lucide', icon: X } },
  photoCredit: { sf: 'info.circle', source: { kind: 'lucide', icon: Info } },
  showPhotos: { sf: 'photo', source: { kind: 'lucide', icon: Image } },
  collapseMap: { sf: 'arrow.down.right.and.arrow.up.left', source: { kind: 'lucide', icon: Minimize2 } },
  // States
  offline: { sf: 'wifi.slash', source: { kind: 'lucide', icon: WifiOff } },
  stale: { sf: 'clock', source: { kind: 'lucide', icon: Clock } },
  refreshFailed: { sf: 'exclamationmark.arrow.circlepath', source: { kind: 'lucide', icon: RefreshCwOff } },
  error: { sf: 'exclamationmark.triangle', source: { kind: 'lucide', icon: TriangleExclamationPoint } },
  noSpotsNearby: { sf: 'safari', source: { kind: 'lucide', icon: Compass } },
  backToNow: { sf: 'arrow.uturn.backward', source: { kind: 'lucide', icon: Undo2 } },
  // Weather safety: NWS alerts, heat and cold notices, the sun by day (#60)
  heat: { sf: 'thermometer.high', source: { kind: 'lucide', icon: ThermometerSun } },
  cold: { sf: 'snowflake', source: { kind: 'lucide', icon: Snowflake } },
  storm: { sf: 'cloud.bolt', source: { kind: 'lucide', icon: CloudLightning } },
  wind: { sf: 'wind', source: { kind: 'lucide', icon: Wind } },
  weatherAlert: { sf: 'exclamationmark.triangle', source: { kind: 'lucide', icon: TriangleExclamationPoint } },
  sunUp: { sf: 'sun.max', source: { kind: 'lucide', icon: Sun } },
  // Prep's Today hero: sky, pressure chip, sun and moon events, the hour line
  cloudy: { sf: 'cloud', source: { kind: 'lucide', icon: Cloud } },
  rain: { sf: 'cloud.rain', source: { kind: 'lucide', icon: CloudRain } },
  pressure: { sf: 'gauge.with.dots.needle.33percent', source: { kind: 'lucide', icon: Gauge } },
  sunrise: { sf: 'sunrise', source: { kind: 'lucide', icon: Sunrise } },
  sunset: { sf: 'sunset', source: { kind: 'lucide', icon: Sunset } },
  moonrise: { sf: 'moonrise', source: { kind: 'inline', svg: inlineSVGs.moonrise } },
  moonset: { sf: 'moonset', source: { kind: 'inline', svg: inlineSVGs.moonset } },
  time: { sf: 'clock', source: { kind: 'lucide', icon: Clock } },
  // The moon in each named phase (MoonPhase): the night icon and the moon line
  moonNew: { sf: 'moonphase.new.moon', source: { kind: 'inline', svg: inlineSVGs.moonNew } },
  moonWaxingCrescent: { sf: 'moonphase.waxing.crescent', source: { kind: 'inline', svg: inlineSVGs.moonWaxingCrescent } },
  moonFirstQuarter: { sf: 'moonphase.first.quarter', source: { kind: 'inline', svg: inlineSVGs.moonFirstQuarter } },
  moonWaxingGibbous: { sf: 'moonphase.waxing.gibbous', source: { kind: 'inline', svg: inlineSVGs.moonWaxingGibbous } },
  moonFull: { sf: 'moonphase.full.moon', source: { kind: 'inline', svg: inlineSVGs.moonFull } },
  moonWaningGibbous: { sf: 'moonphase.waning.gibbous', source: { kind: 'inline', svg: inlineSVGs.moonWaningGibbous } },
  moonLastQuarter: { sf: 'moonphase.last.quarter', source: { kind: 'inline', svg: inlineSVGs.moonLastQuarter } },
  moonWaningCrescent: { sf: 'moonphase.waning.crescent', source: { kind: 'inline', svg: inlineSVGs.moonWaningCrescent } },
  // The Spot's map
  mapPin: { sf: 'mappin', source: { kind: 'lucide', icon: MapPin } },
  // Fishing (custom symbols)
  hook: { sf: 'hook (custom)', source: { kind: 'custom', file: 'hook' } },
  lure: { sf: 'lure (custom)', source: { kind: 'custom', file: 'lure' } },
  rodAndReel: { sf: 'rod.and.reel (custom)', source: { kind: 'custom', file: 'rod.and.reel' } },
  stocked: { sf: 'stocking.truck (custom)', source: { kind: 'custom', file: 'stocking.truck' } },
  boatRamp: { sf: 'boat.ramp (custom)', source: { kind: 'custom', file: 'boat.ramp' } },
  pier: { sf: 'pier (custom)', source: { kind: 'custom', file: 'pier' } },
  lake: { sf: 'lake (custom)', source: { kind: 'custom', file: 'lake' } },
  reservoir: { sf: 'reservoir (custom)', source: { kind: 'custom', file: 'reservoir' } },
  river: { sf: 'river (custom)', source: { kind: 'custom', file: 'river' } },
  communityPond: { sf: 'pond (custom)', source: { kind: 'custom', file: 'pond' } },
  rules: { sf: 'regulations (custom)', source: { kind: 'custom', file: 'regulations' } },
  creel: { sf: 'creel (custom)', source: { kind: 'custom', file: 'creel' } },
  species: { sf: 'fish', source: { kind: 'lucide', icon: Fish } },
} satisfies Record<string, { sf: string; source: Source }>

export type GlyphName = keyof typeof GLYPHS

/** A Spot's kind glyph; a community lake draws the lake, so the picture agrees with the "Lake" label. */
export function spotKindGlyph(spot: SpotSummary): GlyphName {
  switch (spot.kind) {
    case 'lake':
      return 'lake'
    case 'reservoir':
      return 'reservoir'
    case 'river':
      return 'river'
    case 'community_pond':
      return isCommunityLake(spot) ? 'lake' : 'communityPond'
  }
}

export interface GlyphProps {
  name: GlyphName
  /**
   * SF Symbols' `.symbolVariant`: `fill` fills glyphs that have a filled form (saved, home,
   * currentLocation); `circle` / `circleFill` enclose the glyph (the Filters toolbar button).
   */
  variant?: 'none' | 'fill' | 'circle' | 'circleFill'
  /** CSS size; defaults to 1.2em so a glyph matches the text style it sits in, like an SF Symbol. */
  size?: number | string
  /** Stroke in grid units: 1.85 is SF Regular; pass ~2.3 for semibold. */
  weight?: number
  /** Accessible name; omitted means decorative (aria-hidden). */
  label?: string
  className?: string
  style?: CSSProperties
}

/** One glyph, colored by `currentColor` and sized from the surrounding text. */
export function Glyph({ name, variant = 'none', size = '1.2em', weight = 1.85, label, className, style }: GlyphProps) {
  const source: Source = GLYPHS[name].source
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const }
  const circled = variant === 'circle' || variant === 'circleFill'
  const svgSize = circled ? '62%' : size
  let svg
  if (source.kind === 'lucide') {
    const Icon = source.icon
    const filled = variant === 'fill' && source.fillable
    svg = (
      <Icon
        size={svgSize}
        strokeWidth={weight}
        fill={filled ? 'currentColor' : 'none'}
        className={circled ? undefined : `glyph ${className ?? ''}`}
        style={circled ? undefined : style}
        {...(circled ? { 'aria-hidden': true } : a11y)}
      />
    )
  } else {
    const inner = source.kind === 'custom' ? customInner(source.file) : source.svg
    svg = (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={svgSize}
        height={svgSize}
        fill="none"
        stroke="currentColor"
        strokeWidth={weight}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={circled ? undefined : `glyph ${className ?? ''}`}
        style={circled ? undefined : style}
        {...(circled ? { 'aria-hidden': true } : a11y)}
        dangerouslySetInnerHTML={{ __html: inner }}
      />
    )
  }
  if (!circled) return svg
  return (
    <span
      className={`glyph glyph-circle ${variant === 'circleFill' ? 'glyph-circle-fill' : ''} ${className ?? ''}`}
      style={{ width: size, height: size, ...style }}
      {...a11y}
    >
      {svg}
    </span>
  )
}
