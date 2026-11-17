import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { appearanceTitles, setAppearance, useAppState, type Appearance } from '../state/appState'
import { Glyph } from './Glyph'
import { BarButton, type BarButtonProps } from './Screen'

/** A menu's trigger, drawn as a toolbar button. */
type MenuTrigger = Omit<BarButtonProps, 'onClick' | 'badge'>

/**
 * A toolbar Menu: the trigger opens a glass popover under it. `items` renders the menu's
 * buttons and gets `close`. Focus goes to `[data-autofocus]`, else the first item.
 */
function MenuPopover({ trigger, items }: { trigger: MenuTrigger; items: (close: () => void) => ReactNode }) {
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
    const menu = menuRef.current
    ;(menu?.querySelector<HTMLElement>('[data-autofocus]') ?? menu?.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true })
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
              {items(() => setOpen(false))}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

export interface PickerMenuProps<T extends string | number> {
  trigger: MenuTrigger
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

/** A toolbar Menu holding one Picker (the range menu, Appearance), with a checkmark on the current option. */
export function PickerMenu<T extends string | number>({ trigger, options, value, onChange }: PickerMenuProps<T>) {
  return (
    <MenuPopover
      trigger={trigger}
      items={(close) =>
        options.map((option) => {
          const checked = option.value === value
          return (
            <button
              key={String(option.value)}
              type="button"
              role="menuitemradio"
              aria-checked={checked}
              data-autofocus={checked || undefined}
              className="menu-item t-body"
              onClick={() => {
                close()
                if (!checked) onChange(option.value)
              }}
            >
              <span className="menu-check">{checked && <Glyph name="checked" size="0.95em" weight={2.4} />}</span>
              <span>{option.label}</span>
            </button>
          )
        })
      }
    />
  )
}

export interface ActionMenuItem {
  label: string
  /** `Button(role: .destructive)`: system red. */
  destructive?: boolean
  onClick: () => void
}

/** A toolbar Menu of plain buttons (Saved's account menu: Sign out, Delete account). */
export function ActionMenu({ trigger, items }: { trigger: MenuTrigger; items: ActionMenuItem[] }) {
  return (
    <MenuPopover
      trigger={trigger}
      items={(close) =>
        items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={`menu-item is-action t-body ${item.destructive ? 'is-destructive' : ''}`}
            onClick={() => {
              close()
              item.onClick()
            }}
          >
            {item.label}
          </button>
        ))
      }
    />
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
