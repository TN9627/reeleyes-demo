import type { StartPoint } from "../../state/appState";
import { Glyph } from "../../ui/Glyph";

/** "From Tempe · Current location ……… Change": the whole bar opens the Starting point sheet. */
export function StartLine({ start, onChange }: { start: StartPoint; onChange: () => void }) {
  const current = start.source === "currentLocation";
  return (
    <button type="button" className="today-start-line" onClick={onChange} aria-description="Change the starting point">
      <span className="today-start-line-glyph t-subheadline">
        <Glyph name={current ? "currentLocation" : "place"} variant={current ? "fill" : "none"} />
      </span>
      <span className="today-start-line-label t-callout">{current ? `From ${start.label} · Current location` : `From ${start.label}`}</span>
      <span className="today-start-line-change t-body">Change</span>
    </button>
  );
}
