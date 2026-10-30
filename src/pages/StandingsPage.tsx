import { competitionName } from "../lib/competitions";
import type { User } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import { Empty, PageTitle, PrivateGate, readableError } from "../components/ui";
import {
  getCachedGroupRankings,
  loadGroupRankings,
  type Group,
} from "../lib/data";
import { type Match } from "../lib/domain";
import CompetitionSwitch from "../components/CompetitionSwitch";
import FilterPanel, { FilterField } from "../components/FilterPanel";
import RoundSelector from "../components/RoundSelector";
import {
  MyRankCard,
  Podium,
  RankAvatar,
  RankBadge,
} from "../components/RankingWidgets";
import { privateCache } from "../lib/memoryCache";
import { preferenceStore } from "../lib/preferences";
import { useGroupSelection } from "../lib/useGroupSelection";
import {
  buildRanking,
  rankingRounds,
  currentRankingRound,
} from "../lib/rankings";
import {
  roundOptions,
  roundShortLabel,
  type RoundOption,
} from "../lib/roundOptions";

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
  const { groupId, selectGroup, preferences } = useGroupSelection(
    user?.uid || "",
    groups,
  );
  const competition = preferences.competition;
  const [combined, setCombined] = useState(false);
  const [period, setPeriod] = useState<"all" | "round">("round");
  const scope = period === "all" && combined ? "global" : competition;
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

  const cached =
    selectedGroup && user ? getCachedGroupRankings(selectedGroup) : undefined;
  useEffect(() => {
    if (!loadKey || !selectedGroup) return;
    let active = true;
    setResult({ key: loadKey, data: getCachedGroupRankings(selectedGroup) });
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

  useEffect(() => {
    const refresh = () => {
      if (
        document.visibilityState === "visible" &&
        selectedGroup &&
        !getCachedGroupRankings(selectedGroup)
      )
        setRetry((n) => n + 1);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadKey]);
  const data = result.key === loadKey ? result.data || cached : cached;
  const error = result.key === loadKey ? result.error : undefined;
  const rounds = useMemo(
    () => rankingRounds(data?.seasons || [], matches, scope),
    [data, matches, scope],
  );
  const current = useMemo(
    () =>
      currentRankingRound(
        matches,
        rounds.map((r) => r.id),
      ),
    [matches, rounds],
  );
  const selectedRound = rounds.some((r) => r.id === round) ? round : current;
  const roundChoices = useMemo((): RoundOption[] => {
    const ids = new Set(rounds.map((r) => r.id));
    const known = new Map(
      roundOptions(matches.filter((m) => ids.has(m.roundId))).map((r) => [
        r.id,
        r,
      ]),
    );
    return rounds.map((r) => {
      const [, , stage = "", matchday = "0"] = r.id.split("-");
      return {
        ...(known.get(r.id) || {
          id: r.id,
          short: roundShortLabel({ stage, matchday: Number(matchday) || 0 }),
          start: r.kickoff,
          end: r.kickoff,
          state: "finished" as const,
          matches: 0,
        }),
        label: r.label,
      };
    });
  }, [rounds, matches]);
  const roundUnavailable = period === "round" && !selectedRound;
  const rows = useMemo(
    () =>
      buildRanking(
        data?.participants || [],
        roundUnavailable ? [] : data?.seasons || [],
        scope,
        period === "round" ? selectedRound : "",
      ),
    [data, roundUnavailable, scope, period, selectedRound],
  );
  const hasPoints = rows.some((r) => r.points > 0);
  const leaderPoints = rows[0]?.points || 0;
  const title =
    period === "all"
      ? "Todas las jornadas"
      : rounds.find((r) => r.id === selectedRound)?.label || "Por jornada";

  return (
    <>
      <PageTitle eyebrow="CADA ACIERTO SUMA" title="La clasificación" />
      {!user ? (
        <PrivateGate onLogin={onLogin} />
      ) : (
        <>
          <FilterPanel
            title={selectedGroup?.name || "Selecciona un grupo"}
            summary={
              period === "round" && selectedRound
                ? title
                : `${scope === "global" ? "Todas las competiciones" : competitionName(competition)} · ${title}`
            }
            competition={scope === "global" ? "global" : competition}
            applyLabel="Ver clasificación"
          >
            <FilterField label="Grupo">
              <select
                aria-label="Grupo"
                value={groupId}
                onChange={(e) => {
                  selectGroup(e.target.value);
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
            </FilterField>
            <CompetitionSwitch
              value={competition}
              combined={period === "all" && combined}
              onChange={(value) => {
                preferenceStore.update(user.uid, { competition: value });
                setCombined(false);
                setRound("");
              }}
            />
            <div
              className="standings-period"
              data-period={period}
              role="group"
              aria-label="Periodo de clasificación"
            >
              <button
                type="button"
                aria-pressed={period === "round"}
                onClick={() => setPeriod("round")}
              >
                Por jornada
              </button>
              <button
                type="button"
                aria-pressed={period === "all"}
                onClick={() => setPeriod("all")}
              >
                Todas las jornadas
              </button>
            </div>
            {period === "all" && (
              <label className="standings-global-toggle">
                <input
                  type="checkbox"
                  checked={combined}
                  onChange={(e) => setCombined(e.target.checked)}
                />
                <span>Sumar todas las competiciones</span>
              </label>
            )}
          </FilterPanel>
          {selectedGroup && period === "round" && data && (
            <RoundSelector
              rounds={roundChoices}
              value={selectedRound}
              current={current}
              onChange={setRound}
            />
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
                  onClick={() => {
                    privateCache.clear();
                    setRetry((n) => n + 1);
                  }}
                >
                  Reintentar
                </button>
              </div>
            ) : !data ? (
              <div
                className="standings-skeleton"
                role="status"
                aria-label="Cargando clasificación"
              >
                <span />
                <span />
                <span />
                <span />
              </div>
            ) : (
              <div
                className="ranking-view"
                key={`${groupId}:${scope}:${period}:${selectedRound}`}
              >
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
                {hasPoints && rows.length >= 2 && (
                  <Podium rows={rows} userId={user.uid} />
                )}
                <MyRankCard rows={rows} userId={user.uid} />
                <table className="standings-table">
                  <caption className="sr-only">
                    {selectedGroup.name} · {title} ·{" "}
                    {scope === "global"
                      ? "Global del grupo"
                      : competitionName(scope)}
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
                        <td>
                          <RankBadge position={r.position} />
                        </td>
                        <th scope="row">
                          <span className="standings-player">
                            <RankAvatar name={r.name} avatar={r.avatar} />
                            <span className="standings-name">
                              <span>
                                {r.name}
                                {r.id === user.uid && <small> Tú</small>}
                              </span>
                              <span
                                className="standings-bar"
                                aria-hidden="true"
                              >
                                <i
                                  style={{
                                    width: `${leaderPoints ? (r.points / leaderPoints) * 100 : 0}%`,
                                  }}
                                />
                              </span>
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
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
