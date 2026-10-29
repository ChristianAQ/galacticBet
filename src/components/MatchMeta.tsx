import { MapPin } from "lucide-react";
import type { MatchInsight } from "../lib/matchInsightsData";
export default function MatchMeta({
  insight,
}: {
  insight: MatchInsight | null;
}) {
  return (
    <>
      {insight &&
        (insight.venue ||
          insight.referee ||
          insight.attendance !== undefined) && (
          <dl className="match-extra-meta">
            {insight.venue && (
              <div>
                <dt>
                  <MapPin size={13} aria-hidden="true" /> Estadio
                </dt>
                <dd>{insight.venue}</dd>
              </div>
            )}
            {insight.referee && (
              <div>
                <dt>Árbitro</dt>
                <dd>{insight.referee}</dd>
              </div>
            )}
            {insight.attendance !== undefined && (
              <div>
                <dt>Asistencia</dt>
                <dd>
                  {new Intl.NumberFormat("es-ES").format(insight.attendance)}
                </dd>
              </div>
            )}
          </dl>
        )}
    </>
  );
}
