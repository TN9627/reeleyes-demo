// Port of PrepView.content: the verdict and the conditions behind it, then License, Rules, Gear and bait.

import { useState } from "react";
import type { Conditions, Prep, SpotDetail } from "../../data/types";
import { isForecast } from "../../data/types";
import { loadedValue, type Loaded } from "../../logic/freshness";
import { localDayFromDate } from "../../logic/localDay";
import { Format } from "../../logic/spotFacts";
import { LicenseSheet } from "../license/LicenseSheet";
import { ConditionsGrid } from "./ConditionsGrid";
import { ConditionsHeader } from "./ConditionsHeader";
import { GearSection } from "./GearSection";
import { RulesSection } from "./RulesSection";
import { Card, Footnote, Row, SectionHeader } from "../../ui/Surfaces";
import { RulesLink } from "./parts";
import { Button, Spinner } from "../../ui/Controls";

const regulationsURL = "https://www.azgfd.com/fishing-2/";

interface Props {
  spot: SpotDetail | null;
  prep: Prep | null;
  conditions: Loaded<Conditions> | null;
  now: Date;
  isRefreshing: boolean;
  isOnline: boolean;
  refreshConditions: () => void;
  isReloadingPrep: boolean;
  reloadPrep: () => void;
}

export function PrepContent(props: Props) {
  const { spot, prep, conditions, now } = props;
  const [showsLicense, setShowsLicense] = useState(false);
  return (
    <div className="prep-content">
      {conditions && (
        <ConditionsHeader
          loaded={conditions}
          now={now}
          isRefreshing={props.isRefreshing}
          isOnline={props.isOnline}
          refresh={props.refreshConditions}
        />
      )}
      <ConditionsSection {...props} />
      <section>
        <SectionHeader title="License" />
        <Card>
          <Row onClick={() => setShowsLicense(true)} chevron>
            <span className="prep-row-text">
              <span className="prep-body">General Fishing covers this Spot</span>
              <span className="prep-sub">One license for all of Arizona · from $37</span>
            </span>
          </Row>
        </Card>
      </section>
      {prep ? (
        <>
          <RulesSection prep={prep} />
          <GearSection
            gear={prep.gear}
            spotID={prep.spotId}
            spotName={spot?.summary.name ?? null}
            stocking={spot?.stocking ?? []}
            today={localDayFromDate(now)}
          />
        </>
      ) : (
        // Rules and gear failed to load: say so, keep the way to the limits, offer a retry.
        <section>
          <SectionHeader title="Rules and gear" />
          <Card>
            <div className="prep-failed">
              <p className="prep-body">Couldn't load rules and gear</p>
              <p className="prep-sub">Try again in a moment. Until then, check limits on azgfd.com before you go.</p>
              <RulesLink href={regulationsURL} />
              <TryAgain isLoading={props.isReloadingPrep} onClick={props.reloadPrep} />
            </div>
          </Card>
        </section>
      )}
      <LicenseSheet open={showsLicense} onClose={() => setShowsLicense(false)} />
    </div>
  );
}

function ConditionsSection({ spot, conditions, now, isRefreshing, refreshConditions }: Props) {
  const value = conditions ? loadedValue(conditions) : null;
  return (
    <section>
      <SectionHeader title="Conditions" trailing={Format.weekdayMonthDay(now)} />
      {conditions === null ? (
        <div className="prep-loading" role="progressbar" aria-label="Loading conditions">
          <Spinner />
        </div>
      ) : conditions.kind === "unavailable" ? (
        <Card>
          <div className="prep-failed">
            <p className="prep-body prep-secondary">
              {conditions.reason.kind === "offline"
                ? "You're offline and this Spot's conditions aren't saved."
                : "Couldn't load conditions."}
            </p>
            {conditions.reason.kind !== "offline" && <TryAgain isLoading={isRefreshing} onClick={refreshConditions} />}
          </div>
        </Card>
      ) : (
        value &&
        spot && (
          <>
            <ConditionsGrid
              conditions={value}
              spot={spot.summary}
              now={now}
              savedAt={conditions.kind === "cached" && conditions.reason.kind === "offline" ? conditions.savedAt : null}
            />
            {/* MET Norway's licence (CC BY 4.0) asks for credit wherever its data shows. */}
            <Footnote>
              {value.pressure && isForecast(value.pressure)
                ? "Pressure forecast from MET Norway (CC BY 4.0); readings show their own source and age."
                : "Readings show their own source and age."}
            </Footnote>
          </>
        )
      )}
    </section>
  );
}

/** The design system's "Try again" (a secondary button); a spinner replaces the label while it runs. */
function TryAgain({ isLoading, onClick }: { isLoading: boolean; onClick: () => void }) {
  return (
    <Button variant="secondary" className="prep-try-again" loading={isLoading} onClick={onClick} ariaLabel={isLoading ? "Trying again" : "Try again"}>
      Try again
    </Button>
  );
}
