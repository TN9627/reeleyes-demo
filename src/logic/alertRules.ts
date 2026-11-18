// Port of Logic/AlertRules.swift: which NWS alerts are active at the time of viewing, and their words.
// Worked out on the device so a saved copy drops alerts that have ended.

import type { NWSAlert, NWSAlerts } from "../data/types";
import { ClockWords } from "./windowTime";

/** The banner glyph's family. */
export type AlertKind = "heat" | "cold" | "storm" | "wind" | "other";

const severityOrder = ["Extreme", "Severe", "Moderate", "Minor", "Unknown"];
const end = (a: NWSAlert) => a.ends ?? a.expires;
const rank = (a: NWSAlert) => {
  const i = severityOrder.indexOf(a.severity);
  return i < 0 ? severityOrder.length - 1 : i;
};

export const AlertRules = {
  heatEvents: new Set(["Extreme Heat Warning", "Heat Advisory"]),
  coldEvents: new Set(["Extreme Cold Warning", "Cold Weather Advisory"]),

  /** Not ended (ends ?? expires > now); most severe first, then earliest onset (no onset = sent). */
  active(alerts: NWSAlerts | null | undefined, now: Date): NWSAlert[] {
    if (!alerts) return [];
    return alerts.items
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => end(a) > now)
      .sort((l, r) => {
        const dr = rank(l.a) - rank(r.a);
        if (dr !== 0) return dr;
        const lo = (l.a.onset ?? l.a.sent).getTime(), ro = (r.a.onset ?? r.a.sent).getTime();
        if (lo !== ro) return lo - ro;
        return l.i - r.i;
      })
      .map(({ a }) => a);
  },

  /** The first active alert whose event ends in " Warning" and has begun: it hides the verdict. */
  hidingWarning(active: NWSAlert[], now: Date): NWSAlert | null {
    return active.find((a) => a.event.endsWith(" Warning") && (a.onset == null || a.onset <= now)) ?? null;
  },

  kind(event: string): AlertKind {
    if (event.includes("Heat")) return "heat";
    if (event.includes("Cold")) return "cold";
    if (event.includes("Thunderstorm")) return "storm";
    if (event.includes("Wind") || event.includes("Dust")) return "wind";
    return "other";
  },

  /** Onset after now: "From <onset> to <end>"; else "Until <end>". */
  when(alert: NWSAlert, now: Date): string {
    const until = ClockWords.when(end(alert), now);
    if (alert.onset && alert.onset > now) return `From ${ClockWords.when(alert.onset, now)} to ${until}`;
    return `Until ${until}`;
  },

  /** "NWS Phoenix AZ" → "NWS Phoenix" (drops a trailing two-letter state). */
  office(alert: NWSAlert): string {
    return alert.senderName.replace(/ [A-Z]{2}$/, "");
  },

  /** "an Extreme Heat Warning", "a Heat Advisory". */
  withArticle(event: string): string {
    return `${"AEIOU".includes(event[0] ?? "x") ? "an" : "a"} ${event}`;
  },
};
