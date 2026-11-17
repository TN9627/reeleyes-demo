import type { SpotSummary } from '../data/types'

/**
 * Esri's keyless basemaps (CARTO's now watermark every tile without an API key): World Street
 * Map in light, muted further in CSS, and Dark Gray Canvas in dark, like MapKit's muted
 * snapshots per appearance. 256px tiles addressed {z}/{y}/{x}.
 */
export function tileTemplate(scheme: 'light' | 'dark'): string {
  const service = scheme === 'dark' ? 'Canvas/World_Dark_Gray_Base' : 'World_Street_Map'
  return `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`
}

/** The deepest zoom each basemap draws; deeper views scale its tiles up. */
export function maxTileZoom(scheme: 'light' | 'dark'): number {
  return scheme === 'dark' ? 16 : 19
}

export const tileAttributionHTML =
  'Tiles © <a href="https://www.esri.com" target="_blank" rel="noreferrer">Esri</a>, HERE, Garmin, © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'

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
