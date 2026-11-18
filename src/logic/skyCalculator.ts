// Port of Logic/SkyCalculator.swift: sun and moon times for a Spot, computed on
// the device (formulas from SunCalc, Vladimir Agafonkin, BSD-2-Clause).

import type { GlyphName } from "../ui/Glyph";
import { startDate, startOfDay, localDayFromDate } from "./localDay";

export interface SkyDay {
  dawn: Date | null;
  sunrise: Date | null;
  sunset: Date | null;
  dusk: Date | null;
  moonrise: Date | null;
  moonset: Date | null;
  /** Lit fraction of the moon, 0...1. */
  moonIllumination: number;
  /** 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
  moonPhase: number;
}

const rad = Math.PI / 180;
const dayMs = 86_400_000;
const j1970 = 2_440_588;
const j2000 = 2_451_545;
const obliquity = rad * 23.4397;
const j0 = 0.0009;

/** "Waxing crescent · 8%". */
export function moonDescription(day: SkyDay): string {
  return `${moonPhaseName(moonPhaseOf(day.moonPhase))} · ${Math.round(day.moonIllumination * 100)}%`;
}

/** The named phase, which also picks the moon's glyph. */
export const skyDayMoon = (day: SkyDay): MoonPhase => moonPhaseOf(day.moonPhase);

/** The lit side grows on the right from new to full (seen from Arizona). */
export const isWaxing = (day: SkyDay): boolean => day.moonPhase < 0.5;

/** The eight named phases of the moon. */
export type MoonPhase =
  | "new"
  | "waxingCrescent"
  | "firstQuarter"
  | "waxingGibbous"
  | "full"
  | "waningGibbous"
  | "lastQuarter"
  | "waningCrescent";

export function moonPhaseOf(phase: number): MoonPhase {
  if (phase < 0.03 || phase >= 0.97) return "new";
  if (phase < 0.22) return "waxingCrescent";
  if (phase < 0.28) return "firstQuarter";
  if (phase < 0.47) return "waxingGibbous";
  if (phase < 0.53) return "full";
  if (phase < 0.72) return "waningGibbous";
  if (phase < 0.78) return "lastQuarter";
  return "waningCrescent";
}

const MOON_NAMES: Record<MoonPhase, string> = {
  new: "New moon",
  waxingCrescent: "Waxing crescent",
  firstQuarter: "First quarter",
  waxingGibbous: "Waxing gibbous",
  full: "Full moon",
  waningGibbous: "Waning gibbous",
  lastQuarter: "Last quarter",
  waningCrescent: "Waning crescent",
};
export const moonPhaseName = (p: MoonPhase): string => MOON_NAMES[p];

/** The moon drawn in this phase: every night icon and the moon line show the phase the words name. */
export function moonPhaseGlyph(p: MoonPhase): GlyphName {
  return `moon${p[0]!.toUpperCase()}${p.slice(1)}` as GlyphName;
}

/** The moon around a moment: up or down, the rise and set of the pass it's on, and its next rise. */
export interface MoonNow {
  isUp: boolean;
  /** Up: when this pass rose (possibly yesterday). Down: null. */
  rose: Date | null;
  /** Up: when this pass sets (possibly tomorrow). Down: null. */
  sets: Date | null;
  /** Down: the next rise; null when up. */
  nextRise: Date | null;
}

export interface DateInterval {
  start: Date;
  end: Date;
}

/** Sun and moon events on the Arizona calendar day containing `date`. */
export function skyDay(date: Date, lat: number, lng: number): SkyDay {
  const noon = new Date(startDate(localDayFromDate(date)).getTime() + 12 * 3_600_000);
  const sun = sunTimes(noon, lat, lng);
  const ill = moonIlluminationAt(date);
  const crossings = moonCrossings(startOfDay(date), 24, lat, lng);
  return {
    dawn: sun.dawn,
    sunrise: sun.sunrise,
    sunset: sun.sunset,
    dusk: sun.dusk,
    moonrise: crossings.find((c) => c.rising)?.at ?? null,
    moonset: crossings.find((c) => !c.rising)?.at ?? null,
    moonIllumination: ill.fraction,
    moonPhase: ill.phase,
  };
}

/** Whether the moon is up at `now` and the pass around it, from its rises and sets in the 26 hours either side. */
export function moonAt(now: Date, lat: number, lng: number): MoonNow {
  const window = 26;
  const crossings = moonCrossings(new Date(now.getTime() - window * 3_600_000), window * 2, lat, lng);
  const before = crossings.filter((c) => c.at <= now).at(-1);
  const after = crossings.filter((c) => c.at > now);
  const isUp = before ? before.rising : moonAltitude(now, lat, lng) > moonHorizon;
  return isUp
    ? { isUp: true, rose: before?.at ?? null, sets: after.find((c) => !c.rising)?.at ?? null, nextRise: null }
    : { isUp: false, rose: null, sets: null, nextRise: after.find((c) => c.rising)?.at ?? null };
}

/** When the moon is up from `start` to `end`, each pass cut at both ends, in order (the 24-hour bar's moon track). */
export function moonUp(start: Date, end: Date, lat: number, lng: number): DateInterval[] {
  const hours = Math.ceil((end.getTime() - start.getTime()) / 3_600_000);
  const crossings = moonCrossings(start, hours, lat, lng).filter((c) => c.at < end);
  let rose: Date | null = moonAt(start, lat, lng).isUp ? start : null;
  const passes: DateInterval[] = [];
  for (const c of crossings) {
    if (c.rising) {
      if (rose === null) rose = c.at;
    } else if (rose !== null) {
      passes.push({ start: rose, end: c.at });
      rose = null;
    }
  }
  if (rose !== null) passes.push({ start: rose, end });
  return passes;
}

const toJulian = (d: Date) => d.getTime() / dayMs - 0.5 + j1970;
const fromJulian = (j: number): Date | null =>
  Number.isFinite(j) ? new Date((j + 0.5 - j1970) * dayMs) : null;
const toDays = (d: Date) => toJulian(d) - j2000;

const rightAscension = (l: number, b: number) =>
  Math.atan2(Math.sin(l) * Math.cos(obliquity) - Math.tan(b) * Math.sin(obliquity), Math.cos(l));
const declination = (l: number, b: number) =>
  Math.asin(Math.sin(b) * Math.cos(obliquity) + Math.cos(b) * Math.sin(obliquity) * Math.sin(l));
const altitude = (h: number, phi: number, dec: number) =>
  Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h));
const siderealTime = (d: number, lw: number) => rad * (280.16 + 360.9856235 * d) - lw;
function astroRefraction(h0: number): number {
  const h = Math.max(h0, 0);
  return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179));
}

const solarMeanAnomaly = (d: number) => rad * (357.5291 + 0.98560028 * d);
function eclipticLongitude(m: number): number {
  const c = rad * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m));
  return m + c + rad * 102.9372 + Math.PI;
}
function sunCoords(d: number) {
  const l = eclipticLongitude(solarMeanAnomaly(d));
  return { dec: declination(l, 0), ra: rightAscension(l, 0) };
}

const julianCycle = (d: number, lw: number) => Math.round(d - j0 - lw / (2 * Math.PI));
const approxTransit = (ht: number, lw: number, n: number) => j0 + (ht + lw) / (2 * Math.PI) + n;
const solarTransitJ = (ds: number, m: number, l: number) => j2000 + ds + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l);
const hourAngle = (h: number, phi: number, dec: number) =>
  Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));

function sunTimes(date: Date, lat: number, lng: number) {
  const lw = rad * -lng;
  const phi = rad * lat;
  const d = toDays(date);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const m = solarMeanAnomaly(ds);
  const l = eclipticLongitude(m);
  const dec = declination(l, 0);
  const noon = solarTransitJ(ds, m, l);
  const times = (angle: number) => {
    const w = hourAngle(angle * rad, phi, dec);
    const set = solarTransitJ(approxTransit(w, lw, n), m, l);
    return { rise: fromJulian(noon - (set - noon)), set: fromJulian(set) };
  };
  const sun = times(-0.833);
  const civil = times(-6);
  return { dawn: civil.rise, sunrise: sun.rise, sunset: sun.set, dusk: civil.set };
}

function moonCoords(d: number) {
  const l = rad * (218.316 + 13.176396 * d);
  const m = rad * (134.963 + 13.064993 * d);
  const f = rad * (93.272 + 13.22935 * d);
  const lng = l + rad * 6.289 * Math.sin(m);
  const lat = rad * 5.128 * Math.sin(f);
  return { ra: rightAscension(lng, lat), dec: declination(lng, lat), dist: 385_001 - 20_905 * Math.cos(m) };
}

function moonAltitude(date: Date, lat: number, lng: number): number {
  const lw = rad * -lng;
  const phi = rad * lat;
  const d = toDays(date);
  const c = moonCoords(d);
  const h = altitude(siderealTime(d, lw) - c.ra, phi, c.dec);
  return h + astroRefraction(h);
}

function moonIlluminationAt(date: Date) {
  const d = toDays(date);
  const s = sunCoords(d);
  const m = moonCoords(d);
  const sunDistance = 149_598_000;
  const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(sunDistance * Math.sin(phi), m.dist - sunDistance * Math.cos(phi));
  const angle = Math.atan2(
    Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra),
  );
  return { fraction: (1 + Math.cos(inc)) / 2, phase: 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI };
}

/** The moon's altitude at rise and set (SunCalc's 0.133°: its radius plus parallax, net of refraction). */
const moonHorizon = 0.133 * rad;

interface MoonCrossing {
  at: Date;
  rising: boolean;
}

/**
 * Every moonrise and moonset from `start` to `hours` hours later, in order, found by fitting a parabola to the
 * moon's altitude every two hours (SunCalc's getMoonTimes, kept going past the first rise and set).
 */
function moonCrossings(start: Date, hours: number, lat: number, lng: number): MoonCrossing[] {
  const at = (h: number) => new Date(start.getTime() + h * 3_600_000);
  const alt = (h: number) => moonAltitude(at(h), lat, lng) - moonHorizon;
  const crossings: MoonCrossing[] = [];
  const add = (offset: number, rising: boolean) => {
    if (offset >= 0 && offset <= hours) crossings.push({ at: at(offset), rising });
  };
  let h0 = alt(0);
  for (let hour = 1; hour <= hours; hour += 2) {
    const h1 = alt(hour);
    const h2 = alt(hour + 1);
    const a = (h0 + h2) / 2 - h1;
    const b = (h2 - h0) / 2;
    const xe = -b / (2 * a);
    const ye = (a * xe + b) * xe + h1;
    const disc = b * b - 4 * a * h1;
    if (disc >= 0 && a !== 0) {
      const dx = Math.sqrt(disc) / (Math.abs(a) * 2);
      let x1 = xe - dx;
      const x2 = xe + dx;
      let roots = 0;
      if (Math.abs(x1) <= 1) roots++;
      if (Math.abs(x2) <= 1) roots++;
      if (x1 < -1) x1 = x2;
      if (roots === 1) {
        add(hour + x1, h0 < 0);
      } else if (roots === 2) {
        // Up and down (or down and up) within these two hours.
        const rise = hour + (ye < 0 ? x2 : x1);
        const set = hour + (ye < 0 ? x1 : x2);
        add(Math.min(rise, set), rise < set);
        add(Math.max(rise, set), rise > set);
      }
    }
    h0 = h2;
  }
  return crossings;
}
