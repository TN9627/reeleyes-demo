// PrepModel's sample-data loading and Prep's TimelineView clock, shared by Prep and the Verdict screen.

import { useEffect, useState } from "react";
import { conditions as fixtureConditions } from "../../data/repository";
import type { Conditions } from "../../data/types";
import type { Loaded } from "../../logic/freshness";

export function loadConditions(spotId: number): Loaded<Conditions> {
  const value = fixtureConditions(spotId);
  return value
    ? { kind: "live", value, fetchedAt: new Date() }
    : { kind: "unavailable", reason: { kind: "failed", message: "No conditions for this Spot." } };
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
