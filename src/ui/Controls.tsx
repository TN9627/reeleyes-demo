import { useEffect, useRef, type ReactNode } from 'react'
import { Glyph, type GlyphName } from './Glyph'

export interface ButtonProps {
  /** primary: Brick Fill; secondary: Fill Strong with a brick label; plain: brick text only. */
  variant?: 'primary' | 'secondary' | 'plain'
  glyph?: GlyphName
  glyphVariant?: 'none' | 'fill'
  /** Replaces the label with a spinner and disables the button. */
  loading?: boolean
  disabled?: boolean
  onClick?: () => void
  ariaLabel?: string
  className?: string
  children: ReactNode
}

/** The three button styles from Theme.swift: full-width 50pt primary/secondary, 44pt plain action. */
export function Button({ variant = 'primary', glyph, glyphVariant, loading, disabled, onClick, ariaLabel, className, children }: ButtonProps) {
  return (
    <button
      type="button"
      className={`button button-${variant} t-headline ${className ?? ''}`}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <Spinner />
      ) : (
        <>
          {glyph && <Glyph name={glyph} variant={glyphVariant} />}
          <span>{children}</span>
        </>
      )}
    </button>
  )
}

/** The system activity indicator, in the current text color. */
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span className="spinner" style={{ width: size, height: size }} role="progressbar" aria-label="Loading">
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} style={{ transform: `rotate(${i * 45}deg)`, animationDelay: `${(i - 8) * 0.1}s` }} />
      ))}
    </span>
  )
}

export interface ChipProps {
  title: string
  selected: boolean
  /** A leading glyph: `remove` (xmark) on an active toggle chip. */
  glyph?: GlyphName
  onClick: () => void
  ariaLabel?: string
}

/** A filter chip: a capsule, card-white with a hairline, Brick Fill when selected. */
export function Chip({ title, selected, glyph, onClick, ariaLabel }: ChipProps) {
  return (
    <button
      type="button"
      className={`chip ${selected ? 'is-selected t-subheadline-semibold' : 't-subheadline'}`}
      aria-pressed={selected}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {glyph && <Glyph name={glyph} size="0.95em" weight={2.4} />}
      <span>{title}</span>
    </button>
  )
}

/**
 * Chips in one row that scrolls edge to edge (it cancels the 14px screen inset), keeping
 * the selected chip in view whenever `selectedKey` changes.
 */
export function ChipRow({ selectedKey, children }: { selectedKey?: string | null; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  useEffect(() => {
    const row = ref.current
    const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!row || !chip) return
    const left = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2
    row.scrollTo({ left, behavior: first.current ? 'auto' : 'smooth' })
    first.current = false
  }, [selectedKey])
  return (
    <div ref={ref} className="chip-row scroll-x">
      {children}
    </div>
  )
}

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Accessible name when no visible label is tied to it. */
  label?: string
  id?: string
}

/** The iOS switch, tinted slate (Filters' Form toggles). */
export function Switch({ checked, onChange, label, id }: SwitchProps) {
  return (
    <input
      id={id}
      type="checkbox"
      role="switch"
      className="switch"
      checked={checked}
      aria-label={label}
      onChange={(event) => onChange(event.target.checked)}
    />
  )
}

/** A Form toggle row inside a Card: Body label, switch trailing. */
export function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle-row t-body">
      <span>{label}</span>
      <Switch checked={checked} onChange={onChange} />
    </label>
  )
}
