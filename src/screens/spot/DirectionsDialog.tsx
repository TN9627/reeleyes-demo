// SpotView.swift's directions confirmation dialog: Open in Apple Maps, Copy coordinates, Cancel.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SpotSummary } from "../../data/types";
import { formatDrive } from "../../logic/spotFacts";
import "./spot.css";

interface DirectionsDialogProps {
  spot: SpotSummary;
  driveMinutes: number | null;
  onClose: () => void;
}

export function DirectionsDialog({ spot, driveMinutes, onClose }: DirectionsDialogProps) {
  const [closing, setClosing] = useState(false);
  const first = useRef<HTMLAnchorElement>(null);

  function close() {
    if (closing) return;
    setClosing(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(onClose, reduce ? 0 : 220);
  }

  useEffect(() => {
    first.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const coordinates = `${spot.lat.toFixed(5)}, ${spot.lng.toFixed(5)}`;
  const mapsURL = `https://maps.apple.com/?daddr=${spot.lat},${spot.lng}&dirflg=d&q=${encodeURIComponent(spot.name)}`;

  return createPortal(
    <div className="sp-dialog-root" data-closing={closing || undefined}>
      <div className="sp-dialog-scrim" onClick={close} aria-hidden />
      <div className="sp-dialog" role="dialog" aria-modal="true" aria-labelledby="sp-dialog-title">
        <div className="sp-dialog-group">
          <div className="sp-dialog-header">
            <div id="sp-dialog-title" className="t-footnote-semibold">
              Driving directions to {spot.name}
            </div>
            {/* The drive time on its own line, rather than wrapped onto one after the name. */}
            {driveMinutes !== null && <div className="t-footnote">{formatDrive(driveMinutes)} drive</div>}
          </div>
          <a ref={first} className="sp-dialog-action" href={mapsURL} target="_blank" rel="noreferrer" onClick={close}>
            Open in Apple Maps
          </a>
          <button
            type="button"
            className="sp-dialog-action"
            onClick={() => {
              void navigator.clipboard?.writeText(coordinates).catch(() => undefined);
              close();
            }}
          >
            Copy coordinates
          </button>
        </div>
        <button type="button" className="sp-dialog-action sp-dialog-cancel" onClick={close}>
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  );
}
