import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { useColorScheme } from './colorScheme'
import { tileAttributionHTML, tileSubdomains, tileTemplate, zoomFor } from './maps'

export interface SpotMapProps {
  lat: number
  lng: number
  /** Meters the map spans vertically at rest (see `mapSpan(spot, 'hero')`). */
  meters: number
  /** Pan and pinch-zoom (no rotation). Static otherwise; going static recentres it. */
  interactive: boolean
  /** The Spot's pin: an 8pt-radius brick dot with a 3pt card-colored ring. */
  pin?: boolean
  /** Tiles couldn't load (offline and not cached): the screen shows "Map unavailable". */
  onFailure?: () => void
  className?: string
}

/** A live map centred on a Spot (SpotHeroMap), on Map Land, with OpenStreetMap and CARTO credited. */
export function SpotMap({ lat, lng, meters, interactive, pin = true, onFailure, className }: SpotMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.TileLayer | null>(null)
  const scheme = useColorScheme()
  const onFailureRef = useRef(onFailure)
  onFailureRef.current = onFailure

  const zoomForContainer = () => zoomFor(meters, containerRef.current?.clientHeight || 300, lat)

  useEffect(() => {
    const map = L.map(containerRef.current!, {
      center: [lat, lng],
      zoom: zoomForContainer(),
      zoomSnap: 0,
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      scrollWheelZoom: false,
      boxZoom: false,
      keyboard: false,
      inertia: true,
    })
    map.attributionControl.setPrefix(false)
    if (pin) {
      L.marker([lat, lng], {
        icon: L.divIcon({ className: 'spot-pin-marker', html: '<span class="spot-pin"></span>', iconSize: [19, 19] }),
        interactive: false,
        keyboard: false,
      }).addTo(map)
    }
    mapRef.current = map
    const resize = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    resize.observe(containerRef.current!)
    return () => {
      resize.disconnect()
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
    // The map is made once per Spot; later prop changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, pin])

  // Tiles follow the appearance.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    layerRef.current?.remove()
    let loadedAny = false
    let errors = 0
    const layer = L.tileLayer(tileTemplate(scheme), {
      subdomains: tileSubdomains,
      maxZoom: 19,
      detectRetina: false,
      attribution: tileAttributionHTML,
    })
    layer.on('tileload', () => {
      loadedAny = true
    })
    layer.on('tileerror', () => {
      errors += 1
    })
    layer.on('load', () => {
      if (!loadedAny && errors > 0) onFailureRef.current?.()
    })
    layer.addTo(map)
    layerRef.current = layer
  }, [scheme, lat, lng, pin])

  // Interactive while expanded; recentred when it goes static again.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const handlers = [map.dragging, map.touchZoom, map.doubleClickZoom, map.scrollWheelZoom, map.boxZoom, map.keyboard]
    for (const handler of handlers) {
      if (interactive) handler.enable()
      else handler.disable()
    }
    if (!interactive) map.setView([lat, lng], zoomForContainer(), { animate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, lat, lng])

  return <div ref={containerRef} className={`spot-map ${interactive ? 'is-interactive' : ''} ${className ?? ''}`} />
}
