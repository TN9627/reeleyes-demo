import iconDark from "./app-icon-dark.png";
import iconLight from "./app-icon-light.png";
import "./welcome.css";

/** Concentric ellipses (about 0.42 as tall as wide, so the lake reads in perspective), fading outward. */
const ripples = [
  { width: 156, height: 66, lineWidth: 2.0, opacity: 1.0 },
  { width: 244, height: 102, lineWidth: 1.6, opacity: 0.8 },
  { width: 340, height: 142, lineWidth: 1.4, opacity: 0.6 },
  { width: 444, height: 186, lineWidth: 1.2, opacity: 0.42 },
  { width: 560, height: 236, lineWidth: 1.0, opacity: 0.28 },
];

/** The ripples' center, from the top of a 440 pt hero. */
const rippleCenter = 232;

/**
 * A still lake: ripples spreading from the app icon, with the app's name under it.
 * 440 pt on a standard iPhone, scaled down on shorter screens (never under 300 pt);
 * the scale lives in `--welcome-hero-h` (welcome.css).
 */
export function WelcomeHero() {
  return (
    <div className="welcome-hero">
      <svg className="welcome-hero-ripples" viewBox="-280 0 560 440" aria-hidden="true">
        {ripples.map((r) => (
          <ellipse
            key={r.width}
            cx={0}
            cy={rippleCenter}
            rx={r.width / 2}
            ry={r.height / 2}
            fill="none"
            stroke="var(--data-ink)"
            strokeOpacity={0.3 * r.opacity}
            strokeWidth={r.lineWidth}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="welcome-hero-mark" role="img" aria-label="ReelEyes">
        <img className="welcome-hero-icon welcome-hero-icon-light" src={iconLight} alt="" width={104} height={104} />
        <img className="welcome-hero-icon welcome-hero-icon-dark" src={iconDark} alt="" width={104} height={104} />
        <span className="welcome-hero-name t-title" aria-hidden="true">
          ReelEyes
        </span>
      </div>
    </div>
  );
}
