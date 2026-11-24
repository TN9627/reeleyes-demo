// Live weather from Open-Meteo (https://open-meteo.com/, CC BY 4.0, free for non-commercial use, no key).
// The browser asks Open-Meteo directly for the Spot's point and this file builds the weather parts of
// `Conditions` (weather, hourly, pressure, pressureForecast) from the answer. Water, lake level and flow
// stay sample data; alerts are null (Open-Meteo has none).
//
// Units: the types want °C, hPa and mph, so the request leaves temperature and pressure at Open-Meteo's
// defaults (°C, hPa) and asks wind in mph. Times come as unix seconds so no local-time string is parsed.
// Pressure is `pressure_msl` (sea level, like MET Norway in the real app): a model value with no station.

import { startDate, addingDays, localDayFromDate } from "../logic/localDay";
import { PressureWords } from "../logic/freshness";
import type { Conditions, HourlyPeriod, Pressure, PressureReading, PressureTrend, Weather } from "./types";

export const OPEN_METEO_SOURCE = "Open-Meteo";
export const OPEN_METEO_URL = "https://open-meteo.com/";
export const OPEN_METEO_CREDIT = "Weather data by Open-Meteo.com";
export const OPEN_METEO_LICENSE = "CC BY 4.0";

export const FALLBACK_NOTE = "Live weather unavailable, showing sample weather";

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const TIMEOUT_MS = 8_000;
const CACHE_MS = 30 * 60 * 1000;
const CACHE_PREFIX = "reeleyes.open-meteo.v1:";
const HOUR_MS = 3_600_000;
const HOUR_FIELDS = [
  "temperature_2m",
  "relative_humidity_2m",
  "dew_point_2m",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "pressure_msl",
  "precipitation_probability",
  "cloud_cover",
  "weather_code",
  "is_day",
] as const;
type HourField = (typeof HOUR_FIELDS)[number];

/** The parts of Open-Meteo's answer this file reads. Values are null where the model has none. */
export interface OpenMeteoResponse {
  hourly: { time: number[] } & Record<HourField, (number | null)[]>;
  daily: { time: number[]; temperature_2m_max: (number | null)[]; temperature_2m_min: (number | null)[] };
}

export interface CacheEntry {
  savedAt: number;
  response: OpenMeteoResponse;
}

const memory = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CacheEntry>>();

const cacheKey = (lat: number, lng: number) => `${CACHE_PREFIX}${lat.toFixed(3)},${lng.toFixed(3)}`;

function isValid(r: unknown): r is OpenMeteoResponse {
  const x = r as Partial<OpenMeteoResponse> | null;
  if (!x?.hourly || !x.daily || !Array.isArray(x.hourly.time) || !Array.isArray(x.daily.time)) return false;
  const n = x.hourly.time.length;
  const hourly = x.hourly as Record<string, unknown>;
  return (
    n > 0 &&
    HOUR_FIELDS.every((f) => Array.isArray(hourly[f]) && (hourly[f] as unknown[]).length === n) &&
    Array.isArray(x.daily.temperature_2m_max) &&
    Array.isArray(x.daily.temperature_2m_min)
  );
}

function readStored(key: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    return typeof entry.savedAt === "number" && isValid(entry.response) ? entry : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, entry: CacheEntry) {
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Storage full or blocked: the in-memory copy still serves this session.
  }
}

/** The request URL for a point: yesterday (for the 3-hour pressure change at midnight) through 5 days ahead. */
export function requestUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    hourly: HOUR_FIELDS.join(","),
    daily: "temperature_2m_max,temperature_2m_min",
    past_days: "1",
    forecast_days: "6",
    timezone: "America/Phoenix",
    timeformat: "unixtime",
    wind_speed_unit: "mph",
  });
  return `${ENDPOINT}?${params}`;
}

async function download(key: string, lat: number, lng: number): Promise<CacheEntry> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await globalThis.fetch(requestUrl(lat, lng), { signal: controller.signal });
    if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`);
    const response: unknown = await res.json();
    if (!isValid(response)) throw new Error("Open-Meteo answered with an unexpected shape");
    const entry = { savedAt: Date.now(), response };
    memory.set(key, entry);
    writeStored(key, entry);
    return entry;
  } finally {
    clearTimeout(timer);
  }
}

/** The Spot's Open-Meteo answer: cached in memory and localStorage for 30 minutes, else downloaded (8 s limit). Throws on failure. */
export async function weatherFor(lat: number, lng: number, force = false): Promise<CacheEntry> {
  const key = cacheKey(lat, lng);
  if (!force) {
    const cached = memory.get(key) ?? readStored(key);
    if (cached && Date.now() - cached.savedAt < CACHE_MS) {
      memory.set(key, cached);
      return cached;
    }
  }
  let pending = inFlight.get(key);
  if (!pending) {
    pending = download(key, lat, lng).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}

// ---------- WMO weather codes → NWS-style short forecast words ----------

/**
 * NWS's words for a WMO code, since the logic reads those words: "Thunderstorm" for the storm hazard, "Rain",
 * "Showers" or "Drizzle" for the hero's rain icon. Clear and partly cloudy follow NWS's day and night names.
 * Cloud cover (not these words) decides "Cloudy" on the hero.
 */
export function shortForecast(code: number, isDay: boolean): string {
  switch (code) {
    case 0:
      return isDay ? "Sunny" : "Clear";
    case 1:
      return isDay ? "Mostly Sunny" : "Mostly Clear";
    case 2:
      return isDay ? "Partly Sunny" : "Partly Cloudy";
    case 3:
      return "Cloudy";
    case 45:
    case 48:
      return "Fog";
    case 51:
    case 53:
    case 55:
      return "Drizzle";
    case 56:
    case 57:
      return "Freezing Drizzle";
    case 61:
      return "Light Rain";
    case 63:
      return "Rain";
    case 65:
      return "Heavy Rain";
    case 66:
    case 67:
      return "Freezing Rain";
    case 71:
    case 77:
      return "Light Snow";
    case 73:
      return "Snow";
    case 75:
      return "Heavy Snow";
    case 80:
    case 81:
      return "Rain Showers";
    case 82:
      return "Heavy Rain Showers";
    case 85:
      return "Snow Showers";
    case 86:
      return "Heavy Snow Showers";
    case 95:
      return "Thunderstorms";
    case 96:
    case 99:
      return "Thunderstorms And Hail";
    default:
      return "Cloudy";
  }
}

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

/** Degrees the wind blows from → N, NNE, … */
export function compassPoint(degrees: number): string {
  return POINTS[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16]!;
}

// ---------- Open-Meteo → Conditions ----------

function trendOf(changeHpa: number): PressureTrend {
  const d = PressureWords.direction(PressureWords.changeInHgFromHpa(changeHpa));
  return d === "Steady" ? "steady" : d === "Falling" ? "falling" : "rising";
}

/**
 * The sample conditions with their weather parts replaced by Open-Meteo's, read at `now`. Null when the answer
 * has no hour at or before `now` with a temperature (the caller falls back to the sample).
 */
export function conditionsFromOpenMeteo(raw: OpenMeteoResponse, sample: Conditions, now: Date, fetchedAt: Date): Conditions | null {
  const { hourly, daily } = raw;
  const nowSec = now.getTime() / 1000;
  const today = localDayFromDate(now);
  const midnight = startDate(today).getTime() / 1000;
  const end = startDate(addingDays(today, 5)).getTime() / 1000;
  const at = (field: HourField, i: number) => hourly[field][i] ?? null;

  let current = -1;
  for (let i = 0; i < hourly.time.length; i++) if (hourly.time[i]! <= nowSec) current = i;
  if (current < 0 || at("temperature_2m", current) === null) return null;

  const periods: HourlyPeriod[] = [];
  for (let i = 0; i < hourly.time.length; i++) {
    const t = hourly.time[i]!;
    const temp = at("temperature_2m", i);
    if (t < midnight || t >= end || temp === null) continue;
    periods.push({
      startTime: new Date(t * 1000),
      endTime: new Date(t * 1000 + HOUR_MS),
      tempC: temp,
      relativeHumidity: at("relative_humidity_2m", i),
      dewpointC: at("dew_point_2m", i),
      windMph: at("wind_speed_10m", i) ?? 0,
      windDirection: compassPoint(at("wind_direction_10m", i) ?? 0),
      precipitationChance: at("precipitation_probability", i),
      shortForecast: shortForecast(at("weather_code", i) ?? 3, at("is_day", i) !== 0),
      gustMph: at("wind_gusts_10m", i),
      cloudCoverPct: at("cloud_cover", i),
    });
  }

  const observedAt = new Date(hourly.time[current]! * 1000);
  const dayIndex = daily.time.indexOf(midnight);
  const weather: Weather = {
    airTempC: at("temperature_2m", current)!,
    highC: dayIndex >= 0 ? daily.temperature_2m_max[dayIndex] : null,
    lowC: dayIndex >= 0 ? daily.temperature_2m_min[dayIndex] : null,
    sky: shortForecast(at("weather_code", current) ?? 3, at("is_day", current) !== 0),
    windMph: at("wind_speed_10m", current) ?? 0,
    windDirection: compassPoint(at("wind_direction_10m", current) ?? 0),
    observedAt,
    source: OPEN_METEO_SOURCE,
    gridPoint: null,
    gustMph: at("wind_gusts_10m", current),
    cloudCoverPct: at("cloud_cover", current),
  };

  const forecastSeries: PressureReading[] = [];
  const sinceMidnight: PressureReading[] = [];
  for (let i = 0; i < hourly.time.length; i++) {
    const t = hourly.time[i]!;
    const hpa = at("pressure_msl", i);
    if (hpa === null || t < midnight || t >= end) continue;
    const reading = { at: new Date(t * 1000), hpa };
    forecastSeries.push(reading);
    if (i <= current) sinceMidnight.push(reading);
  }
  const hpaNow = at("pressure_msl", current);
  const hpaBefore = current >= 3 ? at("pressure_msl", current - 3) : null;
  let pressure: Pressure | null = null;
  if (hpaNow !== null && hpaBefore !== null) {
    const change = hpaNow - hpaBefore;
    pressure = {
      hpa: hpaNow,
      trend: trendOf(change),
      change3hHpa: change,
      series: sinceMidnight,
      // A model forecast for the Spot's point: no station code, so the app reads it as "forecast, not a reading".
      station: { name: "Open-Meteo model forecast", code: null, distanceMi: 0 },
      observedAt,
      source: OPEN_METEO_SOURCE,
    };
  }

  return {
    ...sample,
    fetchedAt,
    refreshFailed: false,
    weather,
    pressure,
    hourly: { updatedAt: fetchedAt, source: OPEN_METEO_SOURCE, periods },
    pressureForecast: forecastSeries.length ? { source: OPEN_METEO_SOURCE, updatedAt: fetchedAt, series: forecastSeries } : null,
    alerts: null,
  };
}
