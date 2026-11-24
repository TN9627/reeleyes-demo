import { dataNotice, type TodayResult } from "../../data/repository";
import { formatDrive, formatRange } from "../../logic/spotFacts";
import { emptyFilters, noMatchTitle } from "../../logic/todayLayout";
import { setFilters, setShowFarther, type SpotFilters } from "../../state/appState";
import { Button } from "../../ui/Controls";
import { SpotRow } from "../../ui/Media";
import { useNav } from "../../ui/navigation";
import { Card, EmptyState, Footnote, SectionHeader } from "../../ui/Surfaces";

/** Bands, the farther button and the footnote for a loaded Recommendation (Swift RecommendationList). */
export function RecommendationList({
  result,
  filters,
  showFarther,
  place,
  onChangeStart,
}: {
  result: TodayResult;
  filters: SpotFilters;
  showFarther: boolean;
  place: string;
  onChangeStart: () => void;
}) {
  const nav = useNav();
  const { layout, recommendation } = result;
  const range = formatRange(recommendation.rangeMinutes);
  const empty = layout.empty;

  return (
    <>
      {empty?.kind === "noSpotsInRange" && (
        <EmptyState
          glyph="noSpotsNearby"
          title={`No Spots within ${range} of ${place}`}
          message={
            empty.nearest
              ? `The nearest is ${empty.nearest.spot.name}, ${result.estimated ? "about " : ""}${formatDrive(empty.nearest.driveMinutes ?? 0)} away.`
              : `None within ${formatRange(2 * recommendation.rangeMinutes)} either.`
          }
        >
          {empty.nearest && <Button onClick={() => setShowFarther(true)}>Show farther Spots</Button>}
          <Button variant="plain" onClick={onChangeStart}>
            Change starting point
          </Button>
        </EmptyState>
      )}
      {empty?.kind === "noMatches" && (
        <EmptyState
          glyph="filter"
          title={`${noMatchTitle(filters)} within ${range}`}
          message={
            empty.fartherMatches > 0
              ? `${empty.fartherMatches} farther away. Try another fish, or show farther Spots.`
              : "Try another fish or fewer filters."
          }
        >
          <Button variant="secondary" onClick={() => setFilters(emptyFilters())}>
            Show all Spots
          </Button>
          {empty.fartherMatches > 0 && !showFarther && (
            <Button variant="plain" onClick={() => setShowFarther(true)}>
              Show farther Spots
            </Button>
          )}
        </EmptyState>
      )}
      {!empty && (
        <>
          {result.sections.map((section) => (
            <section key={section.title}>
              <SectionHeader title={section.title} trailing={section.rows.length === 1 ? "1 Spot" : `${section.rows.length} Spots`} />
              <Card>
                {section.rows.map((row) => (
                  <SpotRow
                    key={row.spot.id}
                    spot={row.spot}
                    meta={row.meta}
                    driveMinutes={row.driveMinutes}
                    estimated={result.estimated}
                    distanceMi={row.distanceMi}
                    onClick={() => nav.push(`/spot/${row.spot.id}`)}
                  />
                ))}
              </Card>
            </section>
          ))}
          {layout.hiddenFartherCount > 0 && (
            <div className="today-farther">
              <Button variant="plain" onClick={() => setShowFarther(true)}>
                {`Show ${layout.hiddenFartherCount} Spot${layout.hiddenFartherCount === 1 ? "" : "s"} farther than ${range}`}
              </Button>
            </div>
          )}
        </>
      )}
      <div className="today-footnote">
        <Footnote>{`Ranked by drive time from ${place}${result.estimated ? ". Drive times are estimated from distance" : " (Apple Maps)"}. ${dataNotice}`}</Footnote>
      </div>
    </>
  );
}
