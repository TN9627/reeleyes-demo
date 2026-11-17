// Port of Logic/SpotFacts.swift: stocking recency and weeks, species note,
// opening hours, and the Format / Units / Compass copy helpers.

import type { SpotHours, StockingEvent } from "../data/types";
import {
  arizonaParts,
  compareLocalDay,
  daysUntil,
  localDayEquals,
  localDayToString,
  mondayOfWeek,
  startDate,
  type LocalDay,
} from "./localDay";

// ---------- StockingRecency ----------

/** "Stocked recently": stocked 0 to 14 days ago, inclusive. */
export const recentDays = 14;

export function isRecent(stockedOn: LocalDay | null | undefined, today: LocalDay): boolean {
  if (!stockedOn) return false;
  const days = daysUntil(stockedOn, today);
  return days >= 0 && days <= recentDays;
}

/** "This week", "Last week", "3 weeks ago" by Monday-start weeks; a future (scheduled) day reads "Week of Nov 16". */
export function weekLabel(day: LocalDay, today: LocalDay): string {
  const weeks = Math.round(daysUntil(mondayOfWeek(day), mondayOfWeek(today)) / 7);
  if (weeks < 0) return `Week of ${monthDay(startDate(mondayOfWeek(day)))}`;
  if (weeks === 0) return "This week";
  if (weeks === 1) return "Last week";
  return `${weeks} weeks ago`;
}

// ---------- StockingWeeks ----------

export interface StockingLine {
  speciesId: number;
  /** The latest past week, or the soonest scheduled one. */
  week: LocalDay;
  /** Every week this species appears in that direction, `week` included. */
  count: number;
}

export interface StockingWeeks {
  recent: StockingLine[];
  scheduled: StockingLine[];
}

function stockingLines(events: StockingEvent[], pick: (days: LocalDay[]) => LocalDay): StockingLine[] {
  const bySpecies = new Map<number, LocalDay[]>();
  for (const e of events) {
    const list = bySpecies.get(e.speciesId);
    if (list) list.push(e.stockedOn);
    else bySpecies.set(e.speciesId, [e.stockedOn]);
  }
  return [...bySpecies].map(([speciesId, days]) => ({
    speciesId,
    week: pick(days),
    count: new Set(days.map(localDayToString)).size,
  }));
}

const maxDay = (days: LocalDay[]) => days.reduce((a, b) => (compareLocalDay(b, a) > 0 ? b : a));
const minDay = (days: LocalDay[]) => days.reduce((a, b) => (compareLocalDay(b, a) < 0 ? b : a));

export function stockingWeeks(events: StockingEvent[], today: LocalDay): StockingWeeks {
  return {
    recent: stockingLines(events.filter((e) => compareLocalDay(e.stockedOn, today) <= 0), maxDay).sort((a, b) =>
      compareLocalDay(b.week, a.week),
    ),
    scheduled: stockingLines(events.filter((e) => compareLocalDay(e.stockedOn, today) > 0), minDay).sort((a, b) =>
      compareLocalDay(a.week, b.week),
    ),
  };
}

export function stockingWeeksIsEmpty(w: StockingWeeks): boolean {
  return w.recent.length === 0 && w.scheduled.length === 0;
}

/** "3 more times in the last 8 weeks", or null for a single stocking. */
export function recentMeta(line: StockingLine): string | null {
  const more = line.count - 1;
  return more > 0 ? `${more} more ${more === 1 ? "time" : "times"} in the last 8 weeks` : null;
}

/** "Scheduled", or "Scheduled, then 2 more weeks". */
export function scheduledMeta(line: StockingLine): string {
  const more = line.count - 1;
  return more > 0 ? `Scheduled, then ${more} more ${more === 1 ? "week" : "weeks"}` : "Scheduled";
}

// Re-exported for screens comparing days.
export { localDayEquals };

// ---------- SpeciesNote ----------

/**
 * The note without its opening "Sport fish species include …" sentence, which the
 * species rows already show; null when nothing else is left. Notes that open
 * differently stay whole.
 */
export function beyondSpeciesList(note: string | null | undefined): string | null {
  const trimmed = note?.trim();
  if (!trimmed) return null;
  if (!/^Spor[t ]*fish species include/i.test(trimmed)) return trimmed;
  const end = /\.\s+(?=[A-Z])/.exec(trimmed);
  if (!end) return null;
  const rest = trimmed.slice(end.index + end[0].length).trim();
  return rest === "" ? null : rest;
}

// ---------- OpenHours ----------

/** "HH:mm" to minutes after midnight; "24:00" is 1440. Null when malformed. */
export function minutesOfDay(hhmm: string): number | null {
  const parts = hhmm.split(":").filter((p) => p !== "").map(Number);
  if (parts.length !== 2 || parts.some((p) => !Number.isInteger(p))) return null;
  const [h, m] = parts as [number, number];
  if (h < 0 || h > 24 || m < 0 || m >= 60) return null;
  const total = h * 60 + m;
  return total <= 24 * 60 ? total : null;
}

/** Whether a Spot is open at `date` (Arizona time). Unknown hours count as not open. */
export function isOpen(hours: SpotHours | null | undefined, date: Date): boolean {
  if (!hours) return false;
  const opens = minutesOfDay(hours.opensAt);
  const closes = minutesOfDay(hours.closesAt);
  if (opens === null || closes === null) return false;
  const p = arizonaParts(date);
  const now = p.hour * 60 + p.minute;
  if (opens === closes) return true;
  // A closing time before the opening time runs past midnight.
  return opens < closes ? now >= opens && now < closes : now >= opens || now < closes;
}

// ---------- Format ----------

const NBSP = "\u00A0";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "9 min", "1 hr", "2 hr 50 min", with no-break spaces. */
export function formatDrive(minutes: number): string {
  if (minutes < 60) return `${minutes}${NBSP}min`;
  const hours = Math.trunc(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}${NBSP}hr` : `${hours}${NBSP}hr ${rest}${NBSP}min`;
}

/** "30 min", "1 hour", "2 hours": a drive-time range. */
export function formatRange(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.trunc(minutes / 60);
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

/** "just now", "8 min ago", "5 hr ago", "2 days ago". */
export function formatAge(from: Date, to: Date): string {
  const minutes = Math.trunc((to.getTime() - from.getTime()) / 1000 / 60);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.trunc(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.trunc(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

/** "8:05 AM" in Arizona time. */
export function formatTime(date: Date): string {
  const p = arizonaParts(date);
  return `${p.hour % 12 === 0 ? 12 : p.hour % 12}:${String(p.minute).padStart(2, "0")} ${p.hour < 12 ? "AM" : "PM"}`;
}

/** "6:51" in Arizona time, no AM/PM (the day band). */
export function formatShortTime(date: Date): string {
  const p = arizonaParts(date);
  return `${p.hour % 12 === 0 ? 12 : p.hour % 12}:${String(p.minute).padStart(2, "0")}`;
}

/** "Sat, Nov 7" in Arizona time. */
export function formatWeekdayMonthDay(date: Date): string {
  const p = arizonaParts(date);
  return `${WEEKDAYS[p.weekday]}, ${MONTHS[p.month - 1]} ${p.day}`;
}

/** "Nov 16" in Arizona time. */
export function monthDay(date: Date): string {
  const p = arizonaParts(date);
  return `${MONTHS[p.month - 1]} ${p.day}`;
}

/** Swift's `Format` namespace under one object, for call-site parity. */
export const Format = {
  drive: formatDrive,
  range: formatRange,
  age: formatAge,
  time: formatTime,
  shortTime: formatShortTime,
  weekdayMonthDay: formatWeekdayMonthDay,
  monthDay,
};

// ---------- Units ----------

/** Swift's `.rounded()`: halves round away from zero. */
export function roundHalfAway(x: number): number {
  return x < 0 ? -Math.round(-x) : Math.round(x);
}

export function fahrenheit(celsius: number): number {
  return roundHalfAway((celsius * 9) / 5 + 32);
}

export function inHg(hpa: number): number {
  return hpa / 33.8639;
}

// ---------- Compass ----------

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const WORDS: Record<string, string> = { N: "north", E: "east", S: "south", W: "west" };

/** Degrees the wind blows toward (an arrow pointing downwind). */
export function downwindDegrees(direction: string): number {
  return Math.max(POINTS.indexOf(direction), 0) * 22.5 + 180;
}

/** "north", "northeast", "north-northeast"; the input itself when unknown. */
export function compassName(direction: string): string {
  if (!POINTS.includes(direction)) return direction;
  const letters = [...direction].map((c) => WORDS[c]!);
  return letters.length === 3 ? `${letters[0]}-${letters[1]}${letters[2]}` : letters.join("");
}
