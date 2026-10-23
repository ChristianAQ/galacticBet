import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
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
}) {
  return (
    <section className="group-predictions" aria-label="Pronósticos del grupo">
      <div className="group-view-intro">
        <span className="group-view-icon">
          <Users size={22} />
        </span>
        <div>
          <h2>El fútbol se ve mejor en grupo</h2>
          <p>
            Compara vuestras elecciones en cada encuentro. Antes del inicio
            permanecen en secreto.
          </p>
        </div>
      </div>
      <div className="pick-legend">
        <span className="pick-home">1 · Local</span>
        <span className="pick-draw">X · Empate</span>
        <span className="pick-away">2 · Visitante</span>
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
      {!revealed ? (
        <div className="rivals-hidden">
          <span className="rivals-lock">
            <LockKeyhole size={18} />
          </span>
          <div>
            <strong>
              {match.status === "POSTPONED"
                ? "Partido aplazado: los pronósticos siguen ocultos"
                : match.status === "CANCELLED"
                  ? "Partido cancelado"
                  : "Todos los pronósticos siguen en secreto"}
            </strong>
            <p>
              {match.status === "POSTPONED" ? (
                "Se mostrarán cuando se confirme y llegue la nueva hora de inicio."
              ) : match.status === "CANCELLED" ? (
                "Los pronósticos de este encuentro no se revelan."
              ) : (
                <>
                  Se revelan el{" "}
                  {new Intl.DateTimeFormat("es", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Madrid",
                  }).format(new Date(match.utcDate))}
                  .
                </>
              )}
            </p>
          </div>
        </div>
      ) : (
        <>
          <button
            className="rivals-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            <span>
              <Users size={17} />
              {open ? "Pronósticos del grupo" : "Ver pronósticos del grupo"}
              <small>{participants.length} jugadores</small>
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
                    {available} de {participants.length} jugadores hicieron su
                    pronóstico
                  </div>
                  <div className="rivals-grid">
                    {participants.map((person) => {
                      const value = rows[person.id];
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
                      const own = person.id === userId;
                      return (
                        <div
                          className={`rival-player ${own ? "is-me" : ""}`}
                          key={person.id}
                        >
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
                                {own
                                  ? "Tu pronóstico"
                                  : demo
                                    ? "Jugador de ejemplo"
                                    : "Compañero de grupo"}
                              </small>
                            </div>
                            {own && <span className="rival-you">Tú</span>}
                          </div>
                          <div
                            className={`rival-selection ${sign === "1" ? "pick-home" : sign === "X" ? "pick-draw" : sign === "2" ? "pick-away" : "pick-missing"}`}
                          >
                            <strong>
                              {value ? predictionSummary(value) : "—"}
                            </strong>
                            <span>{label}</span>
                          </div>
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
