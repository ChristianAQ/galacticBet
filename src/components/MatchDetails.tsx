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
import TeamForm, { FormGuide } from "./TeamForm";
import { Team } from "./ui";

export default function MatchDetails({
  match,
  matches,
  onClose,
}: {
  match: Match;
  matches: Match[];
  onClose: () => void;
}) {
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
      <p className="match-data-note">
        Hora de tu dispositivo. Datos de la última sincronización; la
        actualización puede tener retraso.
      </p>
      {["EXTRA_TIME", "PENALTY_SHOOTOUT"].includes(
        match.scoreDuration || "",
      ) && (
        <p className="match-context-note">
          {match.scoreDuration === "EXTRA_TIME"
            ? "Este partido se resolvió con prórroga."
            : "Este partido se resolvió en una tanda de penaltis."}{" "}
          Aquí se muestra solo el marcador a 90 minutos, el que cuenta para la
          quiniela.
        </p>
      )}
      {match.status === "FINISHED" && !resultKnown && (
        <p className="match-context-note">
          El partido ha terminado, pero todavía no hay un marcador reglamentario
          fiable disponible. El resultado y los puntos se actualizarán cuando
          esté disponible.
        </p>
      )}
      <section className="match-insight-section">
        <h3>Forma antes del partido</h3>
        <FormGuide />
        <p className="match-data-note">
          Hasta cinco resultados previos disponibles de LaLiga y Champions,
          incluidos los de temporadas anteriores. Los puntos huecos indican que
          falta historial.
        </p>
      </section>
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
                  El global aparecerá cuando haya resultados reglamentarios
                  fiables.
                </p>
              )}
              <p className="match-data-note">
                No incluye prórroga ni penaltis. El global reglamentario puede
                diferir del resultado que decide qué equipo se clasifica.
              </p>
            </>
          ) : (
            <p className="match-data-note">
              El calendario disponible aún no permite identificar una ida y una
              vuelta con seguridad.
            </p>
          )}
        </section>
      )}
      <section className="match-insight-section">
        <h3>Rendimiento de temporada</h3>
        <p className="match-data-note">
          {match.competition === "PD" ? "LaLiga" : "Champions"} ·{" "}
          {match.seasonId.split("-")[1]}/
          {String(Number(match.seasonId.split("-")[1]) + 1).slice(-2)} ·
          resultados disponibles antes de este encuentro, a 90 minutos.
        </p>
        {!home.played && !away.played ? (
          <p className="match-context-note">
            Aún no hay resultados previos de esta temporada para estos equipos.
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
            No hay enfrentamientos anteriores entre ambos equipos en el
            historial disponible.
          </p>
        )}
      </section>
    </Modal>
  );
}
