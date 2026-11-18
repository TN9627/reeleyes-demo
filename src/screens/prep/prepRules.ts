// AppModel.prepRulesSpotID / openPrepRules: the Spot's species sheet opens Prep with Rules opened and in view.

import type { Nav } from "../../ui/navigation";

/** Set to a Spot's id to show its Prep with Rules opened; Prep clears it when it does. */
export const prepRulesRequest: { spotID: number | null } = { spotID: null };

/** Pushes the Spot's Prep with Rules opened. */
export function openPrepRules(nav: Nav, spotID: number) {
  prepRulesRequest.spotID = spotID;
  nav.push(`/spot/${spotID}/prep`);
}
