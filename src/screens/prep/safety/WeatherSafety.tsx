// Views/WeatherSafety.swift: the sources behind the verdict's wind rule, the safety notices and the verdict's class rule
// (#60, #62); the reading sheet and its parts; the heat and cold notices and their signs sheets.

import type { ReactNode } from "react";
import { Card, Glyph, Sheet } from "../../../ui";
import "./safety.css";

export interface SafetySource {
  label: string;
  url: string;
}

const source = (label: string, url: string): SafetySource => ({ label, url });

export const SafetySources = {
  wind: source("Beaufort scale, NWS Miami", "https://www.weather.gov/mfl/beaufort"),
  heatIllness: source("NWS: heat cramps, exhaustion, stroke", "https://www.weather.gov/safety/heat-illness"),
  azHeat: source("AZ State Parks via ADHS: outdoor heat", "https://directorsblog.health.azdhs.gov/safe-outdoor-recreation-in-arizonas-summer-heat/"),
  coldSafety: source("NWS: cold weather safety", "https://www.weather.gov/safety/cold-during"),
  coldInjury: source("CDC: frostbite and hypothermia", "https://www.cdc.gov/winter-weather/prevention/preventing-frostbite.html"),
  /** Why a Spot's class changes how air temperature counts (#62). */
  shallowWater: source("Toffolon et al. 2014", "https://doi.org/10.4319/lo.2014.59.6.2185"),
} as const;

/** A cited source as a tinted link with a chevron; opens Safari. */
export function CiteLink({ source, label }: { source: SafetySource; label?: string }) {
  return (
    <a className="safety-cite t-footnote-semibold" href={source.url} target="_blank" rel="noreferrer">
      <span>{label ?? source.label}</span>
      <Glyph name="disclosure" size="0.8em" weight={2.6} />
    </a>
  );
}

/** The row of tinted text actions along a card's foot, under an edge-to-edge hairline. */
export function CardLinks({ inset = 18, children }: { inset?: number; children: ReactNode }) {
  return (
    <div className="safety-card-links" style={{ ["--card-links-inset" as string]: `${inset}px` }}>
      <div className="safety-card-links-rule" />
      <div className="safety-card-links-row">{children}</div>
    </div>
  );
}

/** One tinted action in `CardLinks`: "Signs of heat illness ›". */
export function CardLinkButton({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button type="button" className="safety-card-link t-footnote-semibold" onClick={onClick}>
      <span>{title}</span>
      <Glyph name="disclosure" size="0.85em" weight={2.6} className="safety-card-link-glyph" />
    </button>
  );
}

/** A sheet of reading matter: inline title, Done, the eggshell ground. */
export function ReadingSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="safety-reading">{children}</div>
    </Sheet>
  );
}

/** A titled item in a reading sheet, above a hairline: "Wind under 15 mph" and its explanation. */
export function ReadingItem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="safety-reading-item">
      <h3 className="t-headline c-ink">{title}</h3>
      {children}
    </section>
  );
}

/** Secondary prose in a reading sheet. */
export function ReadingText({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={`t-subheadline c-ink-secondary ${className ?? ""}`}>{children}</p>;
}

/** A bulleted list of ink lines (the notices' tips, the Verdict's bullets). */
export function BulletList({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <ul className={`safety-bullets t-subheadline c-ink ${className ?? ""}`}>
      {items.map((item, index) => (
        <li key={index}>
          <span aria-hidden="true">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export type SafetyNoticeKind = "heat" | "cold";

const noticeTips: Record<SafetyNoticeKind, string[]> = {
  heat: [
    "Go early and be off the water before the heat; the window leaves those hours out.",
    "Drink water before you're thirsty, 1 to 2 liters an hour when active. Skip alcohol.",
    "Shade, a hat, light loose clothes. Confused, slurring or fainting in the heat: call 911.",
  ],
  cold: [
    "Dress in layers and cover skin: a warm hat, mittens or gloves, and your face and ears. Stay out of the wind.",
    "Keep gloves, socks and skin dry. If you get wet, get somewhere warm and change into dry clothes right away.",
    "Numb, white or waxy skin: get warm now. Shivering hard, confused, slurring or fumbling in the cold: call 911.",
  ],
};

/** Heat or cold danger today (#60): a safety notice, never a fishing rating. A white card with a system-red glyph. */
export function SafetyNotice({ kind, line, showSigns }: { kind: SafetyNoticeKind; line: string; showSigns: () => void }) {
  return (
    <section aria-label={kind === "heat" ? "Heat safety" : "Cold safety"}>
      <Card padding={18} className="safety-notice">
        <h3 className="safety-notice-title t-headline c-ink">
          <Glyph name={kind} size="1.15em" weight={2.3} className="c-red" />
          <span>{kind === "heat" ? "Heat danger today" : "Cold danger today"}</span>
        </h3>
        <p className="safety-notice-line t-subheadline c-ink-secondary">{line} This is about your safety, not the fishing.</p>
        <BulletList items={noticeTips[kind]} className="safety-notice-tips" />
        <CardLinks>
          <CardLinkButton title={kind === "heat" ? "Signs of heat illness" : "Signs of cold injury"} onClick={showSigns} />
        </CardLinks>
      </Card>
    </section>
  );
}

/** Signs of heat illness, from NWS and Arizona State Parks (#60). */
export function HeatSignsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ReadingSheet open={open} onClose={onClose} title="Signs of heat illness">
      <ReadingItem title="Heat exhaustion">
        <ReadingText>Heavy sweating, weakness, cool, pale, clammy skin, a fast weak pulse, dizziness, nausea, headache, fainting.</ReadingText>
        <ReadingText>
          <strong>Do:</strong> get to shade or air conditioning, loosen clothes, cool wet cloths, sips of water. Get medical help if they vomit or it
          lasts over an hour.
        </ReadingText>
      </ReadingItem>
      <ReadingItem title="Heat stroke">
        <ReadingText>Confusion, slurred speech, hot red skin (dry or damp), a strong fast pulse, fainting.</ReadingText>
        <ReadingText>
          <strong>Call 911.</strong> Move them somewhere cooler and cool them with wet cloths. Don't give them anything to drink.
        </ReadingText>
      </ReadingItem>
      <ReadingText className="safety-reading-credit">
        From the National Weather Service's heat illness guide and Arizona State Parks' summer advice.
      </ReadingText>
      <CiteLink source={SafetySources.heatIllness} />
      <CiteLink source={SafetySources.azHeat} />
    </ReadingSheet>
  );
}

/** Signs of cold injury, from NWS and the CDC: the owner's cold-safety addition to #60. */
export function ColdSignsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ReadingSheet open={open} onClose={onClose} title="Signs of cold injury">
      <ReadingItem title="Frostbite">
        <ReadingText>
          Redness or pain first, then numbness and a white or grayish-yellow patch that feels firm or waxy. Most often fingers, toes, nose, ears,
          cheeks and chin.
        </ReadingText>
        <ReadingText>
          <strong>Do:</strong> get somewhere warm. Warm the area in warm, not hot, water or with body heat, like fingers in an armpit. Don't rub it
          or use a fire, stove or heater; numb skin burns easily. See a doctor.
        </ReadingText>
      </ReadingItem>
      <ReadingItem title="Hypothermia">
        <ReadingText>
          Shivering, exhaustion, confusion, fumbling hands, memory loss, slurred speech, drowsiness. It can happen above 40°F if you get wet.
        </ReadingText>
        <ReadingText>
          <strong>Call 911.</strong> Get them somewhere warm, take off wet clothes, and warm the center of the body first under dry blankets.
          Handle them gently and don't rub them.
        </ReadingText>
      </ReadingItem>
      <ReadingText className="safety-reading-credit">From the National Weather Service's cold safety guide and the CDC.</ReadingText>
      <CiteLink source={SafetySources.coldSafety} />
      <CiteLink source={SafetySources.coldInjury} />
    </ReadingSheet>
  );
}
