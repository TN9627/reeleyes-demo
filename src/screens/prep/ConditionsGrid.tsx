// Port of Views/ConditionsGrid.swift: weather, wind, pressure with its 3-hour trace,
// sun and moon, then water, every reading with its source and age.

import type { ReactNode } from "react";
import { Glyph } from "../../ui/Glyph";
import { Card } from "../../ui/Surfaces";
import type { Conditions, LakeLevel, Pressure, RiverFlow, SpotSummary, Weather } from "../../data/types";
import { pressureChangeWords, pressureTraceLabels, pressureTrendWords, type PressureTraceLabels } from "../../logic/freshness";
import { compassName, downwindDegrees, fahrenheit, Format, inHg, roundHalfAway } from "../../logic/spotFacts";
import { moonDescription, skyDay, type SkyDay } from "../../logic/skyCalculator";
import { startOfDay } from "../../logic/localDay";
import "./prep.css";

interface Props {
  conditions: Conditions;
  spot: SpotSummary;
  now: Date;
  /** Set when offline: ages read as "8:05 AM" instead of "8 min ago". */
  savedAt: Date | null;
}

export function ConditionsGrid({ conditions, spot, now, savedAt }: Props) {
  const age = (date: Date) => (savedAt === null ? Format.age(date, now) : Format.time(date));
  const weather = conditions.weather ?? null;
  return (
    <div className="prep-grid">
      <div className="prep-grid-pair">
        {weather ? <WeatherTile weather={weather} age={age} /> : <NoFeedTile title="Weather" message="No weather feed for this Spot." />}
        {weather ? <WindTile weather={weather} age={age} /> : <NoFeedTile title="Wind" message="No weather feed for this Spot." />}
      </div>
      {conditions.pressure ? (
        <PressureTile pressure={conditions.pressure} age={age} />
      ) : (
        <NoFeedTile title="Air pressure" message="No pressure feed for this Spot." />
      )}
      <StatTile>
        <SkyBand sky={skyDay(now, spot.lat, spot.lng)} now={now} />
      </StatTile>
      <WaterTile conditions={conditions} isRiver={spot.kind === "river"} age={age} />
    </div>
  );
}

type Age = (date: Date) => string;

function WeatherTile({ weather, age }: { weather: Weather; age: Age }) {
  const line =
    weather.highC == null || weather.lowC == null
      ? weather.sky
      : `${weather.sky} · H ${fahrenheit(weather.highC)}° L ${fahrenheit(weather.lowC)}°`;
  return (
    <StatTile>
      <TileLabel>Weather</TileLabel>
      <BigValue value={`${fahrenheit(weather.airTempC)}°`} />
      <p className="prep-tile-detail">{line}</p>
      <Source>{`${weather.source} · ${age(weather.observedAt)}`}</Source>
    </StatTile>
  );
}

function WindTile({ weather, age }: { weather: Weather; age: Age }) {
  const calm = weather.windDirection === "";
  return (
    <StatTile>
      <div className="prep-wind-label">
        <TileLabel>Wind</TileLabel>
        {!calm && (
          <Glyph
            name="windDirection"
            size="0.8rem"
            weight={2.6}
            className="prep-wind-arrow"
            style={{ transform: `rotate(${downwindDegrees(weather.windDirection)}deg)` }}
            label={`blowing toward the ${compassName(weather.windDirection)}`}
          />
        )}
      </div>
      <BigValue value={`${roundHalfAway(weather.windMph)}`} unit="mph" />
      <p className="prep-tile-detail">{calm ? "Calm" : `From the ${compassName(weather.windDirection)}`}</p>
      <Source>{`${weather.source} · ${age(weather.observedAt)}`}</Source>
    </StatTile>
  );
}

function PressureTile({ pressure, age }: { pressure: Pressure; age: Age }) {
  const labels = pressureTraceLabels(pressure);
  const station = pressure.station;
  const source = station.code
    ? `${station.name} (${station.code}), ${roundHalfAway(station.distanceMi)} mi away · ${age(pressure.observedAt)}`
    : `${station.name} · ${age(pressure.observedAt)}`;
  return (
    <StatTile>
      <TileHeader title="Air pressure" trailing={labels.window} />
      <BigValue value={inHg(pressure.hpa).toFixed(2)} unit="inHg" />
      <p className="prep-tile-detail prep-trend">{`${pressureTrendWords(pressure)} · ${pressureChangeWords(pressure)}`}</p>
      <PressureChart pressure={pressure} labels={labels} />
      <div className="prep-chart-captions">
        <span>{labels.start}</span>
        <span>{labels.end}</span>
      </div>
      <Source>{source}</Source>
    </StatTile>
  );
}

/** The 3-hour trace in slate, the current reading as a brick point. */
function PressureChart({ pressure, labels }: { pressure: Pressure; labels: PressureTraceLabels }) {
  const series = pressure.series;
  if (series.length === 0) return <div className="prep-chart" aria-label={labels.accessibility} role="img" />;
  const values = series.map((r) => inHg(r.hpa));
  const low = Math.min(...values) - 0.01;
  const high = Math.max(...values) + 0.01;
  const t0 = series[0]!.at.getTime();
  const t1 = series[series.length - 1]!.at.getTime();
  const x = (t: number) => (t1 === t0 ? 50 : ((t - t0) / (t1 - t0)) * 100);
  const y = (v: number) => (1 - (v - low) / (high - low)) * 100;
  const points = series.map((r) => [x(r.at.getTime()), y(inHg(r.hpa))] as const);
  const line = points.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(2)} ${py.toFixed(2)}`).join(" ");
  const area = `${line} L${points[points.length - 1]![0].toFixed(2)} 100 L${points[0]![0].toFixed(2)} 100 Z`;
  const current = labels.currentIsFirst ? points[0]! : points[points.length - 1]!;
  return (
    <div className="prep-chart" role="img" aria-label={labels.accessibility}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d={area} className="prep-chart-area" />
        <path d={line} className="prep-chart-line" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="prep-chart-point" style={{ left: `${current[0]}%`, top: `${current[1]}%` }} />
    </div>
  );
}

/** Dawn to dusk on a track with a Now marker, moon phase and moonrise. */
function SkyBand({ sky, now }: { sky: SkyDay; now: Date }) {
  const dayStart = startOfDay(now).getTime();
  const minutes = (date: Date | null) => (date ? (date.getTime() - dayStart) / 60_000 : null);
  const low = Math.min(5 * 60, (minutes(sky.dawn) ?? 300) - 30);
  const high = Math.max(19 * 60, (minutes(sky.dusk) ?? 1140) + 30);
  const pct = (m: number) => Math.min(Math.max((m - low) / (high - low), 0), 1) * 100;
  const dawn = minutes(sky.dawn);
  const dusk = minutes(sky.dusk);

  const parts: string[] = [];
  if (sky.moonrise) parts.push(`Moonrise ${Format.time(sky.moonrise)}`);
  const nowText = `Now ${Format.time(now)}`;
  if (sky.sunrise && now < sky.sunrise) {
    parts.push(`${nowText}, sunrise in ${Format.drive(Math.trunc((sky.sunrise.getTime() - now.getTime()) / 60_000))}`);
  } else if (sky.sunset && now < sky.sunset) {
    parts.push(`${nowText}, ${Format.drive(Math.trunc((sky.sunset.getTime() - now.getTime()) / 60_000))} of light left`);
  } else {
    parts.push(`${nowText}, after sunset`);
  }

  return (
    <div className="prep-sky">
      <TileHeader title="Sun and moon" trailing={moonDescription(sky)} />
      <div className="prep-sky-track">
        <span className="prep-sky-rail" />
        {dawn !== null && dusk !== null && (
          <span className="prep-sky-day" style={{ left: `${pct(dawn)}%`, width: `${pct(dusk) - pct(dawn)}%` }} />
        )}
        <span
          className="prep-sky-now"
          style={{ left: `${pct(minutes(now) ?? 0)}%` }}
          role="img"
          aria-label={`Now, ${Format.time(now)}`}
        />
      </div>
      <div className="prep-sky-ticks">
        <Tick label="Dawn" date={sky.dawn} />
        <Tick label="Sunrise" date={sky.sunrise} />
        <Tick label="Sunset" date={sky.sunset} end />
        <Tick label="Dusk" date={sky.dusk} end />
      </div>
      <p className="prep-tile-detail">{parts.join(" · ")}</p>
    </div>
  );
}

function Tick({ label, date, end }: { label: string; date: Date | null; end?: boolean }) {
  return (
    <div className={end ? "prep-sky-tick prep-sky-tick-end" : "prep-sky-tick"}>
      <span className="prep-sky-tick-label">{label}</span>
      <span className="prep-sky-tick-time">{date ? Format.shortTime(date) : "—"}</span>
    </div>
  );
}

/** Lake level (lakes, reservoirs, ponds) or river flow (rivers), plus water temperature. */
function WaterTile({ conditions, isRiver, age }: { conditions: Conditions; isRiver: boolean; age: Age }) {
  const level = conditions.lakeLevel ?? null;
  const flow = conditions.flow ?? null;
  const temp = conditions.waterTemp ?? null;
  if ((isRiver ? flow === null : level === null) && temp === null) {
    return (
      <NoFeedTile
        title={isRiver ? "River flow and water temperature" : "Lake level and water temperature"}
        message={
          isRiver
            ? "No flow feed for this Spot. No water temperature for this Spot."
            : "No level feed for this Spot. No water temperature for this Spot."
        }
      />
    );
  }
  const sources: string[] = [];
  if (isRiver && flow) sources.push(`${flow.source} · ${age(flow.observedAt)}`);
  if (!isRiver && level) sources.push(`${level.source} · ${age(level.observedAt)}`);
  if (temp && !sources.some((s) => s.startsWith(temp.source))) sources.push(`${temp.source} · ${age(temp.observedAt)}`);
  const trailing = isRiver ? (flow ? flowTrend(flow) : null) : levelTrailing(level);
  return (
    <StatTile>
      <TileHeader title={isRiver ? "River" : "Lake level"} trailing={trailing} />
      <div className="prep-water-values">
        {isRiver ? (
          <WaterValue value={flow ? `${roundHalfAway(flow.cfs)}` : null} unit="cfs" caption={flow ? "Flow" : "No flow feed"} />
        ) : (
          <WaterValue value={level ? level.ft.toFixed(1) : null} unit="ft" caption={level ? "Elevation" : "No level feed"} />
        )}
        <WaterValue
          value={temp ? `${fahrenheit(temp.c)}°` : null}
          caption={temp ? "Water temp" : "No water temperature"}
        />
      </div>
      {sources.map((s) => (
        <Source key={s}>{s}</Source>
      ))}
    </StatTile>
  );
}

function WaterValue({ value, unit, caption }: { value: string | null; unit?: string; caption: string }) {
  return (
    <div className="prep-water-value">
      {value === null ? <BigValue value="—" dimmed /> : <BigValue value={value} unit={unit} />}
      <span className={value === null ? "prep-water-caption prep-dim" : "prep-water-caption"}>{caption}</span>
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

function levelTrailing(level: LakeLevel | null): string | null {
  if (level?.change24hFt == null) return null;
  const change = roundHalfAway(level.change24hFt * 100) / 100;
  if (change === 0) return "Steady, 24 hr";
  return `${change > 0 ? "+" : ""}${change.toFixed(2)} ft in 24 hr`;
}

// ---------- Tile pieces ----------

function StatTile({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card padding={16} className={className ? `prep-tile ${className}` : "prep-tile"}>
      {children}
    </Card>
  );
}

/** A reading with no feed stays in place, dimmed, saying so. */
function NoFeedTile({ title, message }: { title: string; message: string }) {
  return (
    <StatTile className="prep-tile-nofeed">
      <TileLabel>{title}</TileLabel>
      <BigValue value="—" dimmed />
      <p className="prep-tile-detail prep-secondary">{message}</p>
    </StatTile>
  );
}

function TileLabel({ children }: { children: ReactNode }) {
  return <span className="prep-tile-label">{children}</span>;
}

function TileHeader({ title, trailing }: { title: string; trailing?: string | null }) {
  return (
    <div className="prep-tile-header">
      <TileLabel>{title}</TileLabel>
      {trailing && <TileLabel>{trailing}</TileLabel>}
    </div>
  );
}

function BigValue({ value, unit, dimmed }: { value: string; unit?: string; dimmed?: boolean }) {
  return (
    <div className={dimmed ? "prep-big prep-dim" : "prep-big"}>
      <span className="prep-big-value">{value}</span>
      {unit && <span className="prep-big-unit">{unit}</span>}
    </div>
  );
}

function Source({ children }: { children: ReactNode }) {
  return <p className="prep-source">{children}</p>;
}
