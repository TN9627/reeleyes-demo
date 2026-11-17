// Port of PrepView.swift's ConditionsHeader: the banner, the verdict (or why it's hidden)
// and, when no banner speaks for them, the readings' age.

import type { Conditions } from "../../data/types";
import { conditionsBanner, loadedValue, showsVerdict, type Loaded } from "../../logic/freshness";
import { Format } from "../../logic/spotFacts";
import { Banner, Card } from "../../ui/Surfaces";

interface Props {
  loaded: Loaded<Conditions>;
  now: Date;
  isRefreshing: boolean;
  isOnline: boolean;
  refresh: () => void;
}

export function ConditionsHeader({ loaded, now, isRefreshing, isOnline, refresh }: Props) {
  const banner = conditionsBanner(loaded, now);
  const conditions = loadedValue(loaded);
  // When the readings were taken: the weather's time, else when the server last fetched.
  const readingTime = conditions ? (conditions.weather?.observedAt ?? conditions.fetchedAt ?? null) : null;
  const refreshButton = (
    <button type="button" className="prep-banner-action" onClick={refresh} disabled={isRefreshing || !isOnline}>
      {isRefreshing ? "Refreshing…" : "Refresh"}
    </button>
  );
  const verdict = conditions && showsVerdict(conditions, now) ? (conditions.verdict ?? null) : null;

  return (
    <div className="prep-conditions-header">
      {banner.kind === "offline" && (
        <Banner
          glyph="offline"
          title="You're offline."
          message={readingTime ? `Showing readings from ${Format.time(readingTime)}.` : "Showing the last saved readings."}
          action={
            <button type="button" className="prep-banner-action" disabled>
              Refresh
            </button>
          }
        />
      )}
      {banner.kind === "stale" && (
        <Banner
          glyph="stale"
          title={`These conditions are ${banner.hours} hours old.`}
          message="Pressure and wind may have changed, so there's no verdict."
          action={refreshButton}
        />
      )}
      {banner.kind === "couldNotRefresh" && (
        <Banner glyph="refreshFailed" title="Couldn't refresh." message="Showing the last readings with their age." action={refreshButton} />
      )}
      {conditions && verdict && (
        <Card padding={18} className="prep-verdict">
          <p className="prep-verdict-line">{verdict.line}</p>
          <p className="prep-sub">Our read uses air pressure and wind only. A rule of thumb, not a catch forecast.</p>
        </Card>
      )}
      {conditions && !verdict && conditions.pressure && banner.kind !== "stale" && (
        <p className="prep-sub prep-inset">No verdict today: the pressure reading is over 3 hours old.</p>
      )}
      {conditions && banner.kind === "none" && readingTime && (
        <p className="prep-stamp">
          <span className="prep-stamp-dot" aria-hidden="true" />
          {`Conditions updated ${Format.age(readingTime, now)}`}
        </p>
      )}
    </div>
  );
}
