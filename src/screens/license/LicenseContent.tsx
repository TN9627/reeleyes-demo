import { Button } from "../../ui/Controls";
import { Card, Footnote, Row, SectionHeader } from "../../ui/Surfaces";
import { licenseContent } from "./licenseCopy";
import "./license.css";

/** The License tab's content, also the sheet from Prep (Swift `LicenseContentView`). */
export function LicenseContent() {
  return (
    <div className="license-content">
      <Card padding={18} className="license-headline">
        <h2 className="t-title3-semibold c-ink">{licenseContent.headline}</h2>
        <p className="t-subheadline c-ink-secondary">{licenseContent.detail}</p>
      </Card>
      <SectionHeader title="Options" />
      <Card>
        {licenseContent.options.map((option) => (
          <Row key={option.name}>
            <span className="license-option">
              <span className="license-option-text">
                <span className="t-body c-ink">{option.name}</span>
                <span className="t-subheadline c-ink-secondary">{option.note}</span>
              </span>
              <span className="license-option-price t-subheadline c-ink-secondary">{option.price}</span>
            </span>
          </Row>
        ))}
      </Card>
      <Footnote>{licenseContent.exception}</Footnote>
      <div className="license-buy">
        <Button variant="secondary" onClick={() => window.open(licenseContent.storeURL, "_blank", "noopener")}>
          Buy on azgfd.com
        </Button>
      </div>
    </div>
  );
}
