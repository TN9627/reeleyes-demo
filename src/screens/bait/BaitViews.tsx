// Port of Views/BaitViews.swift: the species sheet's "What they bite" (#97), a snapping row of
// 150px Bait cards; tapping one opens its explanation under the row (why it works, how to hook
// it, Fish it with, the photo credit), and tapping it again or ✕ closes it. At an
// artificial-only Spot the rule line replaces the hint under the row.

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { baitTagLabel, type Bait, type Gear, type GearMethod } from "../../data/types";
import {
  artificialOnlyRuleLine,
  baitAnnouncement,
  baitCardLabel,
  methodsForBait,
  ruleLine,
  toggledBait,
  whatTheyBiteHeader,
  whatTheyBiteHint,
} from "../../logic/gearLayout";
import { Chip } from "../../ui/Controls";
import { Glyph } from "../../ui/Glyph";
import { photoURL } from "../../ui/images";
import { Card, Footnote, SectionHeader } from "../../ui/Surfaces";
import { LinkedCredit } from "../spot/photos";
import "./bait.css";

interface WhatTheyBiteSectionProps {
  gear: Gear;
  selectedMethodID: string | null;
  openBaitID: string | null;
  onOpenBaitIDChange: (id: string | null) => void;
  onFishWith: (method: GearMethod) => void;
  openRules: () => void;
  /** Spoken when a Bait's explanation opens or closes. */
  onAnnounce: (line: string) => void;
}

export function WhatTheyBiteSection({
  gear,
  selectedMethodID,
  openBaitID,
  onOpenBaitIDChange,
  onFishWith,
  openRules,
  onAnnounce,
}: WhatTheyBiteSectionProps) {
  const openBait = gear.baits.find((b) => b.id === openBaitID) ?? null;

  const toggle = (bait: Bait) => {
    const next = toggledBait(openBaitID, bait.id);
    onOpenBaitIDChange(next);
    const line = baitAnnouncement(gear.baits.find((b) => b.id === next) ?? null, openBait);
    if (line) onAnnounce(line);
  };

  const placement = ruleLine(gear);
  return (
    <div>
      <SectionHeader title="What they bite" trailing={whatTheyBiteHeader(gear)} />
      <div className="bait-row scroll-x" role="group" aria-label="Baits">
        {gear.baits.map((bait) => (
          <BaitCard key={bait.id} bait={bait} isOpen={bait.id === openBaitID} onClick={() => toggle(bait)} />
        ))}
      </div>
      {openBait && (
        <div key={openBait.id} className="bait-explanation-slot sp-fade-in">
          <BaitExplanation
            bait={openBait}
            methods={methodsForBait(openBait, gear)}
            selectedMethodID={selectedMethodID}
            onFishWith={onFishWith}
            onClose={() => toggle(openBait)}
          />
        </div>
      )}
      {placement === "none" ? (
        !openBait && (
          <div className="bait-hint">
            <Footnote>{whatTheyBiteHint}</Footnote>
          </div>
        )
      ) : (
        <div style={{ paddingTop: openBait ? 10 : 0 }}>
          <ArtificialOnlyLine openRules={openRules} />
        </div>
      )}
    </div>
  );
}

/** One Bait: its square photo, shop name and tag. Brick 2px outline while its explanation is open. */
function BaitCard({ bait, isOpen, onClick }: { bait: Bait; isOpen: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="bait-card"
      data-open={isOpen || undefined}
      aria-label={baitCardLabel(bait)}
      aria-pressed={isOpen}
      aria-description={isOpen ? "Closes why it works." : "Shows why it works and how to hook it."}
      onClick={onClick}
    >
      <BaitPhoto bait={bait} side={150} glyphSize={32} />
      <span className="bait-card-text">
        <span className="t-subheadline-semibold c-ink">{bait.name}</span>
        <span className="t-footnote c-ink-secondary">{baitTagLabel(bait.tag)}</span>
      </span>
    </button>
  );
}

interface BaitExplanationProps {
  bait: Bait;
  methods: GearMethod[];
  selectedMethodID: string | null;
  onFishWith: (method: GearMethod) => void;
  onClose: () => void;
}

/** The open Bait's explanation, a card under the row. */
function BaitExplanation({ bait, methods, selectedMethodID, onFishWith, onClose }: BaitExplanationProps) {
  return (
    <Card>
      <div className="bait-ex-head">
        <div className="bait-ex-title" role="heading" aria-level={3}>
          <span className="t-headline c-ink">{bait.name}</span>
          <span className="t-footnote c-ink-secondary">{baitTagLabel(bait.tag)}</span>
        </div>
        <button type="button" className="bait-ex-close c-ink-secondary" aria-label={`Close ${bait.name}`} onClick={onClose}>
          <Glyph name="close" size={17} weight={2.2} />
        </button>
      </div>
      <Block label="Why it works">
        <p className="t-body c-ink">{bait.why}</p>
      </Block>
      <Block label="How to hook it">
        <p className="t-body c-ink">{bait.hook}</p>
      </Block>
      {methods.length > 0 && (
        <Block label="Fish it with">
          <div className="bait-ex-chips">
            {methods.map((method) => {
              const selected = method.id === selectedMethodID;
              return (
                <Chip
                  key={method.id}
                  title={method.name}
                  selected={selected}
                  glyph={selected ? "checked" : undefined}
                  onClick={() => onFishWith(method)}
                />
              );
            })}
          </div>
        </Block>
      )}
      {bait.photo && <BaitCredit photo={bait.photo} />}
    </Card>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bait-ex-block">
      <div className="t-footnote-semibold c-ink-secondary">{label}</div>
      {children}
    </div>
  );
}

/** "Photo by Curtis Fry · CC BY 2.0  Wikimedia Commons ›", the explanation's last line, as on Spot photos. */
function BaitCredit({ photo }: { photo: NonNullable<Bait["photo"]> }) {
  // ViewThatFits: the line and the source side by side when both fit at their ideal width, else stacked.
  const ref = useRef<HTMLDivElement>(null);
  const [stacked, setStacked] = useState(false);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const measure = () => {
      const [line, source] = [...box.children] as HTMLElement[];
      const style = getComputedStyle(box);
      const available = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      line.style.whiteSpace = "nowrap";
      const ideal = line.scrollWidth + 6 + source.scrollWidth;
      line.style.whiteSpace = "";
      setStacked(ideal > available);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [photo]);
  return (
    <div ref={ref} className="bait-credit" data-stacked={stacked || undefined}>
      <span className="t-footnote c-ink-secondary">
        <LinkedCredit photo={photo} />
      </span>
      <a
        className="bait-credit-source t-footnote-semibold"
        href={photo.source.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open photo on ${photo.source.name}`}
      >
        {photo.source.name} <Glyph name="disclosure" size="0.8em" weight={3} />
      </a>
    </div>
  );
}

/** "Artificial flies and lures only here; bait isn't allowed. Rules": the whole line opens Prep's Rules. */
export function ArtificialOnlyLine({ openRules }: { openRules: () => void }) {
  return (
    <button
      type="button"
      className="bait-rule-line t-footnote c-ink-secondary"
      aria-label={artificialOnlyRuleLine}
      aria-description="Opens the rules for this Spot."
      onClick={openRules}
    >
      <span>
        {artificialOnlyRuleLine} <span className="semibold c-accent">Rules</span>
      </span>
    </button>
  );
}

/**
 * A Bait's square photo in a fixed slot (the card's 150px, a Bring row's thumbnail). Map Land
 * while it loads; the hook (real or smelly bait) or lure glyph on Map Land when it fails, and
 * on Fill Strong while the Bait has no photo yet.
 */
export function BaitPhoto({ bait, side, glyphSize }: { bait: Bait; side: number; glyphSize: number }) {
  const [phase, setPhase] = useState<"loading" | "loaded" | "failed">("loading");
  const glyph = (
    <Glyph name={bait.tag === "looks-like-food" ? "lure" : "hook"} size={glyphSize} className="c-ink-tertiary" />
  );
  if (!bait.photo) {
    return (
      <span className="bait-photo is-empty" style={{ width: side, height: side }} aria-hidden>
        {glyph}
      </span>
    );
  }
  return (
    <span className="bait-photo" style={{ width: side, height: side }} aria-hidden>
      {phase === "failed" ? (
        glyph
      ) : (
        <img
          src={photoURL(bait.photo)}
          alt=""
          draggable={false}
          className={phase === "loaded" ? "is-loaded" : ""}
          onLoad={() => setPhase("loaded")}
          onError={() => setPhase("failed")}
          ref={(img) => {
            // Already on the device: show at once, no fade.
            if (img?.complete && img.naturalWidth > 0 && phase === "loading") setPhase("loaded");
          }}
        />
      )}
    </span>
  );
}
