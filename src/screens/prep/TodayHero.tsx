// Port of Views/TodayHeroView.swift: Prep's day picker, the "Back to now" pill and the Today hero card.

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import type { RatingLevel } from "../../logic/verdictRules";
import { isSunEvent, type HourCell, type HourSlot } from "../../logic/prepSelection";
import { dayRatingLevel, dayRatingText, dayRatingTitle, type PrepDay } from "../../logic/prepDays";
import type { HeroChip, HeroTone, TodayHero } from "../../logic/todayHero";
import { Glyph } from "../../ui/Glyph";
import "./todayHero.css";

/** RatingLevel.color: the level's dot. */
export function ratingColor(level: RatingLevel): string {
  return `var(--rating-${level})`;
}

/** RatingLevel.softColor: the level's band fill. */
export function ratingSoftColor(level: RatingLevel): string {
  return `var(--rating-${level}-soft)`;
}

function toneColor(tone: HeroTone): string {
  switch (tone) {
    case "dataInk":
      return "var(--data-ink)";
    case "fair":
      return "var(--rating-fair)";
    case "secondary":
      return "var(--ink-secondary)";
    case "accent":
      return "var(--accent)";
  }
}

/** One line that shrinks to fit its width, down to `min` of its size (SwiftUI's lineLimit(1).minimumScaleFactor). */
function FitLine({ min, className, decorative, children }: { min: number; className?: string; decorative?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const text = ref.current;
    const line = text?.parentElement;
    if (!text || !line) return;
    // A transform doesn't change layout, so the text's own width stays measurable; refit when either width
    // changes (the web font arriving, the card resizing).
    const fit = () => {
      const scale = Math.max(Math.min(line.clientWidth / text.offsetWidth, 1), min);
      text.style.transform = scale < 1 ? `scale(${scale})` : "";
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(text);
    observer.observe(line);
    return () => observer.disconnect();
  }, [min]);
  return (
    <span className={`fit-line ${className ?? ""}`} aria-hidden={decorative || undefined}>
      <span ref={ref}>{children}</span>
    </span>
  );
}

/** Prep's day picker: Today and the next 4 days, each with its weather, high and low, and rating dot. */
export function DayPicker({ days, selectedOffset, select }: { days: PrepDay[]; selectedOffset: number; select: (day: PrepDay) => void }) {
  return (
    <div className="day-picker" style={{ gridTemplateColumns: `repeat(${Math.max(days.length, 1)}, minmax(0, 1fr))` }}>
      {days.map((day) => {
        const selected = day.offset === selectedOffset;
        const level = dayRatingLevel(day.rating);
        return (
          <button
            key={day.offset}
            type="button"
            className={`day-chip${selected ? " is-selected" : ""}`}
            aria-label={day.spoken}
            aria-pressed={selected}
            onClick={() => select(day)}
          >
            <FitLine min={0.8} className="day-chip-label">{day.chipLabel}</FitLine>
            <span className="day-chip-icon">
              <Glyph name={day.icon} size={18} />
            </span>
            <span className="day-chip-temps tnum">
              <span>{day.highF !== null ? `${day.highF}°` : "—"}</span>
              {day.lowF !== null && <span className="day-chip-low">{`${day.lowF}°`}</span>}
            </span>
            <span className="day-chip-dot" style={level ? { background: ratingColor(level) } : undefined} />
          </button>
        );
      })}
    </div>
  );
}

/** The pill that returns the selection to Today at the current time. */
export function NowButton({ action }: { action: () => void }) {
  return (
    <button type="button" className="now-button" onClick={action} title="Goes back to today at the current time.">
      <Glyph name="backToNow" size="1.05em" weight={2.3} />
      <span>Back to now</span>
    </button>
  );
}

interface HeroProps {
  day: PrepDay;
  hero: TodayHero;
  cells: HourCell[];
  selectedSlotID: string | null;
  isNow: boolean;
  /** Off while the 24-hour bar is dragged, so the row follows without lag. */
  animatesScroll: boolean;
  select: (slot: HourSlot) => void;
  backToNow: () => void;
  /** Opens the Verdict screen; null on forecast days. */
  open: (() => void) | null;
}

/**
 * Prep's Today hero: the day's rating band, the hourly header and hour slots, the hour line, the weather at the
 * selected hour, three tiles and the one freshness line.
 */
export function TodayHeroCard({ day, hero, cells, selectedSlotID, isNow, animatesScroll, select, backToNow, open }: HeroProps) {
  return (
    <div className="hero-card">
      <Band day={day} hero={hero} open={open} />
      <div className="hero-hourly">
        <HourlyHeader day={day} />
        <SlotRow day={day} cells={cells} selectedSlotID={selectedSlotID} animatesScroll={animatesScroll} select={select} />
      </div>
      <div className="hero-hour-line">
        <Glyph name="time" size="1.1em" weight={2.3} />
        <span className="t-subheadline-semibold tnum">{hero.hourLine}</span>
        <span className="hero-spacer" />
        {!isNow && <NowButton action={backToNow} />}
      </div>
      <div className="hero-weather" aria-hidden="true">
        <span className="hero-weather-main">
          <Glyph name={hero.icon} size={52} weight={1.3} style={{ color: toneColor(hero.tone) }} />
          <span className="hero-temperature tnum">{hero.temperature}</span>
        </span>
        <span className="hero-weather-words">
          <span className="t-headline">{hero.skyWord}</span>
          {hero.highLow && <span className="t-subheadline c-ink-secondary tnum">{hero.highLow}</span>}
        </span>
      </div>
      <div className="hero-chips">
        <Chip chip={hero.wind} tint={hero.windCapped ? "var(--rating-fair)" : "var(--data)"} capped={hero.windCapped} />
        <Chip chip={hero.pressure} tint="var(--data)" capped={false} />
        <Chip chip={hero.sun} tint="var(--accent)" capped={false} />
      </div>
      <p className="hero-footer t-caption">{hero.footer}</p>
    </div>
  );
}

function Band({ day, hero, open }: { day: PrepDay; hero: TodayHero; open: (() => void) | null }) {
  const level = dayRatingLevel(day.rating);
  const showsDot = day.rating.kind !== "hidden";
  const dot = level ? ratingColor(level) : "color-mix(in srgb, var(--ink-tertiary) 60%, transparent)";
  const content = (
    <>
      <span className="hero-kicker">{day.kicker}</span>
      <span className="hero-title-row">
        {showsDot && (
          <span className="hero-dot" style={{ background: `color-mix(in srgb, ${dot} 20%, transparent)` }}>
            <span style={{ background: dot }} />
          </span>
        )}
        <span className="hero-title">{dayRatingTitle(day.rating)}</span>
      </span>
      <span className="hero-text t-callout">{dayRatingText(day.rating)}</span>
    </>
  );
  const style = { background: level ? ratingSoftColor(level) : "var(--fill)" };
  if (!open) {
    return (
      <div className="hero-band" style={style} role="group" aria-label={hero.accessibilityLabel}>
        {content}
      </div>
    );
  }
  return (
    <button type="button" className="hero-band is-tappable" style={style} aria-label={hero.accessibilityLabel} title="Shows what it's based on." onClick={open}>
      {content}
    </button>
  );
}

/** "Hourly" and the day's window line side by side. */
function HourlyHeader({ day }: { day: PrepDay }) {
  const level = dayRatingLevel(day.rating);
  const dot = day.window === null
    ? "color-mix(in srgb, var(--ink-tertiary) 35%, transparent)"
    : level ? ratingColor(level) : "var(--ink-tertiary)";
  return (
    <div className="hero-hourly-header">
      <span className="t-footnote-semibold c-ink-secondary">Hourly</span>
      <span className="hero-window-line">
        <span className="hero-window-dot" style={{ background: dot }} />
        <span className="t-footnote c-ink-secondary">{day.windowLine}</span>
      </span>
    </div>
  );
}

/** Edge to edge in the card; the selected slot scrolls to the 20px inset. */
function SlotRow({ day, cells, selectedSlotID, animatesScroll, select }: {
  day: PrepDay;
  cells: HourCell[];
  selectedSlotID: string | null;
  animatesScroll: boolean;
  select: (slot: HourSlot) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const scrollTo = (behavior: ScrollBehavior) => {
    const row = ref.current;
    if (!row || !selectedSlotID) return;
    const slot = row.querySelector<HTMLElement>(`[data-slot="${selectedSlotID}"]`);
    if (!slot) return;
    row.scrollTo({ left: row.scrollLeft + slot.getBoundingClientRect().left - row.getBoundingClientRect().left - 20, behavior });
  };
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      scrollTo("instant");
    }
  });
  useEffect(() => {
    scrollTo(animatesScroll ? "smooth" : "instant");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlotID, day.offset]);
  const level = dayRatingLevel(day.rating);
  return (
    <div className="hero-slots" ref={ref}>
      {cells.map((cell) => {
        const selected = cell.id === selectedSlotID;
        const sunEvent = isSunEvent(cell.slot);
        const iconColor = selected ? "var(--background)" : sunEvent ? "var(--accent)" : toneColor(cell.tone);
        return (
          <button
            key={cell.id}
            type="button"
            data-slot={cell.id}
            className={`hero-slot${selected ? " is-selected" : sunEvent ? " is-sun-event" : ""}`}
            aria-label={cell.spoken}
            aria-pressed={selected}
            onClick={() => select(cell.slot)}
          >
            <FitLine min={0.7} className="t-caption hero-slot-label">{cell.slot.label}</FitLine>
            <Glyph name={cell.icon} size={20} style={{ color: iconColor }} />
            <span className="t-subheadline-semibold tnum">{cell.value}</span>
            {cell.inWindow && level && <span className="hero-slot-window" style={{ background: ratingColor(level) }} />}
            {cell.hazards.length > 0 && (
              <span className="hero-slot-hazard">
                <Glyph name="weatherAlert" size={9} weight={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Chip({ chip, tint, capped }: { chip: HeroChip; tint: string; capped: boolean }) {
  return (
    <div className={`hero-chip${capped ? " is-capped" : ""}`} role="group" aria-label={chip.spoken}>
      <span aria-hidden="true" className="hero-chip-glyph" style={{ color: tint }}>
        <Glyph name={chip.glyph} size={18} />
      </span>
      <FitLine min={0.8} decorative className="t-headline tnum">{chip.value}</FitLine>
      <FitLine min={0.6} decorative className="t-footnote c-ink-secondary">{chip.caption}</FitLine>
    </div>
  );
}
