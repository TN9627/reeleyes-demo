// Port of Logic/Hazards.swift plus the WindowRules constants of Logic/BestWindow.swift.
// A danger on the water that makes an hour Tough: the Best window's own hazard rules.
// Wind, darkness and a park's hours are not hazards for the rating; they only trim the window.

import type { HourlyPeriod } from "../data/types";
import type { WindowSpan } from "./bestWindow";
import { Feels } from "./feels";
import { ClockWords } from "./windowTime";

/** Thunder at the storm chance or more is listed first: it wins when an hour has several. */
export type Hazard = "storms" | "heat" | "cold";
export const allHazards: Hazard[] = ["storms", "heat", "cold"];

/** What a slot's screen-reader label adds after the hour. */
export function hazardSlotWords(h: Hazard): string {
  switch (h) {
    case "storms":
      return ", storms likely, unsafe on the water";
    case "heat":
      return ", dangerous heat";
    case "cold":
      return ", dangerous cold";
  }
}

/** What the Verdict screen says about the hour. */
export function hazardVerdictWords(h: Hazard): string {
  switch (h) {
    case "storms":
      return "Storms likely this hour";
    case "heat":
      return "Dangerous heat this hour";
    case "cold":
      return "Dangerous cold this hour";
  }
}

/** The rules of the Best window: heat and cold are safety cuts, not fishing ratings. */
export const WindowRules = {
  /** An hour that feels like this or more is out: NWS's heat index "Danger" line. */
  heatF: 103,
  /** A wind chill at or below this is out: NWS Flagstaff's Cold Weather Advisory line. */
  coldF: 0,
  /** Wind at or above this is out; the verdict's "strong wind". */
  maxWindMph: 15,
  /** "Thunderstorm" in the short forecast with this chance or more is out (NWS "Chance"). */
  stormChance: 30,
  /** Shorter spans aren't shown (ms). */
  minSpanMs: 30 * 60_000,

  /** "Thunderstorm" in the short forecast with the storm chance or more. */
  stormsLikely(shortForecast: string, chance: number | null | undefined): boolean {
    return /thunderstorm/i.test(shortForecast) && (chance ?? 0) >= WindowRules.stormChance;
  },
  /** Feels like the heat line or more. */
  heatDanger(airF: number, humidity: number | null | undefined): boolean {
    return Feels.heatF(airF, humidity) >= WindowRules.heatF;
  },
  /** A wind chill at the cold line or below. */
  coldDanger(airF: number, windMph: number): boolean {
    return Feels.windChill(airF, windMph) <= WindowRules.coldF;
  },
  /** The hazards of a forecast hour, by its own values, in `Hazard` order. */
  hazards(period: HourlyPeriod): Hazard[] {
    const airF = Feels.fahrenheit(period.tempC);
    const found: Hazard[] = [];
    if (WindowRules.stormsLikely(period.shortForecast, period.precipitationChance)) found.push("storms");
    if (WindowRules.heatDanger(airF, period.relativeHumidity)) found.push("heat");
    if (WindowRules.coldDanger(airF, period.windMph)) found.push("cold");
    return found;
  },
};

/** The one-sentence reasons for a hazard (no colon), in the heat and cold notices' words. */
export const HazardWords = {
  /** Today's live reading, for the forecast hour holding now. */
  now(hazard: Hazard, period: HourlyPeriod): string {
    const airF = Feels.fahrenheit(period.tempC);
    switch (hazard) {
      case "storms":
        return "Thunderstorms are likely this hour, and lightning makes open water unsafe.";
      case "heat":
        return `It feels like ${Feels.whole(Feels.heatF(airF, period.relativeHumidity))}°F now, dangerous heat on open water.`;
      case "cold":
        return `The wind chill is ${ClockWords.degrees(Feels.windChill(airF, period.windMph))}F now, which risks frostbite.`;
    }
  },
  /** A forecast day's, for the stretch of daylight the hazard covers. */
  forecast(hazard: Hazard, span: WindowSpan): string {
    const when = ClockWords.shortRange(span.start, span.end);
    switch (hazard) {
      case "storms":
        return `Thunderstorms are likely from ${when}, and lightning makes open water unsafe.`;
      case "heat":
        return `It should feel like ${WindowRules.heatF}°F or more from ${when}, dangerous heat on open water.`;
      case "cold":
        return `Wind chill should reach ${WindowRules.coldF}°F or below from ${when}, which risks frostbite.`;
    }
  },
};
