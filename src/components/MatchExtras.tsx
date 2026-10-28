import MatchStatistics from "./MatchStatistics";
import MatchTimeline from "./MatchTimeline";
import MatchProbability from "./MatchProbability";
import { useEffect, useId, useState } from "react";
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
import LineupPitch from "./LineupPitch";

import { availableMatchTabs, type DetailTab } from "../lib/matchDetailTabs";
const detailTabs = [
  {
    id: "probability",
    label: "Probabilidad",
    Icon: ChartNoAxesColumnIncreasing,
  },
  { id: "goals", label: "Eventos", Icon: CircleDot },
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
  const [selectedTab, setTab] = useState<DetailTab>(
    ["TIMED", "SCHEDULED"].includes(match.status) ? "probability" : "goals",
  );
  const [clockTick, setNow] = useState(Date.now());
  const now = Math.max(clockTick, Date.now());
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) setNow(Date.now());
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const available =
    !loading && !error && !demo ? availableMatchTabs(match, insight, now) : [];
  const tab = available.includes(selectedTab) ? selectedTab : available[0];
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
          {available.length > 0 && (
            <div
              className="match-extra-tabs"
              style={{
                gridTemplateColumns: `repeat(${available.length}, minmax(0, 1fr))`,
              }}
              role="group"
              aria-label="Información del partido"
            >
              {detailTabs
                .filter((item) => available.includes(item.id))
                .map(({ id, label, Icon }) => (
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
          )}
          <div
            id={panelId}
            tabIndex={-1}
            className={`match-extra-panel${tab === "statistics" ? " match-statistics-panel" : ""}`}
            aria-busy={loading}
          >
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
                  onClick={() => {
                    document.getElementById(panelId)?.focus();
                    onRetry();
                  }}
                >
                  <RefreshCw size={14} aria-hidden="true" /> Reintentar
                </button>
              </div>
            ) : !tab ? (
              <p className="match-extra-empty">
                Información del partido pendiente de publicación.
              </p>
            ) : tab === "probability" ? (
              <MatchProbability
                match={match}
                probability={insight?.probability}
                now={now}
              />
            ) : !insight ? (
              <p className="match-extra-empty">
                Los detalles aún no están disponibles. Puedes consultar la ficha
                externa mientras se actualizan.
              </p>
            ) : tab === "goals" ? (
              <MatchTimeline match={match} insight={insight} />
            ) : tab === "lineups" ? (
              insight.lineups.length ? (
                <>
                  <LineupPitch match={match} lineups={insight.lineups} />
                  <details className="lineup-full-list">
                    <summary>Ver lista completa y suplentes</summary>
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
                  </details>
                </>
              ) : (
                <p className="match-extra-empty">
                  Alineaciones no disponibles. Suelen publicarse cerca del
                  inicio del partido.
                </p>
              )
            ) : insight.statistics.length ? (
              <>
                <MatchStatistics
                  match={match}
                  statistics={insight.statistics}
                />
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
                <small>En vivo</small>
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
