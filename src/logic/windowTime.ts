// Port of Logic/WindowTime.swift: times and temperatures in the words the window, alerts and verdict use, in Arizona time.

import { Feels } from "./feels";
import { arizonaParts, localDayEquals, localDayFromDate } from "./localDay";
import { Format } from "./spotFacts";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const isMorning = (date: Date) => arizonaParts(date).hour < 12;

export const ClockWords = {
  /** "9:41 AM", "1:00 PM". */
  clock(date: Date): string {
    return Format.time(date);
  },
  /** The clock without ":00": "11 AM", "4:45 PM". */
  short(date: Date): string {
    return ClockWords.clock(date).replaceAll(":00", "");
  },
  /** "6:00 to 7:35 PM" when both ends share AM or PM; else "11:00 AM to 1:00 PM". */
  range(start: Date, end: Date): string {
    return isMorning(start) === isMorning(end)
      ? `${Format.shortTime(start)} to ${ClockWords.clock(end)}`
      : `${ClockWords.clock(start)} to ${ClockWords.clock(end)}`;
  },
  /** "6 to 9 AM" when both ends share AM or PM; else "6 AM to 4 PM". */
  shortRange(start: Date, end: Date): string {
    return isMorning(start) === isMorning(end)
      ? `${Format.shortTime(start).replaceAll(":00", "")} to ${ClockWords.short(end)}`
      : `${ClockWords.short(start)} to ${ClockWords.short(end)}`;
  },
  /** The short clock on the same Arizona day as `now`; else with the weekday: "8 PM Friday". */
  when(date: Date, now: Date): string {
    if (localDayEquals(localDayFromDate(date), localDayFromDate(now))) return ClockWords.short(date);
    return `${ClockWords.short(date)} ${WEEKDAYS[arizonaParts(date).weekday]}`;
  },
  /** "47°", "−14°" (with U+2212 minus), rounded halves up; never "−0°". */
  degrees(f: number): string {
    const whole = Feels.whole(f);
    return `${whole < 0 ? "\u2212" : ""}${Math.abs(whole)}°`;
  },
  /** "26 min old", "2 hr old", "2 hr 5 min old": the minutes part only when it's 5 or more. */
  ageOld(from: Date, now: Date): string {
    const minutes = Feels.whole((now.getTime() - from.getTime()) / 60_000);
    if (minutes < 60) return `${minutes} min old`;
    const rest = minutes % 60;
    return `${Math.trunc(minutes / 60)} hr${rest >= 5 ? ` ${rest} min` : ""} old`;
  },
};
