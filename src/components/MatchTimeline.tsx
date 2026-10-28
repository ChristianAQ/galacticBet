import { ArrowLeftRight, CircleDot } from "lucide-react";
import type { Match } from "../lib/domain";
import type { MatchInsight } from "../lib/matchInsightsData";
import { chronologicalGoals } from "../lib/matchPresentation";
const labels = {
  "yellow-card": "Tarjeta amarilla",
  "red-card": "Tarjeta roja",
  "second-yellow": "Segunda amarilla",
  substitution: "Cambio",
};
export default function MatchTimeline({
  match,
  insight,
}: {
  match: Match;
  insight: MatchInsight;
}) {
  const events = chronologicalGoals([
    ...insight.goals.map((g) => ({
      ...g,
      player: g.scorer,
      playerOut: undefined as string | undefined,
      label:
        g.kind === "penalty"
          ? "Gol de penalti"
          : g.kind === "own-goal"
            ? "Gol en propia puerta"
            : "Gol",
    })),
    ...(insight.incidents || []).map((i) => ({
      ...i,
      assist: undefined as string | undefined,
      label: labels[i.kind],
    })),
  ]);
  if (!events.length)
    return (
      <p className="match-extra-empty">
        Todavía no hay eventos disponibles para este partido.
      </p>
    );
  return (
    <>
      <ol className="match-extra-goals" aria-label="Goles, tarjetas y cambios">
        {events.map((e, index) => (
          <li
            className={`goal-event ${e.side}`}
            key={`${e.minute}-${e.kind}-${e.player}-${index}`}
          >
            <span className="match-extra-minute">{e.minute}</span>
            <span
              className={`match-extra-goal-marker ${e.side}`}
              aria-hidden="true"
            >
              {e.kind === "substitution" ? (
                <ArrowLeftRight size={15} />
              ) : e.kind.includes("card") || e.kind === "second-yellow" ? (
                <i className={`incident-card ${e.kind}`} />
              ) : (
                <CircleDot size={15} />
              )}
            </span>
            <div>
              <small className="incident-label">{e.label}</small>
              <strong>{e.player}</strong>
              <span>{e.side === "home" ? match.home : match.away}</span>
              {e.playerOut && <small>Sale {e.playerOut}</small>}
              {e.assist && <small>Asistencia: {e.assist}</small>}
            </div>
          </li>
        ))}
      </ol>
      {["EXTRA_TIME", "PENALTY_SHOOTOUT"].includes(
        match.scoreDuration || "",
      ) && (
        <p className="match-extra-note">
          Incluye la prórroga cuando está disponible. La tanda de penaltis no se
          incluye.
        </p>
      )}
    </>
  );
}
