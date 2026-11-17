/**
 * App state for the demo, persisted in localStorage (one JSON blob, "reeleyes.state.v1").
 * Mirrors StartPointStore, TodayModel, SessionModel and the Appearance menu in the iOS app.
 * Sign in with Apple and the favorites backend are mocked (see "Session" below).
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
 *   favoriteTapped(spotId, spotName)      the heart: Members toggle, Guests get the sign-in sheet
 *   toggleFavorite(spotId)                Members only; newest first in favoriteIds
 *   isFavorite(spotId), isMember()
 *   requestSignIn({spotId, spotName}) / dismissSignIn()   the root sign-in sheet
 *   signInWithApple(spotId?): Promise     mock round trip, then Member; saves spotId
 *   signOut()                             favorites leave this phone; the account keeps them
 *   deleteAccount(): Promise              the account and its favorites are deleted
 *   refreshFavorites(): Promise           Saved's pull to refresh
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

/** A Member's session (MemberSession), from the mock Apple identity. */
export interface Member {
  memberId: string
  displayName: string
  /** Apple's private-relay-style address for the mock identity. */
  email: string
  /** ISO time. */
  signedInAt: string
}

/** What opened the sign-in sheet: a Spot's heart (saved once signed in), or nothing. */
export interface SignInRequest {
  spotId: number | null
  spotName: string | null
}

export interface AppState {
  /** The Angler has been past Welcome (or already has a start). */
  welcomed: boolean
  start: StartPoint | null
  home: StartPoint | null
  rangeMinutes: number
  filters: SpotFilters
  /** Today's "Show N farther"; not persisted, reset by a new start or range. */
  showFarther: boolean
  /** The Member's saved Spot ids, newest first; empty for a Guest. */
  favoriteIds: number[]
  /** Null for a Guest. Persisted like the iOS Keychain session. */
  member: Member | null
  /** The sign-in sheet is showing (AppModel.signInRequest); not persisted. */
  signInRequest: SignInRequest | null
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

type Persisted = Pick<AppState, 'welcomed' | 'start' | 'home' | 'rangeMinutes' | 'filters' | 'favoriteIds' | 'member' | 'appearance'>

function initialState(): AppState {
  return {
    welcomed: false,
    start: null,
    home: null,
    rangeMinutes: DriveRange.defaultMinutes,
    filters: emptyFilters(),
    showFarther: false,
    favoriteIds: [],
    member: null,
    signInRequest: null,
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
      member: saved.member ?? null,
      favoriteIds: saved.member && Array.isArray(saved.favoriteIds) ? saved.favoriteIds.filter((id) => typeof id === 'number') : [],
      appearance: saved.appearance === 'light' || saved.appearance === 'dark' ? saved.appearance : 'system',
    }
  } catch {
    return state
  }
}

let state: AppState = load()
const listeners = new Set<() => void>()

function persist() {
  const { welcomed, start, home, rangeMinutes, filters, favoriteIds, member, appearance } = state
  const saved: Persisted = { welcomed, start, home, rangeMinutes, filters, favoriteIds, member, appearance }
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

// ---------- Session: Guest or Member (SessionModel.swift, mocked) ----------
//
// Sign in with Apple and the Better Auth backend can't run in a browser demo, so both are
// mocked like the iOS Debug build's MockAppleIdentity: one Apple identity per install
// ("mock-<uuid>", Test Member, <sub>@mock.invalid), and a stand-in for the backend in
// localStorage that keeps each account's favorites. As on iOS, signing out forgets the
// session and favorites on this phone but the account keeps them (signing in again brings
// them back); deleting the account deletes its favorites for good.

/** A Member's mock "server" account: the user Better Auth would hold, keyed by the Apple subject. */
interface MockAccount {
  memberId: string
  /** Newest first, like `GET /api/v0/favorites`. */
  favoriteIds: number[]
}

interface MockBackend {
  /** The install's mock Apple identity (MockAppleIdentity.installSubject). */
  subject: string
  /** Present once the identity has signed in, until the account is deleted. */
  account: MockAccount | null
}

const backendKey = 'reeleyes.mockBackend.v1'
/** About the real round trip: Apple's sheet, then the token exchange. */
const roundTripMs = 900

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

function loadBackend(): MockBackend {
  try {
    const raw = localStorage.getItem(backendKey)
    if (raw) return JSON.parse(raw) as MockBackend
  } catch {
    // Fall through to a new identity.
  }
  const backend: MockBackend = { subject: `mock-${uuid()}`, account: null }
  saveBackend(backend)
  return backend
}

function saveBackend(backend: MockBackend) {
  try {
    localStorage.setItem(backendKey, JSON.stringify(backend))
  } catch {
    // Private mode or full storage: the demo keeps working for this visit.
  }
}

function updateAccount(change: (account: MockAccount) => MockAccount) {
  const backend = loadBackend()
  if (!backend.account) return
  saveBackend({ ...backend, account: change(backend.account) })
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function isMember(): boolean {
  return state.member !== null
}

/** The heart opened the sign-in sheet (`spotId` is saved once signed in), or Saved's own prompt. */
export function requestSignIn(request: SignInRequest = { spotId: null, spotName: null }) {
  update({ signInRequest: request })
}

export function dismissSignIn() {
  update({ signInRequest: null })
}

/**
 * Sign in with Apple (mock): the round trip, then a Member session with the account's
 * favorites from the mock backend; saves `spotId` if it isn't saved yet.
 */
export async function signInWithApple(spotId: number | null = null) {
  await wait(roundTripMs)
  const backend = loadBackend()
  const account = backend.account ?? { memberId: uuid(), favoriteIds: [] }
  saveBackend({ ...backend, account })
  update({
    member: { memberId: account.memberId, displayName: 'Test Member', email: `${backend.subject}@mock.invalid`, signedInAt: new Date().toISOString() },
    favoriteIds: account.favoriteIds,
  })
  if (spotId !== null && !isFavorite(spotId)) toggleFavorite(spotId)
}

/** Ends the session: favorites leave this phone; the account keeps them. */
export function signOut() {
  if (!state.member) return
  update({ member: null, favoriteIds: [] })
}

/** Deletes the account after confirming with Sign in with Apple (mock): its favorites go with it. */
export async function deleteAccount() {
  if (!state.member) return
  await wait(roundTripMs)
  const backend = loadBackend()
  saveBackend({ ...backend, account: null })
  update({ member: null, favoriteIds: [] })
}

/** Pull to refresh on Saved: reads the account's favorites again. */
export async function refreshFavorites() {
  await wait(700)
  if (!state.member) return
  const account = loadBackend().account
  if (!account || account.memberId !== state.member.memberId) {
    // The account is gone (deleted on another device): the session ends.
    update({ member: null, favoriteIds: [] })
    return
  }
  update({ favoriteIds: account.favoriteIds })
}

// ---------- Favorites ----------

export function isFavorite(spotId: number): boolean {
  return state.favoriteIds.includes(spotId)
}

/** Members only: Guests get the sign-in sheet instead (use `favoriteTapped`). */
export function toggleFavorite(spotId: number) {
  if (!state.member) return
  const favoriteIds = isFavorite(spotId) ? state.favoriteIds.filter((id) => id !== spotId) : [spotId, ...state.favoriteIds]
  updateAccount((account) => ({ ...account, favoriteIds }))
  update({ favoriteIds })
}

/** The heart: Members toggle; Guests get the sign-in sheet naming the Spot (AppModel.favoriteTapped). */
export function favoriteTapped(spotId: number, spotName: string | null) {
  if (state.member) toggleFavorite(spotId)
  else requestSignIn({ spotId, spotName })
}

// ---------- Appearance ----------

export function setAppearance(appearance: Appearance) {
  update({ appearance })
}

// ---------- Reset ----------

export function resetToFirstLaunch() {
  // The session is the Keychain's, not the start's: it survives going back to Welcome.
  const { member, favoriteIds } = state
  state = { ...initialState(), member, favoriteIds, location: { ...state.location, isLocating: false, error: null } }
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
