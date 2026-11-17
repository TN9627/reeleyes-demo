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

const columns = 2;

interface Props {
  gear: Gear[];
  spotID: number;
  spotName: string | null;
  stocking: StockingEvent[];
  today: LocalDay;
}

export function GearSection({ gear, spotID, spotName, stocking, today }: Props) {
  const [expansion, setExpansion] = useState(emptyGearExpansion);
  const [selectedID, setSelectedID] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const entries = gearEntries(gear, stocking, today);
  const expanded = isGearExpanded(expansion, spotID);
  const selected = entries.find((e) => e.gear.speciesId === selectedID) ?? null;

  const toggle = () => {
    setAnnouncement(`Showing ${expanded ? collapsedCount : entries.length} species`);
    setExpansion((e) => toggleGearExpansion(e, spotID));
  };

  return (
    <section>
      <SectionHeader title="Gear and bait" trailing={entries.length === 0 ? undefined : `${entries.length} species`} />
      {entries.length === 0 ? (
        <>
          <div className="prep-gear-empty">
            <span className="prep-gear-empty-glyph" aria-hidden="true">
              <Glyph name="species" size="22px" />
            </span>
            <p className="prep-gear-empty-title">No species listed for this Spot</p>
            <p className="prep-sub">AZGFD lists no fish here, so there's no gear to suggest yet.</p>
          </div>
          <Footnote>Species and stocking from AZGFD.</Footnote>
        </>
      ) : (
        <>
          <div className="prep-gear-grid">
            {rows(visible(entries, expanded), columns).map((row, i) => (
              <div key={i} className="prep-gear-row">
                {row.map((entry) => (
                  <SpeciesCard key={entry.gear.speciesId} entry={entry} onOpen={() => setSelectedID(entry.gear.speciesId)} />
                ))}
                {Array.from({ length: columns - row.length }, (_, j) => (
                  <span key={`pad${j}`} />
                ))}
              </div>
            ))}
          </div>
          {canToggle(entries.length) && (
            <button type="button" className="prep-show-all" onClick={toggle}>
              {expanded ? "Show fewer" : `Show all ${entries.length} species`}
            </button>
          )}
          <span className="visually-hidden" aria-live="polite">
            {announcement}
          </span>
          <Footnote>Tap a fish for where they hang out, gear and steps. Adapted from AZGFD.</Footnote>
        </>
      )}
      {selected && <SpeciesSheet entry={selected} spotName={spotName} onClose={() => setSelectedID(null)} />}
    </section>
  );
}

/** One species: its photo, name and, when stocked recently, the slate outline and age. */
function SpeciesCard({ entry, onOpen }: { entry: GearEntry; onOpen: () => void }) {
  const stocked = entry.stockedAge !== null;
  return (
    <button
      type="button"
      className={stocked ? "prep-species-card prep-species-card-stocked" : "prep-species-card"}
      onClick={onOpen}
      aria-label={stocked ? `${entry.gear.name}, stocked ${entry.stockedAge}` : entry.gear.name}
      aria-description="Shows where they hang out, gear and steps."
    >
      <SpeciesImage slug={entry.gear.slug} height={64} symbolSize={34} />
      <span className="prep-species-name">{entry.gear.name}</span>
      {stocked && <span className="prep-species-stocked">{`Stocked ${entry.stockedAge}`}</span>}
    </button>
  );
}
