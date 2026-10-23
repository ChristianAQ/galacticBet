import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  CheckCheck,
  ChevronDown,
  ChevronUp,
  LockKeyhole,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  canRevealPredictions,
  outcome,
  predictionSummary,
  type Match,
  type PredictionValue,
} from "../lib/domain";
import type { Participant } from "../lib/data";
import { db } from "../lib/firebase";
import { MatchRow, readableError } from "./ui";

export default function GroupPredictions({
  matches,
  history,
  participants,
  userId,
  groupId,
  seasonId,
  clock,
  demo,
  ownValues,
  sealed = false,
  loadingOwn = false,
}: {
  matches: Match[];
  history: Match[];
  participants: Participant[];
  userId: string;
  groupId: string;
  seasonId: string;
  clock: number;
  demo: boolean;
  ownValues: Record<string, PredictionValue>;
  sealed?: boolean;
  loadingOwn?: boolean;
}) {
  return (
    <section className="group-predictions" aria-label="Pronósticos del grupo">
      <div className="group-view-heading">
        <h2>El grupo</h2>
        {sealed && (
          <span className="round-state saved" role="status">
            <CheckCheck size={14} />
            Quiniela guardada
          </span>
        )}
      </div>
      {matches.map((m) => (
        <RivalsCard
          key={`${groupId}_${seasonId}_${m.id}`}
          match={m}
          history={history}
          participants={participants}
          userId={userId}
          groupId={groupId}
          seasonId={seasonId}
          revealed={canRevealPredictions(m, clock)}
          demo={demo}
          ownValue={ownValues[m.id]}
          loadingOwn={loadingOwn}
        />
      ))}
    </section>
  );
}
function RivalsCard({
  match,
  history,
  participants,
  userId,
  groupId,
  seasonId,
  revealed,
  demo,
  ownValue,
  loadingOwn,
}: {
  match: Match;
  history: Match[];
  participants: Participant[];
  userId: string;
  groupId: string;
  seasonId: string;
  revealed: boolean;
  demo: boolean;
  ownValue?: PredictionValue;
  loadingOwn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, PredictionValue>>({});
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setRows({});
    setReady(false);
    setError("");
    setPending(false);
    if (!open || !revealed) return;
    if (demo) {
      setRows({
        ...Object.fromEntries(
          participants
            .filter((p) => p.id !== userId)
            .map((p, i) => [
              p.id,
              (["1", "X", "2"] as const)[
                (i + Number(match.id.replace("demo-", ""))) % 3
              ],
            ]),
        ),
        ...(ownValue ? { [userId]: ownValue } : {}),
      });
      setReady(true);
      return;
    }
    if (!db) return;
    setPending(true);
    return onSnapshot(
      query(
        collection(
          db,
          "groups",
          groupId,
          "gameSeasons",
          seasonId,
          "predictions",
        ),
        where("matchId", "==", match.id),
      ),
      (snap) => {
        setRows(
          Object.fromEntries(
            snap.docs.map((d) => [d.data().userId, d.data().value]),
          ),
        );
        setPending(false);
        setReady(true);
      },
      (e) => {
        setError(readableError(e));
        setPending(false);
        setReady(true);
      },
    );
  }, [
    open,
    revealed,
    demo,
    groupId,
    seasonId,
    match.id,
    participants,
    userId,
    ownValue,
    attempt,
  ]);
  const available = participants.filter((p) => rows[p.id]).length;
  return (
    <article className="panel group-match-card">
      <MatchRow match={match} history={history} />
      <div
        className="match-own-pick"
        aria-label="Tu pronóstico"
        aria-busy={loadingOwn}
      >
        <span>Tu pronóstico</span>
        {loadingOwn ? (
          <span className="muted">Cargando…</span>
        ) : (
          <PickValue match={match} value={ownValue} compact />
        )}
      </div>
      {!revealed ? (
        <div className="rivals-waiting">
          <LockKeyhole size={13} />
          <span>
            {match.status === "POSTPONED"
              ? "Partido aplazado"
              : match.status === "CANCELLED"
                ? "Partido cancelado"
                : "A la espera del inicio"}
          </span>
        </div>
      ) : (
        <>
          <button
            className="rivals-toggle"
            disabled={participants.length === 0}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            <span>
              <Users size={17} />
              {open ? "Pronósticos del grupo" : "Ver pronósticos del grupo"}
              {participants.length > 0 && (
                <small>{participants.length} jugadores</small>
              )}
            </span>
            {open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
          </button>
          {open && (
            <div className="rivals-content" aria-busy={pending || !ready}>
              {pending || !ready ? (
                <p className="rivals-loading" role="status">
                  Reuniendo al vestuario…
                </p>
              ) : error ? (
                <div className="rivals-error">
                  <p role="alert">{error}</p>
                  <button
                    className="button secondary"
                    onClick={() => setAttempt((v) => v + 1)}
                  >
                    Volver a intentar
                  </button>
                </div>
              ) : (
                <>
                  <div className="rivals-count">
                    <ShieldCheck size={13} />
                    {available}/{participants.length} pronósticos
                  </div>
                  <div className="rivals-grid">
                    {participants
                      .filter((person) => person.id !== userId)
                      .map((person) => {
                        const value = rows[person.id];
                        return (
                          <div className="rival-player" key={person.id}>
                            <div className="rival-person">
                              <span className="rival-avatar">
                                {person.avatar ? (
                                  <img src={person.avatar} alt="" />
                                ) : (
                                  person.name.trim().charAt(0).toUpperCase()
                                )}
                              </span>
                              <div>
                                <h3>{person.name}</h3>
                                <small>
                                  {demo
                                    ? "Jugador de ejemplo"
                                    : "Compañero de grupo"}
                                </small>
                              </div>
                            </div>
                            <PickValue match={match} value={value} />
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}

function PickValue({
  match,
  value,
  compact = false,
}: {
  match: Match;
  value?: PredictionValue;
  compact?: boolean;
}) {
  const sign = value
    ? typeof value === "string"
      ? value
      : outcome(value.home, value.away)
    : null;
  const label =
    sign === "1"
      ? match.home
      : sign === "2"
        ? match.away
        : sign === "X"
          ? "Empate"
          : "Sin pronóstico";
  return (
    <div
      className={`rival-selection ${compact ? "compact" : ""} ${sign === "1" ? "pick-home" : sign === "X" ? "pick-draw" : sign === "2" ? "pick-away" : "pick-missing"}`}
    >
      <strong>{value ? predictionSummary(value) : "—"}</strong>
      <span>{label}</span>
    </div>
  );
}
