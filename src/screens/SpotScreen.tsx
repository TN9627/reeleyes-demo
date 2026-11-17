// Port of SpotView.swift: a Spot. The hero (photos, or the map alone) under a content sheet
// with the name, drive and Prep buttons, facts, species, stocking and hours.

import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { dataNotice, driveMinutes, prep, spotDetail } from "../data/repository";
import { kindTitle, type Species, type SpotDetail } from "../data/types";
import { canToggle, collapsedCount, gearEntries, ordered, recentStocking, visible } from "../logic/gearLayout";
import { localDayFromDate, type LocalDay } from "../logic/localDay";
import {
  beyondSpeciesList,
  formatDrive,
  isRecent,
  recentMeta,
  scheduledMeta,
  stockingWeeks,
  stockingWeeksIsEmpty,
  weekLabel,
  type StockingLine,
} from "../logic/spotFacts";
import { favoriteTapped, useAppState } from "../state/appState";
import { Glyph, spotKindGlyph } from "../ui/Glyph";
import { SpeciesImage } from "../ui/Media";
import { BarButton, Screen } from "../ui/Screen";
import { Button } from "../ui/Controls";
import { Card, EmptyState, Footnote, Row, SectionHeader } from "../ui/Surfaces";
import { DirectionsDialog } from "./spot/DirectionsDialog";
import { SpeciesSheet } from "./spot/SpeciesSheet";
import { SpotHero } from "./spot/SpotHero";
import "./spot/spot.css";

export default function SpotScreen() {
  const { id } = useParams();
  const detail = spotDetail(Number(id));
  return detail ? (
    <SpotContent key={detail.summary.id} detail={detail} />
  ) : (
    <Screen title="" titleDisplay="inline">
      <EmptyState glyph="error" title="Couldn't load this Spot" message="Try again in a moment." />
    </Screen>
  );
}

function SpotContent({ detail }: { detail: SpotDetail }) {
  const spot = detail.summary;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [showsNavTitle, setShowsNavTitle] = useState(false);
  const [showsDriveDialog, setShowsDriveDialog] = useState(false);
  const [openedSpeciesID, setOpenedSpeciesID] = useState<number | null>(null);
  const [showsAllSpecies, setShowsAllSpecies] = useState(false);
  const saved = useAppState((s) => s.favoriteIds.includes(spot.id));
  const start = useAppState((s) => s.start);
  const today = localDayFromDate(new Date());
  const drive = start ? driveMinutes(start.coordinate, spot.id) : null;

  /** Gear for the Spot's species, in Prep's order. */
  const entries = gearEntries(prep(spot.id)?.gear ?? [], detail.stocking, today);
  const openedEntry = entries.find((e) => e.gear.speciesId === openedSpeciesID) ?? null;

  // The Spot's name joins the bar once its title has scrolled under the bar's row.
  function onScroll() {
    const title = titleRef.current;
    const bar = title?.closest(".screen")?.querySelector(".nav-bar-row");
    if (!title || !bar) return;
    setShowsNavTitle(title.getBoundingClientRect().bottom < bar.getBoundingClientRect().bottom);
  }

  useEffect(() => {
    document.title = `${spot.name} · ReelEyes`;
  }, [spot.name]);

  const facts: Fact[] = [
    {
      label: "Stocked",
      value: stockedFact(detail, today),
      color: isRecent(spot.lastStockedOn, today) ? "data-ink" : spot.lastStockedOn == null ? "ink-tertiary" : "ink",
    },
    {
      label: "Hours",
      value: spot.hours ? spot.hours.summary.replaceAll("Open ", "") : "Not listed",
      color: spot.hours ? "ink" : "ink-tertiary",
    },
    {
      label: "Fee",
      value: feeFact(detail),
      color: spot.isFree == null && detail.feeNote == null ? "ink-tertiary" : "ink",
    },
  ];
  const speciesNote = beyondSpeciesList(detail.speciesNote);

  return (
    <Screen
      title={spot.name}
      titleDisplay="inline"
      bar="overlay"
      barTitleVisible={showsNavTitle}
      inset={false}
      bottomPadding={0}
      onScroll={onScroll}
      trailing={
        <BarButton
          glyph="saved"
          glyphVariant={saved ? "fill" : "none"}
          ariaLabel={saved ? "Remove from Saved" : "Save Spot"}
          onClick={() => favoriteTapped(spot.id, spot.name)}
        />
      }
    >
      <SpotHero spot={spot} photos={detail.photos} />
      {/* The content sheet: Eggshell with 24pt top corners, in front of the hero's bottom edge. */}
      <div className="sp-content">
        <h1 ref={titleRef} className="sp-title t-title c-ink">
          {spot.name}
        </h1>
        <p className="sp-kind t-body c-ink-secondary">
          <Glyph name={spotKindGlyph(spot)} />
          {kindTitle(spot)} · {spot.county} County
        </p>
        <div className="sp-actions">
          <Button glyph="drive" glyphVariant="fill" onClick={() => setShowsDriveDialog(true)}>
            {drive !== null ? formatDrive(drive) : "Directions"}
          </Button>
          <Link to={`/spot/${spot.id}/prep`} className="button button-secondary t-headline">
            <Glyph name="prep" />
            <span>Prep</span>
          </Link>
        </div>
        <FactStrip facts={facts} />

          <SectionHeader title="Fish here" trailing={detail.species.length === 0 ? undefined : `${detail.species.length} species`} />
          {detail.species.length === 0 ? (
            <Card>
              <p className="sp-row-text t-body c-ink-secondary">No species listed for this Spot</p>
            </Card>
          ) : (
            <SpeciesList
              detail={detail}
              today={today}
              expanded={showsAllSpecies}
              opens={(s) => entries.some((e) => e.gear.speciesId === s.id)}
              onOpen={(s) => setOpenedSpeciesID(s.id)}
              onToggle={() => setShowsAllSpecies((v) => !v)}
            />
          )}
          {speciesNote && <Footnote>{speciesNote}</Footnote>}

          <SectionHeader title="Stocking" />
          <Card>
            <StockingRows detail={detail} today={today} />
          </Card>
          {/* AZGFD's stocking note once, under the weeks, rather than under every week. */}
          <Footnote>
            {[detail.stocking.length === 0 ? null : detail.stockingNote, "AZGFD publishes the week a water is stocked, with no counts or sizes."]
              .filter(Boolean)
              .join(" ")}
          </Footnote>

          {/* Hours and fee already lead in the fact strip; this card holds only what it can't. */}
          {detail.hoursDetail.length > 0 && (
            <>
              <SectionHeader title="Hours and access" />
              <Card>
                {detail.hoursDetail.map((line) => (
                  <p key={line} className="sp-row-text t-body c-ink">
                    {line}
                  </p>
                ))}
              </Card>
            </>
          )}
        <Footnote>{`Spot, species and stocking from AZGFD. ${dataNotice}`}</Footnote>
      </div>

      {showsDriveDialog && <DirectionsDialog spot={spot} driveMinutes={drive} onClose={() => setShowsDriveDialog(false)} />}
      {openedEntry && <SpeciesSheet entry={openedEntry} spotName={spot.name} onClose={() => setOpenedSpeciesID(null)} />}
    </Screen>
  );
}

interface Fact {
  label: string;
  value: string;
  color: "ink" | "ink-tertiary" | "data-ink";
}

/** Facts side by side with hairlines (SpotView.swift's FactStrip: Stocked / Hours / Fee). */
function FactStrip({ facts }: { facts: Fact[] }) {
  return (
    <div className="sp-facts">
      {facts.map((f) => (
        <div key={f.label} className="sp-fact" role="group" aria-label={`${f.label}, ${f.value}`}>
          <div className="t-footnote c-ink-secondary" aria-hidden>
            {f.label}
          </div>
          <div className={`t-subheadline-semibold c-${f.color}`} aria-hidden>
            {f.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/** "Not listed" rather than "Not stocked" when AZGFD's note says the Spot is stocked but no week is dated. */
function stockedFact(detail: SpotDetail, today: LocalDay): string {
  const last = detail.summary.lastStockedOn;
  if (last) return weekLabel(last, today);
  return detail.stockingNote == null ? "Not stocked" : "Not listed";
}

function feeFact(detail: SpotDetail): string {
  if (detail.feeNote) return detail.feeNote.replaceAll(" per vehicle", "/car");
  if (detail.summary.isFree === true) return "Free";
  if (detail.summary.isFree === false) return "Fee";
  return "Not listed";
}

/**
 * One row per species in a card, in Prep's order (recently stocked first, then A to Z) and,
 * like Prep's gear, the first few until "Show all": thumbnail, name, "Stocked" when stocked
 * recently, and a disclosure when the row opens the species sheet.
 */
function SpeciesList({
  detail,
  today,
  expanded,
  opens,
  onOpen,
  onToggle,
}: {
  detail: SpotDetail;
  today: LocalDay;
  expanded: boolean;
  opens: (s: Species) => boolean;
  onOpen: (s: Species) => void;
  onToggle: () => void;
}) {
  const latest = recentStocking(detail.stocking, today);
  const species = ordered(detail.species, (s) => s.id, (s) => s.name, latest);
  const [announcement, setAnnouncement] = useState("");
  return (
    <>
      <Card>
        {visible(species, expanded).map((s) => (
          <Row
            key={s.id}
            minHeight={52}
            chevron={opens(s)}
            onClick={opens(s) ? () => onOpen(s) : undefined}
            className="sp-species-row"
          >
            {/* A wide 40×20pt slot, so a 2:1 fish reads at row size. */}
            <SpeciesImage slug={s.slug} height={20} width={40} symbolSize={15} thumbnail />
            <span className="sp-species-name">
              <span className="t-body c-ink">{s.name}</span>
              {latest.has(s.id) && <span className="t-footnote-semibold c-data-ink">Stocked</span>}
            </span>
          </Row>
        ))}
      </Card>
      {canToggle(species.length) && (
        <button
          type="button"
          className="sp-show-all t-body c-accent"
          onClick={() => {
            setAnnouncement(`Showing ${expanded ? collapsedCount : species.length} species`);
            onToggle();
          }}
        >
          {expanded ? "Show fewer" : `Show all ${species.length} species`}
        </button>
      )}
      <div className="visually-hidden" aria-live="polite">
        {announcement}
      </div>
    </>
  );
}

function StockingRows({ detail, today }: { detail: SpotDetail; today: LocalDay }) {
  const weeks = stockingWeeks(detail.stocking, today);
  if (stockingWeeksIsEmpty(weeks)) {
    return (
      <div className="sp-stocking-empty">
        {detail.stockingNote ? (
          // No dated weeks, but AZGFD describes stocking here: say what it says.
          <>
            <div className="t-body c-ink">No stocking weeks listed</div>
            <div className="t-subheadline c-ink-secondary">{detail.stockingNote}</div>
          </>
        ) : (
          <>
            <div className="t-body c-ink">Not stocked by AZGFD</div>
            {detail.species.length > 0 && <div className="t-subheadline c-ink-secondary">Resident fish only</div>}
          </>
        )}
      </div>
    );
  }
  const name = (line: StockingLine) => detail.species.find((s) => s.id === line.speciesId)?.name ?? "Fish";
  return (
    <>
      {weeks.recent.map((line) => {
        const recent = isRecent(line.week, today);
        return (
          <StockingRow
            key={`r${line.speciesId}`}
            name={name(line)}
            meta={recentMeta(line)}
            label={weekLabel(line.week, today)}
            labelClass={recent ? "t-body semibold c-data-ink" : "t-body c-ink-secondary"}
          />
        );
      })}
      {weeks.scheduled.map((line) => (
        <StockingRow
          key={`s${line.speciesId}`}
          name={name(line)}
          meta={scheduledMeta(line)}
          label={weekLabel(line.week, today)}
          labelClass="t-body c-ink-secondary"
        />
      ))}
    </>
  );
}

/** A species' stocking: its name over a meta line, the week trailing. */
function StockingRow({ name, meta, label, labelClass }: { name: string; meta: string | null; label: string; labelClass: string }) {
  return (
    <div className="sp-stocking-row">
      <div className="sp-stocking-text">
        <div className="t-body c-ink">{name}</div>
        {meta && <div className="t-subheadline c-ink-secondary">{meta}</div>}
      </div>
      <div className={labelClass}>{label}</div>
    </div>
  );
}
