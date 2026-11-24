# ReelEyes demo

An installable web version (PWA) of ReelEyes, the Arizona fishing-trip planner, for live demos. Open it on any phone, iPhone or Android, and use it. Add it to the home screen and it runs full screen and offline.

**Live:** https://tn9627.github.io/reeleyes-demo/

It recreates the native SwiftUI app's flow (Welcome, Today, Spot, Prep, Saved, License) on the app's bundled sample data, with **live weather from [Open-Meteo](https://open-meteo.com/)**. Everything else (Spots, stocking, water, drive times) is sample data and made up. There is no backend and no sign-in: favorites stay on the phone.

What differs from the iOS app:

- Drive times come from a sample table for Phoenix, Tempe, Tucson, Flagstaff and Yuma; the iOS app computes them with Apple Maps on the device. A browser location uses the nearest of those cities.
- Weather is live from Open-Meteo (free for non-commercial use, no key; the browser asks it directly): the current hour, five days of hourly forecasts and the day's high and low, for the Spot's point. Each Spot's answer is cached for 30 minutes in memory and `localStorage`, and Refresh skips the cache. If Open-Meteo can't be reached within 8 seconds, Prep shows the time-shifted sample weather with the note "Live weather unavailable, showing sample weather".
- Air pressure is Open-Meteo's sea-level model forecast (`pressure_msl`) for the Spot, so Prep and Verdict treat it as a forecast, not a reading: the real app prefers a measured weather-station reading and says which station and how far away. The forecast text comes from WMO weather codes mapped to NWS-style words.
- NWS alerts are not checked (Open-Meteo has none), so Prep shows its "Couldn't check NWS alerts" note and no alerts. Water temperature, lake level and river flow stay sample data.
- Maps are Esri basemap tiles (OpenStreetMap and other data) instead of Apple Maps.
- Icons stand in for SF Symbols, which can't ship on the web.

## Run it

```sh
bun install
bun run dev        # http://localhost:5173, and on your LAN (Vite prints the Network URL)
```

Share the dev server with anyone, anywhere, like Expo Go's tunnel (free, no account):

```sh
cloudflared tunnel --url http://localhost:5173
```

It prints a `https://<random>.trycloudflare.com` link. The link changes every run.

## Deploy

```sh
bin/deploy         # builds, then publishes dist/ to the gh-pages branch
```

## Credits

Weather data by [Open-Meteo.com](https://open-meteo.com/), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Spot photos are from Wikimedia Commons under the licenses named in the photo viewer, with each author credited there. Map tiles © Esri, HERE, Garmin, © OpenStreetMap contributors. Species artwork and the app icon belong to the ReelEyes project.
