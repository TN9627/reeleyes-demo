// Port of Logic/GearLayout.swift: how Prep's Gear and the Spot's Fish here order, trim and label species.

import { baitTagLabel, type Bait, type Gear, type GearMethod, type StockingEvent } from "../data/types";
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

/** "For bobber · 5 items": the hardware lines and the baits. */
export function bringHeader(m: GearMethod): string {
  return `For ${m.name.toLowerCase()} · ${count(bringCount(m), "item")}`;
}

/** Bring's rows: the hardware lines, then one row per bait. */
export function bringCount(m: GearMethod): number {
  return m.bring.length + m.baits.length;
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
  return `${m.name}. ${count(bringCount(m), "item")} to bring, ${stepsHeader(m)}.`;
}

// ---------- WhatTheyBite ----------
// The species sheet's "What they bite" row. The backend has already dropped what an
// artificial-only Spot bans, so nothing here filters by rule.

export const whatTheyBiteHint = "Tap a bait for why it works and how to hook it.";
export const artificialOnlyRuleLine = "Artificial flies and lures only here; bait isn't allowed.";

/** Where the artificial-only rule line goes: under the row in place of the hint, or alone where the row would be. */
export type RuleLine = "none" | "underRow" | "alone";

export function ruleLine(gear: Gear): RuleLine {
  if (!gear.artificialOnly) return "none";
  return gear.baits.length === 0 ? "alone" : "underRow";
}

/** "3 baits". */
export function whatTheyBiteHeader(gear: Gear): string {
  return count(gear.baits.length, "bait");
}

/** "Fish it with": the methods that use the bait, in method order. */
export function methodsForBait(bait: Bait, gear: Gear): GearMethod[] {
  return gear.methods.filter((m) => bait.methods.includes(m.id));
}

/** A method's baits in its own order, for its Bring rows. */
export function baitsOfMethod(method: GearMethod, gear: Gear): Bait[] {
  return method.baits.flatMap((id) => gear.baits.find((b) => b.id === id) ?? []);
}

/** The next open bait after tapping `tapped`: tapping the open one closes it. */
export function toggledBait(open: string | null, tapped: string): string | null {
  return open === tapped ? null : tapped;
}

/** A card's screen-reader label: "PowerBait, smells like food". */
export function baitCardLabel(bait: Bait): string {
  return `${bait.name}, ${baitTagLabel(bait.tag).toLowerCase()}`;
}

/** Spoken when the explanation opens or closes, as method selection is. */
export function baitAnnouncement(opened: Bait | null, closed: Bait | null): string | null {
  if (opened) return `${opened.name}. Why it works, how to hook it and what to fish it with, below the row.`;
  return closed ? `Closed ${closed.name}.` : null;
}
