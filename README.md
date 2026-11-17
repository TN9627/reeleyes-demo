# ReelEyes demo

An installable web version (PWA) of ReelEyes, the Arizona fishing-trip planner, for live demos. Open it on any phone, iPhone or Android, and use it. Add it to the home screen and it runs full screen and offline.

**Live:** https://tn9627.github.io/reeleyes-demo/

It recreates the native SwiftUI app's flow (Welcome, Today, Spot, Prep, Saved, License) on the app's bundled sample data. **Sample data: every value is made up.** There is no backend and no sign-in: favorites stay on the phone.

What differs from the iOS app:

- Drive times come from a sample table for Phoenix, Tempe, Tucson, Flagstaff and Yuma; the iOS app computes them with Apple Maps on the device. A browser location uses the nearest of those cities.
- Maps are OpenStreetMap data with CARTO tiles instead of Apple Maps.
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

Spot photos are from Wikimedia Commons under the licenses named in the photo viewer, with each author credited there. Map data © OpenStreetMap contributors, tiles © CARTO. Species artwork and the app icon belong to the ReelEyes project.
