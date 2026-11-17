import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { appearanceTitles, setAppearance, useAppState, type Appearance } from '../state/appState'
import { Glyph } from './Glyph'
import { BarButton, type BarButtonProps } from './Screen'

export interface PickerMenuProps<T extends string | number> {
  /** The trigger, drawn as a toolbar button. */
  trigger: Omit<BarButtonProps, 'onClick' | 'badge'>
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

/**
 * A toolbar Menu holding one Picker (the range menu, Appearance): a glass popover under
 * the trigger with a checkmark on the current option.
 */
export function PickerMenu<T extends string | number>({ trigger, options, value, onChange }: PickerMenuProps<T>) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left?: number; right?: number; origin: string } | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const leading = rect.left + rect.width / 2 < window.innerWidth / 2
    setPosition(
      leading
        ? { top: rect.bottom + 8, left: Math.max(rect.left, 12), origin: 'top left' }
        : { top: rect.bottom + 8, right: Math.max(window.innerWidth - rect.right, 12), origin: 'top right' },
    )
  }, [open])

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <span ref={anchorRef} className="menu-anchor" aria-haspopup="menu" aria-expanded={open}>
        <BarButton {...trigger} onClick={() => setOpen(true)} />
      </span>
      {open &&
        createPortal(
          <div className="menu-host">
            <div className="menu-scrim" onClick={() => setOpen(false)} />
            <div
              ref={menuRef}
              className="menu"
              role="menu"
              aria-label={trigger.ariaLabel}
              style={position ? { top: position.top, left: position.left, right: position.right, transformOrigin: position.origin } : { visibility: 'hidden' }}
            >
              {options.map((option) => {
                const checked = option.value === value
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    role="menuitemradio"
                    aria-checked={checked}
                    className="menu-item t-body"
                    onClick={() => {
                      setOpen(false)
                      if (!checked) onChange(option.value)
                    }}
                  >
                    <span className="menu-check">{checked && <Glyph name="checked" size="0.95em" weight={2.4} />}</span>
                    <span>{option.label}</span>
                  </button>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

const appearanceOptions = (Object.keys(appearanceTitles) as Appearance[]).map((value) => ({ value, label: appearanceTitles[value] }))

/** The Appearance menu, top left on Today, Saved and License: System, Light, Dark. */
export function AppearanceMenu() {
  const appearance = useAppState((s) => s.appearance)
  return (
    <PickerMenu
      trigger={{ glyph: 'appearance', ariaLabel: `Appearance, ${appearanceTitles[appearance]}` }}
      options={appearanceOptions}
      value={appearance}
      onChange={setAppearance}
    />
  )
}
