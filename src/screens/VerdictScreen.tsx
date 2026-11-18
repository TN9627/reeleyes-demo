// Port of Views/VerdictViews.swift's VerdictView and VerdictModel: what the verdict is based on, from the conditions
// and Spot Prep just showed (sample data: the same fixtures, read again).

import { useState } from "react";
import { useParams } from "react-router";
import { spotDetail } from "../data/repository";
import { loadedValue } from "../logic/freshness";
import { conditionsReading } from "../logic/conditionsReading";
import { Card } from "../ui/Surfaces";
import { Screen } from "../ui/Screen";
import { loadConditions, useMinuteClock } from "./prep/prepModel";
import { VerdictDetails } from "./verdict/VerdictDetails";
import "./verdict/verdict.css";

export default function VerdictScreen() {
  const spotId = Number(useParams().id);
  const now = useMinuteClock();
  const detail = spotDetail(spotId) ?? null;
  const [loaded] = useState(() => loadConditions(spotId));
  const conditions = loadedValue(loaded);
  return (
    <Screen title="Verdict" titleDisplay="inline" subtitle={detail?.summary.name ?? ""}>
      <div className="verdict-content">
        {conditions && detail ? (
          <VerdictDetails reading={conditionsReading(loaded, conditions, detail.summary, now)} species={detail.species} />
        ) : (
          <Card>
            <p className="t-body c-ink-secondary verdict-failed">Couldn't load the conditions behind the verdict.</p>
          </Card>
        )}
      </div>
    </Screen>
  );
}
