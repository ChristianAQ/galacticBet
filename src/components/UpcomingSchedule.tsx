import { ArrowRight, CalendarDays, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import { roundLabel, type Match } from "../lib/domain";
import { kickoffLabel } from "../lib/matchInsights";
import { kickoffCountdown, roundHasStarted } from "../lib/schedule";
import CompetitionLogo from "./CompetitionLogo";
import { Team } from "./ui";

export default function UpcomingSchedule({
  matches,
  upcoming,
  now,
  loading,
}: {
  matches: Match[];
  upcoming: Match[];
  now: number;
  loading: boolean;
}) {
  return (
    <section
      className="schedule-board"
      aria-label="Próximas jornadas y partidos"
      aria-busy={loading}
    >
      <div className="schedule-board-heading">
        <div>
          <span className="eyebrow">AGENDA DE JUEGO</span>
          <h2>El próximo saque inicial</h2>
        </div>
        <Link to="/partidos">
          Calendario <ArrowRight size={15} />
        </Link>
      </div>
      <div className="schedule-grid">
        {(["PD", "CL"] as const).map((competition) => {
          const next = upcoming.find(
            (match) => match.competition === competition,
          );
          const started = next && roundHasStarted(matches, next, now);
          const isLeagueRound =
            !next ||
            ["REGULAR_SEASON", "LEAGUE_STAGE", "GROUP_STAGE"].includes(
              next.stage,
            );
          const roundName = isLeagueRound ? "jornada" : "ronda";
          const href = `/partidos?competition=${competition}${next ? `&round=${encodeURIComponent(next.roundId)}` : ""}`;
          return (
            <article className="schedule-card" key={competition}>
              <header className="schedule-competition">
                <CompetitionLogo code={competition} small />
                <h3>
                  {competition === "PD"
                    ? "LaLiga EA Sports"
                    : "Champions League"}
                </h3>
              </header>
              {loading ? (
                <div className="schedule-empty" role="status">
                  Cargando próximos encuentros…
                </div>
              ) : next ? (
                <>
                  <div className="schedule-round">
                    <strong>{roundLabel(next)}</strong>
                    <span>
                      {started
                        ? `${isLeagueRound ? "Jornada" : "Ronda"} en curso · próximo partido`
                        : `Comienza la ${roundName}`}
                    </span>
                  </div>
                  <div className="schedule-kickoff">
                    <span>
                      <Clock3 size={14} /> {kickoffCountdown(next.utcDate, now)}
                    </span>
                    <time dateTime={next.utcDate}>
                      {kickoffLabel(next.utcDate, now)}
                    </time>
                  </div>
                  <div
                    className="schedule-fixture"
                    aria-label={`${next.home} contra ${next.away}`}
                  >
                    <Team name={next.home} crest={next.homeCrest} />
                    <span className="schedule-versus">vs</span>
                    <Team name={next.away} crest={next.awayCrest} />
                  </div>
                  {next.status === "SCHEDULED" && (
                    <p className="schedule-provisional">Horario provisional</p>
                  )}
                </>
              ) : (
                <div className="schedule-empty">
                  <CalendarDays size={20} />
                  <strong>Sin próximos partidos confirmados</strong>
                  <span>
                    Consulta el calendario y los resultados disponibles.
                  </span>
                </div>
              )}
              <Link className="schedule-action" to={href}>
                {next && !loading ? `Ver ${roundName}` : "Ver calendario"}
                <ArrowRight size={15} />
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
