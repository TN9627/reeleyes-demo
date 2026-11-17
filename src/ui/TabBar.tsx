import { dataNotice } from '../data/repository'
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
            <Glyph name={glyph} variant={selected && glyph === 'saved' ? 'fill' : 'none'} size={25} weight={selected ? 2 : 1.85} />
            <span className="tab-bar-title">{title}</span>
          </button>
        )
      })}
    </nav>
  )
}

/** "Sample data: every value is made up.", always on screen (PRODUCT.md). */
export function SampleDataNote() {
  return (
    <p className="sample-note t-caption" role="note">
      {dataNotice}
    </p>
  )
}
