import { activeToggleCount } from "../../logic/todayLayout";
import { resetToggles, setFilters, useAppState } from "../../state/appState";
import { ToggleRow } from "../../ui/Controls";
import { Sheet } from "../../ui/Sheet";
import { Card, Footnote } from "../../ui/Surfaces";

/** The four toggles behind Today's Filters button (Swift FiltersSheet). */
export function FiltersSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const filters = useAppState((s) => s.filters);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filters"
      detent="medium"
      cancel={{ label: "Reset", onClick: resetToggles, disabled: activeToggleCount(filters) === 0 }}
    >
      <div className="today-filters-form">
        <Card>
          <ToggleRow label="Stocked recently" checked={filters.stockedRecently} onChange={(on) => setFilters({ stockedRecently: on })} />
          <ToggleRow label="Community waters only" checked={filters.communityWatersOnly} onChange={(on) => setFilters({ communityWatersOnly: on })} />
          <ToggleRow label="Free entry" checked={filters.freeEntry} onChange={(on) => setFilters({ freeEntry: on })} />
          <ToggleRow label="Open now" checked={filters.openNow} onChange={(on) => setFilters({ openNow: on })} />
        </Card>
        <Footnote>Stocked recently means AZGFD stocked it in the last 14 days. Open now uses Arizona time; Spots without listed hours are left out.</Footnote>
      </div>
    </Sheet>
  );
}
