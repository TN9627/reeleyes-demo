import type { CSSProperties, ReactNode } from 'react'
import { formatDrive } from '../logic/spotFacts'
import { Glyph, type GlyphName } from './Glyph'

export interface CardProps {
  /**
   * Without padding, each child is a row and hairlines (inset 16px) separate them.
   * With padding (18 for feature cards, 16 for tiles) it is one block.
   */
  padding?: number
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/** A white 16pt grouped card with the one whisper shadow. */
export function Card({ padding, className, style, children }: CardProps) {
  return (
    <div className={`card ${padding === undefined ? 'has-rows' : ''} ${className ?? ''}`} style={padding === undefined ? style : { padding, ...style }}>
      {children}
    </div>
  )
}

/** "Under 30 min ……… 2 Spots": Title 3 with an optional trailing Footnote. */
export function SectionHeader({ title, trailing }: { title: string; trailing?: string }) {
  return (
    <div className="section-header">
      <h2 className="t-title3">{title}</h2>
      {trailing && <span className="t-footnote c-ink-secondary">{trailing}</span>}
    </div>
  )
}

/** Footnote Ink Secondary under a card, naming sources. */
export function Footnote({ children }: { children: ReactNode }) {
  return <p className="footnote t-footnote c-ink-secondary">{children}</p>
}

/** A section: header, one Card of rows, optional footnote. */
export function GroupedSection({
  title,
  trailing,
  footnote,
  children,
}: {
  title?: string
  trailing?: string
  footnote?: ReactNode
  children: ReactNode
}) {
  return (
    <section>
      {title && <SectionHeader title={title} trailing={trailing} />}
      <Card>{children}</Card>
      {footnote && <Footnote>{footnote}</Footnote>}
    </section>
  )
}

export interface RowProps {
  onClick?: () => void
  /** An Ink Tertiary chevron trailing (disclosure). */
  chevron?: boolean
  /** 50 for tappable list rows (the default when tappable), 44 or 52 elsewhere. */
  minHeight?: number
  ariaLabel?: string
  className?: string
  children: ReactNode
}

/** A card row: 16px side padding, 12px vertical; tappable rows dim while pressed. */
export function Row({ onClick, chevron, minHeight, ariaLabel, className, children }: RowProps) {
  const content = (
    <>
      <div className="row-content">{children}</div>
      {chevron && <Glyph name="disclosure" className="row-chevron c-ink-tertiary" size="0.95em" weight={2.4} />}
    </>
  )
  if (!onClick) {
    return (
      <div className={`row ${className ?? ''}`} style={{ minHeight }}>
        {content}
      </div>
    )
  }
  return (
    <button type="button" className={`row is-tappable ${className ?? ''}`} style={{ minHeight: minHeight ?? 50 }} onClick={onClick} aria-label={ariaLabel}>
      {content}
    </button>
  )
}

/** The amber notice for offline, stale or failed states: Warn glyph, bold title run into the message. */
export function Banner({ glyph, title, message, action }: { glyph: GlyphName; title: string; message: string; action?: ReactNode }) {
  return (
    <div className="banner" role="status">
      <Glyph name={glyph} className="banner-glyph c-warn" weight={2.3} />
      <p className="t-subheadline c-ink">
        <strong>{title}</strong> {message}
      </p>
      {action}
    </div>
  )
}

/** A centered empty state: slate-ringed glyph, Title 3, Subheadline message, stacked actions. */
export function EmptyState({ glyph, title, message, children }: { glyph: GlyphName; title: string; message: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-state-ring c-data">
        <Glyph name={glyph} size={26} />
      </span>
      <h2 className="t-title3">{title}</h2>
      <p className="t-subheadline c-ink-secondary">{message}</p>
      {children && <div className="empty-state-actions">{children}</div>}
    </div>
  )
}

/** "42 min", "1 hr 5 min": numbers in Headline (tabular), units in Footnote Ink Secondary. */
export function DriveTimeText({ minutes }: { minutes: number }) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return (
    <span className="drive-time">
      <span className="visually-hidden">{`${formatDrive(minutes)} drive`}</span>
      <span className="drive-time-figures" aria-hidden="true">
      {hours > 0 ? (
        <>
          <span className="t-headline tnum c-ink">{hours}</span>
          <span className="t-footnote c-ink-secondary">hr</span>
          {rest > 0 && (
            <>
              <span className="t-headline tnum c-ink drive-time-gap">{rest}</span>
              <span className="t-footnote c-ink-secondary">min</span>
            </>
          )}
        </>
      ) : (
        <>
          <span className="t-headline tnum c-ink">{minutes}</span>
          <span className="t-footnote c-ink-secondary">min</span>
        </>
      )}
      </span>
    </span>
  )
}
