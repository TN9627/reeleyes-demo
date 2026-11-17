/** The one statewide license answer: static app content (Views/LicenseAndSaved.swift `LicenseContent`). */
export const licenseContent = {
  headline: "One license covers every Spot in Arizona",
  detail:
    "Anyone 10 or older needs a fishing license. Community waters are covered too; the old separate community license no longer exists.",
  options: [
    { name: "General Fishing", price: "$37 resident · $55 non-resident", note: "Valid 365 days from purchase" },
    { name: "Combination Hunt & Fish", price: "$57 resident · $160 non-resident", note: "Fishing plus small game" },
    { name: "Youth Combination", price: "$5", note: "Ages 10–17" },
    { name: "Short-term Combination", price: "$15 resident · $20 non-resident per day", note: "Good for a single trip" },
  ],
  exception: "Tribal waters (White Mountain Apache, San Carlos) need a tribal permit instead.",
  storeURL: "https://license.azgfd.com",
} as const;
