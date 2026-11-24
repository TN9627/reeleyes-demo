// Port of Logic/BestWindow.swift: the Best window, worked out on the device from the hourly forecast,
// the sun and the Spot's hours. (WindowRules lives in hazards.ts with the hazard predicates.)

import type { HourlyForecast, HourlyPeriod, SpotHours } from "../data/types";
import { Feels } from "./feels";
import { WindowRules } from "./hazards";
import { localDayEquals, localDayFromDate, startDate, type LocalDay } from "./localDay";
import { skyDay } from "./skyCalculator";
import { minutesOfDay } from "./spotFacts";

/** A stretch of the window, both ends rounded to the nearest 5 minutes. */
export interface WindowSpan {
  start: Date;
  end: Date;
}

/** One forecast hour's heat and cold readings, rounded °F. */
interface HourFeel {
  start: Date;
  /** `Feels.heatF`. */
  feelsF: number;
  /** `Feels.windChill`. */
  windChillF: number;
}

/** Heat danger in today's daylight hours: the first hour feeling like 103°F or more, and the hottest hour. */
export interface HeatDanger {
  from: Date;
  peakF: number;
  peakAt: Date;
}

/** Cold danger in today's daylight hours: the first hour with a wind chill of 0°F or below, and the coldest. */
export interface ColdDanger {
  from: Date;
  lowestF: number;
  lowestAt: Date;
}

/** One Arizona day's window, from civil dawn to civil dusk inside the Spot's hours. */
export interface DayWindow {
  /** The later of civil dawn and opening. */
  start: Date;
  /** The earlier of civil dusk and closing. */
  end: Date;
  /** Spans of 30 minutes or more (measured before rounding), both ends rounded to the nearest 5 minutes. */
  spans: WindowSpan[];
  heat: HeatDanger | null;
  cold: ColdDanger | null;
}

const MIN = 60_000;
const HOUR = 3_600_000;
const plus = (d: Date, ms: number) => new Date(d.getTime() + ms);

/** Nearest 5 minutes (Arizona's UTC−7 is a whole number of 5 minutes, so this is on the local clock too). */
function roundToFive(d: Date): Date {
  return new Date(Math.round(d.getTime() / 300_000) * 300_000);
}

/** The reasons a minute is out of the window, as bits, without an allocation per minute. */
const CUT_BIT = { heat: 1, cold: 2, wind: 4, storms: 8 } as const;
/** The cuts at a moment of the forecast: the containing period's values, temperature and humidity interpolated toward the next period. */
class Sampler {
  readonly periods: HourlyPeriod[];
  constructor(periods: HourlyPeriod[]) {
    this.periods = periods;
  }

  /** The period with start ≤ date < end (periods are oldest first); null when the forecast doesn't cover it. */
  index(date: Date): number | null {
    let low = 0;
    let high = this.periods.length;
    const t = date.getTime();
    while (low < high) {
      const mid = (low + high) >> 1;
      if (this.periods[mid]!.startTime.getTime() <= t) low = mid + 1;
      else high = mid;
    }
    if (low === 0 || !(t < this.periods[low - 1]!.endTime.getTime())) return null;
    return low - 1;
  }

  /** A bit set of CUT_BIT. */
  cuts(date: Date, index: number): number {
    const p = this.periods[index]!;
    const n = this.periods[index + 1];
    const next = n && n.startTime.getTime() === p.endTime.getTime() ? n : p;
    const length = p.endTime.getTime() - p.startTime.getTime();
    const f = length > 0 ? (date.getTime() - p.startTime.getTime()) / length : 0;
    const pF = Feels.fahrenheit(p.tempC);
    const qF = Feels.fahrenheit(next.tempC);
    const airF = pF + (qF - pF) * f;
    const a = p.relativeHumidity;
    const b = next.relativeHumidity;
    const humidity = a != null && b != null ? a + (b - a) * f : a;
    let cuts = 0;
    if (WindowRules.heatDanger(airF, humidity)) cuts |= CUT_BIT.heat;
    if (WindowRules.coldDanger(airF, p.windMph)) cuts |= CUT_BIT.cold;
    if (p.windMph >= WindowRules.maxWindMph) cuts |= CUT_BIT.wind;
    if (WindowRules.stormsLikely(p.shortForecast, p.precipitationChance)) cuts |= CUT_BIT.storms;
    return cuts;
  }
}

export const BestWindow = {
  /** Null when the forecast has no period starting on that Arizona day. */
  day(day: LocalDay, forecast: HourlyForecast, lat: number, lng: number, hours: SpotHours | null | undefined): DayWindow | null {
    const dayPeriods = forecast.periods.filter((p) => localDayEquals(localDayFromDate(p.startTime), day));
    if (dayPeriods.length === 0) return null;
    const midnight = startDate(day);
    const sky = skyDay(midnight, lat, lng);
    const dawn = sky.dawn;
    const dusk = sky.dusk;
    if (!dawn || !dusk) return null;

    let start = dawn;
    let end = dusk;
    const opens = hours ? minutesOfDay(hours.opensAt) : null;
    let closes = hours ? minutesOfDay(hours.closesAt) : null;
    if (opens !== null && closes !== null && opens !== closes) {
      // Hours past midnight ("18:00"–"02:00") don't end the daylight part.
      if (closes < opens) closes = 24 * 60;
      const open = plus(midnight, opens * MIN);
      const close = plus(midnight, closes * MIN);
      if (open > start) start = open;
      if (close < end) end = close;
    }

    const sampler = new Sampler(forecast.periods);

    // Per-minute pass over start…end (inclusive), as app.js `windowFor`.
    const rawSpans: WindowSpan[] = [];
    let openStart: Date | null = null;
    for (let t = start.getTime(); t <= end.getTime(); t += MIN) {
      const minute = new Date(t);
      const index = sampler.index(minute);
      const cuts = index === null ? null : sampler.cuts(minute, index);
      if (cuts === 0 && openStart === null) openStart = minute;
      const stops = cuts === null ? true : cuts !== 0;
      if ((stops || t + MIN > end.getTime()) && openStart !== null) {
        rawSpans.push({ start: openStart, end: stops ? minute : end });
        openStart = null;
      }
    }
    const spans = rawSpans
      .filter((s) => s.end.getTime() - s.start.getTime() >= WindowRules.minSpanMs)
      .map((s) => ({ start: roundToFive(s.start), end: roundToFive(s.end) }));

    const daylight: HourFeel[] = dayPeriods
      .filter((p) => plus(p.startTime, HOUR) > dawn && p.startTime < dusk)
      .map((p) => {
        const airF = Feels.fahrenheit(p.tempC);
        return {
          start: p.startTime,
          feelsF: Feels.whole(Feels.heatF(airF, p.relativeHumidity)),
          windChillF: Feels.whole(Feels.windChill(airF, p.windMph)),
        };
      });
    let heat: HeatDanger | null = null;
    const heatFrom = daylight.find((h) => h.feelsF >= WindowRules.heatF);
    if (heatFrom) {
      const peak = daylight.reduce((best, h) => (h.feelsF > best.feelsF ? h : best));
      heat = { from: heatFrom.start, peakF: peak.feelsF, peakAt: peak.start };
    }
    let cold: ColdDanger | null = null;
    const coldFrom = daylight.find((h) => h.windChillF <= WindowRules.coldF);
    if (coldFrom) {
      const lowest = daylight.reduce((best, h) => (h.windChillF < best.windChillF ? h : best));
      cold = { from: coldFrom.start, lowestF: lowest.windChillF, lowestAt: lowest.start };
    }

    return { start, end, spans, heat, cold };
  },
};
