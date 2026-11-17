// Prep's disclosure row (brick label, rotating chevron) and the "Rules on azgfd.com" link.

import { Glyph } from "../../ui/Glyph";

export function Disclosure({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" className="prep-disclosure" onClick={onToggle} aria-expanded={open}>
      <span>{label}</span>
      <Glyph name="disclosure" size="0.95em" weight={2.4} className={open ? "prep-chevron prep-chevron-open" : "prep-chevron"} />
    </button>
  );
}

export function RulesLink({ href }: { href: string }) {
  return (
    <a className="prep-link" href={href} target="_blank" rel="noreferrer">
      <Glyph name="rules" size="1.2em" />
      <span>Rules on azgfd.com</span>
    </a>
  );
}
