// Port of SavedTab in Views/LicenseAndSaved.swift: a Guest prompt, or the Member's saved
// Spots with the account menu. Sign in with Apple and the favorites backend are mocked
// (src/state/appState.ts, "Session").

import { useState } from "react";
import { createPortal } from "react-dom";
import { driveTime, species, spotSummaries } from "../data/repository";
import { speciesByID } from "../data/types";
import { localDayFromDate } from "../logic/localDay";
import { spotMetaLine } from "../logic/todayLayout";
import { deleteAccount, refreshFavorites, signOut, useAppState } from "../state/appState";
import { Alert } from "../ui/Alert";
import { Spinner } from "../ui/Controls";
import { SpotRow } from "../ui/Media";
import { ActionMenu, AppearanceMenu } from "../ui/Menu";
import { useNav } from "../ui/navigation";
import { Screen } from "../ui/Screen";
import { Card, EmptyState } from "../ui/Surfaces";
import { PullToRefresh } from "./prep/PullToRefresh";
import { AppleSignInButton } from "./signin/AppleSignInButton";
import "./prep/prep.css";
import "./saved/saved.css";
import "./signin/signin.css";

export default function SavedScreen() {
  const isMember = useAppState((s) => s.member !== null);
  const [confirmsDeletion, setConfirmsDeletion] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await refreshFavorites();
    setRefreshing(false);
  };

  /** Signs in with Apple again for a fresh session, then deletes the account (docs/spec/v0.md §8). */
  const remove = async () => {
    setIsDeletingAccount(true);
    await deleteAccount();
    setIsDeletingAccount(false);
  };

  return (
    <Screen
      title="Saved"
      titleDisplay="large"
      subtitle={isMember ? "Signed in with Apple" : undefined}
      leading={<AppearanceMenu />}
      trailing={
        isMember && (
          <ActionMenu
            trigger={{ glyph: "account", ariaLabel: "Account", disabled: isDeletingAccount }}
            items={[
              { label: "Sign out", destructive: true, onClick: signOut },
              { label: "Delete account", destructive: true, onClick: () => setConfirmsDeletion(true) },
            ]}
          />
        )
      }
    >
      {isMember ? (
        <PullToRefresh refreshing={refreshing} onRefresh={() => void refresh()}>
          <SavedList />
        </PullToRefresh>
      ) : (
        <EmptyState
          glyph="saved"
          title="Save the Spots you fish often"
          message="Sign in with Apple to keep favorites on all your devices. Everything else works without an account."
        >
          <AppleSignInButton />
        </EmptyState>
      )}
      <Alert
        open={confirmsDeletion}
        title="Delete your account?"
        message="Your account and all your favorites are deleted for good, on every device. You'll confirm with Sign in with Apple."
        actions={[
          { label: "Delete account", role: "destructive", onClick: () => void remove() },
          { label: "Cancel", role: "cancel" },
        ]}
        onClose={() => setConfirmsDeletion(false)}
      />
      {isDeletingAccount &&
        createPortal(
          <div className="signin-progress-host" role="status">
            <div className="signin-progress">
              <Spinner size={24} />
              <span className="t-body">Deleting account…</span>
            </div>
          </div>,
          document.body,
        )}
    </Screen>
  );
}

/** The Member's saved Spots, newest saved first, or the empty state. */
function SavedList() {
  const favoriteIds = useAppState((s) => s.favoriteIds);
  const start = useAppState((s) => s.start);
  const nav = useNav();

  const byID = new Map(spotSummaries().map((spot) => [spot.id, spot]));
  const favorites = favoriteIds.flatMap((id) => byID.get(id) ?? []);
  if (favorites.length === 0) {
    return (
      <EmptyState
        glyph="saved"
        title="No saved Spots yet"
        message="Tap the heart on any Spot to keep it here, with its Prep saved for offline use."
      />
    );
  }

  // Every species is known, so a favorite outside today's range is named too.
  const speciesMap = speciesByID(species());
  const today = localDayFromDate(new Date());
  return (
    <div className="saved-list">
      <Card>
        {favorites.map((spot) => (
          <SpotRow
            key={spot.id}
            spot={spot}
            meta={spotMetaLine(spot, speciesMap, today, null)}
            driveMinutes={start ? driveTime(start.coordinate, spot.id).minutes : null}
            estimated={start ? driveTime(start.coordinate, spot.id).estimated : false}
            onClick={() => nav.push(`/spot/${spot.id}`)}
          />
        ))}
      </Card>
    </div>
  );
}
