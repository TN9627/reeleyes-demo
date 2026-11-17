/**
 * "Starting point" sheet (Swift `StartSheet` in Views/StartViews.swift): current location,
 * Home (or "Save … as Home"), the city/ZIP search and suggestions.
 *
 *   <StartSheet open={open} onClose={() => setOpen(false)} />
 *
 * Keep it mounted and toggle `open` so it animates in and out. Picking a start writes it to
 * app state (`setStart` / `choosePlace` / `locateStart`) and calls `onClose`; so do Done,
 * the scrim and a swipe down. The drive-time range stays in Today's toolbar, as in Swift.
 */
import { useEffect, useState } from "react";
import { clearStartError, locateStart, sameStart, saveAsHome, setStart, useAppState } from "../../state/appState";
import { Glyph, type GlyphName } from "../../ui/Glyph";
import { Sheet } from "../../ui/Sheet";
import { Card, Row } from "../../ui/Surfaces";
import { StartSearch } from "./StartSearch";
import "./start.css";

export interface StartSheetProps {
  open: boolean;
  onClose: () => void;
}

export function StartSheet({ open, onClose }: StartSheetProps) {
  const start = useAppState((s) => s.start);
  const home = useAppState((s) => s.home);
  const permission = useAppState((s) => s.location.permission);
  // A fresh search (no stale query or error) each time the sheet opens.
  const [visit, setVisit] = useState(0);

  useEffect(() => {
    if (!open) return;
    clearStartError();
    setVisit((v) => v + 1);
  }, [open]);

  const locationDetail =
    permission === "allowed"
      ? start?.source === "currentLocation"
        ? start.label
        : "On"
      : permission === "denied"
        ? "Off. Turn on in Settings"
        : "Not allowed yet";

  return (
    <Sheet open={open} onClose={onClose} title="Starting point" detent="large">
      <div className="start-sheet-body">
        <div className="start-sheet-rows">
          <Card>
            <StartRow
              glyph="currentLocation"
              filled
              title="Current location"
              detail={locationDetail}
              checked={start?.source === "currentLocation"}
              onClick={async () => {
                if (await locateStart()) onClose();
              }}
            />
            {home ? (
              <StartRow
                glyph="home"
                filled
                title="Home"
                detail={[home.label, home.zip].filter(Boolean).join(" · ")}
                checked={sameStart(start, home) && start?.source === home.source}
                onClick={() => {
                  setStart(home);
                  onClose();
                }}
              />
            ) : (
              start?.source === "typed" && (
                <StartRow glyph="home" title={`Save ${start.label} as Home`} detail="Pick it again in one tap" checked={false} onClick={saveAsHome} />
              )
            )}
          </Card>
        </div>
        <StartSearch key={visit} onDone={onClose} />
      </div>
    </Sheet>
  );
}

function StartRow({
  glyph,
  filled,
  title,
  detail,
  checked,
  onClick,
}: {
  glyph: GlyphName;
  filled?: boolean;
  title: string;
  detail: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <Row onClick={onClick}>
      <span className="start-row">
        <span className="start-row-glyph">
          <Glyph name={glyph} variant={filled ? "fill" : "none"} />
        </span>
        <span className="start-row-text">
          <span className="t-body c-ink">{title}</span>
          <span className="t-subheadline c-ink-secondary">{detail}</span>
        </span>
        {checked && <Glyph name="checked" className="start-row-check" weight={2.4} label="Selected" />}
      </span>
    </Row>
  );
}
