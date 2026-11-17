import type { Photo } from '../data/types'

const base = `${import.meta.env.BASE_URL}images/`

/**
 * A Spot photo's bundled file: key `spots/<azgfdId>/<n>` → `images/spots/<azgfdId>/<n>@2x.jpg`,
 * or the 52pt-row thumbnail `<n>-thumb@2x.jpg`. Keys under `spots/0` have no file (the failed-photo state).
 */
export function photoURL(photo: Pick<Photo, 'key'>, options: { thumbnail?: boolean } = {}): string {
  return `${base}${photo.key}${options.thumbnail ? '-thumb' : ''}@2x.jpg`
}

/** A species picture: `images/species/<slug>@2x.png`, or the 64×32pt thumbnail. */
export function speciesImageURL(slug: string, options: { thumbnail?: boolean } = {}): string {
  return `${base}species/${slug}${options.thumbnail ? '-thumb' : ''}@2x.png`
}
