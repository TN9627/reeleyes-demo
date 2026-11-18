// Port of Logic/VerdictRules.swift: the verdict (B+), worked out on the device from the conditions,
// the Spot's class and its active alerts.

import type { Conditions, NWSAlert, SpotSummary, WaterTempRange } from "../data/types";
import { isCommunityLake, isForecast } from "../data/types";
import { AlertRules } from "./alertRules";
import { maxPressureAgeMs, PressureWords } from "./freshness";
import { HazardWords, WindowRules, type Hazard } from "./hazards";
import { fahrenheit, roundHalfAway } from "./spotFacts";
import { ClockWords } from "./windowTime";

// ---------- WaterClass ----------

/** How a Spot's water is judged: small, shallow waters follow the air within days. */
export type WaterClass = "communityPond" | "communityLake" | "lakeOrReservoir" | "river";
export const allWaterClasses: WaterClass[] = ["communityPond", "communityLake", "lakeOrReservoir", "river"];

export function waterClassOf(spot: SpotSummary): WaterClass {
  switch (spot.kind) {
    case "community_pond":
      return isCommunityLake(spot) ? "communityLake" : "communityPond";
    case "river":
      return "river";
    case "lake":
    case "reservoir":
      return "lakeOrReservoir";
  }
}

export function waterClassName(c: WaterClass): string {
  switch (c) {
    case "communityPond":
      return "Community Pond";
    case "communityLake":
      return "Community Lake";
    case "lakeOrReservoir":
      return "Lake or reservoir";
    case "river":
      return "River";
  }
}

/** Ponds and community lakes: a hot high lowers the rating. */
export const countsAirTemperature = (c: WaterClass) => c === "communityPond" || c === "communityLake";

/** The class's line on the Verdict screen. */
export function waterClassExplanation(c: WaterClass): string {
  const hot = VerdictRules.hotHighF;
  switch (c) {
    case "communityPond":
      return `Small and shallow. The water follows the air within days, so a high of ${hot}°F or more lowers the rating one level.`;
    case "communityLake":
      return `Over 3 acres but still shallow. It's judged like a pond, so a high of ${hot}°F or more lowers the rating one level.`;
    case "lakeOrReservoir":
      return "Big and deep. The water lags the air by weeks, so air temperature is shown but doesn't change the rating. A measured water temperature is placed on the fish ranges.";
    case "river":
      return "Dam releases and flow set the water, so air temperature is shown but doesn't change the rating.";
  }
}

// ---------- Rating ----------

/** The Today hero's three levels, worst last. */
export type RatingLevel = "good" | "fair" | "slow";
export const allRatingLevels: RatingLevel[] = ["good", "fair", "slow"];
export const levelRank = (l: RatingLevel) => allRatingLevels.indexOf(l);

export function ratingLevelLabel(l: RatingLevel): string {
  switch (l) {
    case "good":
      return "Good time to fish";
    case "fair":
      return "Fair time to fish";
    case "slow":
      return "Tough time to fish";
  }
}

/** One level worse; Slow stays Slow. */
export const lowered = (l: RatingLevel): RatingLevel => allRatingLevels[Math.min(levelRank(l) + 1, 2)]!;

/** What set the level; the reason names it. */
export type RatingFactor =
  /** Δ from −0.06 to −0.02 inHg. */
  | { kind: "pressureEasing" }
  /** |Δ| under 0.02 inHg. */
  | { kind: "pressureSteady" }
  /** Δ of +0.02 inHg or more. */
  | { kind: "pressureClimbing" }
  /** Δ below −0.06 inHg. */
  | { kind: "pressureDroppingFast" }
  /** The wind cap held the level at Fair: gusts over 25 mph or a sustained wind over 15. */
  | { kind: "windCap"; gusts: boolean }
  /** A sustained wind over 25 mph. */
  | { kind: "strongWind" }
  /** A pond's or community lake's high of 95°F or more lowered the level. */
  | { kind: "heat" }
  /** The hour fails one of the Best window's hazard rules: Tough. */
  | { kind: "hazard"; hazard: Hazard };

/** The rating: its level and the one sentence naming what set it. */
export interface Rating {
  level: RatingLevel;
  factor: RatingFactor;
  reason: string;
}

// ---------- VerdictRead ----------

export type Confidence = "High" | "Medium" | "Low";
export type VerdictHidden =
  | { kind: "noWeather" }
  | { kind: "noPressure" }
  | { kind: "pressureOld" }
  | { kind: "warning"; event: string };

/** The verdict for a Spot at the time of viewing: its rating, how sure it is, and why it's hidden. */
export interface VerdictRead {
  waterClass: WaterClass;
  /** Worked out whenever weather and pressure exist and pressure is at most 3 hours old (also under a warning). */
  rating: Rating | null;
  /** Null when `rating` is null. */
  confidence: Confidence | null;
  /** What lowered the confidence: "Pressure station 37 mi away", … */
  lowerings: string[];
  /** The forecast high, °F; null without weather or a high. */
  highF: number | null;
  /** The class counts air temperature and the high is 95°F or more. */
  isHot: boolean;
  hidden: VerdictHidden | null;
  /** The hazards of the forecast hour holding now: any of them makes the rating Tough. */
  hazards: Hazard[];
}

/** The hidden band's title. */
export const verdictHiddenTitle = "No rating today";

/** Why there's no rating, in one sentence. */
export function verdictHiddenText(v: VerdictRead): string | null {
  switch (v.hidden?.kind) {
    case undefined:
      return null;
    case "noWeather":
      return "There's no weather forecast for this Spot, so there's no wind reading.";
    case "noPressure":
      return "There's no air pressure feed for this Spot.";
    case "pressureOld":
      return "The pressure reading is over 3 hours old.";
    case "warning":
      return `NWS has ${AlertRules.withArticle(v.hidden.event)} out for this Spot.`;
  }
}

/** "Close, fresh readings." at High; else what lowered it: "Pressure station 43 mi away." */
export const confidenceWhy = (v: VerdictRead) => (v.confidence === "High" ? "Close, fresh readings." : `${v.lowerings.join(". ")}.`);

/** What the rating is made of, by class. */
export const verdictUses = (v: VerdictRead) =>
  countsAirTemperature(v.waterClass) ? "air pressure, wind and air temperature" : "air pressure and wind";

// ---------- VerdictRules ----------

function reason(factor: RatingFactor, changeInHg: number, windMph: number, waterClass: WaterClass, highF: number | null): string {
  const calm = windMph < 5 ? "the wind is calm" : windMph < 10 ? "the wind is light" : "the breeze is moderate";
  const base = PressureWords.direction(changeInHg) === "Falling" ? "easing" : "steady";
  switch (factor.kind) {
    case "pressureEasing":
      return `Pressure is easing and ${calm}, so fish often feed more.`;
    case "pressureSteady":
      return `Pressure is steady and ${calm}, so expect an ordinary bite.`;
    case "pressureClimbing":
      return "Pressure is rising, so fish often hold deeper and bite less.";
    case "pressureDroppingFast":
      return "Pressure is dropping fast, which often puts fish off the bite.";
    case "windCap":
      return `Pressure is ${base}, but ${factor.gusts ? "strong gusts" : "a strong wind"} will make casting and bite detection harder.`;
    case "strongWind":
      return `A ${roundHalfAway(windMph)} mph wind makes casting and bite detection very hard.`;
    case "heat":
      return `Today's high of ${highF ?? VerdictRules.hotHighF}°F warms this shallow ${waterClass === "communityPond" ? "pond" : "lake"}, so fish often hold deeper and feed less.`;
    case "hazard":
      throw new Error("rate never returns a hazard factor; the hazard override does");
  }
}

export const VerdictRules = {
  /** A pressure station farther than this lowers the confidence. */
  nearStationMi: 25,
  /** An hourly station report plus 15 minutes' slack; older lowers the confidence. */
  freshPressureMs: 75 * 60_000,
  /** Past this the verdict is hidden. */
  maxPressureAgeMs,
  /** At ponds and community lakes, a high at or above this lowers the rating one level. */
  hotHighF: 95,
  capWindMph: 15,
  capGustMph: 25,
  /** A sustained wind over this makes it Slow. */
  strongWindMph: 25,

  read(conditions: Conditions, spot: SpotSummary, active: NWSAlert[], now: Date): VerdictRead {
    const waterClass = waterClassOf(spot);
    const weather = conditions.weather;
    const highF = weather?.highC != null ? fahrenheit(weather.highC) : null;
    const isHot = countsAirTemperature(waterClass) && highF !== null && highF >= VerdictRules.hotHighF;
    const hiddenRead = (hidden: VerdictHidden): VerdictRead => ({
      waterClass,
      rating: null,
      confidence: null,
      lowerings: [],
      highF,
      isHot,
      hidden,
      hazards: [],
    });
    if (!weather) return hiddenRead({ kind: "noWeather" });
    const pressure = conditions.pressure;
    if (!pressure) return hiddenRead({ kind: "noPressure" });
    const age = now.getTime() - pressure.observedAt.getTime();
    if (age > VerdictRules.maxPressureAgeMs) return hiddenRead({ kind: "pressureOld" });

    const lowerings: string[] = [];
    if (isForecast(pressure)) {
      lowerings.push("Pressure is a forecast, not a reading");
    } else {
      if (pressure.station.distanceMi > VerdictRules.nearStationMi) {
        lowerings.push(`Pressure station ${roundHalfAway(pressure.station.distanceMi)} mi away`);
      }
      if (age > VerdictRules.freshPressureMs) {
        const old = ClockWords.ageOld(pressure.observedAt, now);
        lowerings.push(`Pressure reading ${old.replaceAll(" old", "")} old`);
      }
    }
    const confidence: Confidence = lowerings.length === 0 ? "High" : lowerings.length === 1 ? "Medium" : "Low";

    const warning = AlertRules.hidingWarning(active, now);
    let rating = VerdictRules.rate(PressureWords.changeInHg(pressure), weather.windMph, weather.gustMph ?? null, waterClass, highF);
    // An hour that fails a hazard rule is Tough, from the forecast hour holding now.
    const period = conditions.hourly?.periods.find((p) => p.startTime <= now && now < p.endTime);
    const hazards = period ? WindowRules.hazards(period) : [];
    if (period && hazards[0]) {
      rating = { level: "slow", factor: { kind: "hazard", hazard: hazards[0] }, reason: HazardWords.now(hazards[0], period) };
    }
    return {
      waterClass,
      rating,
      confidence,
      lowerings,
      highF,
      isHot,
      hidden: warning ? { kind: "warning", event: warning.event } : null,
      hazards,
    };
  },

  /**
   * The rating from the 3-hour pressure change Δ (inHg, to the hundredth), the sustained wind and gusts (mph),
   * the Spot's class and today's high (°F). The reason names the factor that set the level.
   */
  rate(changeInHg: number, windMph: number, gustMph: number | null | undefined, waterClass: WaterClass, highF: number | null | undefined): Rating {
    let level: RatingLevel;
    let factor: RatingFactor;
    switch (PressureWords.direction(changeInHg)) {
      case "Steady":
        [level, factor] = ["fair", { kind: "pressureSteady" }];
        break;
      case "Rising":
        [level, factor] = ["slow", { kind: "pressureClimbing" }];
        break;
      case "Falling":
        [level, factor] = changeInHg < -PressureWords.fastInHg ? ["slow", { kind: "pressureDroppingFast" }] : ["good", { kind: "pressureEasing" }];
        break;
    }
    const gusty = (gustMph ?? 0) > VerdictRules.capGustMph;
    if (windMph > VerdictRules.strongWindMph) {
      [level, factor] = ["slow", { kind: "strongWind" }];
    } else if ((windMph > VerdictRules.capWindMph || gusty) && levelRank(level) <= levelRank("fair")) {
      [level, factor] = ["fair", { kind: "windCap", gusts: gusty }];
    }
    if (countsAirTemperature(waterClass) && highF != null && highF >= VerdictRules.hotHighF && level !== "slow") {
      [level, factor] = [lowered(level), { kind: "heat" }];
    }
    return { level, factor, reason: reason(factor, changeInHg, windMph, waterClass, highF ?? null) };
  },

  /** The wind cap's condition, which also turns the wind chip amber: sustained over 15 mph or gusts over 25. */
  windCapped(windMph: number, gustMph: number | null | undefined): boolean {
    return windMph > VerdictRules.capWindMph || (gustMph ?? 0) > VerdictRules.capGustMph;
  },
};

/** Equality of two factors (Swift's Equatable). */
export function sameFactor(a: RatingFactor, b: RatingFactor): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ---------- FishRange ----------

/** A species' water-temperature range on the Verdict screen, and where the measured water sits on it. */
export const FishRange = {
  /** "75–86°F" (en dash), or "near 81°F" when the source gives one value. */
  label(range: WaterTempRange): string {
    const low = fahrenheit(range.lowC);
    const high = fahrenheit(range.highC);
    return low === high ? `near ${low}°F` : `${low}–${high}°F`;
  },
  /** "Cooler than its range", "Warmer than its range", "In its range"; a single value names it. */
  placement(waterC: number, range: WaterTempRange): string {
    const water = fahrenheit(waterC);
    const low = fahrenheit(range.lowC);
    const high = fahrenheit(range.highC);
    const point = low === high;
    if (water < low) return point ? `Cooler than ${low}°F` : "Cooler than its range";
    if (water > high) return point ? `Warmer than ${high}°F` : "Warmer than its range";
    return "In its range";
  },
};
