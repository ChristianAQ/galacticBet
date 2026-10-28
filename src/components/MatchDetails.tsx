import { CalendarDays, GitCompareArrows } from "lucide-react";
import { matchStatusLabel, roundLabel, type Match } from "../lib/domain";
import {
  headToHead,
  hasRegulationResult,
  knockoutContext,
  seasonStats,
} from "../lib/matchInsights";
import CompetitionLogo from "./CompetitionLogo";
import Modal from "./Modal";
import MatchResult from "./MatchResult";
import MatchExtras from "./MatchExtras";
import MatchCalendarAction from "./MatchCalendarAction";
import { useMatchInsight } from "../lib/useMatchInsight";
import TeamForm from "./TeamForm";
import { Team } from "./ui";

export default function MatchDetails({
  match,
  matches,
  onClose,
  demo = false,
}: {
  match: Match;
  matches: Match[];
  onClose: () => void;
  demo?: boolean;
}) {
  const insights = useMatchInsight(match, demo);
  const context = knockoutContext(match, matches);
  const home = seasonStats(match, "home", matches),
    away = seasonStats(match, "away", matches);
  const previous = headToHead(match, matches);
  const rows = [
    ["Partidos", home.played, away.played],
    ["Victorias", home.wins, away.wins],
    ["Empates", home.draws, away.draws],
    ["Derrotas", home.losses, away.losses],
    ["Goles a favor", home.goalsFor, away.goalsFor],
    ["Goles en contra", home.goalsAgainst, away.goalsAgainst],
    [
      "Diferencia de goles",
      home.goalsFor - home.goalsAgainst,
      away.goalsFor - away.goalsAgainst,
    ],
  ];
  const resultKnown = match.homeScore !== null && match.awayScore !== null;
  return (
    <Modal
      title="Ficha del partido"
      className="match-details-modal"
      onClose={onClose}
    >
      <div className="match-detail-competition">
        <CompetitionLogo code={match.competition} small />
        <span>
          <strong>
            {match.competition === "PD"
              ? "LaLiga EA Sports"
              : "UEFA Champions League"}
          </strong>
          <small>
            {roundLabel(match)}
            {context?.leg ? ` · ${context.leg === 1 ? "Ida" : "Vuelta"}` : ""}
          </small>
        </span>
      </div>
      <div className="match-detail-teams">
        <div>
          <Team name={match.home} crest={match.homeCrest} />
          <TeamForm match={match} side="home" matches={matches} />
        </div>
        <div className="match-detail-score">
          <strong>
            {resultKnown
              ? `${match.homeScore} – ${match.awayScore}`
              : match.status === "FINISHED"
                ? "—"
                : "vs"}
          </strong>
          <small>{matchStatusLabel[match.status] || match.status}</small>
          {resultKnown && <small>A 90 minutos</small>}
        </div>
        <div>
          <Team name={match.away} crest={match.awayCrest} />
          <TeamForm match={match} side="away" matches={matches} />
        </div>
      </div>
      <p className="match-local-date">
        <CalendarDays size={15} />
        <time dateTime={match.utcDate}>
          {new Intl.DateTimeFormat("es", {
            dateStyle: "full",
            timeStyle: "short",
          }).format(new Date(match.utcDate))}
        </time>
      </p>
      {!demo && <MatchCalendarAction match={match} />}
      {["EXTRA_TIME", "PENALTY_SHOOTOUT"].includes(
        match.scoreDuration || "",
      ) && (
        <p className="match-context-note">
          {match.scoreDuration === "EXTRA_TIME"
            ? "Este partido se resolvió con prórroga."
            : "Este partido se resolvió en una tanda de penaltis."}{" "}
          Marcador mostrado a 90 minutos.
        </p>
      )}
      {match.status === "FINISHED" && <MatchResult match={match} />}
      <MatchExtras match={match} {...insights} demo={demo} />
      {context && (
        <section className="match-insight-section">
          <h3>
            <GitCompareArrows size={16} />
            La eliminatoria
            {context.leg ? ` · ${context.leg === 1 ? "Ida" : "Vuelta"}` : ""}
          </h3>
          {context.firstLeg ? (
            <>
              <p className="first-leg-result">
                <span>Partido de ida</span>
                <strong>
                  {context.firstLeg.home}{" "}
                  {hasRegulationResult(context.firstLeg)
                    ? `${context.firstLeg.homeScore} – ${context.firstLeg.awayScore}`
                    : "vs"}{" "}
                  {context.firstLeg.away}
                </strong>
                <small>
                  {hasRegulationResult(context.firstLeg)
                    ? "Resultado a 90 minutos"
                    : matchStatusLabel[context.firstLeg.status] ||
                      context.firstLeg.status}
                </small>
              </p>
              {context.aggregate ? (
                <div className="aggregate-score">
                  <span>
                    {context.aggregate.played === 2
                      ? "Global reglamentario"
                      : "Global reglamentario tras la ida"}
                  </span>
                  <div>
                    <span>{match.home}</span>
                    <strong>
                      {context.aggregate.home} – {context.aggregate.away}
                    </strong>
                    <span>{match.away}</span>
                  </div>
                </div>
              ) : (
                <p className="match-data-note">
                  Global reglamentario pendiente.
                </p>
              )}
            </>
          ) : (
            <p className="match-data-note">Cruce completo no disponible.</p>
          )}
        </section>
      )}
      <section className="match-insight-section">
        <h3>Rendimiento de temporada</h3>
        <p className="match-data-note">
          {match.competition === "PD" ? "LaLiga" : "Champions"} ·{" "}
          {match.seasonId.split("-")[1]}/
          {String(Number(match.seasonId.split("-")[1]) + 1).slice(-2)}.
        </p>
        {!home.played && !away.played ? (
          <p className="match-context-note">
            Sin resultados previos esta temporada.
          </p>
        ) : (
          <table className="match-stats-table">
            <caption className="sr-only">
              Estadísticas previas de temporada
            </caption>
            <thead>
              <tr>
                <th scope="col">Dato</th>
                <th scope="col">{match.home}</th>
                <th scope="col">{match.away}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, a, b]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{a}</td>
                  <td>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="match-insight-section">
        <h3>Últimos enfrentamientos</h3>
        {previous.length ? (
          <ul className="head-to-head-list">
            {previous.map((m) => (
              <li key={m.id}>
                <span>
                  {new Intl.DateTimeFormat("es", {
                    dateStyle: "medium",
                  }).format(new Date(m.utcDate))}
                  <small>
                    {m.competition === "PD" ? "LaLiga" : "Champions"}
                  </small>
                </span>
                <span>
                  {m.home}
                  <strong>
                    {m.homeScore} – {m.awayScore}
                  </strong>
                  {m.away}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="match-data-note">
            Sin enfrentamientos anteriores disponibles.
          </p>
        )}
      </section>
    </Modal>
  );
}
