// SwiftUI's `.refreshable` on Prep: pull down from the top of the screen's scroll view to refresh.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Spinner } from "../../ui/Controls";

const threshold = 70;

export function PullToRefresh({ refreshing, onRefresh, children }: { refreshing: boolean; onRefresh: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const scroller = ref.current?.closest<HTMLElement>(".screen-scroll");
    if (!scroller) return;
    let startY: number | null = null;
    let distance = 0;
    const start = (e: TouchEvent) => {
      startY = scroller.scrollTop <= 0 ? e.touches[0]!.clientY : null;
      distance = 0;
    };
    const move = (e: TouchEvent) => {
      if (startY === null) return;
      const dy = e.touches[0]!.clientY - startY;
      if (dy <= 0 || scroller.scrollTop > 0) {
        distance = 0;
        setPull(0);
        return;
      }
      // Rubber band: the indicator follows at half speed, like the system control.
      distance = Math.min(dy / 2, threshold * 1.4);
      setPull(distance);
      if (e.cancelable) e.preventDefault();
    };
    const end = () => {
      if (startY !== null && distance >= threshold) onRefreshRef.current();
      startY = null;
      distance = 0;
      setPull(0);
    };
    scroller.addEventListener("touchstart", start, { passive: true });
    scroller.addEventListener("touchmove", move, { passive: false });
    scroller.addEventListener("touchend", end);
    scroller.addEventListener("touchcancel", end);
    return () => {
      scroller.removeEventListener("touchstart", start);
      scroller.removeEventListener("touchmove", move);
      scroller.removeEventListener("touchend", end);
      scroller.removeEventListener("touchcancel", end);
    };
  }, []);

  const height = refreshing ? 44 : pull;
  return (
    <div ref={ref}>
      <div className={pull > 0 ? "prep-ptr" : "prep-ptr prep-ptr-settle"} style={{ height }}>
        {(refreshing || pull > 0) && (
          <span className="prep-ptr-indicator" style={refreshing ? undefined : { opacity: Math.min(pull / threshold, 1) }}>
            <Spinner size={22} />
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
