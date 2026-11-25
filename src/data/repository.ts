// Port of Data/FixtureRepository.swift plus the sample-mode parts of
// App/TodayModel.swift, Logic/DriveTimes.swift and Logic/TodayLayout.swift.
//
// API (all synchronous; every value but the weather is made up; the weather comes from data/openMeteo.ts):
//   dataNotice, startHint
//   loadFixtures(now) / fixtures()         decoded, time-shifted fixture set
//   species(), spotSummaries(), spotDetail(id), prep(spotId), conditions(spotId)
//   places(), samplePlace(query), placesMatching(query), cityName(near), nearestPlace(coord)
//   backendRecommendation(start, rangeMinutes, group)   the backend pre-filter
//   driveTime(start, spotId, roads)        { minutes, estimated }: OSRM road minutes, else a distance estimate
//   recommendation({ start, rangeMinutes, group?, filters?, showFarther?, now? })  => TodayResult
//
// Like the Swift code, fixtures are captured at one instant (fixture-meta.json
// `capturedAt`); every timestamp and day moves forward by the time since that
// instant, measured when the fixtures are first used (app launch). So "updated
// 8 min ago" and "Stocked this week" read as authored on any day.

import conditionsJson from "./fixtures/fixture-conditions.json";
import metaJson from "./fixtures/fixture-meta.json";
import placesJson from "./fixtures/fixture-places.json";
import prepJson from "./fixtures/fixture-prep.json";
import speciesJson from "./fixtures/fixture-species.json";
import spotsJson from "./fixtures/fixture-spots.json";
import { estimateMinutes, minutes as driveMinutesValue, type DriveTime, type RoadMinutes } from "../logic/driveTimes";
import { miles } from "../logic/geo";
import { addingDays, daysUntil, localDayFromDate, parseLocalDay, type LocalDay } from "../logic/localDay";
import { chipGroups, emptyFilters, makeTodayLayout, spotMetaLine, type SpotFilters, type SpotMetaLine, type TodayLayout } from "../logic/todayLayout";
import { spotCoordinate, speciesByID } from "./types";
import type { Candidate, Conditions, Coordinate, Place, Prep, Recommendation, Species, SpotDetail, SpotSummary } from "./types";

export const dataNotice = "Weather is live from Open-Meteo.com; everything else is sample data.";
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

/** The sample place a typed name or ZIP exactly names (its label or an alias), else null. */
export function samplePlace(query: string): Place | null {
  const q = query.trim().toLowerCase();
  const p = places().find((p) => p.aliases.includes(q));
  return p ? { label: p.label, zip: p.zip, lat: p.lat, lng: p.lng } : null;
}

/** Offline fallback for place search: the five sample places by alias, or a 3+ letter label prefix; at most 5. */
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

/** A drive time from `start` to a Spot; `estimated` when it comes from distance, not an OSRM route. */
export interface SpotDrive {
  minutes: number;
  estimated: boolean;
}

/**
 * Drive minutes from `start` to a Spot: OSRM's road minutes (`roads`, from data/osrm.ts) when it has a
 * route, else an estimate from straight-line distance (`estimateMinutes` in logic/driveTimes.ts).
 */
export function driveTime(start: Coordinate, spotId: number, roads: RoadMinutes | null): SpotDrive {
  const road = roads?.[spotId];
  if (road !== undefined && road !== null) return { minutes: road, estimated: false };
  return { minutes: estimateMinutes(miles(start, spotCoordinate(spotDetail(spotId)!.summary))), estimated: true };
}

export interface TodayRow {
  spot: SpotSummary;
  distanceMi: number;
  driveMinutes: number | null;
  /** The time is a distance estimate, not an OSRM route. */
  estimated: boolean;
  meta: SpotMetaLine;
}
export interface TodaySectionRows {
  title: string;
  rows: TodayRow[];
}

export interface TodayResult {
  recommendation: Recommendation;
  driveTimes: Map<number, DriveTime>;
  /** Some times are estimates from distance (OSRM had no route or failed). */
  estimated: boolean;
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
  /** OSRM's road minutes from `start`; null when it failed, so every time is estimated. */
  roads: RoadMinutes | null;
}

/** What Today shows in sample mode: candidates, drive times, bands, filters. */
export function recommendation(input: RecommendationInput): TodayResult {
  const now = input.now ?? new Date();
  const filters = input.filters ?? emptyFilters();
  const group = input.group === undefined ? filters.speciesGroup : input.group;
  const rec = backendRecommendation(input.start, input.rangeMinutes, group, now);
  const drives = new Map(rec.candidates.map((c) => [c.spot.id, driveTime(input.start, c.spot.id, input.roads)]));
  const driveTimes = new Map<number, DriveTime>([...drives].map(([id, d]) => [id, driveMinutesValue(d.minutes)]));
  const layout = makeTodayLayout(rec, driveTimes, filters, input.showFarther ?? false, now);
  const byID = speciesByID(rec.species);
  const today = localDayFromDate(now);
  const sections = layout.sections.map((s) => ({
    title: s.title,
    rows: s.spots.map((r) => ({ ...r, estimated: drives.get(r.spot.id)!.estimated, meta: spotMetaLine(r.spot, byID, today, filters.speciesGroup) })),
  }));
  return { recommendation: rec, driveTimes, estimated: [...drives.values()].some((d) => d.estimated), layout, sections, chipGroups: chipGroups(rec.groups), speciesByID: byID };
}

export type { LocalDay };
