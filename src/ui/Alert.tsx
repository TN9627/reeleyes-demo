import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface AlertAction {
  label: string
  /** `cancel` closes the alert; `destructive` is system red. */
  role?: 'cancel' | 'destructive'
  onClick?: () => void
}

export interface AlertProps {
  open: boolean
  title: string
  message?: string
  /** Two short ones sit side by side, as on iOS, Cancel leading; longer ones stack, Cancel last. */
  actions: AlertAction[]
  /** Escape, and every action after its own `onClick`. */
  onClose: () => void
}

/** The system alert (SwiftUI `.alert`): a centered glass card over a dim scrim. */
export function Alert({ open, title, message, actions, onClose }: AlertProps) {
  const titleId = useId()
  const messageId = useId()
  const cardRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const root = document.getElementById('root')
    const previous = document.activeElement as HTMLElement | null
    root?.setAttribute('inert', '')
    cardRef.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      root?.removeAttribute('inert')
      window.removeEventListener('keydown', onKey)
      previous?.focus?.({ preventScroll: true })
    }
  }, [open])

  if (!open) return null
  // Side by side while two short labels fit, Cancel leading; otherwise stacked, Cancel last.
  const stacked = actions.length > 2 || actions.some((action) => action.label.length > 12)
  const cancelFirst = (a: AlertAction, b: AlertAction) => Number(b.role === 'cancel') - Number(a.role === 'cancel')
  const ordered = [...actions].sort(stacked ? (a, b) => cancelFirst(b, a) : cancelFirst)

  return createPortal(
    <div className="alert-host">
      <div className="alert-scrim" />
      <div
        ref={cardRef}
        className="alert"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
      >
        <h2 id={titleId} className="t-headline">
          {title}
        </h2>
        {message && (
          <p id={messageId} className="t-subheadline">
            {message}
          </p>
        )}
        <div className={`alert-actions ${stacked ? 'is-stacked' : ''}`}>
          {ordered.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`alert-action t-headline ${action.role ? `is-${action.role}` : ''}`}
              onClick={() => {
                action.onClick?.()
                onClose()
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
