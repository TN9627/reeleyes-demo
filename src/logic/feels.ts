// Port of Logic/Feels.swift: what an hour feels like, from the hourly forecast: the heat index for the
// heat cut and the wind chill for the cold cut, both NWS formulas in °F.

import { roundHalfAway } from "./spotFacts";

export const Feels = {
  /** NWS heat index °F (Steadman's simple formula, else the Rothfusz regression with its adjustments). */
  heatIndex(t: number, rh: number): number {
    const simple = 0.5 * (t + 61 + (t - 68) * 1.2 + rh * 0.094);
    if ((simple + t) / 2 < 80) return simple;
    let hi = -42.379 + 2.04901523 * t + 10.14333127 * rh - 0.22475541 * t * rh - 0.00683783 * t * t;
    hi += -0.05481717 * rh * rh + 0.00122874 * t * t * rh + 0.00085282 * t * rh * rh - 0.00000199 * t * t * rh * rh;
    if (rh < 13 && t >= 80 && t <= 112) {
      hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
    } else if (rh > 85 && t >= 80 && t <= 87) {
      hi += ((rh - 85) / 10) * ((87 - t) / 5);
    }
    return hi;
  },
  /** What the heat cut compares: max(air, heat index). Without humidity, the air temperature. */
  heatF(airF: number, humidity: number | null | undefined): number {
    if (humidity == null) return airF;
    return Math.max(airF, Feels.heatIndex(airF, humidity));
  },
  /** NWS wind chill °F when T ≤ 50°F and V > 3 mph; else T. */
  windChill(t: number, v: number): number {
    if (!(t <= 50 && v > 3)) return t;
    const power = Math.pow(v, 0.16);
    return 35.74 + 0.6215 * t - 35.75 * power + 0.4275 * t * power;
  },
  /** °C from the API back to the forecast's °F, rounded to 0.1 so 39.44 → 103.0. */
  fahrenheit(celsius: number): number {
    return roundHalfAway(((celsius * 9) / 5 + 32) * 10) / 10;
  },
  /** JavaScript's `Math.round`: halves go up (−14.5 → −14). */
  whole(value: number): number {
    return Math.floor(value + 0.5);
  },
};
