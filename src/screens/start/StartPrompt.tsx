import { locateStart, useAppState } from "../../state/appState";
import { Button } from "../../ui/Controls";
import { StartSearch } from "./StartSearch";
import "./start.css";

/**
 * Today with no start yet: type a city or ZIP (or use location). Swift `StartPromptView`.
 * Picking a place or a location fix sets the start in app state; Today re-renders from it.
 * The web can't open Settings, so with location off there's no "Turn on location" button.
 */
export function StartPrompt() {
  const permission = useAppState((s) => s.location.permission);
  const isLocating = useAppState((s) => s.location.isLocating);

  return (
    <div className="start-prompt">
      <h2 className="start-prompt-title t-title3 c-ink">Where are you starting from?</h2>
      <p className="start-prompt-message t-footnote c-ink-secondary">
        {permission === "denied"
          ? "Location is off, so type a city or ZIP. You can turn location on in Settings any time."
          : "Type a city or ZIP in Arizona."}
      </p>
      <StartSearch onDone={() => {}} />
      {permission === "notDetermined" && (
        <div className="start-prompt-action">
          <Button variant="plain" loading={isLocating} onClick={() => void locateStart()}>
            Use my location
          </Button>
        </div>
      )}
    </div>
  );
}
