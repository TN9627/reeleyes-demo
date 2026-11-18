// Prep's "Rules on azgfd.com" link, and WindowViews.swift's NoteLine.

import type { ReactNode } from "react";
import { Glyph, type GlyphName } from "../../ui/Glyph";

export function RulesLink({ href }: { href: string }) {
  return (
    <a className="prep-link" href={href} target="_blank" rel="noreferrer">
      <Glyph name="rules" size="1.2em" />
      <span>Rules on azgfd.com</span>
    </a>
  );
}

/** A footnote with an amber glyph: what limits a reading (old forecast, alerts unchecked). */
export function NoteLine({ glyph, className, children }: { glyph: GlyphName; className?: string; children: ReactNode }) {
  return (
    <p className={`note-line ${className ?? ""}`}>
      <Glyph name={glyph} className="note-line-glyph" size="1.05em" weight={2.3} />
      <span>{children}</span>
    </p>
  );
}
