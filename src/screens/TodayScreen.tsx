// Port of Views/TodayView.swift and the sample-mode Today in App/TodayModel.swift:
// the Recommendation, grouped by drive time from the start.

import { useEffect, useMemo, useState } from "react";
import { recommendation } from "../data/repository";
import { formatDrive, formatRange } from "../logic/spotFacts";
import { activeToggleCount } from "../logic/todayLayout";
import { DriveRange, setFilters, setRange, useAppState, type SpotFilters } from "../state/appState";
import { Chip, ChipRow } from "../ui/Controls";
import { AppearanceMenu, PickerMenu } from "../ui/Menu";
import { BarButton, Screen, ToolbarGroup } from "../ui/Screen";
import { StartPrompt, StartSheet } from "./start";
import { FiltersSheet } from "./today/FiltersSheet";
import { PullToRefresh } from "./prep/PullToRefresh";
import { RecommendationList } from "./today/RecommendationList";
import { StartLine } from "./today/StartLine";
import "./today/today.css";

const rangeOptions = DriveRange.options.map((minutes) => ({ value: minutes, label: `Within ${formatRange(minutes)}` }));

/** The wall clock, ticking each minute (Swift's TimelineView(.periodic(by: 60))): "Open now" and stocking weeks follow it. */
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export default function TodayScreen() {
  const start = useAppState((s) => s.start);
  const rangeMinutes = useAppState((s) => s.rangeMinutes);
  const filters = useAppState((s) => s.filters);
  const showFarther = useAppState((s) => s.showFarther);
  const now = useMinuteClock();
  const [startSheetOpen, setStartSheetOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Swift's `.refreshable { await today.load() }`: pull down to read the Recommendation again.
  // The data is bundled, so the reload is a short spinner and a fresh read of the same sample.
  const [refreshing, setRefreshing] = useState(false);
  const [reloads, setReloads] = useState(0);
  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setTimeout(() => {
      setReloads((n) => n + 1);
      setRefreshing(false);
    }, 700);
  };

  const result = useMemo(
    () => (start ? recommendation({ start: start.coordinate, rangeMinutes, filters, showFarther, now }) : null),
    // `reloads` re-reads on pull to refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [start, rangeMinutes, filters, showFarther, now, reloads],
  );
  const toggles = activeToggleCount(filters);

  const toolbar = start && (
    <ToolbarGroup>
      <PickerMenu
        trigger={{ glyph: "drive", title: formatDrive(rangeMinutes), ariaLabel: `Drive time range, within ${formatRange(rangeMinutes)}` }}
        options={rangeOptions}
        value={rangeMinutes}
        onChange={setRange}
      />
      <BarButton
        glyph="filter"
        glyphVariant={toggles > 0 ? "circleFill" : "circle"}
        badge={toggles}
        ariaLabel={toggles > 0 ? `Filters, ${toggles} on` : "Filters"}
        onClick={() => setFiltersOpen(true)}
      />
    </ToolbarGroup>
  );

  return (
    <Screen title="Today" titleDisplay="large" leading={<AppearanceMenu />} trailing={toolbar || undefined}>
      {!start || !result ? (
        <StartPrompt />
      ) : (
        <PullToRefresh refreshing={refreshing} onRefresh={refresh}>
          <StartLine start={start} onChange={() => setStartSheetOpen(true)} />
          <SpeciesChips groups={result.chipGroups} filters={filters} />
          <RecommendationList
            result={result}
            filters={filters}
            showFarther={showFarther}
            place={start.label}
            onChangeStart={() => setStartSheetOpen(true)}
          />
        </PullToRefresh>
      )}
      <StartSheet open={startSheetOpen} onClose={() => setStartSheetOpen(false)} />
      <FiltersSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </Screen>
  );
}

/** "All", the fish groups among the Spots in range, then a removable chip for each Filters toggle that's on. */
function SpeciesChips({ groups, filters }: { groups: string[]; filters: SpotFilters }) {
  const group = filters.speciesGroup;
  const toggle = (title: string, key: "stockedRecently" | "communityWatersOnly" | "freeEntry" | "openNow") =>
    filters[key] && (
      <Chip key={key} title={title} selected glyph="remove" ariaLabel={`${title}, remove filter`} onClick={() => setFilters({ [key]: false })} />
    );
  return (
    <div className="today-chips">
      <ChipRow selectedKey={group ?? "All"}>
        <Chip title="All" selected={group === null} onClick={() => setFilters({ speciesGroup: null })} />
        {groups.map((g) => (
          <Chip key={g} title={g} selected={group === g} onClick={() => setFilters({ speciesGroup: group === g ? null : g })} />
        ))}
        {toggle("Stocked recently", "stockedRecently")}
        {toggle("Community waters", "communityWatersOnly")}
        {toggle("Free entry", "freeEntry")}
        {toggle("Open now", "openNow")}
      </ChipRow>
    </div>
  );
}
