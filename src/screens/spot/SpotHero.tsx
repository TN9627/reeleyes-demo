// Port of SpotPhotos.swift's SpotHero: a 300pt full-bleed pager of the Spot's photos under
// the status bar or, with no usable photo, the map alone. The content sheet overlaps its
// bottom 24pt; scrolling moves it at half speed and pulling down stretches it (neither with
// Reduce Motion, nor while the map is expanded). Over the photos: a glass pin button that
// expands an interactive map to 480pt in place, the page indicator, and ⓘ. Tapping a photo
// opens the viewer; tapping the map-only hero expands its map.

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Photo, SpotSummary } from "../../data/types";
import { heroCounter, heroIndexOf, heroPages, heroSpoken, type HeroPages } from "../../logic/heroPages";
import { Glyph } from "../../ui/Glyph";
import { photoURL } from "../../ui/images";
import { GlassCircleButton } from "../../ui/Screen";
import { HeroMap } from "./HeroMap";
import { PhotoViewer } from "./PhotoViewer";
import { LinkedCredit, useHeroPhotos, type HeroPhotos } from "./photos";

export const heroHeight = 300;
export const heroExpandedHeight = 480;
/** How far the content sheet's top edge rises over the hero's bottom. */
export const sheetOverlap = 24;

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface SpotHeroProps {
  spot: SpotSummary;
  photos: Photo[];
}

export function SpotHero({ spot, photos }: SpotHeroProps) {
  const load = useHeroPhotos();
  const pages = heroPages(spot.name, photos, load.failed);
  /** The pager's photo; null is the first. */
  const [position, setPosition] = useState<string | null>(null);
  /** The photo the indicator and ⓘ follow: held while a finger is on the pager. */
  const [settled, setSettled] = useState<string | null>(null);
  const [showsViewer, setShowsViewer] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  /** Reduce Motion: the hero fades out, changes height, and fades back in. */
  const [faded, setFaded] = useState(false);
  const hero = useRef<HTMLDivElement>(null);
  const media = useRef<HTMLDivElement>(null);
  const pager = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const current = (settled !== null ? heroIndexOf(pages, settled) : null) ?? 0;
  const height = mapExpanded ? heroExpandedHeight : heroHeight;

  // Scrolling up moves the hero at half the distance, so the sheet slides over it; pulling
  // down grows it from its bottom edge to the top of the screen.
  useEffect(() => {
    const el = hero.current?.closest<HTMLElement>(".screen-scroll");
    if (!el) return;
    const apply = () => {
      const y = el.scrollTop;
      const still = reducedMotion() || mapExpanded;
      if (hero.current) hero.current.style.transform = !still && y > 0 ? `translate3d(0, ${y / 2}px, 0)` : "";
      if (media.current) media.current.style.transform = !still && y < 0 ? `scale(${(heroHeight - y) / heroHeight})` : "";
    };
    apply();
    el.addEventListener("scroll", apply, { passive: true });
    return () => el.removeEventListener("scroll", apply);
  }, [mapExpanded]);

  // A photo that failed under the Angler gives way to the one before it.
  useEffect(() => {
    if (position === null || !load.failed.has(position)) return;
    const index = photos.findIndex((p) => p.key === position);
    const before = photos
      .slice(0, index)
      .reverse()
      .find((p) => !load.failed.has(p.key))?.key ?? null;
    setPosition(before);
    setSettled(before);
  }, [load.failed, position, photos]);

  // Pages left the pager: keep the shown photo in place.
  const pageKeys = pages.photos.map((p) => p.key).join("|");
  useLayoutEffect(() => {
    const el = pager.current;
    if (!el) return;
    const index = position === null ? 0 : (heroIndexOf(pages, position) ?? 0);
    el.scrollLeft = index * el.clientWidth;
    // Only when the pages change or the viewer moves the hero.
  }, [pageKeys, showsViewer]);

  function onPagerScroll() {
    const el = pager.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.min(Math.max(Math.round(el.scrollLeft / el.clientWidth), 0), pages.photos.length - 1);
    const key = pages.photos[index]?.key ?? null;
    if (key !== position) setPosition(key);
    if (!dragging.current && key !== settled) setSettled(key);
  }

  function onPagerRelease() {
    dragging.current = false;
    onPagerScroll();
  }

  /** Moves the pager to a photo without a swipe: the viewer's photo, or arrow keys. */
  function show(key: string, smooth = false) {
    setPosition(key);
    setSettled(key);
    const el = pager.current;
    const index = heroIndexOf(pages, key);
    if (el && index !== null) el.scrollTo({ left: index * el.clientWidth, behavior: smooth ? "smooth" : "instant" });
  }

  /** Expands the map to 480pt with the sheet following, or collapses it back. Reduce Motion fades instead. */
  function toggleMap() {
    const expanding = !mapExpanded;
    if (reducedMotion()) {
      setFaded(true);
      window.setTimeout(() => {
        setMapExpanded(expanding);
        setFaded(false);
      }, 150);
    } else {
      setMapExpanded(expanding);
    }
  }

  const photo = pages.photos[current];

  return (
    <div
      ref={hero}
      className="sp-hero"
      data-faded={faded || undefined}
      style={{ height }}
    >
      <div ref={media} className="sp-hero-media">
        {pages.mode === "photos" && (
          <Pager
            pages={pages}
            current={current}
            pagerRef={pager}
            hidden={mapExpanded}
            load={load}
            onScroll={onPagerScroll}
            onPress={() => (dragging.current = true)}
            onRelease={onPagerRelease}
            onOpen={(key) => {
              show(key);
              setShowsViewer(true);
            }}
            onStep={(delta) => {
              const next = pages.photos[current + delta];
              if (next) show(next.key, true);
            }}
          />
        )}
        {(pages.mode === "mapOnly" || mapExpanded) && (
          <div className="sp-hero-map" data-over-photos={pages.mode === "photos" || undefined}>
            <HeroMap
              spot={spot}
              interactive={mapExpanded}
              failed={mapFailed}
              onFailure={() => setMapFailed(true)}
              onExpand={pages.mode === "mapOnly" && !mapExpanded && !mapFailed ? toggleMap : undefined}
            />
          </div>
        )}
      </div>

      {pages.mode === "photos" && !mapExpanded && photo && (
        <>
          <PageIndicator pages={pages} current={current} />
          <PhotoCreditButton photo={photo} />
        </>
      )}
      {(pages.mode === "photos" || mapExpanded) && (
        // Bottom leading, mirroring ⓘ: "Show map" over the photos, "Show photos" over their
        // expanded map, "Collapse map" over a map-only Spot's.
        <div className="sp-hero-map-button">
          <GlassCircleButton
            glyph={pages.mode === "mapOnly" ? "collapseMap" : mapExpanded ? "showPhotos" : "mapPin"}
            ariaLabel={pages.mode === "mapOnly" ? "Collapse map" : mapExpanded ? "Show photos" : "Show map"}
            tone="accent"
            onClick={toggleMap}
          />
        </div>
      )}

      {showsViewer && (
        <PhotoViewer
          photos={pages.photos}
          spotName={spot.name}
          current={position ?? pages.photos[0]?.key ?? ""}
          onChange={show}
          onClose={() => setShowsViewer(false)}
        />
      )}
    </div>
  );
}

interface PagerProps {
  pages: HeroPages;
  current: number;
  pagerRef: RefObject<HTMLDivElement | null>;
  hidden: boolean;
  load: HeroPhotos;
  onScroll: () => void;
  onPress: () => void;
  onRelease: () => void;
  onOpen: (key: string) => void;
  onStep: (delta: number) => void;
}

/** The photos, each scaled to fill and centred; no looping or auto-advance. */
function Pager({ pages, current, pagerRef, hidden, load, onScroll, onPress, onRelease, onOpen, onStep }: PagerProps) {
  return (
    <div
      ref={pagerRef}
      className="sp-hero-pager scroll-x"
      style={{ overflowX: pages.photos.length === 1 ? "hidden" : undefined }}
      role="group"
      aria-roledescription="photos"
      aria-label={heroSpoken(pages, current)}
      aria-hidden={hidden || undefined}
      onScroll={onScroll}
      onTouchStart={onPress}
      onTouchEnd={onRelease}
      onTouchCancel={onRelease}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") onStep(1);
        else if (e.key === "ArrowLeft") onStep(-1);
        else return;
        e.preventDefault();
      }}
    >
      {pages.photos.map((photo, i) => (
        <button
          key={photo.key}
          type="button"
          className="sp-hero-page"
          tabIndex={i === current ? 0 : -1}
          aria-label={`${heroSpoken(pages, i)} Opens the photo.`}
          onClick={() => onOpen(photo.key)}
        >
          <img
            src={photoURL(photo)}
            alt=""
            draggable={false}
            data-loaded={load.loaded.has(photo.key) || undefined}
            onLoad={() => load.markLoaded(photo.key)}
            onError={() => load.markFailed(photo.key)}
          />
        </button>
      ))}
    </div>
  );
}

/** A dot per photo, or "3 / 9" from 6 photos; none for a single photo. Decorative. */
function PageIndicator({ pages, current }: { pages: HeroPages; current: number }) {
  if (pages.indicator === "hidden") return null;
  return (
    <div className="sp-hero-indicator glass-media" aria-hidden>
      {pages.indicator === "dots" ? (
        pages.photos.map((p, i) => <span key={p.key} className="sp-hero-dot" data-current={i === current || undefined} />)
      ) : (
        <span className="t-footnote-semibold tnum c-ink">{heroCounter(pages, current)}</span>
      )}
    </div>
  );
}

/** ⓘ on a hero photo: its popover credits the photo, links the license deed and the source. */
function PhotoCreditButton({ photo }: { photo: Photo }) {
  const [open, setOpen] = useState(false);
  const popover = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!popover.current?.parentElement?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="sp-hero-credit">
      <GlassCircleButton glyph="photoCredit" ariaLabel="Photo credit" onClick={() => setOpen((o) => !o)} />
      {open && (
        <div ref={popover} className="sp-credit-popover" role="dialog" aria-label="Photo credit">
          <p className="t-subheadline c-ink">
            <LinkedCredit photo={photo} />
          </p>
          <a
            className="sp-credit-source t-subheadline-semibold"
            href={photo.source.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open on ${photo.source.name}`}
          >
            {photo.source.name}
            <Glyph name="disclosure" size={12} weight={3} />
          </a>
        </div>
      )}
    </div>
  );
}
