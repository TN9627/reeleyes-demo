// Real road drive times from OSRM's public demo server (https://project-osrm.org/, routes on OpenStreetMap
// data, ODbL). One table request per start covers every Spot; the answer is cached per start (rounded to
// 4 decimals) in memory and localStorage for 7 days. The demo server is a courtesy that can be withdrawn
// at any time: when it fails, callers fall back to the distance estimate.
//
// API:
//   cachedRoutes(start): RoadMinutes | null        memory or localStorage hit, no request
//   fetchRoutes(start): Promise<RoadMinutes>       cached answer, else one table request (8 s limit); throws on failure

import type { RoadMinutes } from "../logic/driveTimes";
import { spotCoordinate, type Coordinate } from "./types";
import { spotSummaries } from "./repository";

export const OSRM_URL = "https://router.project-osrm.org/table/v1/driving/";
export const OSRM_HOME = "http://project-osrm.org";
export const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";

const TIMEOUT_MS = 8000;
const FRESH_MS = 7 * 24 * 60 * 60 * 1000;
/** After a failure the same start isn't asked again for this long, so browsing doesn't hammer a down server. */
const FAILURE_MS = 2 * 60 * 1000;
const STORAGE_KEY = "reeleyes.osrm.v1";

interface Entry {
  savedAt: number;
  minutes: RoadMinutes;
}

const memory = new Map<string, Entry>();
const inFlight = new Map<string, Promise<RoadMinutes>>();
const failedAt = new Map<string, number>();

/** The start rounded to 4 decimals (about 10 m): the cache key and the coordinate sent. */
function rounded(c: Coordinate): Coordinate {
  return { lat: Math.round(c.lat * 1e4) / 1e4, lng: Math.round(c.lng * 1e4) / 1e4 };
}
const keyOf = (c: Coordinate) => `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`;

function readStore(): Record<string, Entry> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, Entry>;
  } catch {
    return {};
  }
}

function writeStore(key: string, entry: Entry) {
  const now = Date.now();
  const store = Object.fromEntries(Object.entries(readStore()).filter(([, e]) => now - e.savedAt < FRESH_MS));
  store[key] = entry;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage full or blocked: the in-memory copy still serves this session.
  }
}

export function cachedRoutes(start: Coordinate): RoadMinutes | null {
  const key = keyOf(rounded(start));
  let entry = memory.get(key) ?? readStore()[key];
  if (!entry || typeof entry.savedAt !== "number" || Date.now() - entry.savedAt >= FRESH_MS) return null;
  memory.set(key, entry);
  return entry.minutes;
}

/** Whether a request for this start failed moments ago (so the estimate stands in without asking again). */
export function recentlyFailed(start: Coordinate): boolean {
  return Date.now() - (failedAt.get(keyOf(rounded(start))) ?? 0) < FAILURE_MS;
}

async function download(start: Coordinate): Promise<RoadMinutes> {
  const spots = spotSummaries();
  const points = [start, ...spots.map((s) => spotCoordinate(s))];
  const path = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const res = await fetch(`${OSRM_URL}${path}?sources=0&annotations=duration`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`OSRM answered ${res.status}`);
  const body = (await res.json()) as { code?: string; durations?: (number | null)[][] };
  const row = body.durations?.[0];
  if (body.code !== "Ok" || !row || row.length !== points.length) throw new Error("OSRM answered with an unexpected shape");
  // Index 0 is the start itself; null is an unroutable Spot.
  return Object.fromEntries(spots.map((s, i) => [s.id, row[i + 1] === null ? null : Math.round(row[i + 1]! / 60)]));
}

export function fetchRoutes(start: Coordinate): Promise<RoadMinutes> {
  const from = rounded(start);
  const key = keyOf(from);
  const cached = cachedRoutes(from);
  if (cached) return Promise.resolve(cached);
  if (recentlyFailed(from)) return Promise.reject(new Error("OSRM failed moments ago"));
  let pending = inFlight.get(key);
  if (!pending) {
    pending = download(from)
      .then((minutes) => {
        const entry = { savedAt: Date.now(), minutes };
        memory.set(key, entry);
        writeStore(key, entry);
        return minutes;
      })
      .catch((error: unknown) => {
        failedAt.set(key, Date.now());
        throw error;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}
