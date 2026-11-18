// Views/AlertViews.swift: an NWS alert's banner on Prep and its sheet with NWS's own text (#60).

import type { NWSAlert, SpotSummary } from "../../../data/types";
import { AlertRules, type AlertKind } from "../../../logic/alertRules";
import { NWSText } from "../../../logic/conditionsReading";
import { ClockWords } from "../../../logic/windowTime";
import { Format } from "../../../logic/spotFacts";
import { Glyph, type GlyphName } from "../../../ui";
import { ReadingSheet } from "./WeatherSafety";
import "./safety.css";

const kindGlyph: Record<AlertKind, GlyphName> = {
  heat: "heat",
  cold: "cold",
  storm: "storm",
  wind: "wind",
  other: "weatherAlert",
};

/**
 * An NWS alert on Prep (#60): red, above everything else. The `alert-soft` wash, a system-red glyph,
 * ink text; tapping opens the alert's own text.
 */
export function AlertBanner({ alert, now, checked, open }: { alert: NWSAlert; now: Date; checked: string; open: () => void }) {
  const when = AlertRules.when(alert, now);
  const office = AlertRules.office(alert);
  return (
    <button
      type="button"
      className="safety-alert"
      onClick={open}
      aria-label={`${alert.event}. ${when}. From ${office}.`}
      aria-description="Shows the alert."
    >
      <Glyph name={kindGlyph[AlertRules.kind(alert.event)]} size="1.2em" weight={2.3} className="safety-alert-glyph c-red" />
      <span className="safety-alert-text">
        <span className="t-subheadline-semibold c-ink safety-bold">{alert.event}</span>
        <span className="t-subheadline c-ink">{when}</span>
        <span className="t-footnote c-ink-secondary">{checked === "" ? office : `${office} · ${checked}`}</span>
      </span>
      <Glyph name="disclosure" size="0.85em" weight={2.4} className="safety-alert-chevron c-ink-secondary" />
    </button>
  );
}

/** One NWS alert's own text, unedited apart from NWS's line wrapping (#60). */
export function AlertSheet({
  open,
  onClose,
  alert,
  spot,
  now,
  savedAt,
  checkedAt,
}: {
  open: boolean;
  onClose: () => void;
  alert: NWSAlert;
  spot: SpotSummary;
  now: Date;
  /** Offline: when the copy was saved; it can't be checked for updates. */
  savedAt: Date | null;
  checkedAt: Date | null;
}) {
  const footnote = savedAt
    ? `Text from the National Weather Service, unedited. Saved at ${Format.time(savedAt)}; can't check for updates offline.`
    : checkedAt
      ? `Text from the National Weather Service, unedited. Checked ${Format.age(checkedAt, now)}.`
      : "Text from the National Weather Service, unedited.";
  return (
    <ReadingSheet open={open} onClose={onClose} title="NWS alert">
      <h3 className="safety-alert-title c-ink">{alert.event}</h3>
      <p className="safety-pre t-subheadline c-ink-secondary safety-gap-4">
        {`${AlertRules.when(alert, now)} · ${AlertRules.office(alert)} · issued ${ClockWords.when(alert.sent, now)}\nFor ${alert.areaDesc}`}
      </p>
      {alert.headline && <p className="t-subheadline-semibold safety-bold c-ink safety-gap-12">{alert.headline}</p>}
      <p className="safety-pre t-subheadline c-ink safety-gap-12">{NWSText.reflow(alert.description)}</p>
      {alert.instruction && (
        <>
          <h4 className="t-footnote-semibold c-ink-secondary safety-gap-18">What NWS says to do</h4>
          <p className="safety-pre t-subheadline c-ink safety-gap-6">{NWSText.reflow(alert.instruction)}</p>
        </>
      )}
      <a className="button button-secondary t-headline safety-link-button safety-gap-20" href={NWSText.forecastPage(spot)} target="_blank" rel="noreferrer">
        Open on weather.gov
      </a>
      <p className="t-footnote c-ink-secondary safety-gap-12">{footnote}</p>
    </ReadingSheet>
  );
}
