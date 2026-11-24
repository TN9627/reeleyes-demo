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
  /** Where the species does best, as a water temperature from its cited study; absent when no source gives one. */
  waterTempRange?: WaterTempRange | null;
}

/** A species' water-temperature range from one cited study. `lowC == highC` when the source gives a single value. */
export interface WaterTempRange {
  lowC: number;
  highC: number;
  /** "Adult growth", "Adults in reservoirs". */
  basis: string;
  /** "Stuber et al. 1982, USFWS". */
  source: string;
  url: string;
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
  /** Ids of the method's baits (in `Gear.baits`), in the order to try them; empty for one without bait. */
  baits: string[];
}

export type BaitTag = "real-food" | "looks-like-food" | "smells-like-food";

/** Swift `Bait.Tag.label`. */
export function baitTagLabel(tag: BaitTag): string {
  switch (tag) {
    case "real-food":
      return "Real food";
    case "looks-like-food":
      return "Looks like food";
    case "smells-like-food":
      return "Smells like food";
  }
}

/** Anything on the hook that gets a fish to bite, with this species' advice. */
export interface Bait {
  id: string;
  /** The shop name, capitalized ("PowerBait", "Inline spinner"). */
  name: string;
  tag: BaitTag;
  description: string;
  /** Why this species takes it. */
  why: string;
  /** How to put it on the hook, sized for this species. */
  hook: string;
  /** Ids of the methods that use it, in method order. */
  methods: string[];
  /** Square photo (`bait/<id>`); null until one exists. */
  photo?: Photo | null;
}

export interface Gear {
  speciesId: number;
  slug: string;
  name: string;
  /** One short line about where the fish holds; null hides the sheet's section. (Swift: `where`.) */
  where?: string | null;
  /** Up to 3 methods in display order; one is `recommended`. Empty at an artificial-only Spot whose rule bans every method's baits. */
  methods: GearMethod[];
  /** The "What they bite" row: the recommended method's baits first, then the other methods', each once. Empty hides the section. */
  baits: Bait[];
  /** The Spot's rules allow only artificial flies and lures for this species. */
  artificialOnly: boolean;
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
  /** The Spot's NWS grid point, "PSR/154,78"; null without an NWS feed. */
  gridPoint?: string | null;
  /** Gusts this hour, mph; null when that fetch failed. */
  gustMph?: number | null;
  /** Sky cover this hour, percent 0–100; null when that fetch failed. */
  cloudCoverPct?: number | null;
}

/** One hour of the Spot's NWS hourly forecast. */
export interface HourlyPeriod {
  startTime: Date;
  endTime: Date;
  tempC: number;
  relativeHumidity?: number | null;
  dewpointC?: number | null;
  windMph: number;
  /** Where the wind blows from; empty when calm. */
  windDirection: string;
  /** Probability of precipitation, percent. */
  precipitationChance?: number | null;
  /** "Chance Showers And Thunderstorms": the window reads thunder from it. */
  shortForecast: string;
  gustMph?: number | null;
  cloudCoverPct?: number | null;
}

/** Every hour that starts today or on the next 4 days in Arizona that the server has, oldest first. */
export interface HourlyForecast {
  updatedAt: Date;
  source: string;
  periods: HourlyPeriod[];
}

/** MET Norway's forecast sea-level pressure from the start of today through the 4th day after, oldest first. */
export interface PressureForecast {
  source: string;
  updatedAt: Date;
  series: PressureReading[];
}

/** An active NWS alert for the Spot's point, with NWS's own text. */
export interface NWSAlert {
  id: string;
  /** "Extreme Heat Warning", "Lake Wind Advisory", … */
  event: string;
  /** Extreme, Severe, Moderate, Minor or Unknown. */
  severity: string;
  headline?: string | null;
  description: string;
  instruction?: string | null;
  areaDesc: string;
  /** "NWS Phoenix AZ". */
  senderName: string;
  sent: Date;
  onset?: Date | null;
  ends?: Date | null;
  expires: Date;
}

export interface NWSAlerts {
  checkedAt: Date;
  /** The latest check failed; `items` are from `checkedAt`. */
  refreshFailed: boolean;
  items: NWSAlert[];
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
  weather?: Weather | null;
  pressure?: Pressure | null;
  lakeLevel?: LakeLevel | null;
  flow?: RiverFlow | null;
  waterTemp?: WaterTemperature | null;
  /** Null without an NWS feed. */
  hourly?: HourlyForecast | null;
  /** Null until MET Norway answered once for the Spot. */
  pressureForecast?: PressureForecast | null;
  /** Null when NWS alerts were never checked successfully for the Spot. */
  alerts?: NWSAlerts | null;
}

/** An Arizona city or ZIP a typed query resolved to. */
export interface Place {
  label: string;
  zip?: string | null;
  /** The county, shown in place of a missing ZIP (searched places). */
  county?: string | null;
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
