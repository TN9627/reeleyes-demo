// Port of VerdictViews.swift's VerdictDetails, ConfidenceLine, InputRow and FishRanges: the inputs with their source,
// age and distance, how sure, the Spot's class, its fish against the water temperature, and what it doesn't know.

import type { ReactNode } from "react";
import { OPEN_METEO_SOURCE } from "../../data/openMeteo";
import type { Species, Weather, WaterTemperature, WaterTempRange } from "../../data/types";
import type { ConditionsReading } from "../../logic/conditionsReading";
import { Feels } from "../../logic/feels";
import { PressureWords } from "../../logic/freshness";
import { hazardVerdictWords, WindowRules } from "../../logic/hazards";
import { compassName, fahrenheit, Format, inHg, roundHalfAway } from "../../logic/spotFacts";
import {
  allWaterClasses,
  confidenceWhy,
  countsAirTemperature,
  FishRange,
  ratingLevelLabel,
  verdictHiddenText,
  verdictHiddenTitle,
  verdictUses,
  VerdictRules,
  waterClassExplanation,
  waterClassName,
  type VerdictRead,
} from "../../logic/verdictRules";
import { ClockWords } from "../../logic/windowTime";
import { Source } from "../prep/details/DetailsCards";
import { OpenMeteoCredit } from "../prep/parts";
import { BulletList, CiteLink, SafetySources } from "../prep/safety/WeatherSafety";
import { ratingColor } from "../prep/TodayHero";
import { Card, Footnote, SectionHeader } from "../../ui/Surfaces";

/** "Confidence: High  Close, fresh readings." */
function ConfidenceLine({ verdict }: { verdict: VerdictRead }) {
  return (
    <p className="t-subheadline c-ink verdict-confidence">
      <strong className="c-data-ink">{`Confidence: ${verdict.confidence ?? ""}`}</strong>
      {`  ${confidenceWhy(verdict)}`}
    </p>
  );
}

export function VerdictDetails({ reading, species, weatherLive }: { reading: ConditionsReading; species: Species[]; weatherLive: boolean }) {
  const verdict = reading.verdict;
  const conditions = reading.conditions;
  const good = <strong>{ratingLevelLabel("good")}</strong>;
  const fair = <strong>{ratingLevelLabel("fair")}</strong>;
  const slow = <strong>{ratingLevelLabel("slow")}</strong>;
  return (
    <>
      <Head reading={reading} />
      <SectionHeader title="What it used" />
      <Card>
        <Inputs reading={reading} />
      </Card>
      {weatherLive && <OpenMeteoCredit className="verdict-credit" />}
      <div id="verdict-rating" className="verdict-anchor">
        <SectionHeader title="How it's rated" />
      </div>
      <Card padding={16}>
        <BulletList
          items={[
            <>{good} when air pressure is easing, down 0.02 to 0.06 inHg in 3 hours.</>,
            <>{fair} when it's steady, within 0.02 inHg.</>,
            <>{slow} when it's climbing 0.02 inHg or more, or dropping faster than 0.06.</>,
            "Wind over 15 mph or gusts over 25 mph hold it at Fair at best. Wind over 25 mph makes it Slow.",
            <>
              An hour is {slow} when storms are likely (thunder in the forecast with a {WindowRules.stormChance}% chance or more), when it
              feels like {WindowRules.heatF}°F or more, or when the wind chill is {WindowRules.coldF}°F or below.
            </>,
            `Ponds and community lakes drop one level when the high is ${VerdictRules.hotHighF}°F or more.`,
          ]}
        />
      </Card>
      <div id="verdict-window" className="verdict-anchor">
        <SectionHeader title="Best window" />
      </div>
      <Card padding={16}>
        <BulletList
          items={[
            "Prep's Best window is the longest stretch of the day at its rating or better that these rules also leave open.",
            <>
              <strong>Daylight only.</strong> Civil dawn to civil dusk, inside the Spot's posted hours when we know them.
            </>,
            <>
              <strong>{`Wind under ${WindowRules.maxWindMph} mph.`}</strong> Where the verdict starts calling it strong wind. On the Beaufort scale 13 to 18
              mph is a moderate breeze that raises dust and small waves.
            </>,
            <>
              <strong>At least 3 hours in a row.</strong> A shorter stretch isn't shown.
            </>,
            <>
              <strong>Never an hour that's Tough.</strong> An hour with storms likely, dangerous heat or dangerous cold is left out, by the rule above.
            </>,
          ]}
        />
      </Card>
      <div className="verdict-window-cite">
        <CiteLink source={SafetySources.wind} />
      </div>
      <div id="verdict-how" className="verdict-anchor">
        <SectionHeader title="How sure" />
      </div>
      <Card padding={16}>
        <BulletList
          items={[
            <>
              <strong>High</strong> when pressure comes from a station within 25 mi, reported in the last 75 min, and wind and air temperature come
              from this Spot's hourly forecast.
            </>,
            "Each of these lowers it one step: a station farther than 25 mi, a reading 75 min to 3 hr old, pressure from a forecast instead of a station.",
            <>
              <strong>Low</strong> with two or more. <strong>No rating</strong> with pressure over 3 hr old, no weather, or while NWS has any warning
              out for the Spot.
            </>,
          ]}
        />
      </Card>
      <div id="verdict-class" className="verdict-anchor">
        <SectionHeader title={`Judged as a ${waterClassName(verdict.waterClass)}`} />
      </div>
      <Card>
        {allWaterClasses.map((waterClass) => {
          const isThis = waterClass === verdict.waterClass;
          return (
            <div key={waterClass} className="verdict-class">
              <p className={`t-headline ${isThis ? "c-data-ink" : "c-ink"}`}>
                {isThis ? `${waterClassName(waterClass)} · this Spot` : waterClassName(waterClass)}
              </p>
              <p className="t-subheadline c-ink-secondary">{waterClassExplanation(waterClass)}</p>
            </div>
          );
        })}
      </Card>
      <div className="verdict-class-note">
        <p className="t-footnote c-ink-secondary">Why class matters: small, shallow lakes warm and cool with the air faster than big, deep ones.</p>
        <CiteLink source={SafetySources.shallowWater} />
      </div>
      <div id="verdict-fish" className="verdict-anchor">
        <SectionHeader title="Fish here and water temperature" />
      </div>
      <FishRanges species={species} waterTemp={conditions.waterTemp ?? null} now={reading.now} />
      <div id="verdict-unknown" className="verdict-anchor">
        <SectionHeader title="What it doesn't know" />
      </div>
      <Card padding={16}>
        <BulletList items={unknowns(reading)} />
      </Card>
      <Footnote>Species ranges cite their source; a species without one shows no range.</Footnote>
    </>
  );
}

function Head({ reading }: { reading: ConditionsReading }) {
  const verdict = reading.verdict;
  const hiddenText = verdictHiddenText(verdict);
  return (
    <div className="card verdict-head">
      {hiddenText !== null ? (
        <>
          <p className="t-title3-semibold c-ink-tertiary">{verdictHiddenTitle}</p>
          <p className="t-subheadline c-ink-secondary verdict-head-hidden">{hiddenText}</p>
        </>
      ) : (
        verdict.rating && (
          <>
            <p className="verdict-head-level">
              <span className="verdict-head-dot" style={{ background: ratingColor(verdict.rating.level) }} aria-hidden="true" />
              <span className="t-title3-semibold c-ink">{ratingLevelLabel(verdict.rating.level)}</span>
            </p>
            <p className="t-body c-ink verdict-head-reason">{verdict.rating.reason}</p>
            <ConfidenceLine verdict={verdict} />
            <p className="t-subheadline c-ink-secondary verdict-head-uses">
              {`The rating uses ${verdictUses(verdict)}. Storms likely, dangerous heat and dangerous cold make an hour Tough. A rule of thumb, not a catch forecast.`}
            </p>
          </>
        )
      )}
    </div>
  );
}

type Flag = { kind: "ok" | "lowers" | "note"; text: string };

/** One input: what it is, its value, where and when it's from, and what it does to the read. */
function InputRow({ title, value, source, flags = [] }: { title: string; value: string; source?: string; flags?: Flag[] }) {
  return (
    <div className="verdict-input">
      <p className="t-headline c-ink">{title}</p>
      <p className="t-subheadline c-ink">{value}</p>
      {source && <Source>{source}</Source>}
      {flags.map((flag) => (
        <FlagLine key={flag.text} flag={flag} />
      ))}
    </div>
  );
}

function FlagLine({ flag }: { flag: Flag }) {
  if (flag.kind === "note") return <p className="t-footnote c-ink-secondary verdict-flag">{flag.text}</p>;
  const color = flag.kind === "ok" ? "var(--data)" : "var(--warn)";
  const ink = flag.kind === "ok" ? "var(--data-ink)" : "var(--warn)";
  return (
    <p className="t-footnote-semibold verdict-flag verdict-flag-dot" style={{ color: ink }}>
      <span style={{ background: color }} aria-hidden="true" />
      {flag.text}
    </p>
  );
}

/** "Open-Meteo forecast", or NWS's grid-point forecast for sample weather. */
function forecastName(source: string): string {
  return source === OPEN_METEO_SOURCE ? "Open-Meteo forecast" : "NWS forecast";
}

/** "26 min old", or offline "from 8:05 AM". */
function age(reading: ConditionsReading, date: Date): string {
  return reading.savedAt === null ? ClockWords.ageOld(date, reading.now) : `from ${Format.time(date)}`;
}

function Inputs({ reading }: { reading: ConditionsReading }) {
  const { conditions, verdict } = reading;
  const pressure = conditions.pressure ?? null;
  const weather = conditions.weather ?? null;
  const water = conditions.waterTemp ?? null;
  const rows: ReactNode[] = [];
  if (pressure) {
    const lowerings = verdict.lowerings;
    const station = pressure.station;
    rows.push(
      <InputRow
        key="pressure"
        title="Air pressure"
        value={`${inHg(pressure.hpa).toFixed(2)} inHg, ${PressureWords.trend(pressure).toLowerCase()} (${PressureWords.change(pressure)})`}
        source={
          station.code
            ? `${station.name} (${station.code}) · ${roundHalfAway(station.distanceMi)} mi away · ${age(reading, pressure.observedAt)}`
            : `${station.name} · ${age(reading, pressure.observedAt)}`
        }
        flags={lowerings.length === 0 ? [{ kind: "ok", text: "Close and fresh" }] : lowerings.map((l) => ({ kind: "lowers", text: `${l}, which lowers confidence` }))}
      />,
    );
  } else {
    rows.push(<InputRow key="pressure" title="Air pressure" value="No pressure feed for this Spot." />);
  }
  if (weather) {
    const grid = weather.gridPoint ? ` (${weather.gridPoint})` : "";
    const direction = weather.windDirection === "" ? "" : ` from the ${compassName(weather.windDirection)}`;
    const gusts = weather.gustMph != null ? `, gusts to ${roundHalfAway(weather.gustMph)} mph` : "";
    const period = conditions.hourly?.periods.find((p) => p.startTime <= reading.now && reading.now < p.endTime) ?? null;
    rows.push(
      <InputRow
        key="wind"
        title="Wind"
        value={`${roundHalfAway(weather.windMph)} mph${direction}${gusts}`}
        source={`${forecastName(weather.source)} for this Spot${grid} · ${age(reading, weather.observedAt)}`}
        flags={[windFlag(weather)]}
      />,
      <InputRow
        key="air"
        title="Air temperature"
        value={`${fahrenheit(weather.airTempC)}°F now${weather.highC != null ? `, high ${fahrenheit(weather.highC)}°F` : ""}`}
        source={`${forecastName(weather.source)} for this Spot · ${age(reading, weather.observedAt)}`}
        flags={[airFlag(verdict)]}
      />,
      <InputRow
        key="hazards"
        title="Storms, heat and cold"
        value={
          period
            ? `${period.shortForecast}, ${Feels.whole(period.precipitationChance ?? 0)}% chance of rain, feels like ${Feels.whole(Feels.heatF(Feels.fahrenheit(period.tempC), period.relativeHumidity))}°F`
            : "No forecast for this hour."
        }
        source={`${(conditions.hourly?.source ?? weather.source) === OPEN_METEO_SOURCE ? "Open-Meteo" : "NWS"} hourly forecast for this Spot`}
        flags={
          verdict.hazards.length === 0
            ? [{ kind: "ok", text: "No storms likely, dangerous heat or dangerous cold this hour" }]
            : verdict.hazards.map((h) => ({ kind: "lowers", text: `${hazardVerdictWords(h)}, which makes the rating Tough` }))
        }
      />,
    );
  } else {
    rows.push(<InputRow key="weather" title="Wind and air temperature" value="No weather feed for this Spot." />);
  }
  if (water) {
    rows.push(
      <InputRow
        key="water"
        title="Water temperature"
        value={`${fahrenheit(water.c)}°F`}
        source={`${water.source} · ${age(reading, water.observedAt)}`}
        flags={[{ kind: "note", text: "Placed on the fish ranges below, not in the rating" }]}
      />,
    );
  }
  return <>{rows}</>;
}

/** Over 25 mph it makes the rating Slow; over the wind cap it holds it at Fair at best. */
function windFlag(weather: Weather): Flag {
  if (weather.windMph > VerdictRules.strongWindMph) return { kind: "lowers", text: "Over 25 mph, which makes the rating Slow" };
  if (VerdictRules.windCapped(weather.windMph, weather.gustMph)) return { kind: "lowers", text: "Over the wind cap, which holds the rating at Fair at best" };
  return { kind: "ok", text: weather.gustMph == null ? "At the Spot (no gust forecast)" : "At the Spot" };
}

function airFlag(verdict: VerdictRead): Flag {
  if (!countsAirTemperature(verdict.waterClass)) {
    return { kind: "note", text: `Shown, not counted at a ${waterClassName(verdict.waterClass).toLowerCase()} (see below)` };
  }
  return verdict.isHot
    ? { kind: "lowers", text: `Counts here. A high of ${VerdictRules.hotHighF}°F or more lowers the rating one level` }
    : { kind: "ok", text: `Counts here. Below ${VerdictRules.hotHighF}°F it doesn't change the rating` };
}

function unknowns(reading: ConditionsReading): string[] {
  const water = reading.conditions.waterTemp ?? null;
  const lines: (string | null)[] = [
    water
      ? `The water temperature is one reading from ${water.source}, ${age(reading, water.observedAt)}; the shoreline can differ.`
      : "No live water temperature for this Spot.",
    countsAirTemperature(reading.verdict.waterClass) ? "The pond's own water temperature: we go by the air." : null,
    "Whether air pressure predicts catches in Arizona: no study has tested it.",
    "Stocking, fishing pressure, water clarity or what's biting today.",
  ];
  return lines.filter((l): l is string => l !== null);
}

const scaleLow = 40;
const scaleHigh = 95;

/** The Spot's fish on a 40–95°F scale, each with its sourced water-temperature range and where today's water sits. */
function FishRanges({ species, waterTemp, now }: { species: Species[]; waterTemp: WaterTemperature | null; now: Date }) {
  const firstUnsourced = species.findIndex((s) => !s.waterTempRange);
  return (
    <Card>
      <div className="verdict-fish-intro t-subheadline">
        <p className="c-ink">
          {waterTemp
            ? `Water ${fahrenheit(waterTemp.c)}°F from ${waterTemp.source}, ${Format.age(waterTemp.observedAt, now)}, placed on each fish's range.`
            : "No live water temperature for this Spot, so today can't be placed on these ranges."}
        </p>
        <p className="c-ink-secondary">Ranges are water temperatures where each fish does best, from the cited study.</p>
      </div>
      {species.map((fish, index) => (
        <div key={fish.id} className="verdict-fish" id={!fish.waterTempRange && index === firstUnsourced ? "verdict-unsourced" : `verdict-fish-${fish.id}`}>
          {index === 0 && (
            <div className="verdict-fish-scale t-caption c-ink-tertiary" aria-hidden="true">
              <span>40°F</span>
              <span>95°F</span>
            </div>
          )}
          {fish.waterTempRange ? (
            <FishRow fish={fish} range={fish.waterTempRange} waterTemp={waterTemp} />
          ) : (
            <div className="verdict-fish-title">
              <span className="t-body c-ink-secondary">{fish.name}</span>
              <span className="t-subheadline c-ink-secondary">No sourced range</span>
            </div>
          )}
        </div>
      ))}
      {species.length === 0 && <p className="t-body c-ink-secondary verdict-fish-empty">No species listed for this Spot</p>}
    </Card>
  );
}

function FishRow({ fish, range, waterTemp }: { fish: Species; range: WaterTempRange; waterTemp: WaterTemperature | null }) {
  const x = (f: number) => ((Math.min(Math.max(f, scaleLow), scaleHigh) - scaleLow) / (scaleHigh - scaleLow)) * 100;
  const lowF = fahrenheit(range.lowC);
  const highF = fahrenheit(range.highC);
  const point = lowF === highF;
  return (
    <>
      <div className="verdict-fish-title">
        <span className="t-body c-ink">{fish.name}</span>
        <span className="t-subheadline c-ink-secondary tnum">{FishRange.label(range)}</span>
      </div>
      <div className="verdict-fish-bar" aria-hidden="true">
        <span className="verdict-fish-track" />
        <span
          className="verdict-fish-range"
          style={{
            left: `calc(${x(lowF)}% - ${point ? 4 : 0}px)`,
            width: `max(calc(${x(highF) - x(lowF)}% + ${point ? 8 : 0}px), 10px)`,
          }}
        />
        {waterTemp && <span className="verdict-fish-water" style={{ left: `calc(${x(fahrenheit(waterTemp.c))}% - 1.5px)` }} />}
      </div>
      {waterTemp && <p className="t-subheadline c-ink verdict-fish-placement">{FishRange.placement(waterTemp.c, range)}</p>}
      <CiteLink source={{ label: `${range.basis} · ${range.source}`, url: range.url }} />
    </>
  );
}
