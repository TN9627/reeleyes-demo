// Port of Logic/Freshness.swift: Loaded/Cached, conditions freshness banners,
// pressure wording and chart labels, and the Prep rules strip.
// OfflinePolicy.load is not ported: the demo has no network fetches to fall back from.

import { isForecast, type Conditions, type Pressure, type Prep, type Rule } from "../data/types";
import { inHg, roundHalfAway } from "./spotFacts";

export type FallbackReason = { kind: "offline" } | { kind: "failed"; message: string };

export type Loaded<T> =
  | { kind: "live"; value: T; fetchedAt: Date }
  | { kind: "cached"; value: T; savedAt: Date; reason: FallbackReason }
  | { kind: "unavailable"; reason: FallbackReason };

export function loadedValue<T>(l: Loaded<T>): T | null {
  return l.kind === "unavailable" ? null : l.value;
}

export function loadedIsOffline<T>(l: Loaded<T>): boolean {
  return (l.kind === "cached" || l.kind === "unavailable") && l.reason.kind === "offline";
}

/** Past this, pressure no longer supports the verdict and the stale banner shows. */
export const maxPressureAgeMs = 3 * 60 * 60 * 1000;

export type ConditionsBanner =
  | { kind: "none" }
  /** Offline, showing what was saved at this time. */
  | { kind: "offline"; savedAt: Date }
  /** The conditions are this many whole hours old. */
  | { kind: "stale"; hours: number }
  /** A refresh failed (ours or the server's); showing the last values. */
  | { kind: "couldNotRefresh" };

/** The age that matters: the pressure reading's, else the weather's. */
export function readingDate(c: Conditions): Date | null {
  return c.pressure?.observedAt ?? c.weather?.observedAt ?? null;
}

/** The verdict shows only while the pressure behind it is at most 3 hours old. */
export function showsVerdict(c: Conditions, now: Date): boolean {
  if (!c.verdict || !c.pressure) return false;
  return now.getTime() - c.pressure.observedAt.getTime() <= maxPressureAgeMs;
}

function staleBanner(c: Conditions, now: Date): ConditionsBanner | null {
  const date = readingDate(c);
  if (!date) return null;
  const age = now.getTime() - date.getTime();
  return age > maxPressureAgeMs ? { kind: "stale", hours: Math.trunc(age / 3_600_000) } : null;
}

/** Offline beats stale beats a failed refresh. */
export function conditionsBanner(loaded: Loaded<Conditions>, now: Date): ConditionsBanner {
  switch (loaded.kind) {
    case "unavailable":
      return { kind: "none" };
    case "cached":
      if (loaded.reason.kind === "offline") return { kind: "offline", savedAt: loaded.savedAt };
      return staleBanner(loaded.value, now) ?? { kind: "couldNotRefresh" };
    case "live":
      return staleBanner(loaded.value, now) ?? (loaded.value.refreshFailed ? { kind: "couldNotRefresh" } : { kind: "none" });
  }
}

// ---------- PressureTraceLabels ----------

export interface PressureTraceLabels {
  /** The tile's trailing label: "Last 3 hours" or "Next 3 hours". */
  window: string;
  start: string;
  end: string;
  accessibility: string;
  /** The current reading is the first point of the series, not the last. */
  currentIsFirst: boolean;
}

export function pressureTraceLabels(p: Pressure): PressureTraceLabels {
  return isForecast(p)
    ? { window: "Next 3 hours", start: "Now", end: "In 3 hr", accessibility: "Pressure forecast for the next 3 hours", currentIsFirst: true }
    : { window: "Last 3 hours", start: "3 hr ago", end: "Now", accessibility: "Pressure over the last 3 hours", currentIsFirst: false };
}

// ---------- PressureWords ----------

/** "Fast" from 1.7 hPa (0.05 inHg) in 3 hours. */
export const fastHpa = 1.7;

/** "Steady", "Falling slowly", "Rising fast". */
export function pressureTrendWords(p: Pressure): string {
  const speed = Math.abs(p.change3hHpa) >= fastHpa ? "fast" : "slowly";
  switch (p.trend) {
    case "steady":
      return "Steady";
    case "falling":
      return `Falling ${speed}`;
    case "rising":
      return `Rising ${speed}`;
  }
}

/** "-0.05 in 3 hr", in inHg rounded to hundredths. */
export function pressureChangeWords(p: Pressure): string {
  const inches = roundHalfAway(inHg(p.change3hHpa) * 100) / 100;
  return `${inches > 0 ? "+" : ""}${inches.toFixed(2)} in 3 hr`;
}

// ---------- RuleSummary ----------

export interface KeyLimit {
  /** The bag rule's id. */
  id: number;
  subject: string;
  /** Line one: "2 per day", "No limit". */
  count: string;
  /** Line two: "Min 13 inches", "Min 13 inches · Max 16 inches"; null without a size rule. */
  size: string | null;
  /** What VoiceOver reads: "Bass, 1 per day, minimum length 13 inches". */
  spoken: string;
}

/** What a rule applies to; a layer's all-fish bag limit is "All other fish". */
export function ruleLabel(rule: Rule): string {
  if (rule.subject) return rule.subject;
  return rule.kind === "bag" && rule.scope !== "spot" ? "All other fish" : "All fish";
}

/** "Bass (largemouth, smallmouth)" → "Bass" for the strip. */
export function shortSubject(subject: string): string {
  return subject.replace(/ \(.*\)$/, "");
}

/** Min/Max of a size rule's value: "Min 13 inches" and "minimum length 13 inches". "inch" for exactly 1. */
export function sizeBounds(rule: Rule): { short: string; spoken: string }[] {
  const value = rule.value;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
  const out: { short: string; spoken: string }[] = [];
  for (const [word, long, key] of [["Min", "minimum", "minIn"], ["Max", "maximum", "maxIn"]] as const) {
    const inches = value[key];
    if (typeof inches !== "number") continue;
    const length = `${inches}\u00A0${inches === 1 ? "inch" : "inches"}`;
    out.push({ short: `${word}\u00A0${length}`, spoken: `${long} length ${length}` });
  }
  return out;
}

/** The first three bag limits, Spot overrides first, each with its fish's size limit. */
export function keyLimits(prep: Prep): KeyLimit[] {
  return prep.rules
    .filter((r) => r.kind === "bag" && (r.subject !== null || r.scope === "spot"))
    .slice(0, 3)
    .map((bag) => {
      const sizeRule = prep.rules.find(
        (r) => r.kind === "size" && r.subject === bag.subject && r.speciesId === bag.speciesId && r.speciesGroup === bag.speciesGroup,
      );
      const bounds = sizeRule ? sizeBounds(sizeRule) : [];
      const subject = shortSubject(ruleLabel(bag));
      const spokenBounds = bounds.map((b) => b.spoken).join(" and ");
      return {
        id: bag.id,
        subject,
        count: bag.summary,
        size: bounds.length === 0 ? null : bounds.map((b) => b.short).join(" · "),
        spoken: [subject, bag.summary, ...(spokenBounds ? [spokenBounds] : [])].join(", "),
      };
    });
}
