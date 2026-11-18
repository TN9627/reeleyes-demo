// Port of GearViews.swift's GearSection, SpeciesCard, GearEmptyCard and ShowAllSpeciesButton:
// a grid of species cards, each opening the species sheet (shared with the Spot screen).

import { useState } from "react";
import type { Gear, StockingEvent } from "../../data/types";
import type { LocalDay } from "../../logic/localDay";
import {
  canToggle,
  collapsedCount,
  emptyGearExpansion,
  gearEntries,
  isGearExpanded,
  rows,
  toggleGearExpansion,
  visible,
  type GearEntry,
} from "../../logic/gearLayout";
import { Glyph } from "../../ui/Glyph";
import { SpeciesImage } from "../../ui/Media";
import { SpeciesSheet } from "../spot/SpeciesSheet";
import { Footnote, SectionHeader } from "../../ui/Surfaces";
import "./gear.css";

const columns = 2;

interface Props {
  gear: Gear[];
  spotID: number;
  spotName: string | null;
  stocking: StockingEvent[];
  today: LocalDay;
  /** The species whose sheet is open; owned by the caller. */
  selectedID: number | null;
  onSelectedIDChange: (id: number | null) => void;
  /** The sheet's artificial-only rule line, after the sheet has closed: show Prep's Rules. */
  openRules: () => void;
}

export function GearSection({ gear, spotID, spotName, stocking, today, selectedID, onSelectedIDChange, openRules }: Props) {
  const [expansion, setExpansion] = useState(emptyGearExpansion);
  const entries = gearEntries(gear, stocking, today);
  const expanded = isGearExpanded(expansion, spotID);
  const selected = entries.find((e) => e.gear.speciesId === selectedID) ?? null;

  return (
    <section>
      <SectionHeader title="Gear and bait" trailing={entries.length === 0 ? undefined : `${entries.length} species`} />
      {entries.length === 0 ? (
        <>
          <GearEmptyCard />
          <Footnote>Species and stocking from AZGFD.</Footnote>
        </>
      ) : (
        <>
          <div className="gear-grid">
            {rows(visible(entries, expanded), columns).map((row, i) => (
              <div key={i} className="gear-row">
                {row.map((entry) => (
                  <SpeciesCard key={entry.gear.speciesId} entry={entry} onOpen={() => onSelectedIDChange(entry.gear.speciesId)} />
                ))}
              </div>
            ))}
          </div>
          {canToggle(entries.length) && (
            <ShowAllSpeciesButton
              count={entries.length}
              expanded={expanded}
              toggle={() => setExpansion((e) => toggleGearExpansion(e, spotID))}
            />
          )}
          <Footnote>Tap a fish for where they hang out, gear and steps. Adapted from AZGFD.</Footnote>
        </>
      )}
      {selected && (
        <SpeciesSheet
          key={selected.gear.speciesId}
          entry={selected}
          spotName={spotName}
          onClose={() => onSelectedIDChange(null)}
          openRules={openRules}
        />
      )}
    </section>
  );
}

/** "Show all N species" / "Show fewer" under a species list trimmed to `collapsedCount`. */
function ShowAllSpeciesButton({ count, expanded, toggle }: { count: number; expanded: boolean; toggle: () => void }) {
  const [announcement, setAnnouncement] = useState("");
  return (
    <>
      <button
        type="button"
        className="gear-show-all t-body"
        onClick={() => {
          toggle();
          setAnnouncement(`Showing ${expanded ? collapsedCount : count} species`);
        }}
      >
        {expanded ? "Show fewer" : `Show all ${count} species`}
      </button>
      <span className="visually-hidden" aria-live="polite">
        {announcement}
      </span>
    </>
  );
}

/** One species: its photo, name and, when stocked recently, the slate outline and age. */
function SpeciesCard({ entry, onOpen }: { entry: GearEntry; onOpen: () => void }) {
  const stocked = entry.stockedAge !== null;
  return (
    <button
      type="button"
      className="gear-species-card"
      data-stocked={stocked || undefined}
      onClick={onOpen}
      aria-label={stocked ? `${entry.gear.name}, stocked ${entry.stockedAge}` : entry.gear.name}
      aria-description="Shows where they hang out, gear and steps."
    >
      <SpeciesImage slug={entry.gear.slug} height={64} symbolSize={34} />
      <span className="t-subheadline-semibold c-ink">{entry.gear.name}</span>
      {stocked && <span className="t-footnote-semibold c-data-ink">{`Stocked ${entry.stockedAge}`}</span>}
    </button>
  );
}

/** The card for a Spot where AZGFD lists no fish. */
function GearEmptyCard() {
  return (
    <div className="gear-empty">
      <span className="gear-empty-glyph" aria-hidden="true">
        <Glyph name="species" size="22px" />
      </span>
      <p className="t-headline c-ink">No species listed for this Spot</p>
      <p className="t-subheadline c-ink-secondary">AZGFD lists no fish here, so there's no gear to suggest yet.</p>
    </div>
  );
}
