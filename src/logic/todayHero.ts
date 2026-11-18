// Port of Logic/TodayHero.swift: the Today hero on Prep at the selected moment, and the Sun and moon card.

import type { GlyphName } from "../ui/Glyph";
import type { ConditionsReading } from "./conditionsReading";
import { PressureWords } from "./freshness";
import { localDayFromDate, compareLocalDay } from "./localDay";
import { dayRatingText, dayRatingTitle, periodAt, type PrepDay, type PrepForecast } from "./prepDays";
import { TimeBar, type TimeBarEvent } from "./prepSelection";
import { isWaxing, moonAt, moonPhaseGlyph, moonPhaseName, moonPhaseOf, skyDay, type MoonPhase, type SkyDay } from "./skyCalculator";
import { compassName, fahrenheit, Format, roundHalfAway } from "./spotFacts";
import { VerdictRules } from "./verdictRules";

/** The icon's color role: night data ink, wind over the cap the Fair color, cloud or rain secondary, sun the accent. */
export type HeroTone = "dataInk" | "fair" | "secondary" | "accent";

/** One tile: its glyph, value ("6 mph"), caption ("From the east") and what a screen reader reads. */
export interface HeroChip {
  glyph: GlyphName;
  value: string;
  caption: string;
  spoken: string;
}

export interface Look {
  icon: GlyphName;
  tone: HeroTone;
  word: string;
}

export interface TodayHero {
  /** "Now · 12:50 AM", "Sat · 9:00 AM". */
  hourLine: string;
  icon: GlyphName;
  tone: HeroTone;
  /** "Sunny", "Windy", "Cloudy", "Rain", "Thunderstorms", "Clear night", "Cloudy night". */
  skyWord: string;
  /** "74°"; "—" when the forecast has no such hour. */
  temperature: string;
  /** The day's "H 79° · L 56°"; null without a high and low. */
  highLow: string | null;
  wind: HeroChip;
  /** The wind cap's condition at the hour: the wind tile takes the Fair color, border and fill. */
  windCapped: boolean;
  pressure: HeroChip;
  /** The next sunrise or sunset after the hour. */
  sun: HeroChip;
  footer: string;
  /** The hero's one screen-reader label. */
  accessibilityLabel: string;
}

/** A sky cover at or above this many percent counts as cloudy. */
export const cloudyPct = 70;
export const forecastFooter = "Forecast from NWS · less certain than a live read";

/** Between sunset and the next sunrise (no sun times: day). */
export function isSunDown(now: Date, day: SkyDay): boolean {
  if (!day.sunrise || !day.sunset) return false;
  return now < day.sunrise || now >= day.sunset;
}

/**
 * The hero icon, its color and the sky word (first match wins): at night the moon in `night`'s phase; a sustained
 * wind over 15 mph, wind; sky cover of 70% or more or rain in the forecast, cloud or rain; otherwise the sun.
 */
export function look(night: MoonPhase | null, windMph: number | null | undefined, cloudCoverPct: number | null | undefined, sky: string): Look {
  const words = sky.toLowerCase();
  const storm = words.includes("thunder") || words.includes("t-storm");
  const rain = storm || ["rain", "shower", "drizzle"].some((w) => words.includes(w));
  const cloudy = (cloudCoverPct ?? 0) >= cloudyPct;
  if (night) return { icon: moonPhaseGlyph(night), tone: "dataInk", word: cloudy || rain ? "Cloudy night" : "Clear night" };
  if (windMph != null && windMph > VerdictRules.capWindMph) return { icon: "wind", tone: "fair", word: "Windy" };
  if (storm) return { icon: "storm", tone: "secondary", word: "Thunderstorms" };
  if (rain) return { icon: "rain", tone: "secondary", word: "Rain" };
  if (cloudy) return { icon: "cloudy", tone: "secondary", word: "Cloudy" };
  return { icon: "sunUp", tone: "accent", word: words.includes("clear") ? "Clear" : "Sunny" };
}

/** "6 mph" over "From the east"; under the wind cap, "Gusts to 27" when gusts are known. */
export function windChip(windMph: number, direction: string, gustMph: number | null | undefined, capped: boolean): HeroChip {
  const mph = roundHalfAway(windMph);
  const name = direction === "" ? null : compassName(direction);
  const gust = gustMph != null ? roundHalfAway(gustMph) : null;
  let caption: string;
  let spoken: string;
  if (capped && gust !== null) {
    caption = `Gusts to ${gust}`;
    spoken = `Wind ${mph} miles per hour, gusts to ${gust}`;
  } else if (name) {
    caption = `From the ${name}`;
    spoken = `Wind ${mph} miles per hour from the ${name}`;
  } else {
    caption = "Calm";
    spoken = `Wind ${mph} miles per hour, calm`;
  }
  return { glyph: "wind", value: `${mph} mph`, caption, spoken };
}

/** The next sunrise or sunset after `date`; after the day's sunset, the next day's sunrise over "Sunrise tmrw". */
export function sunChip(date: Date, day: PrepDay, lat: number, lng: number): HeroChip {
  const chip = (glyph: GlyphName, label: string, at: Date, tomorrow: boolean): HeroChip => ({
    glyph,
    value: Format.shortTime(at),
    caption: tomorrow ? `${label} tmrw` : label,
    spoken: `${label} ${tomorrow ? "tomorrow " : ""}at ${Format.time(at)}`,
  });
  if (day.sky.sunrise && day.sky.sunrise > date) return chip("sunrise", "Sunrise", day.sky.sunrise, false);
  if (day.sky.sunset && day.sky.sunset > date) return chip("sunset", "Sunset", day.sky.sunset, false);
  const next = skyDay(new Date(day.end.getTime() + 12 * 3_600_000), lat, lng).sunrise;
  if (!next) return { glyph: "sunrise", value: "—", caption: "Sunrise", spoken: "Sunrise, unknown" };
  return chip("sunrise", "Sunrise", next, true);
}

/** `isNow`: the selection follows the clock (Today, the current time); `date` is then the reading's now. */
export function todayHero(reading: ConditionsReading, forecast: PrepForecast, day: PrepDay, date: Date, isNow: boolean): TodayHero {
  const spot = reading.spot;
  const weather = isNow ? reading.conditions.weather : null;
  const period = periodAt(forecast, date);
  const night = isSunDown(date, day.sky) ? moonPhaseOf(day.sky.moonPhase) : null;

  const hourLine = isNow ? `Now · ${Format.time(date)}` : `${day.weekday} · ${Format.time(date)}`;
  const lk = weather
    ? look(night, weather.windMph, weather.cloudCoverPct, weather.sky)
    : period
      ? look(night, period.windMph, period.cloudCoverPct, period.shortForecast)
      : look(night, null, null, "");
  const tempC = weather?.airTempC ?? period?.tempC ?? null;
  const temperature = tempC !== null ? `${fahrenheit(tempC)}°` : "—";
  const highLow = day.highF !== null && day.lowF !== null ? `H ${day.highF}° · L ${day.lowF}°` : null;

  const windMph = weather?.windMph ?? period?.windMph ?? null;
  const gustMph = weather?.gustMph ?? period?.gustMph ?? null;
  const capped = windMph !== null ? VerdictRules.windCapped(windMph, gustMph) : false;
  const wind =
    windMph !== null
      ? windChip(windMph, weather?.windDirection ?? period?.windDirection ?? "", gustMph, capped)
      : { glyph: "wind" as GlyphName, value: "—", caption: "No forecast", spoken: "Wind, no forecast for this hour" };

  const live = reading.conditions.pressure;
  const change = isNow && live ? PressureWords.changeInHg(live) : forecast.pressure.changeInHg(date);
  let pressure: HeroChip;
  if (change !== null) {
    pressure = {
      glyph: "pressure",
      value: PressureWords.direction(change),
      caption: PressureWords.caption(change),
      spoken: `Pressure ${PressureWords.spokenFor(change)}`,
    };
  } else if (day.isToday && forecast.pressure.isEmpty && !live) {
    pressure = { glyph: "pressure", value: "—", caption: "No feed", spoken: "Pressure, no feed for this Spot" };
  } else {
    pressure = { glyph: "pressure", value: "—", caption: "Not out yet", spoken: "Pressure, no forecast yet for this hour" };
  }

  let footer: string;
  if (isNow && weather) {
    // "NWS, 17 min ago" wraps as one piece.
    const age = reading.savedAt === null ? Format.age(weather.observedAt, date) : Format.time(weather.observedAt);
    footer = `A rule of thumb from pressure and wind · ${`${weather.source}, ${age}`.replaceAll(" ", "\u00A0")}`;
  } else {
    footer = isNow ? "A rule of thumb from pressure and wind" : forecastFooter;
  }

  const weatherWords = tempC !== null ? `${fahrenheit(tempC)} degrees, ${lk.word.toLowerCase()}.` : "No forecast for this hour.";
  return {
    hourLine,
    icon: lk.icon,
    tone: lk.tone,
    skyWord: lk.word,
    temperature,
    highLow,
    wind,
    windCapped: capped,
    pressure,
    sun: sunChip(date, day, spot.lat, spot.lng),
    footer,
    accessibilityLabel: `${dayRatingTitle(day.rating)}. ${dayRatingText(day.rating)} ${weatherWords}`,
  };
}

// ---------- SkyCard ----------

/** The Sun and moon card at the selected moment. Every row keeps its height; only the words change. */
export interface SkyCard {
  /** "Now 12:50 AM", "9:00 AM". */
  time: string;
  /** "Night", "First light", "Golden hour", "Daylight", "Last light", or the event the selection sits on ("Dawn"). */
  phase: string;
  /** "Sunset in 8 hr 28 min", "Sun is down for the night". */
  nextEvent: string;
  /** "Moon rises at 11:48 AM", "Moon is up · sets 11:00 PM", "Moon is up too · sets 11:00 PM", "Moon has set for the night". */
  moonLine: string;
  /** The sun's place on the arc (0…1) while it's up. */
  sun: number | null;
  /** The moon's place on its own arc (0…1) while it's up. */
  moon: number | null;
  moonIllumination: number;
  moonIsWaxing: boolean;
  moonPhase: MoonPhase;
  dawn: string;
  sunrise: string;
  sunset: string;
  dusk: string;
  /** "Moonrise 11:48 AM", "No moonrise". */
  moonrise: string;
  /** "Moonset 11:00 PM", "Moonset 12:02 AM +1 day", "No moonset". */
  moonset: string;
  /** "Waxing crescent · 22% lit". */
  moonWords: string;
}

/** The solid part of the arc: the sun's while it's up, else the moon's. */
export function skyCardElapsed(c: SkyCard): { progress: number; body: "sun" | "moon" } | null {
  if (c.sun !== null) return { progress: c.sun, body: "sun" };
  if (c.moon !== null) return { progress: c.moon, body: "moon" };
  return null;
}

/** Night before dawn and after dusk, First light to sunrise, Golden hour in the hour after sunrise and before sunset, Last light from sunset to dusk, else Daylight. */
export function skyPhase(date: Date, sky: SkyDay): string {
  const { dawn, sunrise, sunset, dusk } = sky;
  if (!dawn || !sunrise || !sunset || !dusk) return "Daylight";
  if (date < dawn || date >= dusk) return "Night";
  if (date < sunrise) return "First light";
  if (date >= sunset) return "Last light";
  const t = date.getTime();
  if (t < sunrise.getTime() + 3_600_000 || t >= sunset.getTime() - 3_600_000) return "Golden hour";
  return "Daylight";
}

/** t = (now − rise) / (set − rise), clamped to 0...1. */
export function skyProgress(now: Date, rise: Date | null, set: Date | null): number {
  if (!rise || !set || !(set > rise)) return 0;
  return Math.min(Math.max((now.getTime() - rise.getTime()) / (set.getTime() - rise.getTime()), 0), 1);
}

export interface Point {
  x: number;
  y: number;
}

/** The point at t on the half-ellipse centered at `center` with radii rx, ry: θ = π(1 − t). */
export function skyPoint(t: number, center: Point, rx: number, ry: number): Point {
  const theta = Math.PI * (1 - t);
  return { x: center.x + rx * Math.cos(theta), y: center.y - ry * Math.sin(theta) };
}

/** Where the moon marker sits when the sun is up too: nudged 26 pt toward the arc's center when within 34 pt of the sun. */
export function moonPoint(moon: Point, sun: Point | null, center: Point): Point {
  if (!sun || Math.hypot(moon.x - sun.x, moon.y - sun.y) >= 34) return moon;
  const dx = center.x - moon.x;
  const dy = center.y - moon.y;
  const length = Math.max(Math.hypot(dx, dy), 0.001);
  return { x: moon.x + (dx / length) * 26, y: moon.y + (dy / length) * 26 };
}

export function skyCard(day: PrepDay, date: Date, isNow: boolean, events: TimeBarEvent[], lat: number, lng: number): SkyCard {
  const sky = day.sky;
  const time = isNow ? `Now ${Format.time(date)}` : Format.time(date);
  const minute = roundHalfAway((date.getTime() - day.start.getTime()) / 60_000);
  const phase = isNow ? skyPhase(date, sky) : (TimeBar.event(minute, events)?.name ?? skyPhase(date, sky));

  const upcoming: [string, Date | null][] = [
    ["Dawn", sky.dawn],
    ["Sunrise", sky.sunrise],
    ["Sunset", sky.sunset],
    ["Dusk", sky.dusk],
  ];
  const next = upcoming.find(([, at]) => at !== null && at > date);
  const nextEvent = next
    ? `${next[0]} in ${Format.drive(Math.max(0, Math.trunc((next[1]!.getTime() - date.getTime()) / 60_000)))}`
    : "Sun is down for the night";

  const sunUp = !isSunDown(date, sky);
  const sun = sunUp ? skyProgress(date, sky.sunrise, sky.sunset) : null;
  const moonNow = moonAt(date, lat, lng);
  const clock = (at: Date) => (compareLocalDay(localDayFromDate(at), day.day) > 0 ? `${Format.time(at)} +1 day` : Format.time(at));
  let moon: number | null;
  let moonLine: string;
  if (moonNow.isUp) {
    moon = skyProgress(date, moonNow.rose, moonNow.sets);
    moonLine = `Moon is up${sunUp ? " too" : ""}${moonNow.sets ? ` · sets ${clock(moonNow.sets)}` : ""}`;
  } else {
    moon = null;
    const rise = moonNow.nextRise;
    moonLine = rise && compareLocalDay(localDayFromDate(rise), day.day) === 0 ? `Moon rises at ${Format.time(rise)}` : "Moon has set for the night";
  }

  const short = (at: Date | null) => (at ? Format.shortTime(at) : "—");
  // The set after the day's rise, which may be past midnight.
  let set: Date | null;
  if (sky.moonrise) {
    const rise = sky.moonrise;
    set = sky.moonset && sky.moonset > rise ? sky.moonset : moonAt(new Date(rise.getTime() + 60_000), lat, lng).sets;
  } else {
    set = sky.moonset;
  }
  const phaseOfMoon = moonPhaseOf(sky.moonPhase);
  return {
    time,
    phase,
    nextEvent,
    moonLine,
    sun,
    moon,
    moonIllumination: sky.moonIllumination,
    moonIsWaxing: isWaxing(sky),
    moonPhase: phaseOfMoon,
    dawn: short(sky.dawn),
    sunrise: short(sky.sunrise),
    sunset: short(sky.sunset),
    dusk: short(sky.dusk),
    moonrise: sky.moonrise ? `Moonrise ${Format.time(sky.moonrise)}` : "No moonrise",
    moonset: set ? `Moonset ${clock(set)}` : "No moonset",
    moonWords: `${moonPhaseName(phaseOfMoon)} · ${roundHalfAway(sky.moonIllumination * 100)}% lit`,
  };
}
