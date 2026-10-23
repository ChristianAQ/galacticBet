import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Empty, PageTitle, PrivateGate, readableError } from "../components/ui";
import { loadGroupRankings, type Group } from "../lib/data";
import { preferredRound, type Match } from "../lib/domain";
import { buildRanking, rankingRounds } from "../lib/rankings";

export default function StandingsPage({
  groups,
  matches,
  user,
  onLogin,
}: {
  groups: Group[];
  matches: Match[];
  user: User | null;
  onLogin: () => void;
}) {
  const [params] = useSearchParams();
  const [groupId, setGroupId] = useState(params.get("group") || "");
  const [scope, setScope] = useState("global");
  const [period, setPeriod] = useState<"all" | "round">("all");
  const [round, setRound] = useState("");
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data?: Awaited<ReturnType<typeof loadGroupRankings>>;
    error?: string;
  }>({ key: "" });
  const selectedGroup = groups.find((g) => g.id === groupId);
  const membersKey = JSON.stringify(selectedGroup?.memberIds || []);
  const loadKey =
    user && selectedGroup ? `${user.uid}:${groupId}:${membersKey}` : "";

  useEffect(() => {
    if (!loadKey || !selectedGroup) return;
    let active = true;
    setResult({ key: loadKey });
    loadGroupRankings(selectedGroup)
      .then((data) => {
        if (active) setResult({ key: loadKey, data });
      })
      .catch((e: unknown) => {
        if (active) setResult({ key: loadKey, error: readableError(e) });
      });
    return () => {
      active = false;
    };
    // The key includes the signed-in user, group and current member IDs.
  }, [loadKey, retry]);

  const data = result.key === loadKey ? result.data : undefined;
  const error = result.key === loadKey ? result.error : undefined;
  const rounds = rankingRounds(data?.seasons || [], matches, scope);
  const selectedRound = rounds.some((r) => r.id === round)
    ? round
    : preferredRound(
        matches.filter((m) => rounds.some((r) => r.id === m.roundId)),
      ) ||
      rounds.at(-1)?.id ||
      "";
  const roundUnavailable = period === "round" && !selectedRound;
  const rows = buildRanking(
    data?.participants || [],
    roundUnavailable ? [] : data?.seasons || [],
    scope,
    period === "round" ? selectedRound : "",
  );
  const hasPoints = rows.some((r) => r.points > 0);
  const title =
    period === "all"
      ? "Todas las jornadas"
      : rounds.find((r) => r.id === selectedRound)?.label || "Por jornada";

  return (
    <>
      <PageTitle
        eyebrow="CADA ACIERTO SUMA"
        title="La clasificación"
        description="Jornada a jornada, se escribe la historia de vuestro grupo."
      />
      {!user ? (
        <PrivateGate onLogin={onLogin} />
      ) : (
        <>
          <div className="filter-row standings-filters">
            <label>
              Grupo
              <select
                aria-label="Grupo"
                value={groupId}
                onChange={(e) => {
                  setGroupId(e.target.value);
                  setRound("");
                }}
              >
                <option value="">Selecciona un grupo</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Competición
              <select
                aria-label="Competición de clasificación"
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value);
                  setRound("");
                }}
              >
                <option value="global">Global del grupo</option>
                <option value="PD">LaLiga</option>
                <option value="CL">Champions League</option>
              </select>
            </label>
          </div>
          <div
            className="standings-period"
            role="group"
            aria-label="Periodo de clasificación"
          >
            <button
              type="button"
              aria-pressed={period === "all"}
              onClick={() => setPeriod("all")}
            >
              Todas las jornadas
            </button>
            <button
              type="button"
              aria-pressed={period === "round"}
              onClick={() => setPeriod("round")}
            >
              Por jornada
            </button>
          </div>
          {period === "round" && (
            <div className="filter-row standings-filters">
              <label>
                Jornada o ronda
                <select
                  aria-label="Jornada de clasificación"
                  value={selectedRound}
                  disabled={!rounds.length}
                  onChange={(e) => setRound(e.target.value)}
                >
                  {!rounds.length && (
                    <option value="">Sin jornadas disponibles</option>
                  )}
                  {rounds.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div
            className="panel standings-panel"
            aria-busy={Boolean(loadKey && !data && !error)}
          >
            {!selectedGroup ? (
              <Empty title="Tu grupo, en la tabla">
                Selecciona un grupo para ver a todos sus participantes y sus
                puntos.
              </Empty>
            ) : error ? (
              <div role="alert" className="empty">
                <h3>No se pudo cargar la clasificación</h3>
                <p>{error}</p>
                <button
                  className="button secondary"
                  onClick={() => setRetry((n) => n + 1)}
                >
                  Reintentar
                </button>
              </div>
            ) : !data ? (
              <Empty title="Cargando clasificación…">
                Preparando los participantes y sus puntuaciones.
              </Empty>
            ) : (
              <>
                <div className="standings-heading">
                  <div>
                    <h2>{selectedGroup.name}</h2>
                    <p>{title}</p>
                  </div>
                  <span>
                    {rows.length}{" "}
                    {rows.length === 1 ? "participante" : "participantes"}
                  </span>
                </div>
                {roundUnavailable ? (
                  <p className="standings-note" role="status">
                    Aún no hay jornadas disponibles para esta competición. Estos
                    son los participantes, con 0 puntos para esta vista.
                  </p>
                ) : (
                  !hasPoints && (
                    <p className="standings-note" role="status">
                      Todos en la línea de salida. Los puntos aparecerán cuando
                      se sincronicen y puntúen los resultados.
                    </p>
                  )
                )}
                <table className="standings-table">
                  <caption className="sr-only">
                    {selectedGroup.name} · {title} ·{" "}
                    {scope === "global"
                      ? "Global del grupo"
                      : scope === "PD"
                        ? "LaLiga"
                        : "Champions League"}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Pos.</th>
                      <th scope="col">Jugador</th>
                      <th scope="col">Aciertos</th>
                      <th scope="col">Puntos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.id}
                        className={
                          r.id === user.uid ? "standings-me" : undefined
                        }
                      >
                        <td className="green-text">
                          {r.position}
                          {hasPoints && r.position === 1 ? " 🏆" : ""}
                        </td>
                        <th scope="row">
                          <span className="standings-player">
                            <span className="rival-avatar">
                              {r.avatar ? (
                                <img src={r.avatar} alt="" />
                              ) : (
                                r.name.charAt(0).toUpperCase()
                              )}
                            </span>
                            <span className="standings-name">
                              {r.name}
                              {r.id === user.uid && <small> Tú</small>}
                            </span>
                          </span>
                        </th>
                        <td>{r.hits}</td>
                        <td>
                          <strong>{r.points}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
