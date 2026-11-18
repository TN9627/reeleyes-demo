// Port of Logic/Freshness.swift: Loaded/Cached, conditions freshness banners,
// pressure wording and chart labels, and the Prep rules strip.
// OfflinePolicy.load is not ported: the demo has no network fetches to fall back from.

import { type Conditions, type Pressure, type Prep, type Rule } from "../data/types";
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

// ---------- PressureWords ----------

/** Which way pressure went in 3 hours: the pressure chip's word. */
export type PressureDirection = "Falling" | "Steady" | "Rising";

/**
 * Wording for the pressure reading ("Falling slowly · −0.04 in 3 hr"), from the 3-hour change Δ in inHg
 * rounded to the hundredth as shown, so the words always agree with the figure.
 */
export const PressureWords = {
  /** |Δ| under this is steady. */
  steadyInHg: 0.02,
  /** |Δ| over this is fast (and a fast fall rates Slow). */
  fastInHg: 0.06,

  /** The 3-hour change in inHg, rounded to the hundredth. */
  changeInHg(p: Pressure): number {
    return PressureWords.changeInHgFromHpa(p.change3hHpa);
  },
  /** A change in hPa as inHg, rounded to the hundredth. */
  changeInHgFromHpa(hpa: number): number {
    return roundHalfAway(inHg(hpa) * 100) / 100;
  },
  /** |Δ| < 0.02 steady; otherwise falling or rising. */
  direction(changeInHg: number): PressureDirection {
    if (Math.abs(changeInHg) < PressureWords.steadyInHg) return "Steady";
    return changeInHg < 0 ? "Falling" : "Rising";
  },
  /** "Steady", "Falling slowly", "Rising fast" (fast past 0.06 inHg). */
  trend(p: Pressure): string {
    return PressureWords.trendFor(PressureWords.changeInHg(p));
  },
  trendFor(change: number): string {
    const d = PressureWords.direction(change);
    if (d === "Steady") return d;
    return `${d} ${Math.abs(change) > PressureWords.fastInHg ? "fast" : "slowly"}`;
  },
  /** "−0.04 in 3 hr" with a true minus, "+0.06 in 3 hr", "0.00 in 3 hr". */
  change(p: Pressure): string {
    return PressureWords.changeFor(PressureWords.changeInHg(p));
  },
  changeFor(change: number): string {
    const sign = change < 0 ? "\u2212" : change > 0 ? "+" : "";
    return `${sign}${Math.abs(change).toFixed(2)} in 3 hr`;
  },
  /** The hero's pressure tile caption: the change, or "No change" when it rounds to 0.00. */
  caption(change: number): string {
    return change === 0 ? "No change" : PressureWords.changeFor(change);
  },
  /** Screen reader: "falling, down 0.04 inches in 3 hours". */
  spoken(p: Pressure): string {
    return PressureWords.spokenFor(PressureWords.changeInHg(p));
  },
  spokenFor(change: number): string {
    const d = PressureWords.direction(change).toLowerCase();
    if (change === 0) return `${d}, no change in 3 hours`;
    return `${d}, ${change < 0 ? "down" : "up"} ${Math.abs(change).toFixed(2)} inches in 3 hours`;
  },
};

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
