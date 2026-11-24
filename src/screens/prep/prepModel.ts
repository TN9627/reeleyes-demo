// PrepModel's conditions loading and Prep's TimelineView clock, shared by Prep and the Verdict screen.
// Weather is live from Open-Meteo (cached 30 minutes per Spot); water, lake level and flow are sample data.
// When Open-Meteo can't be reached the time-shifted sample conditions stand in and `weatherLive` is false.

import { useEffect, useState } from "react";
import { conditions as fixtureConditions, spotDetail } from "../../data/repository";
import { conditionsFromOpenMeteo, weatherFor } from "../../data/openMeteo";
import type { Conditions } from "../../data/types";
import type { Loaded } from "../../logic/freshness";

export interface ConditionsLoad {
  loaded: Loaded<Conditions>;
  /** The weather is Open-Meteo's; false when the sample weather stands in. */
  weatherLive: boolean;
}

/** `force` skips the 30-minute cache (Refresh and pull to refresh). */
export async function loadConditions(spotId: number, force = false): Promise<ConditionsLoad> {
  const sample = fixtureConditions(spotId);
  const spot = spotDetail(spotId)?.summary;
  if (!sample || !spot) {
    return { loaded: { kind: "unavailable", reason: { kind: "failed", message: "No conditions for this Spot." } }, weatherLive: false };
  }
  try {
    const { savedAt, response } = await weatherFor(spot.lat, spot.lng, force);
    const live = conditionsFromOpenMeteo(response, sample, new Date(), new Date(savedAt));
    if (live) return { loaded: { kind: "live", value: live, fetchedAt: new Date(savedAt) }, weatherLive: true };
  } catch {
    // Offline, blocked, a bad answer or the 8 s limit: the sample weather below.
  }
  return { loaded: { kind: "live", value: sample, fetchedAt: new Date() }, weatherLive: false };
}

/** The Spot's conditions once loaded; null while loading. */
export function useConditions(spotId: number): ConditionsLoad | null {
  const [loaded, setLoaded] = useState<{ spotId: number; load: ConditionsLoad } | null>(null);
  useEffect(() => {
    let current = true;
    void loadConditions(spotId).then((load) => {
      if (current) setLoaded({ spotId, load });
    });
    return () => {
      current = false;
    };
  }, [spotId]);
  return loaded?.spotId === spotId ? loaded.load : null;
}

/** The clock Prep reads, ticking each minute like its TimelineView. */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
