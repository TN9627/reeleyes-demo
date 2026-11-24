// Views/DetailsCards.swift: Prep's Details (B+, Nov 12) for the selected day and time: air pressure over the whole
// day, the sun and moon card with the 24-hour bar, then the water's card when the Spot has a feed, or one line when
// it has none.

import { Fragment, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { OPEN_METEO_SOURCE } from "../../../data/openMeteo";
import type { Conditions, Pressure, RiverFlow, SpotSummary } from "../../../data/types";
import { PressureWords } from "../../../logic/freshness";
import { dayRatingLevel, type PrepDay, type PrepForecast, type PressureTrace } from "../../../logic/prepDays";
import { TimeBar, type TimeBarEvent } from "../../../logic/prepSelection";
import { moonPhaseGlyph } from "../../../logic/skyCalculator";
import { Format, fahrenheit, inHg, roundHalfAway } from "../../../logic/spotFacts";
import { moonPoint, skyCard, skyCardElapsed, skyPhase, skyPoint, type SkyCard } from "../../../logic/todayHero";
import { Card, Glyph } from "../../../ui";
import { OpenMeteoCredit } from "../parts";
import { NowButton, ratingColor } from "../TodayHero";
import "./details.css";

/** The element's content width, kept current: the charts draw in real pixels like a Canvas. */
function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

export interface DetailsSectionProps {
  conditions: Conditions;
  spot: SpotSummary;
  forecast: PrepForecast;
  day: PrepDay;
  /** The selected moment, and whether it follows the clock. */
  date: Date;
  isNow: boolean;
  now: Date;
  /** Set when offline: ages read as "8:05 AM" instead of "8 min ago". */
  savedAt: Date | null;
  /** The 24-hour bar picked a minute of the day; `dragging` while the finger is down. */
  selectMinute: (minute: number, dragging: boolean) => void;
  dragEnded: () => void;
  backToNow: () => void;
}

export function DetailsSection({ conditions, spot, forecast, day, date, isNow, now, savedAt, selectMinute, dragEnded, backToNow }: DetailsSectionProps) {
  const events = TimeBar.events(day);
  const card = skyCard(day, date, isNow, events, spot.lat, spot.lng);
  return (
    <div className="details-section">
      <PressureCard day={day} trace={forecast.pressure} live={conditions.pressure ?? null} date={date} isNow={isNow} now={now} savedAt={savedAt} />
      <SkyCardView
        card={card}
        day={day}
        events={events}
        minute={Math.round((date.getTime() - day.start.getTime()) / 60_000)}
        nowMinute={day.isToday ? Math.trunc((now.getTime() - day.start.getTime()) / 60_000) : null}
        isNow={isNow}
        select={selectMinute}
        dragEnded={dragEnded}
        backToNow={backToNow}
      />
      <div id="water">
        <WaterDetails conditions={conditions} isRiver={spot.kind === "river"} now={now} savedAt={savedAt} />
      </div>
    </div>
  );
}

/**
 * "Air pressure", the value and trend at the selected time, and the day midnight to midnight: measured readings solid
 * up to the latest on Today, the forecast dashed after, the selected time marked.
 */
export function PressureCard({
  day,
  trace,
  live,
  date,
  isNow,
  now,
  savedAt,
}: {
  day: PrepDay;
  trace: PressureTrace;
  live: Pressure | null;
  date: Date;
  isNow: boolean;
  now: Date;
  savedAt: Date | null;
}) {
  const hpa = isNow ? (live?.hpa ?? null) : trace.hpa(date);
  const change = isNow ? (live ? PressureWords.changeInHg(live) : null) : trace.changeInHg(date);

  // Today: the station and its age, then the forecast's credit for the dashed part; other days the credit alone.
  // Open-Meteo's license (CC BY 4.0) asks for credit wherever its data shows.
  const fromOpenMeteo = trace.samples.length > 0 && live?.source === OPEN_METEO_SOURCE;
  const footer = ((): ReactNode[] => {
    const credit = fromOpenMeteo ? <OpenMeteoCredit className="details-credit" /> : null;
    if (!day.isToday || !live) return credit ? [credit] : [];
    const age = savedAt === null ? Format.age(live.observedAt, now) : Format.time(live.observedAt);
    const code = live.station.code;
    if (!code) return [`${live.station.name} · ${age}`, ...(credit ? [credit] : [])];
    return [`${live.station.name} (${code}), ${roundHalfAway(live.station.distanceMi)} mi away · ${age}`];
  })();

  return (
    <Card padding={16} className="details-card details-pressure">
      <div className="details-row-baseline">
        <span className="t-subheadline c-ink-secondary">Air pressure</span>
        <span className="t-footnote c-ink-secondary">{day.isToday && trace.measuredUntil ? "Today · solid = measured" : "Forecast, all day"}</span>
      </div>
      {day.hasPressure ? (
        <>
          <div className="details-pressure-value">
            <span className="details-figure c-ink">{hpa === null ? "—" : inHg(hpa).toFixed(2)}</span>
            <span className="t-subheadline c-ink-secondary">inHg</span>
            <span className="details-pressure-trend t-subheadline-semibold c-data-ink">{change === null ? "" : PressureWords.trendFor(change)}</span>
          </div>
          <DayPressureChart start={day.start} end={day.end} trace={trace} selected={date} />
          <AxisLabels />
          {footer.map((line, i) =>
            typeof line === "string" ? (
              <p key={line} className="t-caption c-ink-tertiary">
                {line}
              </p>
            ) : (
              <Fragment key={i}>{line}</Fragment>
            ),
          )}
        </>
      ) : (
        <p className="t-subheadline c-ink-secondary">
          {day.isToday ? "No pressure feed for this Spot." : "No pressure forecast this far out yet, so there's no rating for this day."}
        </p>
      )}
    </Card>
  );
}

/** "12a · 6a · 12p · 6p · 12a" under the pressure chart and the 24-hour bar. */
export function AxisLabels() {
  return (
    <div className="details-axis" aria-hidden="true">
      {["12a", "6a", "12p", "6p", "12a"].map((label, index) => (
        <span key={index}>{label}</span>
      ))}
    </div>
  );
}

interface ChartPoint {
  at: Date;
  inHg: number;
  measured: boolean;
}

/**
 * The trace's samples inside the day, with its value at either edge when it reaches past it. The forecast part
 * starts at the last measured point so the two lines meet.
 */
function chartPoints(trace: PressureTrace, start: Date, end: Date): ChartPoint[] {
  const until = trace.measuredUntil?.getTime() ?? -Infinity;
  const points = trace.samples
    .filter((sample) => sample.at > start && sample.at < end)
    .map((sample) => ({ at: sample.at, inHg: inHg(sample.hpa), measured: sample.at.getTime() <= until }));
  const first = trace.hpa(start);
  if (first !== null) points.unshift({ at: start, inHg: inHg(first), measured: start.getTime() <= until });
  const last = trace.hpa(end);
  if (last !== null) points.push({ at: end, inHg: inHg(last), measured: end.getTime() <= until });
  return points;
}

/**
 * The day's pressure, midnight to midnight: the area in data-soft, the line in data, solid while measured and dashed
 * (5/5) where forecast, the selected time a dotted accent line with an accent dot ringed in the card color.
 */
export function DayPressureChart({ start, end, trace, selected }: { start: Date; end: Date; trace: PressureTrace; selected: Date }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = 52;
  const points = chartPoints(trace, start, end);
  const measured = points.filter((point) => point.measured);
  const lastMeasured = measured.at(-1);
  const forecast = [...(lastMeasured ? [lastMeasured] : []), ...points.filter((point) => !point.measured)];
  const values = points.map((point) => point.inHg);
  const low = (values.length ? Math.min(...values) : 30) - 0.03;
  const high = (values.length ? Math.max(...values) : 30) + 0.03;
  const span = end.getTime() - start.getTime();
  const x = (at: Date) => ((at.getTime() - start.getTime()) / span) * width;
  const y = (value: number) => height - ((value - low) / (high - low)) * height;
  const line = (part: ChartPoint[]) => part.map((point, index) => `${index ? "L" : "M"}${x(point.at)},${y(point.inHg)}`).join("");
  const markerHpa = trace.hpa(selected);
  const selectedX = x(selected);

  return (
    <div ref={ref} className="details-pressure-chart" aria-hidden="true">
      {width > 0 && (
        <svg width={width} height={height} overflow="visible">
          {points.length > 1 && (
            <path
              d={`${line(points)}L${x(points.at(-1)!.at)},${height}L${x(points[0].at)},${height}Z`}
              style={{ fill: "var(--data-soft)" }}
            />
          )}
          {measured.length > 1 && <path d={line(measured)} className="details-chart-line" />}
          {forecast.length > 1 && <path d={line(forecast)} className="details-chart-line" strokeDasharray="5 5" />}
          <line x1={selectedX} x2={selectedX} y1={0} y2={height} className="details-chart-rule" strokeDasharray="2 3" />
          {markerHpa !== null && (
            <>
              <circle cx={selectedX} cy={y(inHg(markerHpa))} r={7.3} style={{ fill: "var(--card)" }} />
              <circle cx={selectedX} cy={y(inHg(markerHpa))} r={5} style={{ fill: "var(--accent)" }} />
            </>
          )}
        </svg>
      )}
    </div>
  );
}

export interface SkyCardViewProps {
  card: SkyCard;
  day: PrepDay;
  events: TimeBarEvent[];
  minute: number;
  nowMinute: number | null;
  isNow: boolean;
  select: (minute: number, dragging: boolean) => void;
  dragEnded: () => void;
  backToNow: () => void;
}

/**
 * The Sun and moon card (B+, Nov 12): the selected time and its phase, the next sun event, the moon, the arc with both
 * markers, the 24-hour bar and its legend, then the day's sun and moon times. Every row has a set height, so the card
 * keeps its size at every hour of every day.
 */
export function SkyCardView({ card, day, events, minute, nowMinute, isNow, select, dragEnded, backToNow }: SkyCardViewProps) {
  const level = dayRatingLevel(day.rating);
  const windowColor = day.window === null ? "color-mix(in srgb, var(--ink-tertiary) 35%, transparent)" : level ? ratingColor(level) : "var(--ink-tertiary)";
  // The row never wraps (the card keeps its height); when it doesn't fit it shrinks, down to half, like
  // SwiftUI's minimumScaleFactor(0.5).
  const timeRow = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const row = timeRow.current;
    if (!row) return;
    row.style.zoom = "";
    const fit = row.clientWidth / row.scrollWidth;
    if (fit < 1) row.style.zoom = String(Math.max(fit, 0.5));
  });
  return (
    <Card padding={16} className="details-card details-sky">
      <div ref={timeRow} className="details-sky-time">
        <span className="details-sky-clock c-ink">{card.time}</span>
        <span className="details-sky-phase t-footnote-semibold c-ink-secondary">{card.phase}</span>
        <span className="details-spacer" />
        {!isNow && <NowButton action={backToNow} />}
      </div>
      <p className="details-line t-subheadline c-ink-secondary">{card.nextEvent}</p>
      <p className="details-line details-moon-line t-subheadline c-data-ink">
        <Glyph name={moonPhaseGlyph(card.moonPhase)} size="1.1em" />
        <span>{card.moonLine}</span>
      </p>
      <div className="details-arc" aria-hidden={card.sun !== null || card.moon !== null}>
        <SkyArcDrawing card={card} />
        {card.sun === null && card.moon === null && <span className="details-arc-empty t-footnote c-ink-tertiary">Sun and moon are down</span>}
      </div>
      <DayTimeBar day={day} events={events} minute={minute} nowMinute={isNow ? null : nowMinute} select={select} ended={dragEnded} />
      <AxisLabels />
      <div className="details-legend t-footnote c-ink-secondary" aria-hidden="true">
        <div className="details-legend-row">
          <Swatch color="var(--track-daylight)" label="Daylight" />
          <Swatch color="var(--track-twilight)" label="First and last light" />
          <Swatch color="var(--data-ink)" label="Moon up" bar />
        </div>
        <div className="details-legend-row">
          <Swatch color={windowColor} label="Best window" bar />
        </div>
      </div>
      <div className="details-rule" />
      <div className="details-sun-times">
        <SunTime label="Dawn" value={card.dawn} />
        <span className="details-spacer" />
        <SunTime label="Sunrise" value={card.sunrise} />
        <span className="details-spacer" />
        <span className="details-spacer" />
        <SunTime label="Sunset" value={card.sunset} trailing />
        <span className="details-spacer" />
        <SunTime label="Dusk" value={card.dusk} trailing />
      </div>
      <div className="details-legend-line details-moon-times t-footnote c-ink-secondary">
        <span>{card.moonrise}</span>
        <span>{card.moonset}</span>
      </div>
      <p className="details-legend-line t-footnote c-ink-secondary">{card.moonWords}</p>
    </Card>
  );
}

function Swatch({ color, label, bar }: { color: string; label: string; bar?: boolean }) {
  return (
    <span className="details-swatch">
      <span className={bar ? "details-swatch-mark is-bar" : "details-swatch-mark"} style={{ background: color }} />
      <span>{label}</span>
    </span>
  );
}

function SunTime({ label, value, trailing }: { label: string; value: string; trailing?: boolean }) {
  return (
    <span className={trailing ? "details-sun-time is-trailing" : "details-sun-time"}>
      <span className="t-footnote c-ink-secondary">{label}</span>
      <span className="t-headline details-tabular c-ink">{value}</span>
    </span>
  );
}

/**
 * The moon's lit part: the lit half's limb, then the terminator, a half-ellipse whose width follows the
 * illumination (a sliver at a few percent, the whole disc at full). Waxing, lit on the right.
 */
function litPart(cx: number, cy: number, radius: number, illumination: number, waxing: boolean): string {
  const side = waxing ? 1 : -1;
  const terminator = radius * (1 - 2 * Math.min(Math.max(illumination, 0), 1));
  const steps = 48;
  let d = "";
  for (let step = 0; step <= steps; step++) {
    const phi = -Math.PI / 2 + (Math.PI * step) / steps;
    d += `${step === 0 ? "M" : "L"}${cx + side * radius * Math.cos(phi)},${cy + radius * Math.sin(phi)}`;
  }
  for (let step = 0; step <= steps; step++) {
    const phi = Math.PI / 2 - (Math.PI * step) / steps;
    d += `L${cx + side * terminator * Math.cos(phi)},${cy + radius * Math.sin(phi)}`;
  }
  return `${d}Z`;
}

/**
 * The half-ellipse (decorative; the card's text carries the times): the full arc dashed, the elapsed part solid up to
 * the sun (accent) or, with only the moon up, the moon (data ink); the sun's marker at its place, the moon's at its
 * own (68% and behind the sun while the sun is up). Laid out like the B+ canvas, a 330-wide box with the arc
 * centered at (165, 108), radii 135 and 80, scaled to the card's width.
 */
export function SkyArcDrawing({ card }: { card: SkyCard }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = 124;
  const scale = width / 330;
  const center = { x: width / 2, y: 108 };
  const rx = 135 * scale;
  const ry = 80;
  const path = (t: number) => {
    const steps = Math.max(1, Math.ceil(96 * t));
    let d = "";
    for (let step = 0; step <= steps; step++) {
      const point = skyPoint((t * step) / steps, center, rx, ry);
      d += `${step === 0 ? "M" : "L"}${point.x},${point.y}`;
    }
    return d;
  };
  const elapsed = skyCardElapsed(card);
  const sun = card.sun !== null ? skyPoint(card.sun, center, rx, ry) : null;
  const moon = card.moon !== null ? moonPoint(skyPoint(card.moon, center, rx, ry), sun, center) : null;
  const moonRadius = sun === null ? 12 : 12 * 0.68;

  return (
    <div ref={ref} className="details-arc-canvas">
      {width > 0 && (
        <svg width={width} height={height} overflow="visible">
          <line x1={0} x2={width} y1={center.y} y2={center.y} strokeWidth={1} style={{ stroke: "var(--hairline)" }} />
          <path d={path(1)} fill="none" strokeWidth={3} strokeLinecap="round" strokeDasharray="4 6" style={{ stroke: "var(--ink-tertiary)", strokeOpacity: 0.45 }} />
          {elapsed && elapsed.progress > 0 && (
            <path
              d={path(elapsed.progress)}
              fill="none"
              strokeWidth={3}
              strokeLinecap="round"
              style={{ stroke: elapsed.body === "sun" ? "var(--accent)" : "var(--data-ink)" }}
            />
          )}
          {moon && (
            <>
              <circle cx={moon.x} cy={moon.y} r={moonRadius + 2} style={{ fill: "var(--card)" }} />
              <circle cx={moon.x} cy={moon.y} r={moonRadius} style={{ fill: "var(--data-soft)" }} />
              <path d={litPart(moon.x, moon.y, moonRadius, card.moonIllumination, card.moonIsWaxing)} style={{ fill: "var(--data-ink)" }} />
            </>
          )}
          {sun && (
            <>
              <circle cx={sun.x} cy={sun.y} r={17} style={{ fill: "var(--card)" }} />
              {Array.from({ length: 8 }, (_, index) => {
                const angle = (index * Math.PI) / 4;
                return (
                  <line
                    key={index}
                    x1={sun.x + 10 * Math.cos(angle)}
                    y1={sun.y + 10 * Math.sin(angle)}
                    x2={sun.x + 14 * Math.cos(angle)}
                    y2={sun.y + 14 * Math.sin(angle)}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    style={{ stroke: "var(--accent)" }}
                  />
                );
              })}
              <circle cx={sun.x} cy={sun.y} r={6} style={{ fill: "var(--accent)" }} />
            </>
          )}
        </svg>
      )}
    </div>
  );
}

const trackY = 22;

/**
 * The 24-hour bar (B+, Nov 12): midnight to midnight in night, twilight and daylight, the moon's track under it, the
 * best window over it, a tick at the current time on Today when the selection is elsewhere, and the thumb. Dragging
 * or tapping moves the shared selection in 5-minute steps, snapping to a sun or moon event within 8 minutes; the
 * arrow keys (VoiceOver's adjust) move it in quarter hours, stopping at each event.
 */
export function DayTimeBar({
  day,
  events,
  minute,
  nowMinute,
  select,
  ended,
}: {
  day: PrepDay;
  events: TimeBarEvent[];
  minute: number;
  /** Today's current minute while the selection is elsewhere; null hides the tick. */
  nowMinute: number | null;
  select: (minute: number, dragging: boolean) => void;
  ended: () => void;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const dragging = useRef(false);
  const x = (date: Date) => Math.min(Math.max((date.getTime() - day.start.getTime()) / 86_400_000, 0), 1) * width;
  const xMinute = (value: number) => (value / 1440) * width;
  const sky = day.sky;

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const snap = TimeBar.snap(((event.clientX - box.left) / Math.max(box.width, 1)) * 1440, events);
    select(snap.minute, true);
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    move(event);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current) move(event);
  };
  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    ended();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const up = event.key === "ArrowRight" || event.key === "ArrowUp";
    const down = event.key === "ArrowLeft" || event.key === "ArrowDown";
    if (!up && !down) return;
    event.preventDefault();
    select(TimeBar.stepFrom(minute, up, events), false);
  };

  const selectedDate = new Date(day.start.getTime() + minute * 60_000);
  const valueText = `${Format.time(selectedDate)}, ${TimeBar.event(minute, events)?.name ?? skyPhase(selectedDate, sky)}`;
  const span = (start: Date | null, end: Date | null) => (start && end ? { left: x(start), width: Math.max(x(end) - x(start), 0) } : null);
  const twilight = span(sky.dawn, sky.dusk);
  const daylight = span(sky.sunrise, sky.sunset);
  const level = dayRatingLevel(day.rating);
  const thumbX = xMinute(minute);

  return (
    <div
      ref={ref}
      className="details-bar"
      role="slider"
      tabIndex={0}
      aria-label="Choose a time of day"
      aria-valuemin={0}
      aria-valuemax={TimeBar.lastMinute}
      aria-valuenow={minute}
      aria-valuetext={valueText}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      {width > 0 && (
        <>
          <div className="details-bar-track" style={{ top: trackY - 7 }}>
            {twilight && <span style={{ left: twilight.left, width: twilight.width, background: "var(--track-twilight)" }} />}
            {daylight && <span style={{ left: daylight.left, width: daylight.width, background: "var(--track-daylight)" }} />}
          </div>
          {day.moonUp.map((pass) => (
            <span
              key={pass.start.getTime()}
              className="details-bar-capsule"
              style={{ left: x(pass.start), width: Math.max(x(pass.end) - x(pass.start), 4), top: trackY + 7 + 6, background: "var(--data-ink)" }}
            />
          ))}
          {day.window && level && (
            <span
              className="details-bar-capsule"
              style={{
                left: x(day.window.start),
                width: Math.max(x(day.window.end) - x(day.window.start), 4),
                top: trackY - 7 - 4 - 4,
                background: ratingColor(level),
              }}
            />
          )}
          {nowMinute !== null && <span className="details-bar-now" style={{ left: xMinute(nowMinute) - 1, top: trackY - 11 }} />}
          <span className="details-bar-stem" style={{ left: thumbX - 1.5, top: trackY - 17 }} />
          <span className="details-bar-thumb" style={{ left: thumbX - 12, top: trackY - 12 }} />
        </>
      )}
    </div>
  );
}

/** Lake level (lakes, reservoirs, ponds) or river flow (rivers), plus water temperature, each with its source and age; with no feed at all, one line. */
export function WaterDetails({ conditions, isRiver, now, savedAt }: { conditions: Conditions; isRiver: boolean; now: Date; savedAt: Date | null }) {
  const level = conditions.lakeLevel ?? null;
  const flow = conditions.flow ?? null;
  const temp = conditions.waterTemp ?? null;
  if ((isRiver ? flow === null : level === null) && temp === null) {
    return (
      <p className="details-water-none t-footnote c-ink-tertiary">
        {isRiver ? "No river flow or water temp for this Spot." : "No lake level or water temp for this Spot."}
      </p>
    );
  }
  const age = (date: Date) => (savedAt === null ? Format.age(date, now) : Format.time(date));
  const trailing = isRiver ? (flow ? flowTrend(flow) : null) : level?.change24hFt != null ? levelChange(level.change24hFt) : null;
  const sources: string[] = [];
  if (isRiver && flow) sources.push(`${flow.source} · ${age(flow.observedAt)}`);
  if (!isRiver && level) sources.push(`${level.source} · ${age(level.observedAt)}`);
  if (temp && !sources.some((line) => line.startsWith(temp.source))) sources.push(`${temp.source} · ${age(temp.observedAt)}`);

  return (
    <Card padding={16} className="details-water">
      <div className="details-row-baseline">
        <span className="t-subheadline c-ink-secondary">{isRiver ? "River" : "Lake level"}</span>
        {trailing && <span className="t-footnote c-ink-secondary">{trailing}</span>}
      </div>
      <div className="details-water-values">
        {isRiver ? (
          <WaterValue value={flow ? `${roundHalfAway(flow.cfs)}` : null} unit="cfs" caption={flow ? "Flow" : "No flow feed"} />
        ) : (
          <WaterValue
            value={level ? level.ft.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : null}
            unit="ft"
            caption={level ? "Elevation" : "No level feed"}
          />
        )}
        <WaterValue value={temp ? `${fahrenheit(temp.c)}°` : null} caption={temp ? "Water temp" : "No water temperature"} />
      </div>
      {sources.map((line) => (
        <Source key={line}>{line}</Source>
      ))}
    </Card>
  );
}

function WaterValue({ value, unit, caption }: { value: string | null; unit?: string; caption: string }) {
  return (
    <div className="details-water-value">
      <span className="details-water-figure">
        {/* A figure never breaks across lines ("5210" must not read "52 / 10"). */}
        <span className={`t-title-figure ${value === null ? "c-ink-tertiary" : "c-ink"}`}>{value ?? "—"}</span>
        {unit && value !== null && <span className="t-subheadline c-ink-secondary">{unit}</span>}
      </span>
      <span className={`t-subheadline ${value === null ? "c-ink-tertiary" : "c-ink"}`}>{caption}</span>
    </div>
  );
}

function flowTrend(flow: RiverFlow): string {
  switch (flow.trend) {
    case "steady":
      return "Steady";
    case "rising":
      return "Rising";
    case "falling":
      return "Falling";
  }
}

function levelChange(change24hFt: number): string {
  const change = roundHalfAway(change24hFt * 100) / 100;
  if (change === 0) return "Steady, 24 hr";
  return `${change > 0 ? "+" : ""}${change.toFixed(2)} ft in 24 hr`;
}

/** A reading's source and age, small and tertiary. */
export function Source({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={`details-source t-caption c-ink-tertiary ${className ?? ""}`}>{children}</p>;
}
