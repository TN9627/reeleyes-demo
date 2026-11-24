// Port of Views/VerdictViews.swift's VerdictView and VerdictModel: what the verdict is based on, from the conditions
// and Spot Prep just showed (live weather from Open-Meteo, served from its 30-minute cache).

import { useParams } from "react-router";
import { spotDetail } from "../data/repository";
import { loadedValue } from "../logic/freshness";
import { conditionsReading } from "../logic/conditionsReading";
import { Card } from "../ui/Surfaces";
import { Screen } from "../ui/Screen";
import { useConditions, useMinuteClock } from "./prep/prepModel";
import { VerdictDetails } from "./verdict/VerdictDetails";
import "./verdict/verdict.css";

export default function VerdictScreen() {
  const spotId = Number(useParams().id);
  const now = useMinuteClock();
  const detail = spotDetail(spotId) ?? null;
  const load = useConditions(spotId);
  const loaded = load?.loaded ?? null;
  const conditions = loaded ? loadedValue(loaded) : null;
  return (
    <Screen title="Verdict" titleDisplay="inline" subtitle={detail?.summary.name ?? ""}>
      <div className="verdict-content">
        {loaded && conditions && detail ? (
          <VerdictDetails reading={conditionsReading(loaded, conditions, detail.summary, now)} weatherLive={load?.weatherLive ?? false} species={detail.species} />
        ) : load === null ? (
          <Card>
            <p className="t-body c-ink-secondary verdict-failed" role="status">Loading the conditions behind the verdict…</p>
          </Card>
        ) : (
          <Card>
            <p className="t-body c-ink-secondary verdict-failed">Couldn't load the conditions behind the verdict.</p>
          </Card>
        )}
      </div>
    </Screen>
  );
}
