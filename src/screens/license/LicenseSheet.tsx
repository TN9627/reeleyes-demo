import { Sheet } from "../../ui/Sheet";
import { LicenseContent } from "./LicenseContent";
import "./license.css";

/**
 * The License sheet Prep opens (Swift `LicenseSheet`): inline "License" title, Done, the tab's content.
 *
 *   <LicenseSheet open={open} onClose={() => setOpen(false)} />
 *
 * Keep it mounted and toggle `open` so it animates in and out.
 */
export function LicenseSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="License" detent="large">
      <LicenseContent />
    </Sheet>
  );
}
