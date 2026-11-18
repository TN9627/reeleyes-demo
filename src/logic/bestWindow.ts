// Port of Logic/BestWindow.swift: the Best window, worked out on the device from the hourly forecast,
// the sun and the Spot's hours. (WindowRules lives in hazards.ts with the hazard predicates.)

import type { HourlyForecast, HourlyPeriod, SpotHours } from "../data/types";
import { Feels } from "./feels";
import { WindowRules } from "./hazards";
import { localDayEquals, localDayFromDate, startDate, type LocalDay } from "./localDay";
import { skyDay } from "./skyCalculator";
import { minutesOfDay } from "./spotFacts";
import { ClockWords } from "./windowTime";

/** Why a minute is out of the window, in this order everywhere. */
export type WindowCut = "heat" | "cold" | "wind" | "storms";
export const allWindowCuts: WindowCut[] = ["heat", "cold", "wind", "storms"];

/** A stretch of the window, both ends rounded to the nearest 5 minutes. */
export interface WindowSpan {
  start: Date;
  end: Date;
}

export type WindowHourStatus =
  | { kind: "dark" }
  | { kind: "parkClosed" }
  | { kind: "inWindow" }
  | { kind: "out"; cuts: WindowCut[] };

/** One forecast hour in Hour by hour. */
export interface WindowHour {
  start: Date;
  /** Rounded °F. */
  tempF: number;
  /** `Feels.heatF`, rounded. */
  feelsF: number;
  /** `Feels.windChill`, rounded. */
  windChillF: number;
  windMph: number;
  precipitationChance: number;
  /** The sun is up at the middle of the hour: a sun beside the time, else a moon. */
  sunUp: boolean;
  status: WindowHourStatus;
}

/** "Dark", "Park closed", "In window", or the cuts joined by ", "; " (40%)" appended when storms is one. */
export function windowHourStatusText(h: WindowHour): string {
  switch (h.status.kind) {
    case "dark":
      return "Dark";
    case "parkClosed":
      return "Park closed";
    case "inWindow":
      return "In window";
    case "out": {
      const cuts = h.status.cuts;
      const words = cuts
        .map((cut) => {
          switch (cut) {
            case "heat":
              return `Heat danger (${h.feelsF}°)`;
            case "cold":
              return `Cold danger (wind chill ${ClockWords.degrees(h.windChillF)})`;
            case "wind":
              return "Windy";
            case "storms":
              return "Storms likely";
          }
        })
        .join(", ");
      return cuts.includes("storms") ? `${words} (${h.precipitationChance}%)` : words;
    }
  }
}

export const isInWindow = (h: WindowHour) => h.status.kind === "inWindow";

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
  dawn: Date;
  dusk: Date;
  opensLate: boolean;
  closesEarly: boolean;
  /** The forecast has the period containing `start`; otherwise only the rest of the day is known. */
  coversWholeDay: boolean;
  /** Spans of 30 minutes or more (measured before rounding), both ends rounded to the nearest 5 minutes. */
  spans: WindowSpan[];
  /** Rules that took out at least one known minute of start…end. */
  cuts: Set<WindowCut>;
  /** When one rule took out every known minute: heat, else cold, else wind (storms never). */
  blockedThroughout: WindowCut | null;
  /** Minutes of start…end the forecast covers. */
  knownMinutes: number;
  /** The day's forecast hours from an hour before dawn to dusk (Hour by hour). */
  hours: WindowHour[];
  /** The first forecast hour overlapping start…end. */
  firstOpenHour: WindowHour | null;
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

const CUT_BIT: Record<WindowCut, number> = { heat: 1, cold: 2, wind: 4, storms: 8 };

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

  /** A bit set of WindowCut (CUT_BIT). */
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
    const dayPeriods = forecast.periods.flatMap((p, i) => (localDayEquals(localDayFromDate(p.startTime), day) ? [i] : []));
    if (dayPeriods.length === 0) return null;
    const midnight = startDate(day);
    const sky = skyDay(midnight, lat, lng);
    const dawn = sky.dawn;
    const dusk = sky.dusk;
    if (!dawn || !dusk) return null;
    const sunrise = sky.sunrise ?? dawn;
    const sunset = sky.sunset ?? dusk;

    let start = dawn;
    let end = dusk;
    let opensLate = false;
    let closesEarly = false;
    const opens = hours ? minutesOfDay(hours.opensAt) : null;
    let closes = hours ? minutesOfDay(hours.closesAt) : null;
    if (opens !== null && closes !== null && opens !== closes) {
      // Hours past midnight ("18:00"–"02:00") don't end the daylight part.
      if (closes < opens) closes = 24 * 60;
      const open = plus(midnight, opens * MIN);
      const close = plus(midnight, closes * MIN);
      if (open > start) {
        start = open;
        opensLate = true;
      }
      if (close < end) {
        end = close;
        closesEarly = true;
      }
    }

    const sampler = new Sampler(forecast.periods);

    // Per-minute pass over start…end (inclusive), as app.js `windowFor`.
    const rawSpans: WindowSpan[] = [];
    let openStart: Date | null = null;
    let known = 0;
    const blocked = [0, 0, 0, 0];
    for (let t = start.getTime(); t <= end.getTime(); t += MIN) {
      const minute = new Date(t);
      const index = sampler.index(minute);
      const cuts = index === null ? null : sampler.cuts(minute, index);
      if (cuts !== null) {
        known += 1;
        allWindowCuts.forEach((c, i) => {
          if (cuts & CUT_BIT[c]) blocked[i]! += 1;
        });
        if (cuts === 0 && openStart === null) openStart = minute;
      }
      const stops = cuts === null ? true : cuts !== 0;
      if ((stops || t + MIN > end.getTime()) && openStart !== null) {
        rawSpans.push({ start: openStart, end: stops ? minute : end });
        openStart = null;
      }
    }
    const spans = rawSpans
      .filter((s) => s.end.getTime() - s.start.getTime() >= WindowRules.minSpanMs)
      .map((s) => ({ start: roundToFive(s.start), end: roundToFive(s.end) }));

    const rows: WindowHour[] = dayPeriods.map((index) => {
      const period = forecast.periods[index]!;
      const hourStart = period.startTime;
      const airF = Feels.fahrenheit(period.tempC);
      let status: WindowHourStatus;
      if (plus(hourStart, HOUR) <= start) {
        status = opensLate && hourStart >= plus(dawn, -HOUR) ? { kind: "parkClosed" } : { kind: "dark" };
      } else if (hourStart >= end) {
        status = closesEarly && hourStart < dusk ? { kind: "parkClosed" } : { kind: "dark" };
      } else {
        const cuts = sampler.cuts(hourStart, index);
        status = cuts === 0 ? { kind: "inWindow" } : { kind: "out", cuts: allWindowCuts.filter((c) => cuts & CUT_BIT[c]) };
      }
      const mid = plus(hourStart, 30 * MIN);
      return {
        start: hourStart,
        tempF: Feels.whole(airF),
        feelsF: Feels.whole(Feels.heatF(airF, period.relativeHumidity)),
        windChillF: Feels.whole(Feels.windChill(airF, period.windMph)),
        windMph: Feels.whole(period.windMph),
        precipitationChance: Feels.whole(period.precipitationChance ?? 0),
        sunUp: mid >= sunrise && mid < sunset,
        status,
      };
    });

    const daylight = rows.filter((h) => plus(h.start, HOUR) > dawn && h.start < dusk);
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

    let throughout: WindowCut | null = null;
    if (known > 0) {
      throughout = blocked[0] === known ? "heat" : blocked[1] === known ? "cold" : blocked[2] === known ? "wind" : null;
    }

    return {
      start,
      end,
      dawn,
      dusk,
      opensLate,
      closesEarly,
      coversWholeDay: sampler.index(start) !== null,
      spans,
      cuts: new Set(allWindowCuts.filter((_, i) => blocked[i]! > 0)),
      blockedThroughout: throughout,
      knownMinutes: known,
      hours: rows.filter((h) => plus(h.start, HOUR) > plus(dawn, -HOUR) && h.start < dusk),
      firstOpenHour: rows.find((h) => plus(h.start, HOUR) > start && h.start < end) ?? null,
      heat,
      cold,
    };
  },
};

// ---------- WindowCardText ----------

export type WindowCardState = "now" | "later" | "passed" | "none";

/** What "Hour by hour" lists; `tomorrowDawn` set when the hours are tomorrow's. */
export interface HourList {
  hours: WindowHour[];
  tomorrowDawn: Date | null;
}

/** The Best window card's words, from today's window and tomorrow's for the fallback. */
export interface WindowCardText {
  state: WindowCardState;
  /** "Now until 11:00 AM", "10:45 AM to 4:35 PM", "Today's window has passed", "No window today". */
  lead: string;
  also: string | null;
  /** The rule line under the lead. */
  rule: string;
  /** The day track's accessibility label. */
  trackLabel: string;
}

const list = (spans: WindowSpan[]) => spans.map((s) => ClockWords.range(s.start, s.end)).join(" and ");

/** Why there's no window, for a whole day or only the rest of one. */
function reason(day: DayWindow): string {
  const whole = day.coversWholeDay;
  switch (day.blockedThroughout) {
    case "heat": {
      const first = day.firstOpenHour;
      if (first) {
        const at = ClockWords.short(day.start > first.start ? day.start : first.start);
        return whole
          ? `Heat danger from the first open hour: it feels like ${first.feelsF}°F at ${at}.`
          : `Heat danger for the rest of the day: it feels like ${first.feelsF}°F at ${at}.`;
      }
      break;
    }
    case "cold":
      return whole ? "Wind chill stays at 0°F or below all day." : "Wind chill stays at 0°F or below for the rest of the day.";
    case "wind":
      return whole ? "Wind stays at 15 mph or more all day." : "Wind stays at 15 mph or more for the rest of the day.";
    default:
      break;
  }
  return whole
    ? "Every daylight hour has heat or cold danger, strong wind or storms."
    : "Every hour left today has heat or cold danger, strong wind or storms.";
}

export function windowCardText(today: DayWindow, tomorrow: DayWindow | null, now: Date): WindowCardText {
  const spans = today.spans;
  const current = spans.find((s) => s.start <= now && now < s.end);
  const later = spans.filter((s) => s.start > now);
  const past = spans.filter((s) => s.end <= now);
  const tomorrowText = tomorrow
    ? tomorrow.spans[0]
      ? `Tomorrow: ${ClockWords.range(tomorrow.spans[0].start, tomorrow.spans[0].end)}.`
      : "Tomorrow: none either."
    : null;

  let state: WindowCardState;
  let lead: string;
  let also: string | null;
  if (current) {
    state = "now";
    lead = `Now until ${ClockWords.clock(current.end)}`;
    also = later.length === 0 ? null : `Later: ${list(later)}`;
  } else if (later[0]) {
    state = "later";
    lead = list([later[0]]);
    const parts = [later.length > 1 ? `Also ${list(later.slice(1))}` : null, past.length === 0 ? null : `Earlier ${list(past)}, passed`].filter(
      (p): p is string => p !== null,
    );
    also = parts.length === 0 ? null : parts.join(" · ");
  } else if (past.length > 0) {
    state = "passed";
    lead = "Today's window has passed";
    also = [`It was ${list(past)}.`, tomorrowText].filter((p): p is string => p !== null).join(" ");
  } else {
    state = "none";
    lead = today.coversWholeDay ? "No window today" : "No window left today";
    const r = today.knownMinutes === 0 ? null : reason(today);
    const parts = [r, tomorrowText].filter((p): p is string => p !== null);
    also = parts.length === 0 ? null : parts.join(" ");
  }

  const rule =
    `Wind under ${WindowRules.maxWindMph} mph` +
    (today.cuts.has("storms") ? " and no thunderstorms likely" : "") +
    ", between dawn and dusk" +
    (today.opensLate ? `, from ${ClockWords.short(today.start)} when the park opens` : "") +
    "." +
    (today.cuts.has("heat") ? ` Hours that feel like ${WindowRules.heatF}°F or more are left out for safety.` : "") +
    (today.cuts.has("cold") ? ` Hours with a wind chill of ${WindowRules.coldF}°F or below are left out for safety.` : "");
  const trackLabel =
    spans.length === 0
      ? `No window hours today. Now ${ClockWords.clock(now)}.`
      : `Window hours today: ${list(spans)}. Now ${ClockWords.clock(now)}.`;
  return { state, lead, also, rule, trackLabel };
}

/**
 * What "Hour by hour" lists. Today's hours while the lead is about today; tomorrow's once today's window has
 * passed or there is none; whichever has hours otherwise. Null when neither does.
 */
export function hourList(card: WindowCardText, today: DayWindow, tomorrow: DayWindow | null): HourList | null {
  const todays = today.hours.length === 0 ? null : { hours: today.hours, tomorrowDawn: null };
  const tomorrows = tomorrow && tomorrow.hours.length > 0 ? { hours: tomorrow.hours, tomorrowDawn: tomorrow.dawn } : null;
  return card.state === "now" || card.state === "later" ? (todays ?? tomorrows) : (tomorrows ?? todays);
}
