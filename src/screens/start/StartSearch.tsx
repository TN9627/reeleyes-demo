import { useRef, useState, type FormEvent } from "react";
import { GEONAMES_CREDIT, GEONAMES_URL, GEOCODING_CREDIT, searchArizona } from "../../data/geocoding";
import { OPEN_METEO_URL } from "../../data/openMeteo";
import { placesMatching, samplePlace, startHint } from "../../data/repository";
import type { Place } from "../../data/types";
import { choosePlace, useAppState } from "../../state/appState";
import { Card, Row } from "../../ui/Surfaces";
import { Glyph } from "../../ui/Glyph";
import "./start.css";

/** The static suggestions under the search field (docs/spec/v0.md §3). */
const suggestions: Place[] = [
  { label: "Phoenix", zip: "85004", lat: 33.4515, lng: -112.0697 },
  { label: "Tucson", zip: "85701", lat: 32.2226, lng: -110.9747 },
  { label: "Flagstaff", zip: "86001", lat: 35.1983, lng: -111.6513 },
  { label: "Yuma", zip: "85364", lat: 32.6927, lng: -114.6277 },
];

/** The search field, its error, place results and suggestions (Swift `StartSearch`). */
export function StartSearch({ onDone }: { onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [typedError, setTypedError] = useState<string | null>(null);
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  /** Place search was unreachable, so only the sample places were searched. */
  const [offline, setOffline] = useState(false);
  /** The last answer came from Open-Meteo's search (its credit shows with the results). */
  const [live, setLive] = useState(false);
  const latest = useRef(0);
  const locationError = useAppState((s) => s.location.error);
  const error = typedError ?? locationError;

  const choose = (place: Place) => {
    setTypedError(null);
    setResults([]);
    choosePlace(place);
    onDone();
  };

  /**
   * Resolves a typed city or ZIP: a sample place's exact name picks it (its sample drive times keep working);
   * else Open-Meteo's search for Arizona places. One match becomes the start; several are listed.
   */
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    const id = ++latest.current;
    setResults([]);
    setOffline(false);
    setLive(false);
    setSearching(false);
    if (trimmed === "") {
      setTypedError("Type a city or 5-digit ZIP.");
      return;
    }
    const sample = samplePlace(trimmed);
    if (sample) {
      setQuery("");
      choose(sample);
      return;
    }
    setTypedError(null);
    setSearching(true);
    let places: Place[];
    let reached = true;
    try {
      places = await searchArizona(trimmed);
    } catch {
      reached = false;
      places = placesMatching(trimmed);
    }
    if (id !== latest.current) return;
    setSearching(false);
    setOffline(!reached);
    setLive(reached);
    if (places.length === 0) {
      setTypedError(`No Arizona city or ZIP matches “${trimmed}”. ${reached ? "Try another Arizona city or 5-digit ZIP." : startHint}`);
    } else if (places.length === 1) {
      setQuery("");
      choose(places[0]);
    } else {
      setTypedError(null);
      setResults(places);
    }
  };

  return (
    <div className="start-search">
      <form className={`start-field${focused ? " start-field-focused" : ""}`} onSubmit={submit} role="search">
        <Glyph name="search" className="c-ink-secondary" />
        <input
          className="start-input t-body"
          type="search"
          inputMode="search"
          enterKeyHint="go"
          autoCapitalize="words"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          placeholder="City or ZIP"
          aria-label="City or ZIP"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {query !== "" && (
          <button type="button" className="start-clear" aria-label="Clear" onClick={() => setQuery("")}>
            <Glyph name="clear" className="c-ink-tertiary" />
          </button>
        )}
      </form>
      {error && (
        <p className="start-error t-footnote c-red" role="alert">
          {error}
        </p>
      )}
      {searching && (
        <p className="start-status t-footnote c-ink-secondary" role="status">
          Searching…
        </p>
      )}
      {offline && (
        <p className="start-status t-footnote c-ink-secondary" role="status">
          Place search is unavailable, so only the sample places were searched.
        </p>
      )}
      {results.length > 0 && <PlaceList title="Matches" places={results} onChoose={choose} />}
      {live && <PlaceSearchCredit />}
      <PlaceList title="Suggestions" places={suggestions} onChoose={choose} />
    </div>
  );
}

/** "Place search by Open-Meteo.com · location data from GeoNames": the credit the geocoding API asks for. */
function PlaceSearchCredit() {
  return (
    <p className="start-credit t-caption c-ink-tertiary">
      <a className="credit-link" href={OPEN_METEO_URL} target="_blank" rel="noreferrer">
        {GEOCODING_CREDIT}
      </a>
      {" · location data from "}
      <a className="credit-link" href={GEONAMES_URL} target="_blank" rel="noreferrer">
        {GEONAMES_CREDIT}
      </a>
    </p>
  );
}

function PlaceList({ title, places, onChoose }: { title: string; places: Place[]; onChoose: (place: Place) => void }) {
  return (
    <>
      <h3 className="start-list-header t-footnote-semibold c-ink-secondary">{title}</h3>
      <Card>
        {places.map((place) => (
          <Row key={`${place.label}-${place.lat}-${place.lng}`} onClick={() => onChoose(place)}>
            <span className="start-place">
              <span className="t-body c-ink">{place.label}</span>
              {(place.zip || place.county) && <span className="t-body c-ink-secondary">{place.zip || place.county}</span>}
            </span>
          </Row>
        ))}
      </Card>
    </>
  );
}
