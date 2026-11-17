// Port of Logic/TodayLayout.swift: filters, ranking, drive bands, the
// within/farther split, and the grey meta line under a Spot's name.

import { kindShortTitle, type Recommendation, type Species, type SpotSummary } from "../data/types";
import type { DriveTime } from "./driveTimes";
import { localDayFromDate, type LocalDay } from "./localDay";
import { formatRange, isOpen, isRecent, weekLabel } from "./spotFacts";

/** The Angler's filters on Today, combined with AND. */
export interface SpotFilters {
  /** A `Species.group` ("Trout", "Bass", …); null is All. */
  speciesGroup: string | null;
  stockedRecently: boolean;
  /** Every Community Fishing Program water, Lakes and Ponds alike. */
  communityWatersOnly: boolean;
  freeEntry: boolean;
  openNow: boolean;
}

export const emptyFilters = (): SpotFilters => ({
  speciesGroup: null,
  stockedRecently: false,
  communityWatersOnly: false,
  freeEntry: false,
  openNow: false,
});

/** The toggles behind the Filters button (not the species chip). */
export function activeToggleCount(f: SpotFilters): number {
  return [f.stockedRecently, f.communityWatersOnly, f.freeEntry, f.openNow].filter(Boolean).length;
}

export function filtersAreEmpty(f: SpotFilters): boolean {
  return f.speciesGroup === null && activeToggleCount(f) === 0;
}

/** Fish chips in display order; only groups present in a Recommendation are shown. */
export const speciesGroups = ["Trout", "Bass", "Catfish", "Crappie", "Striped bass", "Walleye", "Sunfish"];

/** The species chips: the groups among every Spot in range, in chip order. */
export function chipGroups(groups: string[]): string[] {
  return speciesGroups.filter((g) => groups.includes(g));
}

/** Whether a Spot passes every active filter at `now`. Unknown values fail a filter that needs them. */
export function matchesFilters(f: SpotFilters, spot: SpotSummary, species: Map<number, Species>, now: Date): boolean {
  if (f.speciesGroup !== null && !spot.speciesIds.some((id) => species.get(id)?.group === f.speciesGroup)) return false;
  if (f.stockedRecently && !isRecent(spot.lastStockedOn, localDayFromDate(now))) return false;
  if (f.communityWatersOnly && spot.kind !== "community_pond") return false;
  if (f.freeEntry && spot.isFree !== true) return false;
  if (f.openNow && !isOpen(spot.hours, now)) return false;
  return true;
}

/** "No trout Spots", "No Spots match your filters". */
export function noMatchTitle(f: SpotFilters): string {
  if (activeToggleCount(f) === 0 && f.speciesGroup !== null) return `No ${f.speciesGroup.toLowerCase()} Spots`;
  return "No Spots match your filters";
}

/** Drive-time ranges the Angler can pick; 2 hours by default. */
export const driveRangeOptions = [30, 60, 120, 180, 240];
export const defaultRangeMinutes = 120;

/** A candidate with its drive time, once known. */
export interface RankedSpot {
  spot: SpotSummary;
  distanceMi: number;
  /** Null while unknown (shown as "~N mi"). */
  driveMinutes: number | null;
}

export interface TodaySection {
  title: string;
  spots: RankedSpot[];
}

export type TodayEmpty =
  | { kind: "noSpotsInRange"; nearest: RankedSpot | null }
  | { kind: "noMatches"; fartherMatches: number };

export interface TodayLayout {
  sections: TodaySection[];
  /** Matching Spots beyond the range that "Show farther Spots" would reveal. */
  hiddenFartherCount: number;
  /** Set when `sections` is empty. */
  empty: TodayEmpty | null;
}

export const pendingTitle = "Getting drive times";

/** "Under 30 min", "30 to 60 min", "1 to 2 hours", then hourly bands up to the range. */
export function bands(range: number): { title: string; minutes: [number, number] }[] {
  const all: { title: string; minutes: [number, number] }[] = [{ title: "Under 30 min", minutes: [0, 30] }];
  if (range > 30) all.push({ title: "30 to 60 min", minutes: [31, 60] });
  for (let hour = 1; hour * 60 < range; hour++) {
    all.push({ title: `${hour} to ${hour + 1} hours`, minutes: [hour * 60 + 1, (hour + 1) * 60] });
  }
  return all.map((b) => ({ title: b.title, minutes: [b.minutes[0], Math.min(b.minutes[1], range)] }));
}

const byDrive = (a: RankedSpot, b: RankedSpot) =>
  (a.driveMinutes ?? 0) - (b.driveMinutes ?? 0) || (a.spot.name < b.spot.name ? -1 : a.spot.name > b.spot.name ? 1 : 0);

export function makeTodayLayout(
  recommendation: Recommendation,
  driveTimes: Map<number, DriveTime>,
  filters: SpotFilters,
  showFarther: boolean,
  now: Date,
): TodayLayout {
  const range = recommendation.rangeMinutes;
  const species = new Map<number, Species>();
  for (const s of recommendation.species) if (!species.has(s.id)) species.set(s.id, s);
  const inRange: RankedSpot[] = [];
  const farther: RankedSpot[] = [];
  const pending: RankedSpot[] = [];
  for (const c of recommendation.candidates) {
    const time = driveTimes.get(c.spot.id);
    if (time === undefined) {
      pending.push({ spot: c.spot, distanceMi: c.distanceMi, driveMinutes: null });
    } else if (time.kind === "minutes") {
      const ranked = { spot: c.spot, distanceMi: c.distanceMi, driveMinutes: time.minutes };
      if (time.minutes <= range) inRange.push(ranked);
      else if (time.minutes <= 2 * range) farther.push(ranked);
    }
  }
  inRange.sort(byDrive);
  farther.sort(byDrive);
  pending.sort((a, b) => a.distanceMi - b.distanceMi);

  const matches = (r: RankedSpot) => matchesFilters(filters, r.spot, species, now);
  const inRangeMatches = inRange.filter(matches);
  const fartherMatches = farther.filter(matches);
  const pendingMatches = pending.filter(matches);
  const hidden = showFarther ? 0 : fartherMatches.length;

  if (inRange.length === 0 && pending.length === 0 && !showFarther) {
    return { sections: [], hiddenFartherCount: hidden, empty: { kind: "noSpotsInRange", nearest: farther[0] ?? null } };
  }
  const sections: TodaySection[] = [];
  for (const band of bands(range)) {
    const spots = inRangeMatches.filter((s) => s.driveMinutes! >= band.minutes[0] && s.driveMinutes! <= band.minutes[1]);
    if (spots.length > 0) sections.push({ title: band.title, spots });
  }
  if (pendingMatches.length > 0) sections.push({ title: pendingTitle, spots: pendingMatches });
  if (showFarther && fartherMatches.length > 0) {
    sections.push({ title: `Farther than ${formatRange(range)}`, spots: fartherMatches });
  }
  if (sections.length === 0) {
    return { sections: [], hiddenFartherCount: hidden, empty: { kind: "noMatches", fartherMatches: fartherMatches.length } };
  }
  return { sections, hiddenFartherCount: hidden, empty: null };
}

// ---------- SpotMeta ----------

export interface SpotMetaLine {
  kind: string;
  detail: string | null;
  /** The detail is a recent stocking, shown in the data color (slate). */
  isRecentStocking: boolean;
}

/** "Bluegill, redear sunfish": the first name as written, the rest lowercased. */
function speciesList(list: Species[]): string {
  return list.map((s, i) => (i === 0 ? s.name : s.name.toLowerCase())).join(", ");
}

/**
 * "Pond · Stocked this week", else the kind and the first two species. With a fish chip on
 * (`group`), the Spot's species in that group instead: "Lake · Bluegill, redear sunfish".
 */
export function spotMetaLine(
  spot: SpotSummary,
  species: Map<number, Species>,
  today: LocalDay,
  group: string | null = null,
): SpotMetaLine {
  const kind = kindShortTitle(spot);
  if (group) {
    const matched = spot.speciesIds.map((id) => species.get(id)).filter((s): s is Species => !!s && s.group === group);
    if (matched.length > 0) return { kind, detail: speciesList(matched.slice(0, 2)), isRecentStocking: false };
  }
  if (spot.lastStockedOn) {
    const label = weekLabel(spot.lastStockedOn, today);
    return { kind, detail: `Stocked ${label.toLowerCase()}`, isRecentStocking: isRecent(spot.lastStockedOn, today) };
  }
  const named = spot.speciesIds.slice(0, 2).map((id) => species.get(id)).filter((s): s is Species => !!s);
  return { kind, detail: named.length === 0 ? null : speciesList(named), isRecentStocking: false };
}

/** Swift's `DriveRange` namespace, for call-site parity. */
export const DriveRange = { options: driveRangeOptions, defaultMinutes: defaultRangeMinutes };
