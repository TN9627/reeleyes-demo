// Port of Logic/SkyCalculator.swift: sun and moon times for a Spot, computed on
// the device (formulas from SunCalc, Vladimir Agafonkin, BSD-2-Clause).

import { startDate, startOfDay, localDayFromDate } from "./localDay";

export interface SkyDay {
  dawn: Date | null;
  sunrise: Date | null;
  sunset: Date | null;
  dusk: Date | null;
  moonrise: Date | null;
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

/** "Waning crescent, 12%". */
export function moonDescription(day: SkyDay): string {
  return `${phaseName(day.moonPhase)}, ${Math.round(day.moonIllumination * 100)}%`;
}

export function phaseName(phase: number): string {
  if (phase < 0.03 || phase >= 0.97) return "New moon";
  if (phase < 0.22) return "Waxing crescent";
  if (phase < 0.28) return "First quarter";
  if (phase < 0.47) return "Waxing gibbous";
  if (phase < 0.53) return "Full moon";
  if (phase < 0.72) return "Waning gibbous";
  if (phase < 0.78) return "Last quarter";
  return "Waning crescent";
}

/** Sun and moon events on the Arizona calendar day containing `date`. */
export function skyDay(date: Date, lat: number, lng: number): SkyDay {
  const noon = new Date(startDate(localDayFromDate(date)).getTime() + 12 * 3_600_000);
  const sun = sunTimes(noon, lat, lng);
  const ill = moonIlluminationAt(date);
  return {
    dawn: sun.dawn,
    sunrise: sun.sunrise,
    sunset: sun.sunset,
    dusk: sun.dusk,
    moonrise: moonrise(startOfDay(date), lat, lng),
    moonIllumination: ill.fraction,
    moonPhase: ill.phase,
  };
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

/** The moon's rise on the day starting at `dayStart`, found by fitting a parabola to its altitude every two hours. */
function moonrise(dayStart: Date, lat: number, lng: number): Date | null {
  const hc = 0.133 * rad;
  const at = (hours: number) => new Date(dayStart.getTime() + hours * 3_600_000);
  const alt = (hours: number) => moonAltitude(at(hours), lat, lng) - hc;
  let h0 = alt(0);
  for (let hour = 1; hour <= 24; hour += 2) {
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
      if (roots === 1 && h0 < 0) return at(hour + x1);
      if (roots === 2) return at(hour + (ye < 0 ? x2 : x1));
    }
    h0 = h2;
  }
  return null;
}
