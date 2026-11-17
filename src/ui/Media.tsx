import { useState, type CSSProperties } from 'react'
import type { SpotSummary } from '../data/types'
import type { SpotMetaLine } from '../logic/todayLayout'
import { useColorScheme } from './colorScheme'
import { Glyph } from './Glyph'
import { photoURL, speciesImageURL } from './images'
import { mapSpan, tileSubdomains, tileTemplate, zoomFor } from './maps'
import { DriveTimeText } from './Surfaces'

export interface MapThumbProps {
  lat: number
  lng: number
  /** Meters the map spans vertically (see `mapSpan`). */
  meters: number
  width: number
  height: number
  /** The Spot's pin, as on the hero map; off for row thumbnails. */
  pin?: boolean
  className?: string
  style?: CSSProperties
}

/**
 * A static map: raster tiles stitched around a point on Map Land, fading in as they load
 * (MapSnapshotView). Decorative; attribution belongs to the screen that shows maps.
 */
export function MapThumb({ lat, lng, meters, width, height, pin, className, style }: MapThumbProps) {
  const scheme = useColorScheme()
  const zoom = Math.min(zoomFor(meters, height, lat), 18)
  const z = Math.floor(zoom)
  const scale = 2 ** (zoom - z)
  const tile = 256 * scale
  const worldPx = 256 * 2 ** z
  const sinLat = Math.sin((lat * Math.PI) / 180)
  const cx = ((lng + 180) / 360) * worldPx * scale
  const cy = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * worldPx * scale
  const left = cx - width / 2
  const top = cy - height / 2
  const template = tileTemplate(scheme).replace('{r}', '@2x')
  const tiles = []
  for (let x = Math.floor(left / tile); x <= Math.floor((left + width) / tile); x++) {
    for (let y = Math.floor(top / tile); y <= Math.floor((top + height) / tile); y++) {
      const s = tileSubdomains[(x + y) % tileSubdomains.length]!
      const src = template.replace('{s}', s).replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
      tiles.push(<MapTile key={src} src={src} left={x * tile - left} top={y * tile - top} size={tile} />)
    }
  }
  return (
    <div className={`map-thumb ${className ?? ''}`} style={{ width, height, ...style }} aria-hidden="true">
      {tiles}
      {pin && <span className="spot-pin" style={{ left: width / 2, top: height / 2 }} />}
    </div>
  )
}

function MapTile({ src, left, top, size }: { src: string; left: number; top: number; size: number }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <img
      className={`map-tile ${loaded ? 'is-loaded' : ''}`}
      src={src}
      alt=""
      draggable={false}
      style={{ left, top, width: size + 0.5, height: size + 0.5 }}
      onLoad={() => setLoaded(true)}
      ref={(img) => {
        if (img?.complete && img.naturalWidth > 0 && !loaded) setLoaded(true)
      }}
    />
  )
}

/**
 * The 52pt row thumbnail: the Spot's map until its first photo's thumbnail arrives, which
 * fades in over it (at once when already loaded); the map stays when the photo fails.
 */
export function SpotThumb({ spot, size = 52 }: { spot: SpotSummary; size?: number }) {
  const [photo, setPhoto] = useState<'loading' | 'shown' | 'failed'>('loading')
  return (
    <div className="spot-thumb" style={{ width: size, height: size }}>
      <MapThumb lat={spot.lat} lng={spot.lng} meters={mapSpan(spot, 'thumbnail')} width={size} height={size} />
      {spot.photo && photo !== 'failed' && (
        <img
          className={`spot-thumb-photo ${photo === 'shown' ? 'is-loaded' : ''}`}
          src={photoURL(spot.photo, { thumbnail: true })}
          alt=""
          draggable={false}
          onLoad={() => setPhoto('shown')}
          onError={() => setPhoto('failed')}
          ref={(img) => {
            if (img?.complete && img.naturalWidth > 0 && photo === 'loading') setPhoto('shown')
          }}
        />
      )}
    </div>
  )
}

export interface SpeciesImageProps {
  slug: string
  /** Slot height in px. */
  height: number
  /** Slot width; full width when omitted. */
  width?: number
  /** The fish glyph's size while loading, on failure or with no picture. */
  symbolSize?: number
  /** The 64×32pt file, for slots that small (row thumbnails, chips). */
  thumbnail?: boolean
  /** Accessible name; decorative when omitted. */
  label?: string
}

/** A species picture in a fixed slot; the fish glyph holds the slot until it loads or if it can't. */
export function SpeciesImage({ slug, height, width, symbolSize = 20, thumbnail, label }: SpeciesImageProps) {
  const [state, setState] = useState<'loading' | 'shown' | 'failed'>('loading')
  return (
    <span className="species-image" style={{ height, width: width ?? '100%' }}>
      {state !== 'shown' && <Glyph name="species" size={symbolSize} className="c-ink-tertiary" />}
      {state !== 'failed' && (
        <img
          src={speciesImageURL(slug, { thumbnail })}
          alt={label ?? ''}
          aria-hidden={label ? undefined : true}
          draggable={false}
          className={state === 'shown' ? 'is-loaded' : ''}
          onLoad={() => setState('shown')}
          onError={() => setState('failed')}
          ref={(img) => {
            if (img?.complete && img.naturalWidth > 0 && state === 'loading') setState('shown')
          }}
        />
      )}
    </span>
  )
}

export interface SpotRowProps {
  spot: SpotSummary
  /** `spotMetaLine(...)` from logic/todayLayout (Today's rows carry it already). */
  meta: SpotMetaLine
  /** Trailing drive time; while unknown, `distanceMi` shows as "~18 mi". */
  driveMinutes: number | null
  distanceMi?: number
  onClick: () => void
}

/** The Recommendation's unit: thumbnail, name, one meta line, drive time trailing. */
export function SpotRow({ spot, meta, driveMinutes, distanceMi, onClick }: SpotRowProps) {
  return (
    <button type="button" className="row is-tappable spot-row" onClick={onClick}>
      <SpotThumb spot={spot} />
      <span className="spot-row-text">
        <span className="t-headline c-ink">{spot.name}</span>
        <span className="t-subheadline truncate spot-row-meta">
          <span className="c-ink-secondary">{meta.kind}</span>
          {meta.detail && (
            <>
              <span className="c-ink-secondary"> · </span>
              {meta.isRecentStocking ? (
                <span className="c-data-ink semibold">
                  <Glyph name="stocked" size="1.15em" weight={2.1} className="spot-row-stocked" /> {meta.detail}
                </span>
              ) : (
                <span className="c-ink-secondary">{meta.detail}</span>
              )}
            </>
          )}
        </span>
      </span>
      {driveMinutes !== null ? (
        <DriveTimeText minutes={driveMinutes} />
      ) : (
        distanceMi !== undefined && (
          <span className="t-subheadline c-ink-secondary" aria-label={`About ${Math.round(distanceMi)} miles away, drive time pending`}>
            ~{Math.round(distanceMi)} mi
          </span>
        )
      )}
    </button>
  )
}
