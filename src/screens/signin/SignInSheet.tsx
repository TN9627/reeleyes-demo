// Favorites need an account; everything else stays open to Guests (Swift `SignInSheet`).
// Mounted once at the root, like iOS's `.sheet(item: $app.signInRequest)`.

import { useState } from "react";
import { dismissSignIn, useAppState, type SignInRequest } from "../../state/appState";
import { Button } from "../../ui/Controls";
import { Sheet } from "../../ui/Sheet";
import { EmptyState } from "../../ui/Surfaces";
import { AppleSignInButton } from "./AppleSignInButton";
import "./signin.css";

export function SignInSheet() {
  const request = useAppState((s) => s.signInRequest);
  // Keep the last request's words on screen while the sheet slides away.
  const [shown, setShown] = useState<SignInRequest | null>(request);
  if (request && request !== shown) setShown(request);

  const name = shown?.spotName;
  return (
    <Sheet open={request !== null} onClose={dismissSignIn} title={name ? `Save ${name}` : "Save your Spots"} detent="medium" done={null} hidesTitleBar>
      <EmptyState
        glyph="saved"
        title={name ? `Save ${name}` : "Save your Spots"}
        message="Favorites need an account so they follow you to every device. It's free, and Prep, rules and conditions stay open to Guests."
      >
        <AppleSignInButton key={request ? "open" : "closed"} spotId={shown?.spotId ?? null} onSignedIn={dismissSignIn} />
        <Button variant="plain" onClick={dismissSignIn}>
          Not now
        </Button>
      </EmptyState>
    </Sheet>
  );
}
