// Port of Data/FixtureRepository.swift plus the sample-mode parts of
// App/TodayModel.swift, Logic/DriveTimes.swift and Logic/TodayLayout.swift.
//
// API (all synchronous; every value is made up):
//   dataNotice, startHint
//   loadFixtures(now) / fixtures()         decoded, time-shifted fixture set
//   species(), spotSummaries(), spotDetail(id), prep(spotId), conditions(spotId)
//   places(), placesMatching(query), cityName(near), nearestPlace(coord)
//   backendRecommendation(start, rangeMinutes, group)   the backend pre-filter
//   driveMinutes(start, spotId)            sample drive time
//   recommendation({ start, rangeMinutes, group?, filters?, showFarther?, now? })  => TodayResult
//
// Like the Swift code, fixtures are captured at one instant (fixture-meta.json
// `capturedAt`); every timestamp and day moves forward by the time since that
// instant, measured when the fixtures are first used (app launch). So "updated
// 8 min ago" and "Stocked this week" read as authored on any day.

import conditionsJson from "./fixtures/fixture-conditions.json";
import driveTimesJson from "./fixtures/fixture-drive-times.json";
import metaJson from "./fixtures/fixture-meta.json";
import placesJson from "./fixtures/fixture-places.json";
import prepJson from "./fixtures/fixture-prep.json";
import speciesJson from "./fixtures/fixture-species.json";
import spotsJson from "./fixtures/fixture-spots.json";
import { minutes as driveMinutesValue, type DriveTime } from "../logic/driveTimes";
import { miles } from "../logic/geo";
import { addingDays, daysUntil, localDayFromDate, parseLocalDay, type LocalDay } from "../logic/localDay";
import { chipGroups, emptyFilters, makeTodayLayout, spotMetaLine, type SpotFilters, type SpotMetaLine, type TodayLayout } from "../logic/todayLayout";
import { spotCoordinate, speciesByID } from "./types";
import type { Candidate, Conditions, Coordinate, Place, Prep, Recommendation, Species, SpotDetail, SpotSummary } from "./types";

export const dataNotice = "Sample data: every value is made up.";
export const startHint = "The sample data knows Phoenix, Tempe, Tucson, Flagstaff and Yuma.";

/** A place the fixtures know, with the typed inputs that match it. */
export interface FixturePlace {
  id: string;
  label: string;
  zip: string;
  lat: number;
  lng: number;
  aliases: string[];
}

export interface Fixtures {
  species: Species[];
  spots: SpotDetail[];
  preps: Map<number, Prep>;
  conditionsBySpot: Map<number, Conditions>;
  places: FixturePlace[];
  driveTable: Record<string, Record<string, number>>;
  /** Days added to every fixture day, and ms added to every fixture instant. */
  dayShift: number;
  offsetMs: number;
}

const DAY_KEYS = new Set(["lastStockedOn", "nextStockingOn", "stockedOn"]);
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T/;

/** Walks raw JSON: day keys become LocalDay (shifted), ISO instants become Dates (shifted). */
function hydrate(value: unknown, offsetMs: number, dayShift: number, key?: string): unknown {
  if (Array.isArray(value)) return value.map((v) => hydrate(v, offsetMs, dayShift));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = hydrate(v, offsetMs, dayShift, k);
    return out;
  }
  if (typeof value === "string") {
    if (key !== undefined && DAY_KEYS.has(key)) {
      const day = parseLocalDay(value);
      if (!day) throw new Error(`Not a YYYY-MM-DD day: ${value}`);
      return dayShift === 0 ? day : addingDays(day, dayShift);
    }
    if (ISO_INSTANT.test(value)) {
      const ms = Date.parse(value);
      if (Number.isNaN(ms)) throw new Error(`Not ISO-8601: ${value}`);
      return new Date(ms + offsetMs);
    }
  }
  return value;
}

export function loadFixtures(now: Date): Fixtures {
  const capturedAt = new Date(metaJson.capturedAt);
  const offsetMs = now.getTime() - capturedAt.getTime();
  const dayShift = daysUntil(localDayFromDate(capturedAt), localDayFromDate(now));
  const decode = <T>(raw: unknown) => hydrate(raw, offsetMs, dayShift) as T;
  const preps = decode<Prep[]>(prepJson).map(normalizePrep);
  const conditions = decode<Conditions[]>(conditionsJson);
  return {
    species: decode<Species[]>(speciesJson),
    spots: decode<SpotDetail[]>(spotsJson).map(normalizeDetail),
    preps: new Map(preps.map((p) => [p.spotId, p])),
    conditionsBySpot: new Map(conditions.map((c) => [c.spotId, c])),
    places: placesJson as FixturePlace[],
    driveTable: driveTimesJson as Record<string, Record<string, number>>,
    dayShift,
    offsetMs,
  };
}

/** Like Swift's tolerant Gear/GearMethod/Bait decoders: missing `baits`, `artificialOnly` and `methods` default to empty/false. */
function normalizePrep(raw: Prep): Prep {
  return {
    ...raw,
    gear: raw.gear.map((g) => ({
      ...g,
      methods: g.methods.map((m) => ({ ...m, baits: m.baits ?? [] })),
      baits: (g.baits ?? []).map((b) => ({ ...b, methods: b.methods ?? [] })),
      artificialOnly: g.artificialOnly ?? false,
    })),
  };
}

/**
 * The fixture JSON flattens SpotSummary fields into the detail object (a Swift
 * detail decodes `summary` from the same container). Rebuild that shape.
 */
function normalizeDetail(raw: SpotDetail): SpotDetail {
  const flat = raw as unknown as Record<string, unknown>;
  if (flat["summary"]) return raw;
  const { speciesNote, stockingNote, species, stocking, hoursDetail, feeNote, photos, ...summary } = flat;
  return {
    summary: summary as unknown as SpotSummary,
    speciesNote: speciesNote as string | null | undefined,
    stockingNote: stockingNote as string | null | undefined,
    species: species as Species[],
    stocking: stocking as SpotDetail["stocking"],
    hoursDetail: hoursDetail as string[],
    feeNote: feeNote as string | null | undefined,
    photos: (photos as SpotDetail["photos"] | undefined) ?? [],
  };
}

let memo: Fixtures | null = null;
/** The fixture set, decoded once at first use (app launch). */
export function fixtures(): Fixtures {
  return (memo ??= loadFixtures(new Date()));
}

// ---------- lookups ----------

export const species = (): Species[] => fixtures().species;
export const spotSummaries = (): SpotSummary[] => fixtures().spots.map((d) => d.summary);

export function spotDetail(id: number): SpotDetail | undefined {
  return fixtures().spots.find((d) => d.summary.id === id);
}
export const prep = (spotId: number): Prep | undefined => fixtures().preps.get(spotId);
export const conditions = (spotId: number): Conditions | undefined => fixtures().conditionsBySpot.get(spotId);

export const places = (): FixturePlace[] => fixtures().places;

/** The sample place nearest a coordinate. */
export function nearestPlace(c: Coordinate): FixturePlace {
  return places().reduce((best, p) => (miles(p, c) < miles(best, c) ? p : best));
}

/** Resolves a typed city or ZIP against the five sample places (alias, or a 3+ letter label prefix); at most 5. */
export function placesMatching(query: string): Place[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];
  return places()
    .filter((p) => p.aliases.includes(q) || (q.length >= 3 && p.label.toLowerCase().startsWith(q)))
    .slice(0, 5)
    .map((p) => ({ label: p.label, zip: p.zip, lat: p.lat, lng: p.lng }));
}

/** The sample city within 10 miles of a coordinate, else null. */
export function cityName(near: Coordinate): string | null {
  const p = nearestPlace(near);
  return miles(p, near) <= 10 ? p.label : null;
}

// ---------- recommendation ----------

/**
 * The backend's pre-filter: straight-line distance up to 1.2 mi × (2 × range),
 * then Spots with a species in `group` if given, nearest first, at most 40.
 * `groups` covers every Spot in the radius.
 */
export function backendRecommendation(start: Coordinate, rangeMinutes: number, group: string | null = null, now = new Date()): Recommendation {
  const fx = fixtures();
  const radius = 1.2 * (2 * rangeMinutes);
  const groupByID = new Map(fx.species.map((s) => [s.id, s.group]));
  const within: Candidate[] = fx.spots
    .map((d) => ({ spot: d.summary, distanceMi: Math.round(miles(start, spotCoordinate(d.summary)) * 10) / 10 }))
    .filter((c) => c.distanceMi <= radius)
    .sort((a, b) => a.distanceMi - b.distanceMi);
  const groups = [...new Set(within.flatMap((c) => c.spot.speciesIds).map((id) => groupByID.get(id)).filter((g): g is string => !!g))].sort();
  const matching = group ? within.filter((c) => c.spot.speciesIds.some((id) => groupByID.get(id) === group)) : within;
  return { start, rangeMinutes, generatedAt: now, species: fx.species, groups, candidates: matching.slice(0, 40) };
}

/**
 * Sample drive minutes from `start` to a Spot. Swift's FixtureETAProvider uses the
 * table only within 5 mi of a sample place and otherwise estimates from distance;
 * here a raw coordinate (browser geolocation) always uses the NEAREST sample
 * place's table, so any start inside Arizona gets plausible times.
 */
export function driveMinutes(start: Coordinate, spotId: number): number {
  const fx = fixtures();
  const table = fx.driveTable[nearestPlace(start).id]?.[String(spotId)];
  if (table !== undefined) return table;
  const spot = spotDetail(spotId)!.summary;
  return Math.round(miles(start, spotCoordinate(spot)) * 1.3 + 6);
}

export interface TodayRow {
  spot: SpotSummary;
  distanceMi: number;
  driveMinutes: number | null;
  meta: SpotMetaLine;
}
export interface TodaySectionRows {
  title: string;
  rows: TodayRow[];
}

export interface TodayResult {
  recommendation: Recommendation;
  driveTimes: Map<number, DriveTime>;
  layout: TodayLayout;
  /** Layout sections with each row's grey meta line already computed. */
  sections: TodaySectionRows[];
  /** The species chips, in chip order. */
  chipGroups: string[];
  speciesByID: Map<number, Species>;
}

export interface RecommendationInput {
  start: Coordinate;
  rangeMinutes: number;
  /** Defaults to `filters.speciesGroup`. */
  group?: string | null;
  filters?: SpotFilters;
  showFarther?: boolean;
  now?: Date;
}

/** What Today shows in sample mode: candidates, drive times, bands, filters. */
export function recommendation(input: RecommendationInput): TodayResult {
  const now = input.now ?? new Date();
  const filters = input.filters ?? emptyFilters();
  const group = input.group === undefined ? filters.speciesGroup : input.group;
  const rec = backendRecommendation(input.start, input.rangeMinutes, group, now);
  const driveTimes = new Map<number, DriveTime>(rec.candidates.map((c) => [c.spot.id, driveMinutesValue(driveMinutes(input.start, c.spot.id))]));
  const layout = makeTodayLayout(rec, driveTimes, filters, input.showFarther ?? false, now);
  const byID = speciesByID(rec.species);
  const today = localDayFromDate(now);
  const sections = layout.sections.map((s) => ({
    title: s.title,
    rows: s.spots.map((r) => ({ ...r, meta: spotMetaLine(r.spot, byID, today, filters.speciesGroup) })),
  }));
  return { recommendation: rec, driveTimes, layout, sections, chipGroups: chipGroups(rec.groups), speciesByID: byID };
}

export type { LocalDay };
