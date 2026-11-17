// Port of SpotPhotos.swift's PhotoViewer and ZoomablePhoto: the hero's photos on black,
// opening on the tapped one. Swipe between them, pinch to 3×, double-tap for 2×, swipe
// down to leave; the hero follows to the last photo viewed. "2 of 3" and Close on top;
// the caption, the credit and a thumbnail strip at the bottom.

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Photo } from "../../data/types";
import { photoURL } from "../../ui/images";
import { LinkedCredit } from "./photos";
import "./spot.css";

interface PhotoViewerProps {
  /** The hero's photos still in the pager. */
  photos: Photo[];
  spotName: string;
  /** The photo shown; the hero follows it. */
  current: string;
  onChange: (key: string) => void;
  onClose: () => void;
}

export function PhotoViewer({ photos, spotName, current, onChange, onClose }: PhotoViewerProps) {
  const pager = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [zoomed, setZoomed] = useState(false);
  const [pull, setPull] = useState(0);
  const [closing, setClosing] = useState(false);
  const index = Math.max(
    photos.findIndex((p) => p.key === current),
    0,
  );
  const photo = photos[index];

  // Opens on the tapped photo, with focus on Close; only on open.
  useLayoutEffect(() => {
    const el = pager.current;
    if (el) el.scrollLeft = index * el.clientWidth;
    closeButton.current?.focus();
  }, []);

  // No photo left (the last one failed): the viewer closes.
  useEffect(() => {
    if (photos.length === 0) onClose();
  }, [photos.length, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") scrollTo(index + 1);
      else if (e.key === "ArrowLeft") scrollTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Keeps the current thumbnail in view once the strip scrolls.
  useEffect(() => {
    const thumb = strip.current?.children[index] as HTMLElement | undefined;
    thumb?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [index]);

  function onScroll() {
    const el = pager.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    const key = photos[Math.min(Math.max(i, 0), photos.length - 1)]?.key;
    if (key && key !== current) onChange(key);
  }

  function scrollTo(i: number, smooth = true) {
    const el = pager.current;
    if (!el || i < 0 || i >= photos.length) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: smooth && !reducedMotion() ? "smooth" : "instant" });
  }

  function close() {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, reducedMotion() ? 0 : 200);
  }

  const pullProgress = Math.min(Math.abs(pull) / 300, 1);

  return createPortal(
    <div
      className="sp-viewer"
      data-closing={closing || undefined}
      role="dialog"
      aria-modal="true"
      aria-label={`Photos of ${spotName}`}
      style={{ backgroundColor: `rgba(0, 0, 0, ${1 - pullProgress * 0.8})` }}
    >
      <div className="sp-viewer-top" style={{ opacity: 1 - pullProgress }}>
        <button ref={closeButton} type="button" className="sp-viewer-close" aria-label="Close" onClick={close}>
          <X size={22} strokeWidth={2} aria-hidden />
        </button>
        {photos.length > 0 && (
          <div className="sp-viewer-count t-subheadline-semibold tnum" aria-live="polite">
            {index + 1} of {photos.length}
          </div>
        )}
      </div>

      <div
        ref={pager}
        className="sp-viewer-pager scroll-x"
        style={{ overflowX: zoomed ? "hidden" : undefined }}
        onScroll={onScroll}
      >
        {photos.map((p) => (
          <ZoomablePhoto
            key={p.key}
            photo={p}
            label={p.title === "" ? `Photo of ${spotName}` : p.title}
            isCurrent={p.key === current}
            pull={p.key === current ? pull : 0}
            onZoomChange={setZoomed}
            onPull={setPull}
            onPullEnd={(dy) => {
              if (Math.abs(dy) > 110) close();
              else setPull(0);
            }}
          />
        ))}
      </div>

      <div className="sp-viewer-bottom" style={{ opacity: 1 - pullProgress }}>
        {photo && (
          <div className="sp-viewer-caption">
            {photo.title !== "" && <div className="t-headline">{photo.title}</div>}
            <div className="sp-viewer-credit t-caption">
              <LinkedCredit photo={photo} />
            </div>
          </div>
        )}
        <div ref={strip} className="sp-viewer-strip scroll-x" role="group" aria-label="Photos">
          {photos.map((p, i) => (
            <button
              key={p.key}
              type="button"
              className="sp-viewer-thumb"
              data-current={i === index || undefined}
              aria-label={`Photo ${i + 1} of ${photos.length}`}
              aria-pressed={i === index}
              onClick={() => scrollTo(i)}
            >
              <img src={photoURL(p, { thumbnail: true })} alt="" draggable={false} />
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface ZoomablePhotoProps {
  photo: Photo;
  label: string;
  isCurrent: boolean;
  /** The swipe-down distance while leaving. */
  pull: number;
  onZoomChange: (zoomed: boolean) => void;
  onPull: (dy: number) => void;
  onPullEnd: (dy: number) => void;
}

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const identity: Transform = { scale: 1, x: 0, y: 0 };

/** One photo fitted to the page: pinch between 1× and 3×, double-tap toggles 2×. Leaving the page puts it back to 1×. */
function ZoomablePhoto({ photo, label, isCurrent, pull, onZoomChange, onPull, onPullEnd }: ZoomablePhotoProps) {
  const box = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<Transform>(identity);
  const [animating, setAnimating] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    kind: "pinch" | "pan" | "pull" | "pending";
    start: Transform;
    dist: number;
    mid: { x: number; y: number };
    origin: { x: number; y: number };
  } | null>(null);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);
  const moved = useRef(false);

  useEffect(() => {
    if (!isCurrent) setT(identity);
  }, [isCurrent]);

  useEffect(() => {
    if (isCurrent) onZoomChange(t.scale > 1.01);
  }, [isCurrent, t.scale, onZoomChange]);

  function centerOf(e: { clientX: number; clientY: number }) {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - (r.left + r.width / 2), y: e.clientY - (r.top + r.height / 2) };
  }

  function clamp(next: Transform): Transform {
    const r = box.current!.getBoundingClientRect();
    const scale = Math.min(Math.max(next.scale, 1), 3);
    const maxX = ((scale - 1) * r.width) / 2;
    const maxY = ((scale - 1) * r.height) / 2;
    return { scale, x: Math.min(Math.max(next.x, -maxX), maxX), y: Math.min(Math.max(next.y, -maxY), maxY) };
  }

  function zoomAt(point: { x: number; y: number }, scale: number) {
    setAnimating(!reducedMotion());
    if (scale <= 1) {
      setT(identity);
      return;
    }
    // The tapped point stays under the finger.
    const px = (point.x - t.x) / t.scale;
    const py = (point.y - t.y) / t.scale;
    setT(clamp({ scale, x: point.x - px * scale, y: point.y - py * scale }));
  }

  function onPointerDown(e: ReactPointerEvent) {
    pointers.current.set(e.pointerId, centerOf(e));
    moved.current = false;
    setAnimating(false);
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
      gesture.current = {
        kind: "pinch",
        start: t,
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        origin: { x: 0, y: 0 },
      };
    } else if (pts.length === 1) {
      gesture.current = { kind: t.scale > 1.01 ? "pan" : "pending", start: t, dist: 0, mid: pts[0]!, origin: pts[0]! };
    }
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, centerOf(e));
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    if (g.kind === "pinch" && pts.length >= 2) {
      moved.current = true;
      const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const scale = Math.min(Math.max((g.start.scale * Math.hypot(a.x - b.x, a.y - b.y)) / g.dist, 1), 3);
      const px = (g.mid.x - g.start.x) / g.start.scale;
      const py = (g.mid.y - g.start.y) / g.start.scale;
      setT(clamp({ scale, x: mid.x - px * scale, y: mid.y - py * scale }));
      return;
    }
    const p = pts[0]!;
    const dx = p.x - g.origin.x;
    const dy = p.y - g.origin.y;
    if (Math.hypot(dx, dy) > 6) moved.current = true;
    if (g.kind === "pan") {
      setT(clamp({ scale: g.start.scale, x: g.start.x + dx, y: g.start.y + dy }));
    } else if (g.kind === "pending" && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
      g.kind = "pull";
    }
    if (g.kind === "pull") onPull(dy);
  }

  function onPointerUp(e: ReactPointerEvent) {
    const g = gesture.current;
    const point = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);
    if (g?.kind === "pull" && point) onPullEnd(point.y - g.origin.y);
    if (pointers.current.size === 0) {
      gesture.current = null;
      if (!moved.current && point && e.type === "pointerup") {
        const now = performance.now();
        const last = lastTap.current;
        if (last && now - last.time < 320 && Math.hypot(point.x - last.x, point.y - last.y) < 30) {
          lastTap.current = null;
          zoomAt(point, t.scale > 1.01 ? 1 : 2);
        } else {
          lastTap.current = { time: now, ...point };
        }
      }
    } else if (pointers.current.size === 1) {
      // One finger left after a pinch: it pans from here.
      const rest = [...pointers.current.values()][0]!;
      gesture.current = { kind: t.scale > 1.01 ? "pan" : "pending", start: t, dist: 0, mid: rest, origin: rest };
    }
  }

  return (
    <div className="sp-viewer-page">
      <div
        ref={box}
        className="sp-viewer-zoom"
        style={{ touchAction: t.scale > 1.01 ? "none" : "pan-x" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={photoURL(photo)}
          alt={label}
          draggable={false}
          className="sp-viewer-image"
          data-animating={animating || undefined}
          style={{
            transform: `translate3d(${t.x}px, ${t.y + pull}px, 0) scale(${t.scale * (1 - Math.min(Math.abs(pull) / 1200, 0.25))})`,
          }}
        />
      </div>
    </div>
  );
}
