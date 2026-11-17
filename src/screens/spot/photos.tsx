// Spot photo credit lines and load state (SpotPhotos.swift: PhotoCredit, SpotHeroPhotos).

import { useCallback, useState } from "react";
import type { Photo } from "../../data/types";

/**
 * "Photo by Nicholas Hartmann · CC BY-SA 4.0", the license underlined and linked to its deed
 * when it has one: the hero's ⓘ popover and the viewer's credit line.
 */
export function LinkedCredit({ photo }: { photo: Photo }) {
  const line = photo.author === "" ? photo.license.name : `Photo by ${photo.author} · ${photo.license.name}`;
  const url = photo.license.url;
  if (!url) return line;
  const at = line.lastIndexOf(photo.license.name);
  return (
    <>
      {line.slice(0, at)}
      <a className="sp-underline" href={url} target="_blank" rel="noreferrer">
        {photo.license.name}
      </a>
    </>
  );
}

/** Which hero photos have loaded and which failed, by photo key. */
export interface HeroPhotos {
  loaded: ReadonlySet<string>;
  failed: ReadonlySet<string>;
  markLoaded: (key: string) => void;
  markFailed: (key: string) => void;
}

/**
 * The hero's photos: every one starts loading as the hero appears (the pager mounts
 * them all), so the pager drops the ones that fail before the Angler swipes to them.
 */
export function useHeroPhotos(): HeroPhotos {
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set());
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const markLoaded = useCallback((key: string) => setLoaded((s) => (s.has(key) ? s : new Set(s).add(key))), []);
  const markFailed = useCallback((key: string) => setFailed((s) => (s.has(key) ? s : new Set(s).add(key))), []);
  return { loaded, failed, markLoaded, markFailed };
}
