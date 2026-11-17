// Port of Logic/HeroPages.swift: what the Spot hero shows, its photos or the map alone.

import type { Photo } from "../data/types";

export type HeroMode = "photos" | "mapOnly";
/** "hidden": one photo; "dots": 2 to 5; "counter": "1 / 9" for 6 or more. */
export type HeroIndicator = "hidden" | "dots" | "counter";

export const mostDots = 5;

export interface HeroPages {
  spotName: string;
  /** Each photo that hasn't failed to load, in the Spot's order. */
  photos: Photo[];
  mode: HeroMode;
  indicator: HeroIndicator;
}

export function heroPages(spotName: string, photos: Photo[], failed: ReadonlySet<string>): HeroPages {
  const kept = photos.filter((p) => !failed.has(p.key));
  const indicator: HeroIndicator = kept.length <= 1 ? "hidden" : kept.length <= mostDots ? "dots" : "counter";
  return { spotName, photos: kept, mode: kept.length === 0 ? "mapOnly" : "photos", indicator };
}

/** The photo's index; null once it has left the pager. */
export function heroIndexOf(pages: HeroPages, key: string): number | null {
  const i = pages.photos.findIndex((p) => p.key === key);
  return i < 0 ? null : i;
}

/** "3 / 9". */
export function heroCounter(pages: HeroPages, index: number): string {
  return `${index + 1} / ${pages.photos.length}`;
}

/** Screen-reader text: "Photo 2 of 4. Saguaro Lake at dawn. By Nicholas Hartmann." */
export function heroSpoken(pages: HeroPages, index: number): string {
  const photo = pages.photos[index]!;
  const caption = photo.title === "" ? `Photo of ${pages.spotName}` : photo.title;
  const credit = photo.author === "" ? "" : ` By ${photo.author}.`;
  return `Photo ${index + 1} of ${pages.photos.length}. ${caption}.${credit}`;
}
