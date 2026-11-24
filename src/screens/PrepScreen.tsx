// Port of Views/PrepView.swift (and PrepModel): the day picker, NWS alerts and the heat or cold notice, the Today
// hero, the Details behind it, then License, Rules, Gear and bait. Weather is live from Open-Meteo; refreshing asks it again.

import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import { prep as fixturePrep, spotDetail } from "../data/repository";
import { useOnline } from "../state/appState";
import { useNav } from "../ui/navigation";
import { Screen } from "../ui/Screen";
import { PrepContent } from "./prep/PrepContent";
import { loadConditions, useConditions, useMinuteClock, type ConditionsLoad } from "./prep/prepModel";
import { prepRulesRequest } from "./prep/prepRules";
import { PullToRefresh } from "./prep/PullToRefresh";
import "./prep/prep.css";

/** How long reloading Prep's rules shows its spinner; the sample data answers at once. */
const refreshMs = 700;

/** After the species sheet has gone and Rules has laid out its rows. */
function scrollToRules() {
  setTimeout(() => document.getElementById("prep-rules")?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
}

export default function PrepScreen() {
  const spotId = Number(useParams().id);
  const nav = useNav();
  const isOnline = useOnline();
  const now = useMinuteClock();
  const spot = spotDetail(spotId) ?? null;
  const [prep, setPrep] = useState(() => fixturePrep(spotId) ?? null);
  const loadedConditions = useConditions(spotId);
  const [refreshed, setRefreshed] = useState<{ spotId: number; load: ConditionsLoad } | null>(null);
  const load = refreshed?.spotId === spotId ? refreshed.load : loadedConditions;
  const [isRefreshing, setRefreshing] = useState(false);
  const [isReloadingPrep, setReloadingPrep] = useState(false);
  // Opened from the Spot's species sheet (app.prepRulesSpotID): Rules starts open.
  const [rulesOpen, setRulesOpen] = useState(() => prepRulesRequest.spotID === spotId);
  const [openedGearID, setOpenedGearID] = useState<number | null>(null);

  const refreshConditions = useCallback(() => {
    setRefreshing(true);
    void loadConditions(spotId, true).then((result) => {
      setRefreshed({ spotId, load: result });
      setRefreshing(false);
    });
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

  /** Shows Rules opened: the species sheet's rule line. */
  const showRules = useCallback(() => {
    setRulesOpen(true);
    scrollToRules();
  }, []);

  useEffect(() => {
    if (prepRulesRequest.spotID !== spotId) return;
    prepRulesRequest.spotID = null;
    scrollToRules();
  }, [spotId]);

  return (
    <Screen title="Prep" titleDisplay="inline" subtitle={spot?.summary.name ?? ""}>
      <PullToRefresh refreshing={isRefreshing} onRefresh={refresh}>
        <PrepContent
          spot={spot}
          prep={prep}
          conditions={load?.loaded ?? null}
          weatherLive={load?.weatherLive ?? true}
          now={now}
          isRefreshing={isRefreshing}
          isOnline={isOnline}
          refreshConditions={refreshConditions}
          isReloadingPrep={isReloadingPrep}
          reloadPrep={reloadPrep}
          rulesOpen={rulesOpen}
          setRulesOpen={setRulesOpen}
          showRules={showRules}
          openedGearID={openedGearID}
          setOpenedGearID={setOpenedGearID}
          openVerdict={() => nav.push(`/spot/${spotId}/prep/verdict`)}
        />
      </PullToRefresh>
    </Screen>
  );
}
