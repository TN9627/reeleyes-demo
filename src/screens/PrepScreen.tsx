// Port of Views/PrepView.swift (and PrepModel): the verdict and the conditions behind it,
// then License, Rules, Gear and bait. Sample data: refreshing re-reads the same fixtures.

import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import { conditions as fixtureConditions, prep as fixturePrep, spotDetail } from "../data/repository";
import type { Conditions } from "../data/types";
import type { Loaded } from "../logic/freshness";
import { useOnline } from "../state/appState";
import { Screen } from "../ui/Screen";
import { PrepContent } from "./prep/PrepContent";
import { PullToRefresh } from "./prep/PullToRefresh";
import "./prep/prep.css";

/** How long a refresh shows its spinner; the sample data answers at once. */
const refreshMs = 700;

function loadConditions(spotId: number): Loaded<Conditions> {
  const value = fixtureConditions(spotId);
  return value
    ? { kind: "live", value, fetchedAt: new Date() }
    : { kind: "unavailable", reason: { kind: "failed", message: "No conditions for this Spot." } };
}

/** The clock Prep reads, ticking each minute like its TimelineView. */
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function PrepScreen() {
  const spotId = Number(useParams().id);
  const isOnline = useOnline();
  const now = useMinuteClock();
  const spot = spotDetail(spotId) ?? null;
  const [prep, setPrep] = useState(() => fixturePrep(spotId) ?? null);
  const [conditions, setConditions] = useState(() => loadConditions(spotId));
  const [isRefreshing, setRefreshing] = useState(false);
  const [isReloadingPrep, setReloadingPrep] = useState(false);

  const refreshConditions = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setConditions(loadConditions(spotId));
      setRefreshing(false);
    }, refreshMs);
  }, [spotId]);

  const reloadPrep = useCallback(() => {
    setReloadingPrep(true);
    setTimeout(() => {
      setPrep(fixturePrep(spotId) ?? null);
      setReloadingPrep(false);
    }, refreshMs);
  }, [spotId]);

  const refresh = () => {
    refreshConditions();
    if (!prep) reloadPrep();
  };

  return (
    <Screen title="Prep" titleDisplay="inline" subtitle={spot?.summary.name ?? ""}>
      <PullToRefresh refreshing={isRefreshing} onRefresh={refresh}>
        <PrepContent
          spot={spot}
          prep={prep}
          conditions={conditions}
          now={now}
          isRefreshing={isRefreshing}
          isOnline={isOnline}
          refreshConditions={refreshConditions}
          isReloadingPrep={isReloadingPrep}
          reloadPrep={reloadPrep}
        />
      </PullToRefresh>
    </Screen>
  );
}
