// Port of Logic/GearLayout.swift: how Prep's Gear and the Spot's Fish here order, trim and label species.

import type { Gear, GearMethod, StockingEvent } from "../data/types";
import { compareLocalDay, daysUntil, type LocalDay } from "./localDay";
import { isRecent } from "./spotFacts";

export interface GearEntry {
  gear: Gear;
  /** The latest stocking of this species within the recent window; null when none. */
  stockedOn: LocalDay | null;
  /** "today", "3 days ago", "1 wk ago"; null when not recently stocked. */
  stockedAge: string | null;
}

/** Species shown before "Show all". */
export const collapsedCount = 4;

/** Each species' latest stocking within the recent window, by species id. */
export function recentStocking(stocking: StockingEvent[], today: LocalDay): Map<number, LocalDay> {
  const latest = new Map<number, LocalDay>();
  for (const e of stocking) {
    if (!isRecent(e.stockedOn, today)) continue;
    const known = latest.get(e.speciesId);
    if (known && compareLocalDay(known, e.stockedOn) >= 0) continue;
    latest.set(e.speciesId, e.stockedOn);
  }
  return latest;
}

/** Species stocked recently first (most recent first), then name A to Z. */
export function ordered<Item>(
  items: Item[],
  speciesID: (item: Item) => number,
  name: (item: Item) => string,
  latest: Map<number, LocalDay>,
): Item[] {
  return [...items].sort((l, r) => {
    const a = latest.get(speciesID(l));
    const b = latest.get(speciesID(r));
    if (a && b && compareLocalDay(a, b) !== 0) return compareLocalDay(b, a);
    if (a && !b) return -1;
    if (!a && b) return 1;
    return name(l).localeCompare(name(r), undefined, { sensitivity: "accent" });
  });
}

/** "today", "yesterday", "3 days ago", "1 wk ago", "2 wk ago", read after "Stocked ". */
export function stockedAge(stockedOn: LocalDay, today: LocalDay): string {
  const days = daysUntil(stockedOn, today);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days <= 6) return `${days} days ago`;
  return `${Math.trunc(days / 7)} wk ago`;
}

/** Recently stocked species first (most recent first), then name A to Z. */
export function gearEntries(gear: Gear[], stocking: StockingEvent[], today: LocalDay): GearEntry[] {
  const latest = recentStocking(stocking, today);
  const entries = gear.map((g) => {
    const on = latest.get(g.speciesId) ?? null;
    return { gear: g, stockedOn: on, stockedAge: on ? stockedAge(on, today) : null };
  });
  return ordered(entries, (e) => e.gear.speciesId, (e) => e.gear.name, latest);
}

/** Whether there are enough species to offer "Show all". */
export function canToggle(count: number): boolean {
  return count > collapsedCount;
}

/** Every species up to 4; past that, the first 4 until expanded. */
export function visible<T>(items: T[], expanded: boolean): T[] {
  return canToggle(items.length) && !expanded ? items.slice(0, collapsedCount) : items;
}

/** Splits items into rows of `columns`; the last row may be short. */
export function rows<T>(items: T[], columns: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += columns) out.push(items.slice(i, i + columns));
  return out;
}

/** Which Spots' gear lists are expanded; any other Spot starts collapsed. Immutable. */
export type GearExpansion = ReadonlySet<number>;
export const emptyGearExpansion: GearExpansion = new Set();
export const isGearExpanded = (e: GearExpansion, spotID: number) => e.has(spotID);
export function toggleGearExpansion(e: GearExpansion, spotID: number): GearExpansion {
  const next = new Set(e);
  if (!next.delete(spotID)) next.add(spotID);
  return next;
}

// ---------- GearMethods ----------

/** One numbered row of a method's Steps: its actions, then the bite. */
export interface GearStep {
  /** 1-based. */
  number: number;
  count: number;
  text: string;
  isBite: boolean;
}

/** "Step 2 of 4: …", or "Step 4 of 4, when you get a bite: …" for the last. */
export function stepAccessibilityLabel(s: GearStep): string {
  return `Step ${s.number} of ${s.count}${s.isBite ? ", when you get a bite" : ""}: ${s.text}`;
}

/** The method a sheet opens on: the recommended one, else the first. */
export function defaultMethodID(methods: GearMethod[]): string | null {
  return (methods.find((m) => m.recommended) ?? methods[0])?.id ?? null;
}

/** The method with `id`, falling back to the default one. */
export function methodFor(methods: GearMethod[], id: string | null): GearMethod | null {
  const byId = methods.find((m) => m.id === id);
  if (byId) return byId;
  const def = defaultMethodID(methods);
  return methods.find((m) => m.id === def) ?? null;
}

/** The method's steps in order, with the bite as the last numbered step. */
export function methodSteps(method: GearMethod): GearStep[] {
  const texts = [...method.steps, method.bite];
  return texts.map((text, i) => ({ number: i + 1, count: texts.length, text, isBite: i === texts.length - 1 }));
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** "For bobber · 5 items". */
export function bringHeader(m: GearMethod): string {
  return `For ${m.name.toLowerCase()} · ${count(m.bring.length, "item")}`;
}

/** "4 steps": the actions and the bite. */
export function stepsHeader(m: GearMethod): string {
  return count(m.steps.length + 1, "step");
}

/** "Bobber, recommended. Float a worm…" or "Fly, needs a fly rod. Cast a floating bug…". */
export function methodRowLabel(m: GearMethod): string {
  const note = m.recommended ? ", recommended" : m.requirement ? `, ${m.requirement.toLowerCase()}` : "";
  return `${m.name}${note}. ${m.summary}`;
}

/** "Bobber. 5 items to bring, 4 steps." */
export function methodAnnouncement(m: GearMethod): string {
  return `${m.name}. ${count(m.bring.length, "item")} to bring, ${stepsHeader(m)}.`;
}
