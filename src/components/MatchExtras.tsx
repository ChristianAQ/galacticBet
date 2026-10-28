import { useId, useState } from "react";
import {
  ArrowUpRight,
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  CircleDot,
  MapPin,
  RefreshCw,
  Tv,
  UsersRound,
} from "lucide-react";
import type { Match } from "../lib/domain";
import {
  matchExternalLinks,
  type MatchInsight,
  type MatchLineup,
  type MatchPlayer,
} from "../lib/matchInsightsData";
import "../styles/matchExtras.css";

type DetailTab = "goals" | "lineups" | "statistics";
const detailTabs = [
  { id: "goals", label: "Goles", Icon: CircleDot },
  { id: "lineups", label: "Alineaciones", Icon: UsersRound },
  {
    id: "statistics",
    label: "Estadísticas",
    Icon: ChartNoAxesColumnIncreasing,
  },
] as const;

function PlayerList({ players }: { players: MatchPlayer[] }) {
  return (
    <ul className="match-extra-players">
      {players.map((player, index) => (
        <li key={`${player.name}-${player.number || index}`}>
          <span
            className="match-extra-dorsal"
            aria-label={
              player.number ? `Dorsal ${player.number}` : "Sin dorsal"
            }
          >
            {player.number || "—"}
          </span>
          <strong>{player.name}</strong>
          {player.position && <small>{player.position}</small>}
        </li>
      ))}
    </ul>
  );
}

function TeamLineup({ name, lineup }: { name: string; lineup?: MatchLineup }) {
  const starters = lineup?.players.filter((p) => p.starter) || [];
  const bench = lineup?.players.filter((p) => !p.starter) || [];
  return (
    <section className="match-extra-lineup">
      <div className="match-extra-lineup-heading">
        <h4>{name}</h4>
        {lineup?.formation && <span>{lineup.formation}</span>}
      </div>
      {starters.length ? (
        <>
          <p className="match-extra-squad-label">Titulares</p>
          <PlayerList players={starters} />
        </>
      ) : (
        <p className="match-extra-empty">Once inicial no disponible.</p>
      )}
      {bench.length > 0 && (
        <details className="match-extra-bench">
          <summary>
            <span>
              Suplentes <small>{bench.length}</small>
            </span>
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
          <PlayerList players={bench} />
        </details>
      )}
    </section>
  );
}

export default function MatchExtras({
  match,
  insight,
  loading,
  error,
  onRetry,
  demo = false,
}: {
  match: Match;
  insight: MatchInsight | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  demo?: boolean;
}) {
  const [tab, setTab] = useState<DetailTab>("goals");
  const headingId = useId();
  const panelId = useId();
  const links = matchExternalLinks(match, insight);
  const hasInsight = Boolean(insight) && !demo;
  const updatedAt = insight
    ? new Intl.DateTimeFormat("es-ES", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(insight.fetchedAt))
    : "";

  return (
    <section className="match-extras" aria-labelledby={headingId}>
      <header className="match-extras-heading">
        <div>
          <h3 id={headingId}>El partido, al detalle</h3>
          <p>
            {hasInsight ? (
              <>
                Actualizado{" "}
                <time dateTime={insight!.fetchedAt}>{updatedAt}</time>
              </>
            ) : demo ? (
              "Datos de ejemplo"
            ) : (
              "Alineaciones, goles y estadísticas"
            )}
          </p>
        </div>
        {hasInsight && <span className="match-extra-source">ESPN</span>}
      </header>

      {demo ? (
        <p className="match-extra-empty">
          La demo no consulta información de partidos reales.
        </p>
      ) : (
        <>
          <div
            className="match-extra-tabs"
            role="group"
            aria-label="Información del partido"
          >
            {detailTabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={tab === id}
                aria-controls={panelId}
                onClick={() => setTab(id)}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div id={panelId} className="match-extra-panel" aria-busy={loading}>
            {loading ? (
              <p className="match-extra-empty" role="status">
                Cargando información del partido…
              </p>
            ) : error ? (
              <div className="match-extra-empty" role="status">
                <p>{error}</p>
                <button
                  type="button"
                  className="match-extra-retry"
                  onClick={onRetry}
                >
                  <RefreshCw size={14} aria-hidden="true" /> Reintentar
                </button>
              </div>
            ) : !insight ? (
              <p className="match-extra-empty">
                Los detalles aún no están disponibles. Puedes consultar la ficha
                externa mientras se actualizan.
              </p>
            ) : tab === "goals" ? (
              insight.goals.length ? (
                <>
                  <ol
                    className="match-extra-goals"
                    aria-label="Goleadores del partido"
                  >
                    {insight.goals.map((goal, index) => (
                      <li key={`${goal.minute}-${goal.scorer}-${index}`}>
                        <span className="match-extra-minute">
                          {goal.minute}
                        </span>
                        <span
                          className={`match-extra-goal-marker ${goal.side}`}
                          aria-hidden="true"
                        >
                          <CircleDot size={15} />
                        </span>
                        <div>
                          <strong>{goal.scorer}</strong>
                          <span>
                            {goal.side === "home" ? match.home : match.away}
                          </span>
                          {goal.assist && (
                            <small>Asistencia: {goal.assist}</small>
                          )}
                          {goal.kind !== "goal" && (
                            <em>
                              {goal.kind === "penalty"
                                ? "Penalti"
                                : "En propia puerta"}
                            </em>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                  {["EXTRA_TIME", "PENALTY_SHOOTOUT"].includes(
                    match.scoreDuration || "",
                  ) && (
                    <p className="match-extra-note">
                      Incluye goles de la prórroga cuando están disponibles. La
                      tanda de penaltis no se incluye.
                    </p>
                  )}
                </>
              ) : (
                <p className="match-extra-empty">
                  Detalle de goleadores no disponible.
                </p>
              )
            ) : tab === "lineups" ? (
              insight.lineups.length ? (
                <div className="match-extra-lineups">
                  <TeamLineup
                    name={match.home}
                    lineup={insight.lineups.find((l) => l.side === "home")}
                  />
                  <TeamLineup
                    name={match.away}
                    lineup={insight.lineups.find((l) => l.side === "away")}
                  />
                </div>
              ) : (
                <p className="match-extra-empty">
                  Alineaciones no disponibles. Suelen publicarse cerca del
                  inicio del partido.
                </p>
              )
            ) : insight.statistics.length ? (
              <>
                <table className="match-extra-stats">
                  <caption className="sr-only">
                    Estadísticas del partido según ESPN
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{match.home}</th>
                      <th scope="col">
                        <span className="sr-only">Estadística</span>
                      </th>
                      <th scope="col">{match.away}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insight.statistics.map((stat, index) => (
                      <tr key={`${stat.label}-${index}`}>
                        <td>{stat.home}</td>
                        <th scope="row">{stat.label}</th>
                        <td>{stat.away}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {["EXTRA_TIME", "PENALTY_SHOOTOUT"].includes(
                  match.scoreDuration || "",
                ) && (
                  <p className="match-extra-note">
                    Las estadísticas del proveedor pueden incluir la prórroga.
                  </p>
                )}
              </>
            ) : (
              <p className="match-extra-empty">
                Estadísticas de este encuentro no disponibles.
              </p>
            )}
          </div>

          {hasInsight &&
            (insight!.venue ||
              insight!.referee ||
              insight!.attendance !== undefined) && (
              <dl className="match-extra-meta">
                {insight!.venue && (
                  <div>
                    <dt>
                      <MapPin size={13} aria-hidden="true" /> Estadio
                    </dt>
                    <dd>{insight!.venue}</dd>
                  </div>
                )}
                {insight!.referee && (
                  <div>
                    <dt>Árbitro</dt>
                    <dd>{insight!.referee}</dd>
                  </div>
                )}
                {insight!.attendance !== undefined && (
                  <div>
                    <dt>Asistencia</dt>
                    <dd>
                      {new Intl.NumberFormat("es-ES").format(
                        insight!.attendance,
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            )}

          <div className="match-extra-links">
            <a
              href={links.television}
              target="_blank"
              rel="noopener noreferrer"
              className="match-extra-tv"
            >
              <Tv size={19} aria-hidden="true" />
              <span>
                <strong>Dónde verlo</strong>
                <small>Consulta canales y disponibilidad en España</small>
              </span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <div className="match-extra-external">
              <a href={links.details} target="_blank" rel="noopener noreferrer">
                Más información <ArrowUpRight size={13} aria-hidden="true" />
              </a>
              {links.source && (
                <a
                  href={links.source}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ficha en ESPN <ArrowUpRight size={13} aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
          {hasInsight && (
            <p className="match-extra-note match-extra-attribution">
              Datos complementarios de ESPN, sujetos a disponibilidad.
              Actualización periódica.
            </p>
          )}
        </>
      )}
    </section>
  );
}
