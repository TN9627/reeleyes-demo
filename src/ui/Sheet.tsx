import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface SheetAction {
  label: string
  onClick: () => void
  disabled?: boolean
}

export interface SheetProps {
  open: boolean
  /** Swipe down, the scrim, Escape and (by default) Done all call it. */
  onClose: () => void
  title: string
  subtitle?: string
  /** `medium`: about half the screen, floating (Filters); `large`: nearly full (Starting point). */
  detent?: 'medium' | 'large'
  /** The confirmation slot, semibold brick; defaults to Done → onClose. Pass null for none. */
  done?: SheetAction | null
  /** The cancellation slot (Filters' Reset). */
  cancel?: SheetAction
  /** No toolbar (the sign-in sheet): only the grabber; `title` still names the dialog. */
  hidesTitleBar?: boolean
  children: ReactNode
}

const exitMs = 280

/**
 * An iOS sheet: rises from the bottom over a scrim, a grabber and inline title bar with
 * Reset and Done slots, Eggshell ground, its own scroll view. Drag the bar down to dismiss.
 */
export function Sheet({ open, onClose, title, subtitle, detent = 'large', done, cancel, hidesTitleBar, children }: SheetProps) {
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  const [drag, setDrag] = useState(0)
  const dragStart = useRef<{ y: number; t: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
      setDrag(0)
      return
    }
    if (!mounted) return
    setClosing(true)
    const timer = setTimeout(() => {
      setMounted(false)
      setClosing(false)
    }, exitMs)
    return () => clearTimeout(timer)
  }, [open, mounted])

  // While open: the app behind is inert, focus moves in and returns after, Escape closes.
  useEffect(() => {
    if (!mounted || closing) return
    const root = document.getElementById('root')
    const previous = document.activeElement as HTMLElement | null
    root?.setAttribute('inert', '')
    panelRef.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      root?.removeAttribute('inert')
      window.removeEventListener('keydown', onKey)
      previous?.focus?.({ preventScroll: true })
    }
  }, [mounted, closing])

  if (!mounted) return null

  const onPointerDown = (event: ReactPointerEvent) => {
    if ((event.target as HTMLElement).closest('button')) return
    dragStart.current = { y: event.clientY, t: event.timeStamp }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent) => {
    if (!dragStart.current) return
    const dy = event.clientY - dragStart.current.y
    // Rubber-band upward, follow the finger downward.
    setDrag(dy > 0 ? dy : -Math.sqrt(-dy) * 2)
  }
  const onPointerUp = (event: ReactPointerEvent) => {
    if (!dragStart.current) return
    const dy = event.clientY - dragStart.current.y
    const velocity = dy / Math.max(event.timeStamp - dragStart.current.t, 1)
    dragStart.current = null
    if (dy > 120 || velocity > 0.6) onClose()
    else setDrag(0)
  }

  const doneAction = done === undefined ? { label: 'Done', onClick: onClose } : done

  return createPortal(
    <div className={`sheet-host ${closing ? 'is-closing' : ''}`}>
      <div className="sheet-scrim" onClick={onClose} />
      <div
        ref={panelRef}
        className={`sheet is-${detent}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
      >
        <div className="sheet-bar" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <span className="sheet-grabber" aria-hidden="true" />
          <div className={`sheet-bar-row ${hidesTitleBar ? 'visually-hidden' : ''}`}>
            <div className="sheet-bar-side">
              {cancel && (
                <button type="button" className="sheet-action glass t-body c-accent" onClick={cancel.onClick} disabled={cancel.disabled}>
                  {cancel.label}
                </button>
              )}
            </div>
            <div className="sheet-title">
              <h2 id={titleId} className="t-headline truncate">
                {title}
              </h2>
              {subtitle && <p className="t-footnote c-ink-secondary truncate">{subtitle}</p>}
            </div>
            <div className="sheet-bar-side is-trailing">
              {doneAction && (
                <button type="button" className="sheet-action glass t-headline c-accent" onClick={doneAction.onClick} disabled={doneAction.disabled}>
                  {doneAction.label}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="sheet-body scroll-y">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
