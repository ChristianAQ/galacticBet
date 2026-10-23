import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import { useEffect, useState } from "react";
import {
  canRevealPredictions,
  matchStatusLabel,
  outcome,
  predictionSummary,
  type Match,
  type PredictionValue,
} from "../lib/domain";
import type { Participant } from "../lib/data";
import { db } from "../lib/firebase";
import { kickoffLabel } from "../lib/matchInsights";
import { Team, readableError } from "./ui";
import TeamForm from "./TeamForm";

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
            Guardada
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
  const hasScore =
    match.homeScore !== null &&
    match.awayScore !== null &&
    ["FINISHED", "IN_PLAY", "PAUSED"].includes(match.status);
  const scheduled = ["TIMED", "SCHEDULED"].includes(match.status);
  return (
    <article className="panel group-match-card">
      <header className="saved-match-heading">
        <time dateTime={match.utcDate}>{kickoffLabel(match.utcDate)}</time>
        <span
          className={`saved-match-status ${["IN_PLAY", "PAUSED"].includes(match.status) ? "is-live" : ""}`}
        >
          {scheduled
            ? revealed
              ? "Pendiente de actualización"
              : "A la espera del inicio"
            : matchStatusLabel[match.status] || match.status}
        </span>
      </header>
      <div className="saved-fixture">
        <div className="saved-team">
          <Team name={match.home} crest={match.homeCrest} />
          <TeamForm match={match} side="home" matches={history} />
        </div>
        <div
          className="match-own-pick"
          role="group"
          aria-label="Tu pronóstico"
          aria-busy={loadingOwn}
        >
          <span>Tu pronóstico</span>
          {loadingOwn ? (
            <span className="saved-pick-loading" role="status">
              Cargando…
            </span>
          ) : (
            <PickValue match={match} value={ownValue} compact />
          )}
        </div>
        <div className="saved-team">
          <Team name={match.away} crest={match.awayCrest} />
          <TeamForm match={match} side="away" matches={history} />
        </div>
      </div>
      {(hasScore || revealed) && (
        <div className="saved-match-footer">
          {hasScore && (
            <div
              className="saved-match-result"
              aria-label="Resultado real a 90 minutos"
            >
              <span>
                {match.status === "FINISHED" ? "Resultado" : "Marcador"} · 90
                min
              </span>
              <strong>
                {match.homeScore} – {match.awayScore}
              </strong>
            </div>
          )}
          {revealed && (
            <button
              className="rivals-toggle"
              disabled={participants.length < 2}
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={
                open
                  ? "Ocultar pronósticos del grupo"
                  : "Ver pronósticos del grupo"
              }
            >
              <span>
                <Users size={15} />
                {open ? "Ocultar grupo" : "Ver grupo"}
              </span>
              {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
        </div>
      )}
      {revealed && open && (
        <div className="rivals-content" aria-busy={pending || !ready}>
          {pending || !ready ? (
            <p className="rivals-loading" role="status">
              Cargando pronósticos…
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
                {available}/{participants.length} pronósticos
              </div>
              <div className="rivals-grid">
                {participants
                  .filter((person) => person.id !== userId)
                  .map((person) => (
                    <div className="rival-player" key={person.id}>
                      <div className="rival-person">
                        <span className="rival-avatar">
                          {person.avatar ? (
                            <img src={person.avatar} alt="" />
                          ) : (
                            person.name.trim().charAt(0).toUpperCase()
                          )}
                        </span>
                        <h3>{person.name}</h3>
                      </div>
                      <PickValue match={match} value={rows[person.id]} />
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
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
      <span>
        {compact && value
          ? sign === "1"
            ? "Local"
            : sign === "2"
              ? "Visitante"
              : "Empate"
          : label}
      </span>
    </div>
  );
}
