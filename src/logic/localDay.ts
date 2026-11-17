// Port of Models/LocalDay.swift. Arizona time is America/Phoenix, UTC-7 all
// year (no daylight saving), so every conversion is an exact fixed offset;
// Intl is not needed for that and this stays dependency- and locale-free.
// Weeks start on Monday (AZGFD stocking weeks).

/** A calendar day as the API sends it ("YYYY-MM-DD"), in Arizona time. */
export interface LocalDay {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Milliseconds Phoenix local time is behind UTC. */
const AZ_BEHIND_UTC = 7 * HOUR;

export function localDay(year: number, month: number, day: number): LocalDay {
  return { year, month, day };
}

/** Parses "YYYY-MM-DD"; null when malformed. */
export function parseLocalDay(raw: string): LocalDay | null {
  const parts = raw.split("-").filter((p) => p !== "").map((p) => Number(p));
  if (parts.length !== 3 || parts.some((p) => !Number.isInteger(p))) return null;
  const [year, month, day] = parts as [number, number, number];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/** The Arizona day containing `date`. */
export function localDayFromDate(date: Date): LocalDay {
  const p = arizonaParts(date);
  return { year: p.year, month: p.month, day: p.day };
}

/** "YYYY-MM-DD". */
export function localDayToString(d: LocalDay): string {
  return `${String(d.year).padStart(4, "0")}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

/** Midnight (Arizona) at the start of this day. */
export function startDate(d: LocalDay): Date {
  return new Date(Date.UTC(d.year, d.month - 1, d.day) + AZ_BEHIND_UTC);
}

export function addingDays(d: LocalDay, days: number): LocalDay {
  return localDayFromDate(new Date(startDate(d).getTime() + days * DAY));
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function daysUntil(a: LocalDay, b: LocalDay): number {
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY);
}

export function compareLocalDay(a: LocalDay, b: LocalDay): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

export function localDayEquals(a: LocalDay, b: LocalDay): boolean {
  return compareLocalDay(a, b) === 0;
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(d: LocalDay): number {
  return new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
}

/** The Monday starting the week that contains `d`. */
export function mondayOfWeek(d: LocalDay): LocalDay {
  return addingDays(d, -((weekday(d) + 6) % 7));
}

export interface ArizonaParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday. */
  weekday: number;
}

/** Calendar components of an instant in Arizona time. */
export function arizonaParts(date: Date): ArizonaParts {
  const t = new Date(date.getTime() - AZ_BEHIND_UTC);
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate(),
    hour: t.getUTCHours(),
    minute: t.getUTCMinutes(),
    second: t.getUTCSeconds(),
    weekday: t.getUTCDay(),
  };
}

/** Midnight (Arizona) of the day containing `date`. */
export function startOfDay(date: Date): Date {
  return startDate(localDayFromDate(date));
}
