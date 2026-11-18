// Port of Logic/PrepSelection.swift: Prep's one selection (a day and a time), the hero's hour slots and the 24-hour bar.

import type { Weather } from "../data/types";
import type { GlyphName } from "../ui/Glyph";
import { hazardSlotWords, WindowRules, type Hazard } from "./hazards";
import { periodAt, type PrepDay, type PrepForecast } from "./prepDays";
import { moonPhaseOf } from "./skyCalculator";
import { fahrenheit, Format, roundHalfAway } from "./spotFacts";
import { isSunDown, look, type HeroTone } from "./todayHero";
import { ClockWords } from "./windowTime";

// ---------- DaySelection ----------

export interface DaySelection {
  /** 0 is today, up to `prepDayCount − 1`. */
  dayOffset: number;
  /** Minutes after the day's midnight; null follows the clock (Today only). */
  minute: number | null;
}

/** Today at the current time. */
export const selectionNow: DaySelection = { dayOffset: 0, minute: null };

export const selectionIsNow = (s: DaySelection) => s.dayOffset === 0 && s.minute === null;

/** Where a day opens: Today at the current time; other days at sunrise + 2 hours rounded to the hour (about 9 AM). */
export function openingSelection(day: PrepDay): DaySelection {
  if (day.isToday) return selectionNow;
  const sunrise = day.sky.sunrise;
  if (!sunrise) return { dayOffset: day.offset, minute: 9 * 60 };
  const minutes = (sunrise.getTime() - day.start.getTime()) / 60_000 + 120;
  return { dayOffset: day.offset, minute: Math.min(roundHalfAway(minutes / 60) * 60, 23 * 60) };
}

/** The selected moment. */
export function selectionDate(s: DaySelection, day: PrepDay, now: Date): Date {
  return s.minute !== null ? new Date(day.start.getTime() + s.minute * 60_000) : now;
}

/** Minutes after the day's midnight of the selected moment. */
export function selectionMinutes(s: DaySelection, day: PrepDay, now: Date): number {
  return s.minute ?? Math.trunc((now.getTime() - day.start.getTime()) / 60_000);
}

// ---------- HourSlot ----------

export type HourSlotKind = "hour" | "now" | "sunrise" | "sunset";

/** One slot in the hero's sideways row: an hour, Today's current hour ("Now"), or a sunrise or sunset at its exact time. */
export interface HourSlot {
  id: string;
  kind: HourSlotKind;
  /** Minutes after the day's midnight the slot selects; null for Now (the current time). */
  minute: number | null;
  /** Minutes after the day's midnight the slot sits at in the row (Now: the current minute). */
  position: number;
  date: Date;
  /** "9 AM", "Now", "Sunrise", "Sunset". */
  label: string;
}

export const isSunEvent = (s: HourSlot) => s.kind === "sunrise" || s.kind === "sunset";
export const slotSelection = (s: HourSlot, dayOffset: number): DaySelection => ({ dayOffset, minute: s.minute });

export const HourSlots = {
  /**
   * One slot per hour from 12 AM to 11 PM, plus a Sunrise and a Sunset slot at their exact minute, in time order.
   * A sun event exactly on the hour replaces that hour's slot (never Today's Now slot). On Today the current hour's slot is Now.
   */
  slots(day: PrepDay, now: Date | null): HourSlot[] {
    const start = day.start;
    const nowMinute = now ? Math.trunc((now.getTime() - start.getTime()) / 60_000) : null;
    const sun = new Map<number, HourSlot>();
    for (const [kind, label, date] of [
      ["sunrise", "Sunrise", day.sky.sunrise],
      ["sunset", "Sunset", day.sky.sunset],
    ] as const) {
      if (!date) continue;
      const minute = roundHalfAway((date.getTime() - start.getTime()) / 60_000);
      if (minute < 0 || minute >= 24 * 60) continue;
      sun.set(minute, { id: label.toLowerCase(), kind, minute, position: minute, date: new Date(start.getTime() + minute * 60_000), label });
    }
    const slots: HourSlot[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const minute = hour * 60;
      if (now && nowMinute !== null && Math.trunc(nowMinute / 60) === hour) {
        slots.push({ id: "now", kind: "now", minute: null, position: nowMinute, date: now, label: "Now" });
      } else if (!sun.has(minute)) {
        const date = new Date(start.getTime() + minute * 60_000);
        slots.push({ id: `h${hour}`, kind: "hour", minute, position: minute, date, label: ClockWords.short(date) });
      }
    }
    return [...slots, ...sun.values()].sort((a, b) => a.position - b.position);
  },

  /** The slot the selection highlights. */
  selectedID(slots: HourSlot[], selection: DaySelection, minutes: number): string | null {
    if (selectionIsNow(selection)) return slots.find((s) => s.kind === "now")?.id ?? null;
    const sunSlot = slots.find((s) => isSunEvent(s) && s.minute === minutes);
    if (sunSlot) return sunSlot.id;
    const hour = Math.trunc(minutes / 60);
    return (
      (
        slots.find((s) => s.kind === "hour" && s.minute === hour * 60) ??
        slots.find((s) => s.kind === "now" && Math.trunc(s.position / 60) === hour) ??
        slots.find((s) => isSunEvent(s) && s.minute === hour * 60)
      )?.id ?? null
    );
  },
};

// ---------- HourCell ----------

/** A slot as the hero's row draws it. */
export interface HourCell {
  id: string;
  slot: HourSlot;
  icon: GlyphName;
  tone: HeroTone;
  /** "62°", "—" without a forecast for the hour, or a sun slot's "6:59". */
  value: string;
  inWindow: boolean;
  /** "9 AM, 55 degrees, cloudy, in the best window", "Sunrise at 6:59 AM". */
  spoken: string;
  /** The hour's hazards: the slot wears a warning mark. */
  hazards: Hazard[];
}

/** The day's slots drawn: the hour's forecast (Now: the live reading) by the hero's rules. */
export function hourCells(day: PrepDay, forecast: PrepForecast, now: Date | null, current: Weather | null | undefined): HourCell[] {
  return HourSlots.slots(day, now).map((slot): HourCell => {
    const inWindow = day.window ? day.window.start <= slot.date && slot.date <= day.window.end : false;
    const windowWords = inWindow ? ", in the best window" : "";
    const period = periodAt(forecast, slot.date);
    const hazards = period ? WindowRules.hazards(period) : [];
    const hazardWords = hazards.map(hazardSlotWords).join("");
    if (isSunEvent(slot)) {
      return {
        id: slot.id,
        slot,
        icon: slot.kind === "sunrise" ? "sunrise" : "sunset",
        tone: "accent",
        value: Format.shortTime(slot.date),
        inWindow,
        spoken: `${slot.label} at ${Format.time(slot.date)}${windowWords}${hazardWords}`,
        hazards,
      };
    }
    const night = isSunDown(slot.date, day.sky) ? moonPhaseOf(day.sky.moonPhase) : null;
    const weather = slot.kind === "now" ? current : null;
    const lk = weather
      ? look(night, weather.windMph, weather.cloudCoverPct, weather.sky)
      : period
        ? look(night, period.windMph, period.cloudCoverPct, period.shortForecast)
        : look(night, null, null, "");
    const c = weather?.airTempC ?? period?.tempC;
    const tempF = c != null ? fahrenheit(c) : null;
    const label = slot.kind === "now" ? "Now" : Format.time(slot.date);
    return {
      id: slot.id,
      slot,
      icon: lk.icon,
      tone: lk.tone,
      value: tempF !== null ? `${tempF}°` : "—",
      inWindow,
      spoken: `${label}, ${tempF !== null ? `${tempF} degrees, ${lk.word.toLowerCase()}` : "no forecast"}${windowWords}${hazardWords}`,
      hazards,
    };
  });
}

// ---------- TimeBar ----------

/** A sun or moon event the bar snaps to: "Dawn", "Sunrise", "Sunset", "Dusk", "Moonrise", "Moonset". */
export interface TimeBarEvent {
  name: string;
  minute: number;
}

/** The 24-hour bar's stops and steps. */
export const TimeBar = {
  /** Dragging moves in these steps. */
  step: 5,
  /** Within this many minutes of an event the bar snaps to it. */
  snapMinutes: 8,
  /** Screen reader steps move this far, stopping at each event on the way. */
  accessibilityStep: 15,
  lastMinute: 24 * 60 - 1,

  /** The day's dawn, sunrise, sunset, dusk, moonrise and moonset, in time order. */
  events(day: PrepDay): TimeBarEvent[] {
    const sky = day.sky;
    const named: [string, Date | null][] = [
      ["Dawn", sky.dawn],
      ["Sunrise", sky.sunrise],
      ["Sunset", sky.sunset],
      ["Dusk", sky.dusk],
      ["Moonrise", sky.moonrise],
      ["Moonset", sky.moonset],
    ];
    return named
      .flatMap(([name, date]) => {
        if (!date) return [];
        const minute = roundHalfAway((date.getTime() - day.start.getTime()) / 60_000);
        return minute >= 0 && minute <= TimeBar.lastMinute ? [{ name, minute }] : [];
      })
      .sort((a, b) => a.minute - b.minute);
  },

  /** A position on the bar (minutes, fractional) to the minute it selects: the nearest event within 8 minutes, else the nearest 5-minute step. */
  snap(raw: number, events: TimeBarEvent[]): { minute: number; event: TimeBarEvent | null } {
    const clamped = Math.min(Math.max(raw, 0), TimeBar.lastMinute);
    let best: TimeBarEvent | null = null;
    for (const e of events) {
      const d = Math.abs(e.minute - clamped);
      if (d <= TimeBar.snapMinutes && (best === null || d < Math.abs(best.minute - clamped))) best = e;
    }
    if (best) return { minute: best.minute, event: best };
    const stepped = roundHalfAway(clamped / TimeBar.step) * TimeBar.step;
    return { minute: Math.min(stepped, Math.trunc(TimeBar.lastMinute / TimeBar.step) * TimeBar.step), event: null };
  },

  /** The screen reader's next stop: the next quarter hour up or down, or an event on the way there. */
  stepFrom(minute: number, up: boolean, events: TimeBarEvent[]): number {
    const a = TimeBar.accessibilityStep;
    if (up) {
      const next = Math.min((Math.trunc(minute / a) + 1) * a, TimeBar.lastMinute);
      return events.find((e) => e.minute > minute && e.minute < next)?.minute ?? next;
    }
    const previous = Math.max((Math.trunc((minute + a - 1) / a) - 1) * a, 0);
    return events.findLast((e) => e.minute < minute && e.minute > previous)?.minute ?? previous;
  },

  /** The event at exactly `minute`, if any. */
  event(minute: number, events: TimeBarEvent[]): TimeBarEvent | null {
    return events.find((e) => e.minute === minute) ?? null;
  },
};
