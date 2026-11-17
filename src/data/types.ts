// Mirrors ios/FishingApp/Models/APIModels.swift: same type and field names.
// JSON is camelCase; temperatures °C, pressure hPa, wind mph, distances miles.
// Differences from the wire format: `Date` fields are JS Dates and `LocalDay`
// fields are `LocalDay` objects once the repository has decoded them (the
// Swift decoder does the same). Swift computed properties are free functions
// at the bottom of this file.

import type { LocalDay } from "../logic/localDay";

export type { LocalDay };

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface Species {
  id: number;
  name: string;
  /** Stable key, also the asset name of the species image. */
  slug: string;
  /** Trout, Bass, Catfish, Crappie, Striped bass, Walleye, Sunfish or Other. */
  group: string;
}

export type SpotKind = "lake" | "reservoir" | "river" | "community_pond";

/** A community water's class (ADR 0002). */
export type CommunityClass = "lake" | "pond";

/** Opening hours in Arizona time. Around the clock is "00:00"–"24:00". */
export interface SpotHours {
  summary: string;
  opensAt: string;
  closesAt: string;
}

export interface PhotoLicense {
  name: string;
  /** The license deed; null for public domain. */
  url?: string | null;
}

export interface PhotoSource {
  name: string;
  url: string;
}

/** `key` is `spots/<azgfdId>/<n>`; the image files are public/images/<key>@2x.jpg and <key>-thumb@2x.jpg. */
export interface Photo {
  key: string;
  width: number;
  height: number;
  title: string;
  author: string;
  license: PhotoLicense;
  source: PhotoSource;
}

export interface SpotSummary {
  id: number;
  name: string;
  kind: SpotKind;
  /** Set exactly when `kind` is "community_pond". */
  communityClass?: CommunityClass | null;
  lat: number;
  lng: number;
  county: string;
  speciesIds: number[];
  lastStockedOn?: LocalDay | null;
  nextStockingOn?: LocalDay | null;
  isFree?: boolean | null;
  /** Null/absent means unknown ("Hours not listed"). */
  hours?: SpotHours | null;
  /** The first photo, for the Today and Saved thumbnails. */
  photo?: Photo | null;
}

/** A Spot pre-filtered by straight-line distance from the start. (Swift: summary fields + distanceMi flattened; here `spot` + `distanceMi`.) */
export interface Candidate {
  spot: SpotSummary;
  /** Straight-line miles from the start. */
  distanceMi: number;
}

export interface Recommendation {
  start: Coordinate;
  rangeMinutes: number;
  generatedAt: Date;
  species: Species[];
  /** Species groups among every Spot within the radius, whatever the requested group and the cap. */
  groups: string[];
  candidates: Candidate[];
}

export interface StockingEvent {
  speciesId: number;
  stockedOn: LocalDay;
}

export interface SpotDetail {
  summary: SpotSummary;
  speciesNote?: string | null;
  stockingNote?: string | null;
  species: Species[];
  /** The last 8 weeks and every scheduled week. */
  stocking: StockingEvent[];
  hoursDetail: string[];
  feeNote?: string | null;
  /** The header carousel after the map, at most 4; empty when none. */
  photos: Photo[];
}

export type RuleLayer = "statewide" | "community";
export type RuleScope = "statewide" | "community" | "spot";
export type RuleKind = "bag" | "size" | "season" | "method" | "other";

export type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };

export interface Rule {
  id: number;
  scope: RuleScope;
  speciesId: number | null;
  speciesGroup: string | null;
  /** Display label: the species name, the group, or null for an all-fish rule. */
  subject: string | null;
  kind: RuleKind;
  value: JSONValue;
  summary: string;
}

export interface RuleSet {
  years: string;
  sourceUrl: string;
}

export interface GearMethod {
  id: string;
  name: string;
  summary: string;
  recommended: boolean;
  /** Special gear the Angler may not own ("Needs a fly rod"). */
  requirement?: string | null;
  bring: string[];
  steps: string[];
  /** What to do when a fish bites; always shown as the last step. */
  bite: string;
}

export interface Gear {
  speciesId: number;
  slug: string;
  name: string;
  /** One short line about where the fish holds; null hides the sheet's section. (Swift: `where`.) */
  where?: string | null;
  /** 1–3 methods in display order; exactly one is `recommended`. */
  methods: GearMethod[];
}

export interface Prep {
  spotId: number;
  /** Null until a reviewed edition is loaded, and then `rules` is empty. */
  ruleSet?: RuleSet | null;
  layer: RuleLayer;
  /** Spot rules first, then the layer's rules. */
  rules: Rule[];
  gear: Gear[];
}

export type PressureTrend = "rising" | "steady" | "falling";

export interface Verdict {
  line: string;
  reasons: string[];
}

export interface Weather {
  airTempC: number;
  highC?: number | null;
  lowC?: number | null;
  sky: string;
  windMph: number;
  /** Where the wind blows from: N, NE, E, … */
  windDirection: string;
  observedAt: Date;
  source: string;
}

export interface PressureReading {
  at: Date;
  hpa: number;
}

export interface PressureStation {
  name: string;
  code?: string | null;
  distanceMi: number;
}

export interface Pressure {
  hpa: number;
  trend: PressureTrend;
  change3hHpa: number;
  series: PressureReading[];
  station: PressureStation;
  observedAt: Date;
  source: string;
}

export interface WaterTemperature {
  c: number;
  observedAt: Date;
  source: string;
}

export interface LakeLevel {
  ft: number;
  /** Null when the feed has no reading about 24 hours before this one. */
  change24hFt?: number | null;
  observedAt: Date;
  source: string;
}

export interface RiverFlow {
  cfs: number;
  trend: PressureTrend;
  change3hCfs: number;
  observedAt: Date;
  source: string;
}

export interface Conditions {
  spotId: number;
  /** When the server last refreshed; null when it never has. */
  fetchedAt?: Date | null;
  refreshFailed: boolean;
  verdict?: Verdict | null;
  weather?: Weather | null;
  pressure?: Pressure | null;
  lakeLevel?: LakeLevel | null;
  flow?: RiverFlow | null;
  waterTemp?: WaterTemperature | null;
}

/** An Arizona city or ZIP a typed query resolved to. */
export interface Place {
  label: string;
  zip?: string | null;
  lat: number;
  lng: number;
}

// --- Swift computed properties ---

export function spotCoordinate(spot: { lat: number; lng: number }): Coordinate {
  return { lat: spot.lat, lng: spot.lng };
}

/** A community water the app reads as a Lake. A community pond with no class reads as a Pond (ADR 0002). */
export function isCommunityLake(spot: SpotSummary): boolean {
  return spot.kind === "community_pond" && spot.communityClass === "lake";
}

/** "Lake", "River stretch", "Community lake", "Community pond": the Spot header. */
export function kindTitle(spot: SpotSummary): string {
  switch (spot.kind) {
    case "lake":
    case "reservoir":
      return "Lake";
    case "river":
      return "River stretch";
    case "community_pond":
      return isCommunityLake(spot) ? "Community lake" : "Community pond";
  }
}

/** "Lake", "River", "Pond": the Today and Saved row. */
export function kindShortTitle(spot: SpotSummary): string {
  switch (spot.kind) {
    case "lake":
    case "reservoir":
      return "Lake";
    case "river":
      return "River";
    case "community_pond":
      return isCommunityLake(spot) ? "Lake" : "Pond";
  }
}

/** MET Norway's forecast for the Spot (no station code): its trace is the next 3 hours. */
export function isForecast(pressure: Pressure): boolean {
  return pressure.station.code == null;
}

/** Every species by id. */
export function speciesByID(species: Species[]): Map<number, Species> {
  const map = new Map<number, Species>();
  for (const s of species) if (!map.has(s.id)) map.set(s.id, s);
  return map;
}
