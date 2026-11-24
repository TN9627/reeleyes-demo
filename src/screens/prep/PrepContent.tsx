// Port of PrepView.content and its private views (ConditionsHeader, PrepConditions, ConditionsSkeleton): the day
// picker, NWS alerts and the heat or cold notice, the Today hero, the Details behind it, then License, Rules, Gear and
// bait. The day picker, hour slots and 24-hour bar share one selected day and time.

import { useMemo, useState, type ReactNode } from "react";
import type { Conditions, NWSAlert, Prep, SpotDetail } from "../../data/types";
import { conditionsBanner, loadedValue, type Loaded } from "../../logic/freshness";
import { alertsChecked, conditionsReading, type ConditionsReading } from "../../logic/conditionsReading";
import { prepForecast, type PrepForecast } from "../../logic/prepDays";
import {
  HourSlots,
  hourCells,
  openingSelection,
  selectionDate,
  selectionMinutes,
  selectionNow,
  slotSelection,
  type DaySelection,
  type HourSlot,
} from "../../logic/prepSelection";
import { todayHero } from "../../logic/todayHero";
import { localDayFromDate } from "../../logic/localDay";
import { Format } from "../../logic/spotFacts";
import { LicenseSheet } from "../license/LicenseSheet";
import { DetailsSection } from "./details/DetailsCards";
import { AlertBanner, AlertSheet } from "./safety/AlertViews";
import { ColdSignsSheet, HeatSignsSheet, SafetyNotice } from "./safety/WeatherSafety";
import { GearSection } from "./GearSection";
import { RulesSection } from "./RulesSection";
import { DayPicker, TodayHeroCard } from "./TodayHero";
import { FALLBACK_NOTE } from "../../data/openMeteo";
import { NoteLine, OpenMeteoCredit, RulesLink } from "./parts";
import { Banner, Card, SectionHeader } from "../../ui/Surfaces";
import { Button } from "../../ui/Controls";
import { Glyph } from "../../ui/Glyph";

const regulationsURL = "https://www.azgfd.com/fishing-2/";

type ConditionsSheet = "heatSigns" | "coldSigns";

interface Props {
  spot: SpotDetail | null;
  prep: Prep | null;
  conditions: Loaded<Conditions> | null;
  /** The weather is Open-Meteo's; false when the sample weather stands in. */
  weatherLive: boolean;
  now: Date;
  isRefreshing: boolean;
  isOnline: boolean;
  refreshConditions: () => void;
  isReloadingPrep: boolean;
  reloadPrep: () => void;
  rulesOpen: boolean;
  setRulesOpen: (open: boolean) => void;
  /** The species sheet's rule line: close it, open Rules and scroll to it. */
  showRules: () => void;
  openedGearID: number | null;
  setOpenedGearID: (id: number | null) => void;
  openVerdict: () => void;
}

export function PrepContent(props: Props) {
  const { spot, prep, conditions, now } = props;
  const [showsLicense, setShowsLicense] = useState(false);
  const [openedAlert, setOpenedAlert] = useState<NWSAlert | null>(null);
  const [conditionsSheet, setConditionsSheet] = useState<ConditionsSheet | null>(null);

  const value = conditions ? loadedValue(conditions) : null;
  const reading = useMemo(
    () => (conditions && value && spot ? conditionsReading(conditions, value, spot.summary, now) : null),
    [conditions, value, spot, now],
  );
  const header = conditions && (
    <ConditionsHeader
      loaded={conditions}
      reading={reading}
      weatherLive={props.weatherLive}
      now={now}
      isRefreshing={props.isRefreshing}
      isOnline={props.isOnline}
      refresh={props.refreshConditions}
      openAlert={setOpenedAlert}
      openSheet={setConditionsSheet}
    />
  );

  return (
    <div className="prep-content">
      {reading ? (
        <PrepConditions reading={reading} openVerdict={props.openVerdict} header={header} weatherLive={props.weatherLive} />
      ) : (
        <>
          {header ?? <SkeletonHeader />}
          <DetailsFallback {...props} />
        </>
      )}
      <section>
        <SectionHeader title="License" />
        <Card>
          <button type="button" className="prep-license-row" onClick={() => setShowsLicense(true)}>
            <span className="prep-license-tile" aria-hidden="true">
              <Glyph name="license" size={22} weight={2} />
            </span>
            <span className="prep-row-text">
              <span className="t-headline c-ink">General Fishing covers this Spot</span>
              <span className="t-subheadline c-ink-secondary">One license for all of Arizona · from $37</span>
            </span>
            <Glyph name="disclosure" className="prep-license-chevron" size="0.8rem" weight={2.6} />
          </button>
        </Card>
      </section>
      {prep ? (
        <>
          <RulesSection prep={prep} open={props.rulesOpen} setOpen={props.setRulesOpen} />
          <GearSection
            gear={prep.gear}
            spotID={prep.spotId}
            spotName={spot?.summary.name ?? null}
            stocking={spot?.stocking ?? []}
            today={localDayFromDate(now)}
            selectedID={props.openedGearID}
            onSelectedIDChange={props.setOpenedGearID}
            openRules={props.showRules}
          />
        </>
      ) : (
        // Rules and gear failed to load: say so, keep the way to the limits, offer a retry.
        <section>
          <SectionHeader title="Rules and gear" />
          <Card>
            <div className="prep-failed">
              <p className="t-body c-ink">Couldn't load rules and gear</p>
              <p className="t-subheadline c-ink-secondary">Try again in a moment. Until then, check limits on azgfd.com before you go.</p>
              <RulesLink href={regulationsURL} />
              <TryAgain isLoading={props.isReloadingPrep} onClick={props.reloadPrep} />
            </div>
          </Card>
        </section>
      )}
      <LicenseSheet open={showsLicense} onClose={() => setShowsLicense(false)} />
      {spot && openedAlert && (
        <AlertSheet
          open
          onClose={() => setOpenedAlert(null)}
          alert={openedAlert}
          spot={spot.summary}
          now={now}
          savedAt={reading?.savedAt ?? null}
          checkedAt={value?.alerts?.checkedAt ?? null}
        />
      )}
      <HeatSignsSheet open={conditionsSheet === "heatSigns"} onClose={() => setConditionsSheet(null)} />
      <ColdSignsSheet open={conditionsSheet === "coldSigns"} onClose={() => setConditionsSheet(null)} />
    </div>
  );
}

/** Prep's header: the freshness banner, then NWS alerts, the heat and cold notices. */
function ConditionsHeader({ loaded, reading, weatherLive, now, isRefreshing, isOnline, refresh, openAlert, openSheet }: {
  loaded: Loaded<Conditions>;
  /** Null until the Spot is loaded too (its place and class feed the hero and the rating). */
  reading: ConditionsReading | null;
  weatherLive: boolean;
  now: Date;
  isRefreshing: boolean;
  isOnline: boolean;
  refresh: () => void;
  openAlert: (alert: NWSAlert) => void;
  openSheet: (sheet: ConditionsSheet) => void;
}) {
  const banner = conditionsBanner(loaded, now);
  const value = loadedValue(loaded);
  // When the readings were taken: the weather's time, else when the server last fetched.
  const readingTime = value ? (value.weather?.observedAt ?? value.fetchedAt ?? null) : null;
  const refreshButton = (
    <button type="button" className="prep-banner-action" onClick={refresh} disabled={isRefreshing || !isOnline}>
      {isRefreshing ? "Refreshing…" : "Refresh"}
    </button>
  );
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
          message="Pressure and wind may have changed, so there's no rating."
          action={refreshButton}
        />
      )}
      {banner.kind === "couldNotRefresh" && (
        <Banner glyph="refreshFailed" title="Couldn't refresh." message="Showing the last readings with their age." action={refreshButton} />
      )}
      {!weatherLive && value && (
        <NoteLine glyph="offline" className="prep-header-note">
          {FALLBACK_NOTE}
        </NoteLine>
      )}
      {reading && (
        <>
          {reading.active.map((alert) => (
            <AlertBanner key={alert.id} alert={alert} now={now} checked={alertsChecked(reading)} open={() => openAlert(alert)} />
          ))}
          {reading.heatLine && (
            <div id="prep-heat">
              <SafetyNotice kind="heat" line={reading.heatLine} showSigns={() => openSheet("heatSigns")} />
            </div>
          )}
          {reading.coldLine && (
            <div id="prep-cold">
              <SafetyNotice kind="cold" line={reading.coldLine} showSigns={() => openSheet("coldSigns")} />
            </div>
          )}
          {/* The window card carried this note; with the card off Prep, it sits over the hero. */}
          {reading.alertsNote.kind === "checkFailed" && (
            <NoteLine glyph="weatherAlert" className="prep-header-note">
              Couldn't check NWS alerts, so a heat, cold, storm or wind alert wouldn't show here.
            </NoteLine>
          )}
          {reading.alertsNote.kind === "offlineNoneActive" && (
            <NoteLine glyph="offline" className="prep-header-note">
              {`Can't check NWS alerts offline. None were active at ${Format.time(reading.alertsNote.savedAt)}.`}
            </NoteLine>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The day picker, `header` (banners and alerts), the Today hero and the Details, around the one selected day and
 * time. The five days' ratings (`forecast`) are worked out once per reading.
 */
function PrepConditions({ reading, openVerdict, header, weatherLive }: { reading: ConditionsReading; openVerdict: () => void; header: ReactNode; weatherLive: boolean }) {
  const forecast: PrepForecast = useMemo(() => prepForecast(reading), [reading]);
  const [selection, setSelection] = useState<DaySelection>(selectionNow);
  /** The 24-hour bar is being dragged: the hour row follows without animating. */
  const [dragging, setDragging] = useState(false);
  const now = reading.now;
  const day = forecast.days[Math.min(Math.max(selection.dayOffset, 0), forecast.days.length - 1)]!;
  const isNow = day.isToday && selection.minute === null;
  const date = selectionDate(selection, day, now);
  const cells = hourCells(day, forecast, day.isToday ? now : null, reading.conditions.weather);
  const backToNow = () => {
    setDragging(false);
    setSelection(selectionNow);
  };
  return (
    <>
      <DayPicker
        days={forecast.days}
        selectedOffset={day.offset}
        select={(picked) => {
          setDragging(false);
          setSelection(openingSelection(picked));
        }}
      />
      {header}
      <TodayHeroCard
        day={day}
        hero={todayHero(reading, forecast, day, date, isNow)}
        cells={cells}
        selectedSlotID={HourSlots.selectedID(cells.map((c) => c.slot), selection, selectionMinutes(selection, day, now))}
        isNow={isNow}
        animatesScroll={!dragging}
        select={(slot: HourSlot) => {
          setDragging(false);
          setSelection(slotSelection(slot, day.offset));
        }}
        backToNow={backToNow}
        open={day.isToday ? openVerdict : null}
      />
      {weatherLive && <OpenMeteoCredit className="prep-credit" />}
      <div id="prep-conditions" className="prep-anchor">
        <SectionHeader title="Details" />
      </div>
      <DetailsSection
        conditions={reading.conditions}
        spot={reading.spot}
        forecast={forecast}
        day={day}
        date={date}
        isNow={isNow}
        now={now}
        savedAt={reading.savedAt}
        selectMinute={(minute: number, isDragging: boolean) => {
          setDragging(isDragging);
          setSelection({ dayOffset: day.offset, minute });
        }}
        dragEnded={() => setDragging(false)}
        backToNow={backToNow}
      />
    </>
  );
}

/** Details before the Spot or conditions are in: placeholders while loading, else why there are none. */
function DetailsFallback({ conditions, isRefreshing, refreshConditions }: Props) {
  if (conditions === null) {
    return (
      <div id="prep-conditions" className="prep-anchor">
        <SectionHeader title="Details" />
        <div className="prep-skeleton-tiles" aria-hidden="true">
          <SkeletonCard bars={[[120, 1]]} />
          <SkeletonCard bars={[[200, 1]]} />
        </div>
      </div>
    );
  }
  if (conditions.kind !== "unavailable") return null;
  return (
    <div id="prep-conditions" className="prep-anchor prep-details-failed">
      <Card>
        <div className="prep-failed">
          <p className="t-body c-ink-secondary">
            {conditions.reason.kind === "offline" ? "You're offline and this Spot's conditions aren't saved." : "Couldn't load conditions."}
          </p>
          {conditions.reason.kind !== "offline" && <TryAgain isLoading={isRefreshing} onClick={refreshConditions} />}
        </div>
      </Card>
    </div>
  );
}

/** Placeholder while Prep's conditions load: the hero. */
function SkeletonHeader() {
  return (
    <div className="prep-skeleton-header" role="status" aria-label="Loading conditions">
      <SkeletonCard bars={[[90, 1], [52, 0.6], [70, 1]]} />
    </div>
  );
}

function SkeletonCard({ bars }: { bars: [height: number, width: number][] }) {
  return (
    <div className="prep-skeleton-card">
      {bars.map(([height, width], i) => (
        <span key={i} className="prep-skeleton-bar" style={{ height, width: `${width * 100}%` }} />
      ))}
    </div>
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
