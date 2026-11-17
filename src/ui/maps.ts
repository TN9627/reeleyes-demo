import type { SpotSummary } from '../data/types'

/** CARTO basemaps (no key): Voyager in light, Dark Matter in dark, like MapKit's muted snapshots per appearance. */
export function tileTemplate(scheme: 'light' | 'dark'): string {
  const style = scheme === 'dark' ? 'dark_all' : 'rastertiles/voyager'
  return `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`
}

export const tileSubdomains = ['a', 'b', 'c', 'd']

export const tileAttributionHTML =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>'

/**
 * The map's span in meters (MapSnapshotView / SpotHeroMap): ponds are small, community lakes
 * mid-sized, rivers and lakes need room. `thumbnail` for the 52pt rows, `hero` for the Spot's map.
 */
export function mapSpan(spot: Pick<SpotSummary, 'kind' | 'communityClass'>, use: 'thumbnail' | 'hero'): number {
  const communityLake = spot.kind === 'community_pond' && spot.communityClass === 'lake'
  const [pond, lake, river, big] = use === 'thumbnail' ? [900, 2200, 6000, 7000] : [1400, 3500, 9000, 11000]
  switch (spot.kind) {
    case 'community_pond':
      return communityLake ? lake : pond
    case 'river':
      return river
    case 'lake':
    case 'reservoir':
      return big
  }
}

/** The (fractional) web-mercator zoom at which `meters` spans `pixels` at `lat`. */
export function zoomFor(meters: number, pixels: number, lat: number): number {
  const metersPerPixel = meters / pixels
  return Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180)) / metersPerPixel)
}
