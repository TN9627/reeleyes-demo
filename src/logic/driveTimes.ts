// Port of Logic/DriveTimes.swift. The MapKit fetcher (DriveTimeFetcher) has no
// web counterpart: sample drive times come synchronously from
// data/repository.ts (`driveTimesFor`). The value type and the cache are here.

import type { Coordinate } from "../data/types";
import { roundedKey } from "./geo";

/** A candidate's drive time from the current start. */
export type DriveTime = { kind: "minutes"; minutes: number } | { kind: "noRoute" };

export const minutes = (m: number): DriveTime => ({ kind: "minutes", minutes: m });
export const noRoute: DriveTime = { kind: "noRoute" };

/**
 * Rule of thumb for any start that is not a sample place: straight-line miles x 1.3 for the road,
 * at 45 mph, rounded to the minute. The one place these numbers live.
 */
export const ROAD_FACTOR = 1.3;
export const AVERAGE_MPH = 45;

/** Estimated drive minutes for a straight-line distance (ROAD_FACTOR, AVERAGE_MPH). */
export const estimateMinutes = (straightLineMiles: number): number => Math.round(((straightLineMiles * ROAD_FACTOR) / AVERAGE_MPH) * 60);

export interface DriveTimeEntry {
  time: DriveTime;
  at: Date;
}

/** Drive times kept for 30 minutes, keyed on the start rounded to two decimals and the Spot. */
export interface DriveTimeCache {
  entries: Record<string, DriveTimeEntry>;
}

export const driveTimeFreshFor = 30 * 60 * 1000;

export const emptyDriveTimeCache = (): DriveTimeCache => ({ entries: {} });

export function driveTimeKey(start: Coordinate, spotID: number): string {
  return `${roundedKey(start)}|${spotID}`;
}

/** A drive time no older than 30 minutes (any age when `allowStale`). */
export function cachedDriveTime(
  cache: DriveTimeCache,
  start: Coordinate,
  spotID: number,
  now: Date,
  allowStale = false,
): DriveTime | null {
  const entry = cache.entries[driveTimeKey(start, spotID)];
  if (!entry) return null;
  return allowStale || now.getTime() - entry.at.getTime() <= driveTimeFreshFor ? entry.time : null;
}

/** Returns a new cache with the time recorded. */
export function recordDriveTime(
  cache: DriveTimeCache,
  time: DriveTime,
  start: Coordinate,
  spotID: number,
  at: Date,
): DriveTimeCache {
  return { entries: { ...cache.entries, [driveTimeKey(start, spotID)]: { time, at } } };
}

/** Drops entries older than a day. */
export function pruneDriveTimes(cache: DriveTimeCache, now: Date): DriveTimeCache {
  const entries: Record<string, DriveTimeEntry> = {};
  for (const [k, v] of Object.entries(cache.entries)) {
    if (now.getTime() - v.at.getTime() < 24 * 60 * 60 * 1000) entries[k] = v;
  }
  return { entries };
}
