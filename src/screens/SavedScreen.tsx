// Port of SavedTab in Views/LicenseAndSaved.swift, for a Guest whose favorites live on
// this phone: the demo has no sign-in, so there's no Sign in with Apple prompt or account menu.

import { driveMinutes, species, spotSummaries } from "../data/repository";
import { speciesByID } from "../data/types";
import { localDayFromDate } from "../logic/localDay";
import { spotMetaLine } from "../logic/todayLayout";
import { useAppState } from "../state/appState";
import { SpotRow } from "../ui/Media";
import { AppearanceMenu } from "../ui/Menu";
import { useNav } from "../ui/navigation";
import { Screen } from "../ui/Screen";
import { Card, EmptyState } from "../ui/Surfaces";
import "./saved/saved.css";

export default function SavedScreen() {
  const favoriteIds = useAppState((s) => s.favoriteIds);
  const start = useAppState((s) => s.start);
  const nav = useNav();

  const byID = new Map(spotSummaries().map((spot) => [spot.id, spot]));
  const favorites = favoriteIds.flatMap((id) => byID.get(id) ?? []);
  const speciesMap = speciesByID(species());
  const today = localDayFromDate(new Date());

  return (
    <Screen title="Saved" titleDisplay="large" leading={<AppearanceMenu />}>
      {favorites.length === 0 ? (
        <EmptyState
          glyph="saved"
          title="No saved Spots yet"
          message="Tap the heart on any Spot to keep it here, with its Prep saved for offline use."
        />
      ) : (
        <div className="saved-list">
          <Card>
            {favorites.map((spot) => (
              <SpotRow
                key={spot.id}
                spot={spot}
                meta={spotMetaLine(spot, speciesMap, today, null)}
                driveMinutes={start ? driveMinutes(start.coordinate, spot.id) : null}
                onClick={() => nav.push(`/spot/${spot.id}`)}
              />
            ))}
          </Card>
        </div>
      )}
    </Screen>
  );
}
