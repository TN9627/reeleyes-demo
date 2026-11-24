import { OPEN_METEO_URL } from '../data/openMeteo'
import { Glyph, type GlyphName } from './Glyph'
import { useNav, type Tab } from './navigation'

const tabs: { tab: Tab; title: string; glyph: GlyphName }[] = [
  { tab: 'today', title: 'Today', glyph: 'today' },
  { tab: 'saved', title: 'Saved', glyph: 'saved' },
  { tab: 'license', title: 'License', glyph: 'license' },
]

/** The iOS 26 floating glass tab bar: Today · Saved · License, tinted brick. */
export function TabBar() {
  const nav = useNav()
  return (
    <nav className="tab-bar glass" aria-label="Tabs">
      {tabs.map(({ tab, title, glyph }) => {
        const selected = nav.tab === tab
        return (
          <button
            key={tab}
            type="button"
            className={`tab-bar-item ${selected ? 'is-selected' : ''}`}
            aria-current={selected ? 'page' : undefined}
            onClick={() => nav.selectTab(tab)}
          >
            <Glyph name={glyph} variant={glyph === 'saved' ? 'fill' : 'none'} size={25} weight={selected ? 2 : 1.85} />
            <span className="tab-bar-title">{title}</span>
          </button>
        )
      })}
    </nav>
  )
}

/** "Live weather by Open-Meteo.com · all else is sample data", always on screen (PRODUCT.md). */
export function SampleDataNote() {
  return (
    <p className="sample-note t-caption" role="note">
      Live weather by{' '}
      <a className="credit-link" href={OPEN_METEO_URL} target="_blank" rel="noreferrer">
        Open-Meteo.com
      </a>{' '}
      · all else is sample data
    </p>
  )
}
