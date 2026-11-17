/**
 * App state for the demo, persisted in localStorage (one JSON blob, "reeleyes.state.v1").
 * Mirrors StartPointStore, TodayModel, SessionModel and the Appearance menu in the iOS app,
 * Guest-only: favorites live on the device, there is no sign-in.
 *
 * Read (React):
 *   const state = useAppState()                 // whole AppState, re-renders on any change
 *   const range = useAppState((s) => s.rangeMinutes)  // selector form, re-renders when it changes
 *   const online = useOnline()                  // navigator.onLine, live
 *   getAppState()                               // outside React
 *
 * Write (plain functions, call from handlers):
 *   finishWelcome()                       Welcome done ("Not now" or after a start was picked)
 *   setStart(start)                       switch the start; resets "show farther"
 *   choosePlace(place)                    a typed/suggested Place becomes a typed start
 *   locateStart(): Promise<boolean>       explicit tap only: asks for browser location, starts from it
 *                                         (outside Arizona it snaps to the nearest sample place); false when
 *                                         refused or unavailable; `location.error` says why (null when refused)
 *   clearStartError()                     the Starting point sheet clears the last error on open
 *   saveAsHome()                          the current typed start becomes Home
 *   setRange(minutes)                     one of DriveRange.options
 *   setFilters(patch | (f) => f)          fish chip and the four toggles
 *   resetToggles()                        Filters sheet's Reset: keeps the fish chip
 *   setShowFarther(bool)                  "Show N farther" on Today (memory only)
 *   toggleFavorite(spotId)                heart on a Spot; newest first in favoriteIds
 *   isFavorite(spotId)
 *   setAppearance('system' | 'light' | 'dark')
 *   resetToFirstLaunch()
 */

import { useSyncExternalStore } from 'react'
import { cityName, nearestPlace } from '../data/repository'
import type { Coordinate, Place } from '../data/types'
import { emptyFilters, type SpotFilters } from '../logic/todayLayout'

export type { SpotFilters }

/** Where the Angler starts: device location or a typed Arizona city or ZIP. */
export interface StartPoint {
  label: string
  zip: string | null
  coordinate: Coordinate
  source: 'currentLocation' | 'typed'
}

export type Appearance = 'system' | 'light' | 'dark'

export const appearanceTitles: Record<Appearance, string> = { system: 'System', light: 'Light', dark: 'Dark' }

/** Drive-time ranges the Angler can pick; 2 hours by default. */
export const DriveRange = { options: [30, 60, 120, 180, 240], defaultMinutes: 120 } as const

export type LocationPermission = 'notDetermined' | 'allowed' | 'denied'

export interface AppState {
  /** The Angler has been past Welcome (or already has a start). */
  welcomed: boolean
  start: StartPoint | null
  home: StartPoint | null
  rangeMinutes: number
  filters: SpotFilters
  /** Today's "Show N farther"; not persisted, reset by a new start or range. */
  showFarther: boolean
  /** Saved Spot ids, newest first. */
  favoriteIds: number[]
  appearance: Appearance
  location: {
    permission: LocationPermission
    /** A fix is on its way. */
    isLocating: boolean
    /** Why the last start attempt failed, for the start prompt and sheet. */
    error: string | null
  }
}

const storageKey = 'reeleyes.state.v1'

type Persisted = Pick<AppState, 'welcomed' | 'start' | 'home' | 'rangeMinutes' | 'filters' | 'favoriteIds' | 'appearance'>

function initialState(): AppState {
  return {
    welcomed: false,
    start: null,
    home: null,
    rangeMinutes: DriveRange.defaultMinutes,
    filters: emptyFilters(),
    showFarther: false,
    favoriteIds: [],
    appearance: 'system',
    location: { permission: 'notDetermined', isLocating: false, error: null },
  }
}

function load(): AppState {
  const state = initialState()
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return state
    const saved = JSON.parse(raw) as Partial<Persisted>
    const range = (DriveRange.options as readonly number[]).includes(saved.rangeMinutes ?? -1)
      ? (saved.rangeMinutes as number)
      : DriveRange.defaultMinutes
    return {
      ...state,
      welcomed: saved.welcomed === true || saved.start != null,
      start: saved.start ?? null,
      home: saved.home ?? null,
      rangeMinutes: range,
      filters: { ...emptyFilters(), ...saved.filters },
      favoriteIds: Array.isArray(saved.favoriteIds) ? saved.favoriteIds.filter((id) => typeof id === 'number') : [],
      appearance: saved.appearance === 'light' || saved.appearance === 'dark' ? saved.appearance : 'system',
    }
  } catch {
    return state
  }
}

let state: AppState = load()
const listeners = new Set<() => void>()

function persist() {
  const { welcomed, start, home, rangeMinutes, filters, favoriteIds, appearance } = state
  const saved: Persisted = { welcomed, start, home, rangeMinutes, filters, favoriteIds, appearance }
  try {
    localStorage.setItem(storageKey, JSON.stringify(saved))
  } catch {
    // Private mode or full storage: the demo keeps working for this visit.
  }
}

function update(patch: Partial<AppState>) {
  state = { ...state, ...patch }
  persist()
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getAppState(): AppState {
  return state
}

export function useAppState(): AppState
export function useAppState<T>(select: (state: AppState) => T): T
export function useAppState<T>(select?: (state: AppState) => T): T | AppState {
  return useSyncExternalStore(subscribe, () => (select ? select(state) : state))
}

// ---------- Welcome ----------

export function finishWelcome() {
  update({ welcomed: true })
}

// ---------- Start, range, filters ----------

export function sameStart(a: StartPoint | null, b: StartPoint | null): boolean {
  if (!a || !b) return a === b
  return a.coordinate.lat === b.coordinate.lat && a.coordinate.lng === b.coordinate.lng
}

export function setStart(start: StartPoint) {
  update({ start, showFarther: false, location: { ...state.location, error: null } })
}

export function choosePlace(place: Place) {
  setStart({ label: place.label, zip: place.zip ?? null, coordinate: { lat: place.lat, lng: place.lng }, source: 'typed' })
}

export function clearStartError() {
  if (state.location.error !== null) update({ location: { ...state.location, error: null } })
}

export function saveAsHome() {
  if (state.start?.source === 'typed') update({ home: state.start })
}

export function setRange(minutes: number) {
  if (minutes === state.rangeMinutes) return
  update({ rangeMinutes: minutes, showFarther: false })
}

export function setFilters(change: Partial<SpotFilters> | ((filters: SpotFilters) => SpotFilters)) {
  const filters = typeof change === 'function' ? change(state.filters) : { ...state.filters, ...change }
  update({ filters })
}

export function resetToggles() {
  update({ filters: { ...emptyFilters(), speciesGroup: state.filters.speciesGroup } })
}

export function setShowFarther(showFarther: boolean) {
  update({ showFarther })
}

// ---------- Current location ----------

/** Arizona's bounding box: a fix outside it can't rank the sample Spots. */
function inArizona(c: Coordinate): boolean {
  return c.lat >= 31.3 && c.lat <= 37.05 && c.lng >= -114.85 && c.lng <= -109.0
}

function currentLocationStart(fix: Coordinate): StartPoint {
  if (inArizona(fix)) {
    return { label: cityName(fix) ?? 'your location', zip: null, coordinate: fix, source: 'currentLocation' }
  }
  // Far from the sample data (a demo outside Arizona): start from the nearest sample place.
  const place = nearestPlace(fix)
  return { label: place.label, zip: place.zip, coordinate: { lat: place.lat, lng: place.lng }, source: 'currentLocation' }
}

function setLocation(patch: Partial<AppState['location']>) {
  update({ location: { ...state.location, ...patch } })
}

/** Asks for location (the browser prompt the first time) and starts from it. */
export async function locateStart(): Promise<boolean> {
  if (!('geolocation' in navigator)) {
    setLocation({ error: "Couldn't find your location. Type a city or ZIP instead." })
    return false
  }
  setLocation({ isLocating: true, error: null })
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 }),
    )
    const start = currentLocationStart({ lat: position.coords.latitude, lng: position.coords.longitude })
    update({
      start,
      showFarther: false,
      welcomed: true,
      location: { permission: 'allowed', isLocating: false, error: null },
    })
    return true
  } catch (error) {
    const denied = (error as GeolocationPositionError).code === 1
    setLocation({
      isLocating: false,
      permission: denied ? 'denied' : state.location.permission,
      // Refused: the typed start prompt explains it, no error.
      error: denied ? null : "Couldn't find your location. Type a city or ZIP instead.",
    })
    return false
  }
}

/** Reads the browser's location permission without prompting. */
async function readPermission() {
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' })
    if (!status) return
    const map = (s: PermissionState): LocationPermission => (s === 'granted' ? 'allowed' : s === 'denied' ? 'denied' : 'notDetermined')
    setLocation({ permission: map(status.state) })
    status.addEventListener('change', () => setLocation({ permission: map(status.state) }))
  } catch {
    // Safari before 16 has no Permissions API: stays notDetermined until the first tap.
  }
}
void readPermission()

// ---------- Favorites ----------

export function isFavorite(spotId: number): boolean {
  return state.favoriteIds.includes(spotId)
}

export function toggleFavorite(spotId: number) {
  const favoriteIds = isFavorite(spotId) ? state.favoriteIds.filter((id) => id !== spotId) : [spotId, ...state.favoriteIds]
  update({ favoriteIds })
}

// ---------- Appearance ----------

export function setAppearance(appearance: Appearance) {
  update({ appearance })
}

// ---------- Reset ----------

export function resetToFirstLaunch() {
  state = { ...initialState(), location: { ...state.location, isLocating: false, error: null } }
  persist()
  for (const listener of listeners) listener()
}

// ---------- Online ----------

function subscribeOnline(listener: () => void) {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine)
}
