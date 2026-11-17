// Port of PrepView.rulesSection: the key limits strip, then every rule for the Spot behind a disclosure.

import { useState } from "react";
import type { Prep } from "../../data/types";
import { keyLimits, ruleLabel } from "../../logic/freshness";
import { Card, SectionHeader } from "../../ui/Surfaces";
import { Disclosure, RulesLink } from "./parts";

const regulationsURL = "https://www.azgfd.com/fishing-2/";

export function RulesSection({ prep }: { prep: Prep }) {
  const [open, setOpen] = useState(false);
  const ruleSet = prep.ruleSet ?? null;
  const limits = keyLimits(prep);
  const layerName = prep.layer === "community" ? "Community water" : "Statewide";
  const spotRules = prep.rules.filter((r) => r.scope === "spot");
  const layerRules = prep.rules.filter((r) => r.scope !== "spot");
  return (
    <section>
      <SectionHeader title="Rules" trailing={ruleSet ? `${layerName} limits` : undefined} />
      <Card>
        {ruleSet ? (
          <>
            {limits.length > 0 && (
              <div className="prep-facts">
                {limits.map((l) => (
                  <div key={l.id} className="prep-fact" aria-label={l.spoken} role="group">
                    <span className="prep-fact-label" aria-hidden="true">{l.subject}</span>
                    <span className="prep-fact-value" aria-hidden="true">{l.count}</span>
                    {l.size && <span className="prep-fact-detail" aria-hidden="true">{l.size}</span>}
                  </div>
                ))}
              </div>
            )}
            <Disclosure
              open={open}
              onToggle={() => setOpen((o) => !o)}
              label={open ? "Hide rules for this Spot" : "All rules for this Spot"}
            />
            {open && (
              <div className="prep-rules">
                {spotRules.length === 0 ? (
                  <RuleLine text="No special rules at this Spot" />
                ) : (
                  spotRules.map((rule) => (
                    <RuleLine key={rule.id} text={rule.subject ? `${rule.subject}: ${rule.summary.toLowerCase()}` : rule.summary} />
                  ))
                )}
                <p className="prep-rules-subhead">{`${layerName} daily limits`}</p>
                {layerRules.map((rule) => (
                  <RuleLine key={rule.id} text={ruleLabel(rule)} trailing={rule.summary} />
                ))}
                <p className="prep-rules-note">{`From Commission Order 40, ${ruleSet.years}. Check AZGFD before you go.`}</p>
                <RulesLink href={ruleSet.sourceUrl} />
              </div>
            )}
          </>
        ) : (
          // No reviewed edition is loaded: say so rather than show unchecked limits.
          <div className="prep-card-text">
            <p className="prep-body">Limits aren't checked yet</p>
            <p className="prep-sub">
              We show limits once each one is checked against the Commission Order 40 booklet. Check AZGFD before you go.
            </p>
            <RulesLink href={regulationsURL} />
          </div>
        )}
      </Card>
    </section>
  );
}

function RuleLine({ text, trailing }: { text: string; trailing?: string }) {
  return (
    <div className="prep-rule">
      <span className="prep-rule-text">{text}</span>
      {trailing && <span className="prep-rule-trailing">{trailing}</span>}
    </div>
  );
}
