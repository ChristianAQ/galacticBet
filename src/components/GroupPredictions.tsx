import {
  collection,
  documentId,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import { useEffect, useState } from "react";
import {
  hasMatchStarted,
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
import { decodeDelivery } from "../lib/roundDelivery";

type SharedEntries = Record<string, Record<string, PredictionValue>>;
export default function GroupPredictions({
  matches,
  history,
  participants,
  userId,
  groupId,
  seasonId,
  roundId,
  clock,
  demo,
  ownValues,
  sealed = false,
  loadingOwn = false,
  canShare,
  completedIds,
}: {
  matches: Match[];
  history: Match[];
  participants: Participant[];
  userId: string;
  groupId: string;
  seasonId: string;
  roundId: string;
  clock: number;
  demo: boolean;
  ownValues: Record<string, PredictionValue>;
  sealed?: boolean;
  loadingOwn?: boolean;
  canShare: boolean;
  completedIds: string[];
}) {
  const [requested, setRequested] = useState(false);
  const [entries, setEntries] = useState<SharedEntries>({});
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const membersKey = participants.map((p) => p.id).sort();
  const membersQueryKey = JSON.stringify(membersKey);
  useEffect(() => {
    setEntries({});
    setReady(false);
    setError("");
    setPending(false);
    if (!requested || !canShare || membersQueryKey === "[]") return;
    if (demo) {
      setEntries(
        Object.fromEntries(
          completedIds
            .filter((id) => id !== userId)
            .map((id, i) => [
              id,
              Object.fromEntries(
                matches.map((m) => [
                  m.id,
                  (["1", "X", "2"] as const)[(i + m.id.length) % 3],
                ]),
              ),
            ]),
        ),
      );
      setReady(true);
      return;
    }
    if (!db) return;
    setPending(true);
    // One round listener shares each immutable entry across all fixture cards.
    return onSnapshot(
      query(
        collection(
          db,
          "groups",
          groupId,
          "gameSeasons",
          seasonId,
          "roundEntries",
          roundId,
          "players",
        ),
        where(documentId(), "in", JSON.parse(membersQueryKey)),
      ),
      (snap) => {
        try {
          setEntries(
            Object.fromEntries(
              snap.docs.map((d) => [d.id, decodeDelivery(d.data())]),
            ),
          );
          setError("");
        } catch (e) {
          setEntries({});
          setError(readableError(e));
        }
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
    requested,
    canShare,
    membersQueryKey,
    groupId,
    seasonId,
    roundId,
    demo,
    userId,
    attempt,
  ]);
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
          key={m.id}
          match={m}
          history={history}
          participants={participants}
          userId={userId}
          started={hasMatchStarted(m, clock)}
          canShare={canShare}
          ownValue={ownValues[m.id]}
          loadingOwn={loadingOwn}
          entries={canShare ? entries : {}}
          pending={pending || !requested}
          ready={ready}
          error={error}
          completedIds={completedIds}
          onRequest={() => setRequested(true)}
          onRetry={() => setAttempt((n) => n + 1)}
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
  started,
  canShare,
  ownValue,
  loadingOwn,
  entries,
  pending,
  ready,
  error,
  completedIds,
  onRequest,
  onRetry,
}: {
  match: Match;
  history: Match[];
  participants: Participant[];
  userId: string;
  started: boolean;
  canShare: boolean;
  ownValue?: PredictionValue;
  loadingOwn: boolean;
  entries: SharedEntries;
  pending: boolean;
  ready: boolean;
  error: string;
  completedIds: string[];
  onRequest: () => void;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const visible = participants.filter(
    (p) => p.id !== userId && completedIds.includes(p.id),
  );
  const available = visible.filter(
    (person) => entries[person.id]?.[match.id],
  ).length;
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
            ? started
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
      {(hasScore || (canShare && visible.length > 0)) && (
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
          {canShare && visible.length > 0 && (
            <button
              className="rivals-toggle"
              disabled={visible.length === 0}
              onClick={() => {
                setOpen((v) => !v);
                onRequest();
              }}
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
      {canShare && open && (
        <div className="rivals-content" aria-busy={pending || !ready}>
          {pending || !ready ? (
            <p className="rivals-loading" role="status">
              Cargando pronósticos…
            </p>
          ) : error ? (
            <div className="rivals-error">
              <p role="alert">{error}</p>
              <button className="button secondary" onClick={onRetry}>
                Volver a intentar
              </button>
            </div>
          ) : (
            <>
              <div className="rivals-count">
                {available}/{visible.length} pronósticos compartidos
              </div>
              <div className="rivals-grid">
                {visible.map((person) => (
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
                    <PickValue
                      match={match}
                      value={entries[person.id]?.[match.id]}
                    />
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
