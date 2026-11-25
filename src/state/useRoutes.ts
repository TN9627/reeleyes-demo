// The road drive times from a start (data/osrm.ts) for React: one request per start, shared by Today,
// Saved and the Spot screen through the cache.
//
//   const { loading, routes } = useRoutes(start?.coordinate ?? null)
//   loading: the request is out; routes: minutes per Spot id, or null when there is no start or the request
//   failed (callers then estimate from distance).

import { useEffect, useState } from "react";
import { cachedRoutes, fetchRoutes, recentlyFailed } from "../data/osrm";
import type { Coordinate } from "../data/types";
import type { RoadMinutes } from "../logic/driveTimes";

export interface RoutesState {
  loading: boolean;
  routes: RoadMinutes | null;
}

export function useRoutes(start: Coordinate | null): RoutesState {
  const key = start ? `${start.lat.toFixed(4)},${start.lng.toFixed(4)}` : null;
  const [settled, setSettled] = useState<{ key: string; routes: RoadMinutes | null } | null>(null);

  useEffect(() => {
    if (!start || key === null || cachedRoutes(start) || recentlyFailed(start)) return;
    let live = true;
    fetchRoutes(start).then(
      (routes) => live && setSettled({ key, routes }),
      () => live && setSettled({ key, routes: null }),
    );
    return () => {
      live = false;
    };
    // The start's rounded key is what identifies the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!start || key === null) return { loading: false, routes: null };
  const cached = cachedRoutes(start);
  if (cached) return { loading: false, routes: cached };
  if (recentlyFailed(start) || settled?.key === key) return { loading: false, routes: null };
  return { loading: true, routes: null };
}
