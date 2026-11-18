// Port of Logic/PrepDays.swift: Prep's five days (B+, Nov 12): the pressure trace, each day's rating and
// best window, sun and moon, high and low and the day chip's icon.

import type { Conditions, HourlyPeriod, PressureReading } from "../data/types";
import { isForecast } from "../data/types";
import type { GlyphName } from "../ui/Glyph";
import { BestWindow, type WindowSpan } from "./bestWindow";
import type { ConditionsReading } from "./conditionsReading";
import { PressureWords } from "./freshness";
import { allHazards, HazardWords, WindowRules, type Hazard } from "./hazards";
import { addingDays, arizonaParts, localDayEquals, localDayFromDate, startDate, type LocalDay } from "./localDay";
import { moonUp, skyDay, type DateInterval, type SkyDay } from "./skyCalculator";
import { fahrenheit, Format, roundHalfAway } from "./spotFacts";
import { look } from "./todayHero";
import {
  allRatingLevels,
  levelRank,
  ratingLevelLabel,
  VerdictRules,
  verdictHiddenText,
  verdictHiddenTitle,
  type Rating,
  type RatingFactor,
  type RatingLevel,
  type WaterClass,
} from "./verdictRules";
import { ClockWords } from "./windowTime";

const HOUR = 3_600_000;
const plus = (d: Date, ms: number) => new Date(d.getTime() + ms);
const maxDate = (a: Date, b: Date) => (a > b ? a : b);
const minDate = (a: Date, b: Date) => (a < b ? a : b);
const byTime = (a: { at: Date }, b: { at: Date }) => a.at.getTime() - b.at.getTime();

// ---------- PressureTrace ----------

/**
 * The pressure trace through Prep's five days: the station's readings up to its latest, then MET Norway's hourly
 * forecast moved by one constant so it meets the latest reading. Without a station, MET Norway's forecast as is.
 */
export class PressureTrace {
  /** Samples further apart than this aren't joined (ms). */
  static readonly maxGapMs = 6 * HOUR;

  /** Oldest first. */
  readonly samples: PressureReading[];
  /** The latest measured sample; null when nothing is measured. Up to it the chart is solid, after it dashed. */
  readonly measuredUntil: Date | null;

  constructor(samples: PressureReading[], measuredUntil: Date | null) {
    this.samples = samples;
    this.measuredUntil = measuredUntil;
  }

  static fromConditions(conditions: Conditions): PressureTrace {
    const p = conditions.pressure;
    const measured = p && !isForecast(p) ? [...p.series].sort(byTime) : [];
    let forecast = conditions.pressureForecast ? [...conditions.pressureForecast.series].sort(byTime) : [];
    if (forecast.length === 0 && p && isForecast(p)) forecast = p.series;
    const last = measured.at(-1);
    if (!last) return new PressureTrace(forecast, null);
    const raw = new PressureTrace(forecast, null);
    const meeting = raw.hpa(last.at) ?? forecast.find((r) => Math.abs(r.at.getTime() - last.at.getTime()) <= HOUR)?.hpa ?? null;
    const shift = meeting === null ? 0 : last.hpa - meeting;
    const after = forecast.filter((r) => r.at > last.at).map((r) => ({ at: r.at, hpa: r.hpa + shift }));
    return new PressureTrace([...measured, ...after], last.at);
  }

  get isEmpty(): boolean {
    return this.samples.length === 0;
  }

  /** hPa at `date`, straight between the samples around it; null outside the trace or across a gap over 6 hours. */
  hpa(date: Date): number | null {
    const s = this.samples;
    const t = date.getTime();
    let low = 0;
    let high = s.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (s[mid]!.at.getTime() <= t) low = mid + 1;
      else high = mid;
    }
    if (low === 0) return null;
    const before = s[low - 1]!;
    if (before.at.getTime() === t) return before.hpa;
    if (low >= s.length) return null;
    const after = s[low]!;
    const gap = after.at.getTime() - before.at.getTime();
    if (gap > PressureTrace.maxGapMs) return null;
    return before.hpa + ((after.hpa - before.hpa) * (t - before.at.getTime())) / gap;
  }

  /** The 3-hour change ending at `date`, inHg rounded to the hundredth; null when the trace doesn't cover both ends. */
  changeInHg(endingAt: Date): number | null {
    const end = this.hpa(endingAt);
    const start = this.hpa(plus(endingAt, -3 * HOUR));
    if (end === null || start === null) return null;
    return PressureWords.changeInHgFromHpa(end - start);
  }
}

// ---------- DayRating ----------

/** A day's rating on Prep. */
export type DayRating =
  | { kind: "rated"; rating: Rating }
  /** Today's verdict is hidden (no weather or pressure, pressure over 3 hours old, an NWS warning). */
  | { kind: "hidden"; title: string; text: string }
  /** A forecast day without a pressure forecast covering its daylight. */
  | { kind: "notYet" };

export const dayRatingNotYetTitle = "No rating yet";
export const dayRatingNotYetText = "Too far out to rate. Check back once the pressure forecast is in.";

export const dayRatingLevel = (r: DayRating): RatingLevel | null => (r.kind === "rated" ? r.rating.level : null);

export function dayRatingTitle(r: DayRating): string {
  switch (r.kind) {
    case "rated":
      return ratingLevelLabel(r.rating.level);
    case "hidden":
      return r.title;
    case "notYet":
      return dayRatingNotYetTitle;
  }
}

export function dayRatingText(r: DayRating): string {
  switch (r.kind) {
    case "rated":
      return r.rating.reason;
    case "hidden":
      return r.text;
    case "notYet":
      return dayRatingNotYetText;
  }
}

// ---------- DayRatings ----------

/** One forecast hour, cut to the span being rated. */
export interface RatedHour {
  span: WindowSpan;
  rating: Rating;
  /** The hour's hazards, which made its rating Tough. */
  hazards: Hazard[];
  /** What the hour would rate without its hazards; null when it has none. */
  base: Rating | null;
  /** The whole forecast hour, when `span` is cut to dawn or dusk; set for a hazard hour. */
  hourSpan: WindowSpan | null;
}

const withoutHazards = (h: RatedHour): RatedHour => ({ span: h.span, rating: h.base ?? h.rating, hazards: [], base: null, hourSpan: null });

/** A day's level and its stretch. */
export interface Stretch {
  level: RatingLevel;
  window: WindowSpan | null;
  run: RatedHour[];
}

const duration = (run: RatedHour[]) => run[run.length - 1]!.span.end.getTime() - run[0]!.span.start.getTime();
const spanLength = (s: WindowSpan) => s.end.getTime() - s.start.getTime();

/** "morning" before noon, "afternoon" before 5 PM, else "evening". */
function partOfDay(date: Date): string {
  const hour = arizonaParts(date).hour;
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}

export const DayRatings = {
  /** A day's level has to hold this long, unbroken, and so does a best window (ms). */
  minStretchMs: 3 * HOUR,

  /** The forecast hours overlapping from…to, each rated and cut to it; null when the forecast or the pressure trace doesn't cover all of it. */
  hours(from: Date, to: Date, periods: HourlyPeriod[], pressure: PressureTrace, waterClass: WaterClass, highF: number | null): RatedHour[] | null {
    if (!(from < to)) return null;
    const hours: RatedHour[] = [];
    let covered = from;
    for (const period of periods) {
      if (!(period.endTime > from && period.startTime < to)) continue;
      const change = pressure.changeInHg(period.startTime);
      if (!(period.startTime <= covered) || change === null) return null;
      const rating = VerdictRules.rate(change, period.windMph, period.gustMph, waterClass, highF);
      const span = { start: maxDate(period.startTime, from), end: minDate(period.endTime, to) };
      const hazards = WindowRules.hazards(period);
      if (hazards[0]) {
        const tough: Rating = { level: "slow", factor: { kind: "hazard", hazard: hazards[0] }, reason: "" };
        hours.push({ span, rating: tough, hazards, base: rating, hourSpan: { start: period.startTime, end: period.endTime } });
      } else {
        hours.push({ span, rating, hazards: [], base: null, hourSpan: null });
      }
      covered = period.endTime;
    }
    return covered >= to ? hours : null;
  },

  /** When hazards, not pressure or wind, left the day Tough: the hazard covering the most daylight and its longest run. */
  hazardCause(hours: RatedHour[], level: RatingLevel): { hazard: Hazard; span: WindowSpan } | null {
    if (level !== "slow") return null;
    const plain = DayRatings.best(hours.map(withoutHazards), []);
    if (!plain || plain.level === "slow") return null;
    let cause: { hazard: Hazard; covered: number; span: WindowSpan } | null = null;
    for (const hazard of allHazards) {
      let covered = 0;
      let run: WindowSpan | null = null;
      let longest: WindowSpan | null = null;
      for (const hour of hours) {
        if (hour.hazards.includes(hazard)) {
          covered += spanLength(hour.span);
          // Worded in whole forecast hours ("6 AM to 4 PM"), not cut to dawn or dusk.
          const whole = hour.hourSpan ?? hour.span;
          run = { start: run && run.end.getTime() === whole.start.getTime() ? run.start : whole.start, end: whole.end };
          if (spanLength(run) > (longest ? spanLength(longest) : 0)) longest = run;
        } else {
          run = null;
        }
      }
      if (longest && covered > (cause?.covered ?? 0)) cause = { hazard, covered, span: longest };
    }
    return cause ? { hazard: cause.hazard, span: cause.span } : null;
  },

  /**
   * The day's level and its stretch: the best level L whose hours, rated L or better, run unbroken for at least
   * `minStretch`; `window` is the longest part of those stretches that `safe` keeps for `minStretch`.
   */
  best(hours: RatedHour[], safe: WindowSpan[]): Stretch | null {
    for (const level of allRatingLevels) {
      let runs: RatedHour[][] = [];
      for (const hour of hours) {
        if (levelRank(hour.rating.level) > levelRank(level)) continue;
        const lastRun = runs[runs.length - 1];
        const last = lastRun?.[lastRun.length - 1];
        if (lastRun && last && last.span.end.getTime() === hour.span.start.getTime()) lastRun.push(hour);
        else runs.push([hour]);
      }
      runs = runs.filter((r) => duration(r) >= DayRatings.minStretchMs);
      const first = runs[0];
      if (!first) continue;
      let found: { window: WindowSpan; run: RatedHour[] } | null = null;
      if (level !== "slow") {
        for (const run of runs) {
          for (const open of safe) {
            const start = maxDate(run[0]!.span.start, open.start);
            const end = minDate(run[run.length - 1]!.span.end, open.end);
            const length = end.getTime() - start.getTime();
            if (length < DayRatings.minStretchMs) continue;
            if (!found || length > spanLength(found.window)) found = { window: { start, end }, run };
          }
        }
      }
      return { level, window: found?.window ?? null, run: found?.run ?? first };
    }
    return null;
  },

  partOfDay,

  /** A forecast day's reason (one sentence, naming the factor of `hour`). */
  forecastReason(hour: RatedHour, windy: RatedHour | null, windMph: number, waterClass: WaterClass, highF: number | null): string {
    const part = partOfDay(hour.span.start);
    const wind = windMph < 5 ? "calm wind" : windMph < 10 ? "light wind" : "a moderate breeze";
    let gusty: string | null = null;
    if (windy) {
      const otherPart = partOfDay(windy.span.start);
      if (windy.span.start > hour.span.start) {
        gusty = otherPart === part ? "before the wind picks up" : `before the wind picks up in the ${otherPart}`;
      } else {
        gusty = otherPart === part ? "once the wind drops" : `after a windy ${otherPart}`;
      }
    }
    const f = hour.rating.factor;
    switch (f.kind) {
      case "pressureEasing":
        if (gusty) return `Pressure should ease through a calm ${part} ${gusty}.`;
        return `Pressure should ease through the ${part} with ${wind}.`;
      case "pressureSteady":
        if (gusty) return `Pressure should hold steady through a calm ${part} ${gusty}.`;
        return `Steady pressure and ${wind} should make for an ordinary bite.`;
      case "pressureClimbing":
        return "Pressure should climb, so fish often hold deeper and bite less.";
      case "pressureDroppingFast":
        return "Pressure should drop fast, which often puts fish off the bite.";
      case "windCap":
        return `${f.gusts ? "Strong gusts" : "A strong wind"} should make casting and bite detection harder.`;
      case "strongWind":
        return `A ${roundHalfAway(windMph)} mph wind should make casting and bite detection very hard.`;
      case "heat":
        return `A high of ${highF ?? VerdictRules.hotHighF}°F should warm this shallow ${waterClass === "communityPond" ? "pond" : "lake"}, so fish often feed less.`;
      case "hazard":
        throw new Error("a hazard day is worded by HazardWords.forecast, never from an hour's factor");
    }
  },

  /** "6:32–9 AM", "7:00–11 AM", "10:00 AM–1 PM". */
  windowText(w: WindowSpan): string {
    const sameHalf = arizonaParts(w.start).hour < 12 === arizonaParts(w.end).hour < 12;
    return `${sameHalf ? Format.shortTime(w.start) : Format.time(w.start)}\u2013${ClockWords.short(w.end)}`;
  },
};

// ---------- PrepDay ----------

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** One of Prep's five days. Swift's computed properties are precomputed fields. */
export interface PrepDay {
  /** 0 is today. */
  offset: number;
  day: LocalDay;
  /** Sun and moon for the day (the moon's phase at noon). */
  sky: SkyDay;
  rating: DayRating;
  window: WindowSpan | null;
  highF: number | null;
  lowF: number | null;
  /** The day chip's weather icon. */
  icon: GlyphName;
  /** The pressure trace reaches into the day: a forecast day without it has no rating and no chart. */
  hasPressure: boolean;
  /** When the moon is up during the day, cut at midnight (the 24-hour bar's moon track). */
  moonUp: DateInterval[];
  isToday: boolean;
  start: Date;
  end: Date;
  /** "Today", "Fri 13". */
  chipLabel: string;
  /** "Thu", the hour line's day. */
  weekday: string;
  /** "Today · Thu, Nov 12", "Forecast for Sat, Nov 14". */
  kicker: string;
  /** The hourly header's right side. */
  windowLine: string;
  /** Screen reader for the day chip: "Sat, Nov 14, high 73 degrees, low 52 degrees, good rating". */
  spoken: string;
}

function makePrepDay(base: Omit<PrepDay, "isToday" | "start" | "end" | "chipLabel" | "weekday" | "kicker" | "windowLine" | "spoken">): PrepDay {
  const isToday = base.offset === 0;
  const start = startDate(base.day);
  const end = startDate(addingDays(base.day, 1));
  const weekday = SHORT_WEEKDAYS[arizonaParts(start).weekday]!;
  const date = Format.weekdayMonthDay(start);
  const r = base.rating;
  const windowLine =
    r.kind === "notYet" ? "Rated once the forecast is in" : base.window ? `Best window ${DayRatings.windowText(base.window)}` : "No standout window";
  const high =
    base.highF !== null ? `high ${base.highF} degrees${base.lowF !== null ? `, low ${base.lowF} degrees` : ""}` : "no forecast";
  const level =
    r.kind === "rated"
      ? r.rating.level === "good"
        ? "good rating"
        : r.rating.level === "fair"
          ? "fair rating"
          : "tough rating"
      : r.kind === "hidden"
        ? "no rating today"
        : "no rating yet";
  return {
    ...base,
    isToday,
    start,
    end,
    chipLabel: isToday ? "Today" : `${weekday} ${base.day.day}`,
    weekday,
    kicker: isToday ? `Today · ${date}` : `Forecast for ${date}`,
    windowLine,
    spoken: `${isToday ? "Today, " : ""}${date}, ${high}, ${level}`,
  };
}

// ---------- PrepForecast ----------

/** Everything Prep's day picker, hero and Details read for the five days, from one conditions reading. */
export interface PrepForecast {
  days: PrepDay[];
  pressure: PressureTrace;
  /** The NWS hourly periods, oldest first. */
  periods: HourlyPeriod[];
}

export const prepDayCount = 5;

const isCapped = (f: RatingFactor) => f.kind === "windCap" || f.kind === "strongWind";

export function prepForecast(reading: ConditionsReading): PrepForecast {
  const { conditions, spot, now } = reading;
  const pressure = PressureTrace.fromConditions(conditions);
  const periods = [...(conditions.hourly?.periods ?? [])].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const today = localDayFromDate(now);
  const waterClass = reading.verdict.waterClass;

  const days = Array.from({ length: prepDayCount }, (_, offset): PrepDay => {
    const day = addingDays(today, offset);
    const midnight = startDate(day);
    const sky = skyDay(plus(midnight, 12 * HOUR), spot.lat, spot.lng);
    const dawn = sky.dawn ?? sky.sunrise ?? plus(midnight, 6 * HOUR);
    const dusk = sky.dusk ?? sky.sunset ?? plus(midnight, 18 * HOUR);
    const dayPeriods = periods.filter((p) => localDayEquals(localDayFromDate(p.startTime), day));
    const temps = dayPeriods.map((p) => fahrenheit(p.tempC));
    let highF: number | null = temps.length ? Math.max(...temps) : null;
    let lowF: number | null = temps.length ? Math.min(...temps) : null;
    const weather = conditions.weather;
    if (offset === 0 && weather) {
      highF = weather.highC != null ? fahrenheit(weather.highC) : highF;
      lowF = weather.lowC != null ? fahrenheit(weather.lowC) : lowF;
    }
    const dayWindow =
      offset === 0 ? reading.today : conditions.hourly ? BestWindow.day(day, conditions.hourly, spot.lat, spot.lng, spot.hours) : null;
    // The Best window's open spans, with an end it rounded off dawn, dusk or the Spot's hours put back exactly.
    const safe: WindowSpan[] = dayWindow
      ? dayWindow.spans.map((s) => ({
          start: Math.abs(s.start.getTime() - dayWindow.start.getTime()) < 300_000 ? dayWindow.start : s.start,
          end: Math.abs(s.end.getTime() - dayWindow.end.getTime()) < 300_000 ? dayWindow.end : s.end,
        }))
      : [];

    let rating: DayRating;
    let window: WindowSpan | null = null;
    if (offset === 0) {
      const verdict = reading.verdict;
      const hiddenText = verdictHiddenText(verdict);
      if (hiddenText !== null) {
        rating = { kind: "hidden", title: verdictHiddenTitle, text: hiddenText };
      } else if (verdict.rating) {
        rating = { kind: "rated", rating: verdict.rating };
        if (verdict.rating.level !== "slow") {
          const hours = DayRatings.hours(maxDate(now, dawn), dusk, dayPeriods, pressure, waterClass, highF);
          const best = hours ? DayRatings.best(hours, safe) : null;
          if (best && best.level !== "slow") window = best.window;
        }
      } else {
        rating = { kind: "hidden", title: verdictHiddenTitle, text: "" };
      }
    } else {
      const hours = DayRatings.hours(dawn, dusk, dayPeriods, pressure, waterClass, highF);
      const best = hours ? DayRatings.best(hours, safe) : null;
      if (hours && best) {
        window = best.window;
        const cause = DayRatings.hazardCause(hours, best.level);
        if (cause) {
          // Tough because of a hazard: the reason names it and its span.
          rating = {
            kind: "rated",
            rating: { level: "slow", factor: { kind: "hazard", hazard: cause.hazard }, reason: HazardWords.forecast(cause.hazard, cause.span) },
          };
        } else {
          // A Tough day without a hazard cause names its factor from the hours as pressure and wind rated them.
          const stretch = best.level === "slow" ? (DayRatings.best(hours.map(withoutHazards), []) ?? best) : best;
          const w = window;
          const inWindow = stretch.run.filter((h) => (w ? h.span.end > w.start && h.span.start < w.end : true));
          const named = inWindow.find((h) => h.rating.level === best.level) ?? inWindow[0] ?? stretch.run[0]!;
          const windy = isCapped(named.rating.factor) ? null : (hours.find((h) => isCapped(h.rating.factor)) ?? null);
          const period = dayPeriods.find((p) => p.startTime <= named.span.start && named.span.start < p.endTime);
          rating = {
            kind: "rated",
            rating: {
              level: best.level,
              factor: named.rating.factor,
              reason: DayRatings.forecastReason(named, windy, period?.windMph ?? 0, waterClass, highF),
            },
          };
        }
      } else {
        rating = { kind: "notYet" };
      }
    }

    return makePrepDay({
      offset,
      day,
      sky,
      rating,
      window,
      highF,
      lowF,
      icon: dayIcon(dayPeriods.filter((p) => p.endTime > dawn && p.startTime < dusk)),
      hasPressure:
        offset === 0 ? pressure.samples.some((r) => localDayEquals(localDayFromDate(r.at), day)) : rating.kind !== "notYet",
      moonUp: moonUp(midnight, startDate(addingDays(day, 1)), spot.lat, spot.lng),
    });
  });

  return { days, pressure, periods };
}

/** The forecast hour holding `date`. */
export function periodAt(forecast: PrepForecast, date: Date): HourlyPeriod | null {
  return forecast.periods.find((p) => p.startTime <= date && date < p.endTime) ?? null;
}

/**
 * The day chip's icon from its daylight hours: thunderstorms or rain in any hour, else wind over 15 mph in any,
 * else cloud when most hours are cloudy, else the sun.
 */
export function dayIcon(daylight: HourlyPeriod[]): GlyphName {
  const looks = daylight.map((p) => look(null, p.windMph, p.cloudCoverPct, p.shortForecast).icon);
  for (const icon of ["storm", "rain", "wind"] as GlyphName[]) if (looks.includes(icon)) return icon;
  return looks.filter((i) => i === "cloudy").length * 2 > looks.length ? "cloudy" : "sunUp";
}

