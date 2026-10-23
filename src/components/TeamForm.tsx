import { memo } from "react";
import type { Match } from "../lib/domain";
import { recentForm, type Side } from "../lib/matchInsights";
export const formNames = { win: "Victoria", draw: "Empate", loss: "Derrota" };
const TeamForm = memo(function TeamForm({
  match,
  side,
  matches,
  now = Date.now(),
}: {
  match: Match;
  side: Side;
  matches: Match[];
  now?: number;
}) {
  const form = recentForm(match, side, matches, now);
  const missing = 5 - form.length;
  const summary = form
    .map(
      (f) =>
        `${formNames[f.result]}, ${f.match.home} ${f.match.homeScore} a ${f.match.awayScore} ${f.match.away}`,
    )
    .join("; ");
  return (
    <span
      className="team-form"
      role="img"
      aria-label={`${match[side]}: ${form.length} de 5 resultados previos disponibles a 90 minutos, de más antiguo a más reciente.${summary ? " " + summary : " Sin historial disponible."}`}
    >
      {Array.from({ length: missing }, (_, i) => (
        <span
          key={`missing-${i}`}
          className="form-dot form-missing"
          title="Sin resultado previo disponible"
        />
      ))}
      {form.map((f) => (
        <span
          key={f.match.id}
          className={`form-dot form-${f.result}`}
          title={`${formNames[f.result]} · ${f.match.home} ${f.match.homeScore}–${f.match.awayScore} ${f.match.away} · ${new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(new Date(f.match.utcDate))} · 90 minutos`}
        />
      ))}
    </span>
  );
});
export default TeamForm;
export function FormGuide() {
  return (
    <div className="form-guide">
      <span>Forma a 90 min · más reciente a la derecha</span>
      <span className="form-guide-key">
        <span>
          <i className="form-dot form-win" />
          Victoria
        </span>
        <span>
          <i className="form-dot form-draw" />
          Empate
        </span>
        <span>
          <i className="form-dot form-loss" />
          Derrota
        </span>
        <span>
          <i className="form-dot form-missing" />
          Sin datos
        </span>
      </span>
    </div>
  );
}
