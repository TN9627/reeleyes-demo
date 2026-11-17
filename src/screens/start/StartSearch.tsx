import { useState, type FormEvent } from "react";
import { placesMatching, startHint } from "../../data/repository";
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
  const locationError = useAppState((s) => s.location.error);
  const error = typedError ?? locationError;

  const choose = (place: Place) => {
    setTypedError(null);
    setResults([]);
    choosePlace(place);
    onDone();
  };

  /** Resolves a typed city or ZIP: one match becomes the start; several are listed. */
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    setResults([]);
    if (trimmed === "") {
      setTypedError("Type a city or 5-digit ZIP.");
      return;
    }
    const places = placesMatching(trimmed);
    if (places.length === 0) {
      setTypedError(`No Arizona city or ZIP matches “${trimmed}”. ${startHint}`);
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
      {results.length > 0 && <PlaceList title="Matches" places={results} onChoose={choose} />}
      <PlaceList title="Suggestions" places={suggestions} onChoose={choose} />
    </div>
  );
}

function PlaceList({ title, places, onChoose }: { title: string; places: Place[]; onChoose: (place: Place) => void }) {
  return (
    <>
      <h3 className="start-list-header t-footnote-semibold c-ink-secondary">{title}</h3>
      <Card>
        {places.map((place) => (
          <Row key={`${place.label}-${place.zip}`} onClick={() => onChoose(place)}>
            <span className="start-place">
              <span className="t-body c-ink">{place.label}</span>
              {place.zip && <span className="t-body c-ink-secondary">{place.zip}</span>}
            </span>
          </Row>
        ))}
      </Card>
    </>
  );
}
