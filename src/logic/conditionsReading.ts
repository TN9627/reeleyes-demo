// Port of Logic/ConditionsReading.swift: everything Prep's header and the Verdict screen read from one
// conditions response at one moment.

import type { Conditions, NWSAlert, SpotSummary } from "../data/types";
import { AlertRules } from "./alertRules";
import { BestWindow, type DayWindow } from "./bestWindow";
import { conditionsBanner, type ConditionsBanner, type Loaded } from "./freshness";
import { addingDays, localDayFromDate } from "./localDay";
import { SafetyNotices } from "./safetyNotices";
import { Format } from "./spotFacts";
import { VerdictRules, type VerdictRead } from "./verdictRules";

/** How the alerts check stands, for the window card's note. */
export type AlertsNote =
  | { kind: "none" }
  /** The last check failed (or none ever succeeded): an alert wouldn't show. */
  | { kind: "checkFailed" }
  /** Offline with no active alert in the saved copy, saved at this time. */
  | { kind: "offlineNoneActive"; savedAt: Date };

export interface ConditionsReading {
  conditions: Conditions;
  spot: SpotSummary;
  now: Date;
  banner: ConditionsBanner;
  /** Set when offline: the saved copy's time ("as of 8:05 AM"). */
  savedAt: Date | null;
  active: NWSAlert[];
  today: DayWindow | null;
  tomorrow: DayWindow | null;
  verdict: VerdictRead;
  heatLine: string | null;
  coldLine: string | null;
  alertsNote: AlertsNote;
}

export function conditionsReading(loaded: Loaded<Conditions>, conditions: Conditions, spot: SpotSummary, now: Date): ConditionsReading {
  const banner = conditionsBanner(loaded, now);
  const savedAt = banner.kind === "offline" ? banner.savedAt : null;
  const active = AlertRules.active(conditions.alerts, now);
  const day = localDayFromDate(now);
  const hourly = conditions.hourly;
  const today = hourly ? BestWindow.day(day, hourly, spot.lat, spot.lng, spot.hours) : null;
  const tomorrow = hourly ? BestWindow.day(addingDays(day, 1), hourly, spot.lat, spot.lng, spot.hours) : null;
  let alertsNote: AlertsNote;
  if (savedAt && active.length === 0) alertsNote = { kind: "offlineNoneActive", savedAt };
  else if (savedAt === null && (conditions.alerts?.refreshFailed ?? true)) alertsNote = { kind: "checkFailed" };
  else alertsNote = { kind: "none" };
  return {
    conditions,
    spot,
    now,
    banner,
    savedAt,
    active,
    today,
    tomorrow,
    verdict: VerdictRules.read(conditions, spot, active, now),
    heatLine: SafetyNotices.heatLine(today, active),
    coldLine: SafetyNotices.coldLine(today, active),
    alertsNote,
  };
}

/** "checked 6 min ago" under an alert banner; "as of 8:05 AM" offline. */
export function alertsChecked(r: ConditionsReading): string {
  if (r.savedAt) return `as of ${Format.time(r.savedAt)}`;
  const checkedAt = r.conditions.alerts?.checkedAt;
  return checkedAt ? `checked ${Format.age(checkedAt, r.now)}` : "";
}

/** The stale banner's age in hours, when it shows. */
export const staleHours = (r: ConditionsReading): number | null => (r.banner.kind === "stale" ? r.banner.hours : null);

/** NWS's own text, shown as NWS wrote it. */
export const NWSText = {
  /** A line break followed by text is NWS's hard wrap and becomes a space; blank lines and indented lines keep their breaks. */
  reflow(text: string): string {
    return text.replace(/(?<=\S)[ \t]*\n(?=[^\s*])/g, " ");
  },
  /** The Spot's point forecast on weather.gov, where NWS lists its alerts too. */
  forecastPage(spot: SpotSummary): string {
    return `https://forecast.weather.gov/MapClick.php?lat=${spot.lat.toFixed(4)}&lon=${spot.lng.toFixed(4)}`;
  },
};
