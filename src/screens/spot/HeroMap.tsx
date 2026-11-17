// MapSnapshotView.swift's SpotHeroMap: a live map centred on the Spot with its pin. Static in
// the collapsed map-only hero (tapping it expands), it pans and zooms once expanded. When the
// tiles don't load, Map Land says "Map unavailable" instead.

import type { SpotSummary } from "../../data/types";
import { Glyph } from "../../ui/Glyph";
import { mapSpan } from "../../ui/maps";
import { SpotMap } from "../../ui/SpotMap";

interface HeroMapProps {
  spot: SpotSummary;
  interactive: boolean;
  failed: boolean;
  onFailure: () => void;
  /** The collapsed map-only hero: the whole map is one button that expands it. */
  onExpand?: () => void;
}

export function HeroMap({ spot, interactive, failed, onFailure, onExpand }: HeroMapProps) {
  if (failed) {
    return (
      <div className="sp-map-unavailable c-ink-tertiary" role="img" aria-label="Map unavailable">
        <Glyph name="mapPin" size={24} />
        <span className="t-footnote">Map unavailable</span>
      </div>
    );
  }
  return (
    <div className="sp-map" aria-label={`Map of ${spot.name}`} role={onExpand ? undefined : "img"}>
      <SpotMap lat={spot.lat} lng={spot.lng} meters={mapSpan(spot, "hero")} interactive={interactive} onFailure={onFailure} />
      {onExpand && (
        <button type="button" className="sp-map-expand" aria-label={`Map of ${spot.name}`} aria-description="Double-tap to expand." onClick={onExpand} />
      )}
    </div>
  );
}
