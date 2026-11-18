// Port of GearViews.swift's SpeciesSheet: a species' habitat, what it bites, its fishing methods
// and, for the chosen method, what to bring and the steps. Self-contained: mount it while open;
// Done, the scrim, a swipe down or Escape play the exit, then call `onClose`. The artificial-only
// rule line plays the exit too, then calls `onClose` and `openRules`.

import { useEffect, useRef, useState } from "react";
import type { Bait, GearMethod } from "../../data/types";
import {
  baitsOfMethod,
  bringHeader,
  defaultMethodID,
  methodAnnouncement,
  methodFor,
  methodRowLabel,
  methodSteps,
  ruleLine,
  stepAccessibilityLabel,
  stepsHeader,
  type GearEntry,
} from "../../logic/gearLayout";
import { SpeciesImage } from "../../ui/Media";
import { Glyph } from "../../ui/Glyph";
import { Sheet } from "../../ui/Sheet";
import { Card, Footnote, SectionHeader } from "../../ui/Surfaces";
import { ArtificialOnlyLine, BaitPhoto, WhatTheyBiteSection } from "../bait/BaitViews";
import "./spot.css";

/** The shared Sheet's exit. */
const sheetExitMs = 280;

interface SpeciesSheetProps {
  entry: GearEntry;
  spotName: string | null;
  onClose: () => void;
  /** The artificial-only rule line's "Rules": called after the sheet has closed, to show Prep's Rules. */
  openRules: () => void;
}

export function SpeciesSheet({ entry, spotName, onClose, openRules }: SpeciesSheetProps) {
  const gear = entry.gear;
  const [open, setOpen] = useState(true);
  // Lives in the sheet, so each open starts on the recommended method; never persisted.
  const [selectedID, setSelectedID] = useState(() => defaultMethodID(gear.methods));
  // The Bait whose explanation is open under the row; each open starts closed.
  const [openBaitID, setOpenBaitID] = useState<string | null>(null);
  // The method row a "Fish it with" chip just selected, washed in Fill Strong for a moment.
  const [flashedID, setFlashedID] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  const how = useRef<HTMLDivElement>(null);
  const details = useRef<HTMLDivElement>(null);
  const rulesAfterExit = useRef(false);
  const method = methodFor(gear.methods, selectedID);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const openRulesRef = useRef(openRules);
  openRulesRef.current = openRules;

  useEffect(() => {
    if (open) {
      // The screen reader lands on the title once the sheet has finished presenting.
      const timer = window.setTimeout(() => title.current?.focus({ preventScroll: true }), 450);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      onCloseRef.current();
      if (rulesAfterExit.current) openRulesRef.current();
    }, sheetExitMs);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!flashedID) return;
    const timer = window.setTimeout(() => setFlashedID(null), 300);
    return () => window.clearTimeout(timer);
  }, [flashedID]);

  function select(m: GearMethod) {
    if (m.id === selectedID) return;
    setSelectedID(m.id);
    setAnnouncement(methodAnnouncement(m));
  }

  /** A "Fish it with" chip: select the method, scroll to How to fish and flash its row. */
  function fishWith(m: GearMethod) {
    select(m);
    (gear.methods.length > 1 ? how : details).current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFlashedID(m.id);
  }

  function showRules() {
    rulesAfterExit.current = true;
    setOpen(false);
  }

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="" detent="large">
      <div className="sp-sheet-content">
        <SpeciesImage slug={gear.slug} height={170} symbolSize={80} label={`Photo of ${gear.name.toLowerCase()}`} />
        <h2 ref={title} tabIndex={-1} className="sp-sheet-title t-title c-ink">
          {gear.name}
        </h2>
        {(entry.stockedAge || spotName) && (
          <p className="sp-sheet-meta t-subheadline c-ink-secondary">
            {entry.stockedAge && <span className="semibold c-data-ink">Stocked {entry.stockedAge}</span>}
            {entry.stockedAge && spotName && " · "}
            {spotName}
          </p>
        )}
        {gear.where && (
          <>
            <SectionHeader title="Where they hang out" />
            <Card>
              <p className="sp-row-text t-body c-ink">{gear.where}</p>
            </Card>
          </>
        )}
        {gear.baits.length > 0 ? (
          <WhatTheyBiteSection
            gear={gear}
            selectedMethodID={method?.id ?? null}
            openBaitID={openBaitID}
            onOpenBaitIDChange={setOpenBaitID}
            onFishWith={fishWith}
            openRules={showRules}
            onAnnounce={setAnnouncement}
          />
        ) : (
          ruleLine(gear) === "alone" && (
            <div className="sp-rule-alone">
              <ArtificialOnlyLine openRules={showRules} />
            </div>
          )
        )}
        {gear.methods.length > 1 && (
          <div ref={how}>
            <SectionHeader title="How to fish" />
            <div role="group" aria-label="Method">
              <Card>
                {gear.methods.map((m) => (
                  <MethodRow
                    key={m.id}
                    method={m}
                    selected={m.id === method?.id}
                    flashed={m.id === flashedID}
                    onSelect={() => select(m)}
                  />
                ))}
              </Card>
            </div>
          </div>
        )}
        {method && (
          // Bring and Steps cross-fade in place when the method changes.
          <div ref={details}>
            <div key={method.id} className="sp-fade-in">
              <SectionHeader title="Bring" trailing={bringHeader(method)} />
              <Card>
                {method.bring.map((item, i) => (
                  <div key={i} className="sp-bring-row">
                    <span className="sp-bring-dot" aria-hidden />
                    <span className="t-body c-ink">{item}</span>
                  </div>
                ))}
                {baitsOfMethod(method, gear).map((bait) => (
                  <BaitBringRow key={bait.id} bait={bait} />
                ))}
              </Card>
              <SectionHeader title="Steps" trailing={stepsHeader(method)} />
              <Card>
                {methodSteps(method).map((step) => (
                  <div key={step.number} className="sp-step-row" role="group" aria-label={stepAccessibilityLabel(step)}>
                    <span className="sp-step-number t-headline tnum c-ink" data-bite={step.isBite || undefined} aria-hidden>
                      {step.number}
                    </span>
                    <div className="sp-step-text" aria-hidden>
                      {step.isBite && <div className="t-footnote-semibold c-ink-secondary">When you get a bite</div>}
                      <div className="t-body c-ink">{step.text}</div>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}
        <Footnote>Limits and legal gear are under Rules in Prep.</Footnote>
        <div className="visually-hidden" aria-live="polite">
          {announcement}
        </div>
      </div>
    </Sheet>
  );
}

interface MethodRowProps {
  method: GearMethod;
  selected: boolean;
  /** Washed in Fill Strong while a "Fish it with" chip's selection fades. */
  flashed: boolean;
  onSelect: () => void;
}

/** One row per method; the Angler's choice carries the brick checkmark. */
function MethodRow({ method, selected, flashed, onSelect }: MethodRowProps) {
  return (
    <button
      type="button"
      className="sp-method-row sp-press-row"
      data-flashed={flashed || undefined}
      aria-label={methodRowLabel(method)}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <div className="sp-method-text">
        <div className="sp-method-name">
          <span className="t-headline c-ink">{method.name}</span>
          {method.recommended ? (
            <span className="t-footnote-semibold c-data-ink">Recommended</span>
          ) : (
            method.requirement && <span className="t-footnote c-ink-secondary">{method.requirement}</span>
          )}
        </div>
        <div className="t-subheadline c-ink-secondary">{method.summary}</div>
      </div>
      {/* Reserved when unselected so the text doesn't shift. */}
      <span className="sp-method-check" style={{ opacity: selected ? 1 : 0 }}>
        <Glyph name="checked" size={20} weight={2.6} />
      </span>
    </button>
  );
}

/** A bait to bring: its photo as a small square thumbnail and its name. Not tappable; its card is in the row above. */
function BaitBringRow({ bait }: { bait: Bait }) {
  return (
    <div className="bait-bring-row">
      <BaitPhoto bait={bait} side={36} glyphSize={17} />
      <span className="t-body c-ink">{bait.name}</span>
    </div>
  );
}
