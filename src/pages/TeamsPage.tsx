import { useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
import { PageTitle, Team } from "../components/ui";
import LineupPitch from "../components/LineupPitch";
import { useMatchInsight } from "../lib/useMatchInsight";
import {
  FEATURED_TEAMS,
  playerAge,
  positionName,
  type TeamDirectory,
} from "../lib/teamExplorer";
import { loadTeamDirectory } from "../lib/teamDirectoryCache";
import type { Match } from "../lib/domain";
import "../styles/matchExtras.css";
import "../styles/teams.css";
function Lineup({ match, club }: { match: Match; club: number }) {
  const { insight, loading, error, onRetry } = useMatchInsight(match, false);
  return (
    <section className="panel teams-lineup">
      <h3>
        {match.home} · {match.away}
      </h3>
      <p>
        {new Date(match.utcDate).toLocaleString("es", {
          dateStyle: "medium",
          timeStyle: "short",
        })}{" "}
        · Alineación de este partido
      </p>
      {loading ? (
        <p role="status">Cargando alineaciones…</p>
      ) : error ? (
        <p role="alert">
          No se pudieron cargar. <button onClick={onRetry}>Reintentar</button>
        </p>
      ) : insight?.lineups.some((l) => l.players.some((p) => p.starter)) ? (
        <>
          <LineupPitch
            match={match}
            lineups={insight.lineups}
            initialSide={match.homeTeamId === club ? "home" : "away"}
          />
          <small>
            Fuente: ESPN · Actualizado{" "}
            {new Date(insight.fetchedAt).toLocaleString("es")}
          </small>
        </>
      ) : (
        <p>La alineación de este partido todavía no está disponible.</p>
      )}
    </section>
  );
}
export default function TeamsPage({
  matches,
  demo = false,
}: {
  matches: Match[];
  demo?: boolean;
}) {
  const [directory, setDirectory] = useState<TeamDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [club, setClub] = useState<number>(81);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("squad");
  const [fixture, setFixture] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(!demo);
    setError(false);
    setDirectory(null);
    if (!demo)
      void loadTeamDirectory().then(
        (d) => {
          if (active) {
            setDirectory(d);
            setLoading(false);
          }
        },
        () => {
          if (active) {
            setError(true);
            setLoading(false);
          }
        },
      );
    return () => {
      active = false;
    };
  }, [attempt, demo]);
  const squad = directory?.teams.find((t) => t.id === club);
  const clubMatches = demo
    ? []
    : matches.filter((m) => m.homeTeamId === club || m.awayTeamId === club);
  const now = Date.now();
  const next = clubMatches
    .filter(
      (m) =>
        Date.parse(m.utcDate) >= now &&
        ["SCHEDULED", "TIMED", "IN_PLAY", "PAUSED"].includes(m.status),
    )
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate))
    .slice(0, 1);
  const recent = clubMatches
    .filter(
      (m) =>
        Date.parse(m.utcDate) < now &&
        ["FINISHED", "IN_PLAY", "PAUSED"].includes(m.status),
    )
    .sort((a, b) => b.utcDate.localeCompare(a.utcDate))
    .slice(0, 5);
  const fixtures = [...next, ...recent];
  const match = fixtures.find((m) => m.id === fixture) || recent[0] || next[0];
  const players =
    squad?.players.filter((p) =>
      p.name.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")),
    ) || [];
  const crest = (id: number) => {
    const m = matches.find((m) => m.homeTeamId === id || m.awayTeamId === id);
    return m?.homeTeamId === id ? m.homeCrest : m?.awayCrest;
  };
  return (
    <div className="teams-page">
      <PageTitle
        eyebrow="HERRAMIENTAS"
        title="Equipos y jugadores"
        description="Explora las plantillas y los onces de los clubes destacados."
      />
      <details className="panel teams-selector">
        <summary>
          <Team
            name={FEATURED_TEAMS.find((t) => t.id === club)!.name}
            crest={crest(club)}
          />
          <span>Cambiar equipo</span>
        </summary>
        <div className="teams-clubs" role="group" aria-label="Elegir equipo">
          {FEATURED_TEAMS.map((t) => (
            <button
              key={t.id}
              aria-pressed={club === t.id}
              onClick={(event) => {
                event.currentTarget.closest("details")?.removeAttribute("open");
                setClub(t.id);
                setSearch("");
                setFixture("");
              }}
            >
              <Team name={t.name} crest={crest(t.id)} />
            </button>
          ))}
        </div>
      </details>
      <div
        className="teams-tabs"
        role="group"
        aria-label="Información del equipo"
      >
        <button aria-pressed={tab === "squad"} onClick={() => setTab("squad")}>
          Plantilla
        </button>
        <button
          aria-pressed={tab === "lineup"}
          onClick={() => setTab("lineup")}
        >
          Alineaciones
        </button>
      </div>
      {demo ? (
        <p className="panel teams-note">
          Esta herramienta consulta datos reales fuera del modo demo.
        </p>
      ) : tab === "lineup" ? (
        <>
          {fixtures.length ? (
            <>
              <label className="teams-fixture">
                Partido
                <select
                  value={match?.id || ""}
                  onChange={(e) => setFixture(e.target.value)}
                >
                  {fixtures.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.home} – {m.away} ·{" "}
                      {new Date(m.utcDate).toLocaleDateString("es")}
                    </option>
                  ))}
                </select>
              </label>
              {match && (
                <Lineup key={`${club}-${match.id}`} match={match} club={club} />
              )}
            </>
          ) : (
            <p className="panel teams-note">
              No hay partidos disponibles de este equipo en el calendario
              sincronizado.
            </p>
          )}
        </>
      ) : (
        <section className="panel teams-squad">
          <header>
            <div>
              <h2>{FEATURED_TEAMS.find((t) => t.id === club)?.name}</h2>
              <small>
                {squad
                  ? `${squad.players.length} jugadores · Football-Data.org`
                  : "Plantilla del equipo"}
              </small>
            </div>
            <Users size={20} />
          </header>
          <label className="teams-search">
            <Search size={17} />
            <input
              aria-label="Buscar jugador"
              type="search"
              placeholder="Buscar jugador"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {loading ? (
            <p role="status">Cargando plantillas…</p>
          ) : error ? (
            <p role="alert">
              No se pudo cargar la plantilla.{" "}
              <button onClick={() => setAttempt((n) => n + 1)}>
                Reintentar
              </button>
            </p>
          ) : !squad ? (
            <p>
              Plantilla pendiente de sincronización o sin cobertura del
              proveedor. Los clubes se actualizan por turnos.
            </p>
          ) : (
            <>
              <ul className="teams-players">
                {players.map((p) => (
                  <li key={p.id}>
                    <span className="teams-player-icon" aria-hidden="true">
                      {p.name.charAt(0)}
                    </span>
                    <div>
                      <strong>{p.name}</strong>
                      <small>
                        {positionName(p.position)}
                        {p.nationality && ` · ${p.nationality}`}
                      </small>
                    </div>
                    <span className="teams-age">
                      {playerAge(p.birthDate) ?? "—"}
                      <small>años</small>
                    </span>
                  </li>
                ))}
              </ul>
              {!players.length && <p>No hay jugadores con ese nombre.</p>}
              <p className="teams-updated">
                Actualizado {new Date(squad.fetchedAt).toLocaleString("es")} ·
                La plantilla no representa un once confirmado.
              </p>
            </>
          )}
        </section>
      )}
      <details className="panel teams-coverage">
        <summary>Cobertura de los datos</summary>
        <p>
          <strong>Nota de rendimiento:</strong> no disponible en las fuentes
          integradas. No se calcula a partir de goles ni de minutos.
        </p>
        <p>
          <strong>Valor de mercado:</strong> no disponible. Es una estimación
          distinta al importe pagado por un traspaso; requiere un proveedor que
          publique ese dato y permita utilizarlo.
        </p>
        <p>
          Las alineaciones corresponden al partido seleccionado. Las fechas de
          nacimiento y plantillas dependen de la cobertura de Football-Data.org;
          los onces, de ESPN.
        </p>
      </details>
    </div>
  );
}
