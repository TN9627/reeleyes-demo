// Port of Data/Geo.swift.

import type { Coordinate } from "../data/types";

/** Straight-line (haversine) miles. */
export function miles(a: Coordinate, b: Coordinate): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}

/** The start rounded to two decimals (about half a mile), for cache keys. */
export function roundedKey(c: Coordinate): string {
  return `${c.lat.toFixed(2)},${c.lng.toFixed(2)}`;
}
