// Port of Logic/SafetyNotices.swift: the heat and cold danger notices on Prep, about the Angler's safety, never a fishing rating.

import type { NWSAlert } from "../data/types";
import { AlertRules } from "./alertRules";
import type { DayWindow } from "./bestWindow";
import { WindowRules } from "./hazards";
import { ClockWords } from "./windowTime";

function alertLine(active: NWSAlert[], events: Set<string>): string | null {
  const a = active.find((x) => events.has(x.event));
  return a ? `NWS has ${AlertRules.withArticle(a.event)} out for this Spot.` : null;
}

export const SafetyNotices = {
  /** Heat danger today: shown when today's window has `heat`, or an active heat alert. */
  heatLine(today: DayWindow | null, active: NWSAlert[]): string | null {
    const heat = today?.heat;
    if (heat) {
      return `It feels like ${WindowRules.heatF}°F or more from ${ClockWords.short(heat.from)}, up to ${heat.peakF}°F around ${ClockWords.short(heat.peakAt)}. Full sun adds up to 15°F.`;
    }
    return alertLine(active, AlertRules.heatEvents);
  },
  /** Cold danger today: shown when today's window has `cold`, or an active cold alert. */
  coldLine(today: DayWindow | null, active: NWSAlert[]): string | null {
    const cold = today?.cold;
    if (cold) {
      return `The wind chill reaches ${WindowRules.coldF}°F or below today, as low as ${ClockWords.degrees(cold.lowestF)}F around ${ClockWords.short(cold.lowestAt)}.`;
    }
    return alertLine(active, AlertRules.coldEvents);
  },
};
