import { OSM_COPYRIGHT_URL, OSRM_HOME } from "../../data/osrm";

/** "Routes: OSRM · © OpenStreetMap contributors (ODbL)": what OSRM's usage policy asks to be shown with its routes. */
export function OsrmCredit() {
  return (
    <p className="t-caption c-ink-tertiary today-credit">
      {"Routes: "}
      <a className="credit-link" href={OSRM_HOME} target="_blank" rel="noreferrer">
        OSRM
      </a>
      {" · © "}
      <a className="credit-link" href={OSM_COPYRIGHT_URL} target="_blank" rel="noreferrer">
        OpenStreetMap contributors (ODbL)
      </a>
    </p>
  );
}
