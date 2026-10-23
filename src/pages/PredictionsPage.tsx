import type { User } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import {
  Check,
  CheckCheck,
  LockKeyhole,
  Save,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import CompetitionLogo from "../components/CompetitionLogo";
import ConfirmQuiniela from "../components/ConfirmQuiniela";
import GroupPredictions from "../components/GroupPredictions";
import {
  Badge,
  Empty,
  MatchRow,
  PageTitle,
  readableError,
} from "../components/ui";
import {
  loadParticipants,
  savePrediction,
  submitRound,
  type Group,
  type Participant,
} from "../lib/data";
import {
  canPredict,
  preferredRound,
  roundLabel,
  type Match,
  type Mode,
  type Prediction,
  type PredictionValue,
} from "../lib/domain";
import { db } from "../lib/firebase";

const demoPlayers: Participant[] = [
  { id: "demo-me", name: "Tú", avatar: null },
  { id: "demo-alex", name: "Alex Moreno", avatar: null },
  { id: "demo-marta", name: "Marta López", avatar: null },
  { id: "demo-dani", name: "Dani Ruiz", avatar: null },
];
export default function PredictionsPage({
  matches,
  groups,
  user,
  demo,
}: {
  matches: Match[];
  groups: Group[];
  user: User | null;
  demo: boolean;
}) {
  const [params] = useSearchParams();
  const [group, setGroup] = useState(params.get("group") || "");
  const [demoCompetition, setDemoCompetition] = useState("PD");
  const [season, setSeason] = useState("");
  const [seasons, setSeasons] = useState<
    { id: string; mode: Mode; competition: string }[]
  >([]);
  const [values, setValues] = useState<Record<string, PredictionValue>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [round, setRound] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [loadingPredictions, setLoadingPredictions] = useState(!demo);
  const [loadingSeal, setLoadingSeal] = useState(!demo);
  const [sealed, setSealed] = useState(false);
  const [demoSeals, setDemoSeals] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [view, setView] = useState<"mine" | "group">("mine");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [peopleError, setPeopleError] = useState("");
  const uid = user?.uid || "demo-me";
  const selectedGroup = groups.find((g) => g.id === group);
  const active = seasons.find((s) => s.id === season);
  const mode: Mode = demo ? "classic" : active?.mode || "classic";
  const filtered = matches.filter((m) =>
    demo
      ? m.competition === demoCompetition
      : m.competition === active?.competition && m.seasonId === season,
  );
  const rounds = [...new Set(filtered.map((m) => m.roundId))];
  const selected = rounds.includes(round) ? round : preferredRound(filtered);
  const list = filtered.filter((m) => m.roundId === selected);
  const isSealed = demo ? Boolean(demoSeals[selected]) : sealed;
  const pending = !demo && (loadingPredictions || loadingSeal);
  const completed = list.filter((m) => values[m.id]).length;
  const missingOpen = list.filter(
    (m) => canPredict(m.utcDate, clock, m.status) && !values[m.id],
  ).length;
  const canSubmit =
    list.length > 0 &&
    completed > 0 &&
    missingOpen === 0 &&
    !pending &&
    !busy &&
    !submitting &&
    !isSealed;
  // Keep the chosen round on screen when its last fixture starts.
  useEffect(() => {
    if (selected && selected !== round) setRound(selected);
  }, [selected, round]);
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!demo && groups.length && !groups.some((g) => g.id === group))
      setGroup(groups[0]?.id || "");
  }, [groups, group, demo]);
  useEffect(() => {
    setSeasons([]);
    setSeason("");
    setRound("");
    if (!db || !group || demo) return;
    let active = true;
    getDocs(collection(db, "groups", group, "gameSeasons"))
      .then((s) => {
        if (!active) return;
        const next = s.docs.map(
          (d) =>
            ({ id: d.id, ...d.data() }) as {
              id: string;
              mode: Mode;
              competition: string;
            },
        );
        next.sort(
          (a, b) =>
            Number(b.competition === "PD") - Number(a.competition === "PD") ||
            b.id.localeCompare(a.id, "es", { numeric: true }),
        );
        setSeasons(next);
        setSeason(next[0]?.id || "");
      })
      .catch((e) => {
        if (active) setError(readableError(e));
      });
    return () => {
      active = false;
    };
  }, [group, demo]);
  useEffect(() => {
    setValues({});
    setError("");
    if (!db || !group || !season || !user || demo) {
      setLoadingPredictions(false);
      return;
    }
    setLoadingPredictions(true);
    return onSnapshot(
      query(
        collection(db, "groups", group, "gameSeasons", season, "predictions"),
        where("userId", "==", uid),
      ),
      { includeMetadataChanges: true },
      (snap) => {
        setValues(
          Object.fromEntries(
            snap.docs.map((d) => [d.data().matchId, d.data().value]),
          ),
        );
        setLoadingPredictions(snap.metadata.fromCache);
      },
      (e) => {
        setError(readableError(e));
        setLoadingPredictions(false);
      },
    );
  }, [group, season, uid, demo]);
  useEffect(() => {
    setSealed(false);
    setConfirm(false);
    setSubmitError("");
    if (!db || !group || !season || !selected || !user || demo) {
      setLoadingSeal(false);
      return;
    }
    setLoadingSeal(true);
    return onSnapshot(
      doc(
        db,
        "groups",
        group,
        "gameSeasons",
        season,
        "submissions",
        uid,
        "rounds",
        selected,
      ),
      { includeMetadataChanges: true },
      (snap) => {
        if (!snap.metadata.hasPendingWrites) setSealed(snap.exists());
        setLoadingSeal(snap.metadata.fromCache);
      },
      () => {
        setError(
          "No podemos comprobar ahora el estado de tu quiniela. Comprueba la conexión y vuelve a entrar antes de guardar.",
        );
        setLoadingSeal(true);
      },
    );
  }, [group, season, selected, uid, demo]);
  useEffect(() => {
    setParticipants([]);
    setPeopleError("");
    if (demo) return;
    if (!selectedGroup) return;
    let active = true;
    loadParticipants(selectedGroup)
      .then((next) => {
        if (active) setParticipants(next);
      })
      .catch((e) => {
        if (active) setPeopleError(readableError(e));
      });
    return () => {
      active = false;
    };
  }, [selectedGroup, demo]);
  async function choose(match: Match, value: PredictionValue) {
    if (isSealed || busy || pending || submitting) return;
    setBusy(match.id);
    setError("");
    try {
      if (!demo) {
        if (!user || !group || !season)
          throw new Error("Selecciona un grupo y una competición.");
        await savePrediction(uid, group, season, match, value);
      }
      setValues((v) => ({ ...v, [match.id]: value }));
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy("");
    }
  }
  async function finalize() {
    if (!canSubmit) {
      setSubmitError(
        "Espera a que se comprueben tus elecciones antes de confirmar.",
      );
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      if (demo) setDemoSeals((v) => ({ ...v, [selected]: true }));
      else {
        await submitRound(
          uid,
          group,
          season,
          selected,
          Object.fromEntries(
            list.filter((m) => values[m.id]).map((m) => [m.id, values[m.id]]),
          ),
        );
        setSealed(true);
      }
      setConfirm(false);
    } catch (e) {
      setSubmitError(readableError(e));
    } finally {
      setSubmitting(false);
    }
  }
  useEffect(() => {
    if (isSealed && !submitting) setConfirm(false);
  }, [isSealed, submitting]);
  const disabled = Boolean(busy) || pending || submitting;
  const selectorsDisabled = Boolean(busy) || submitting;
  return (
    <>
      <PageTitle
        eyebrow="CONFÍA EN TU INSTINTO"
        title="Mi quiniela"
        description="Elige tus resultados, revisa tu jornada y guárdala cuando lo tengas claro."
      />
      {!demo && (
        <div className="filter-row">
          <select
            aria-label="Grupo"
            value={group}
            disabled={selectorsDisabled}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value="">Selecciona tu grupo</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div
        className="competition-picker"
        role="group"
        aria-label="Elegir competición de la quiniela"
      >
        {["PD", "CL"].map((code) => (
          <button
            key={code}
            type="button"
            aria-label={
              code === "PD" ? "Elegir LaLiga" : "Elegir Champions League"
            }
            aria-pressed={
              (demo ? demoCompetition : active?.competition) === code
            }
            disabled={
              selectorsDisabled ||
              (!demo && !seasons.some((s) => s.competition === code))
            }
            onClick={() => {
              if (demo) setDemoCompetition(code);
              else
                setSeason(
                  seasons.find((s) => s.competition === code)?.id || "",
                );
              setRound("");
            }}
          >
            <CompetitionLogo code={code} />
            <span>
              {code === "PD" ? "LaLiga EA Sports" : "Champions League"}
            </span>
          </button>
        ))}
      </div>
      {!demo &&
        seasons.filter((s) => s.competition === active?.competition).length >
          1 && (
          <label className="prediction-season-history">
            Temporada
            <select
              aria-label="Temporada de la competición"
              value={season}
              disabled={selectorsDisabled}
              onChange={(e) => {
                setSeason(e.target.value);
                setRound("");
              }}
            >
              {seasons
                .filter((s) => s.competition === active?.competition)
                .map((s) => {
                  const year = Number(s.id.split("-")[1]);
                  return (
                    <option key={s.id} value={s.id}>
                      {year} / {year + 1}
                    </option>
                  );
                })}
            </select>
          </label>
        )}
      <div className="filter-row">
        <Badge>
          {mode === "classic" ? "QUINIELA CLÁSICA · 1X2" : "MARCADOR EXACTO"}
        </Badge>
        <select
          aria-label="Jornada"
          value={selected || ""}
          disabled={selectorsDisabled}
          onChange={(e) => setRound(e.target.value)}
        >
          {rounds.map((r) => (
            <option key={r} value={r}>
              {roundLabel(filtered.find((m) => m.roundId === r)!)}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {list.length ? (
        <>
          <section
            className={`round-save-panel panel ${isSealed ? "is-sealed" : ""}`}
            aria-label="Estado de la quiniela"
          >
            <div className="round-save-heading">
              <span className="round-save-icon">
                {isSealed ? <CheckCheck size={22} /> : <Target size={22} />}
              </span>
              <div>
                <h2>
                  {isSealed
                    ? "Quiniela guardada y cerrada"
                    : "Tu próxima jugada"}
                </h2>
                <p>
                  {isSealed
                    ? "Tus pronósticos ya no se pueden modificar. ¡Ahora toca disfrutar del fútbol!"
                    : "Tus elecciones se conservan al elegir. Al guardar la quiniela, quedarán cerradas definitivamente."}
                </p>
              </div>
              <span className={`round-state ${isSealed ? "saved" : ""}`}>
                {isSealed ? (
                  <>
                    <LockKeyhole size={12} />
                    Guardada
                  </>
                ) : (
                  "En edición"
                )}
              </span>
            </div>
            <div className="round-progress-row">
              <span>
                {completed} / {list.length} completados
              </span>
              <span>
                {isSealed
                  ? "Jornada cerrada"
                  : missingOpen > 0
                    ? `${missingOpen} por completar`
                    : "Lista para guardar"}
              </span>
            </div>
            <div className="round-progress-track">
              <span
                style={{
                  width: `${list.length ? (completed / list.length) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="round-save-bottom">
              <p>
                {isSealed ? (
                  <>
                    <ShieldCheck size={14} />
                    Tus amigos verán cada pronóstico al inicio del partido.
                  </>
                ) : pending ? (
                  "Comprobando tus elecciones y el cierre…"
                ) : missingOpen > 0 ? (
                  "Completa los partidos disponibles antes de guardar."
                ) : completed === 0 ? (
                  "No tienes pronósticos en esta jornada."
                ) : (
                  "Antes de confirmar podrás revisar todos tus pronósticos."
                )}
              </p>
              <button
                className="button primary"
                disabled={!canSubmit}
                onClick={() => {
                  setSubmitError("");
                  setConfirm(true);
                }}
              >
                {isSealed ? (
                  <>
                    <Check size={16} />
                    Quiniela guardada
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Guardar quiniela
                  </>
                )}
              </button>
            </div>
          </section>
          <div
            className="prediction-view-tabs"
            role="tablist"
            aria-label="Vista de pronósticos"
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? "mine"
                  : event.key === "End"
                    ? "group"
                    : view === "mine"
                      ? "group"
                      : "mine";
              setView(next);
              document.getElementById(`${next}-tab`)?.focus();
            }}
          >
            <button
              id="mine-tab"
              role="tab"
              aria-selected={view === "mine"}
              tabIndex={view === "mine" ? 0 : -1}
              aria-controls="mine-predictions"
              onClick={() => setView("mine")}
            >
              <Target size={17} />
              Mi quiniela
            </button>
            <button
              id="group-tab"
              role="tab"
              aria-selected={view === "group"}
              tabIndex={view === "group" ? 0 : -1}
              aria-controls="group-predictions"
              onClick={() => setView("group")}
            >
              <Users size={17} />
              El grupo
            </button>
          </div>
          {view === "mine" ? (
            <div
              id="mine-predictions"
              role="tabpanel"
              aria-labelledby="mine-tab"
              className="prediction-list"
            >
              {list.map((m) => {
                const kickoffLocked = !canPredict(m.utcDate, clock, m.status);
                const locked = isSealed || kickoffLocked;
                return (
                  <div
                    className={`panel prediction-card ${locked ? "prediction-locked" : ""}`}
                    key={m.id}
                  >
                    <MatchRow match={m} />
                    <div className="prediction-actions">
                      <span>
                        {isSealed ? (
                          <>
                            <LockKeyhole size={14} />
                            Quiniela cerrada
                          </>
                        ) : kickoffLocked ? (
                          <>
                            <LockKeyhole size={14} />
                            Partido cerrado
                          </>
                        ) : values[m.id] ? (
                          <>
                            <Check size={14} />
                            Elección guardada
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={14} />
                            Elige tu pronóstico
                          </>
                        )}
                      </span>
                      {mode === "classic" ? (
                        <div className="outcomes">
                          {(["1", "X", "2"] as const).map((v) => (
                            <button
                              disabled={locked || disabled}
                              aria-pressed={values[m.id] === v}
                              className={values[m.id] === v ? "selected" : ""}
                              key={v}
                              onClick={() => void choose(m, v)}
                            >
                              {v}
                              {values[m.id] === v && <Check size={13} />}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <ExactInput
                          disabled={locked || disabled}
                          value={
                            typeof values[m.id] === "object"
                              ? (values[m.id] as Prediction)
                              : undefined
                          }
                          onApply={(value) => void choose(m, value)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              id="group-predictions"
              role="tabpanel"
              aria-labelledby="group-tab"
            >
              {peopleError ? (
                <p className="error" role="alert">
                  {peopleError}
                </p>
              ) : !demo && participants.length === 0 ? (
                <Empty title="Reuniendo al vestuario…">
                  Cargando los participantes del grupo.
                </Empty>
              ) : (
                <GroupPredictions
                  matches={list}
                  participants={demo ? demoPlayers : participants}
                  userId={uid}
                  groupId={group}
                  seasonId={season}
                  clock={clock}
                  demo={demo}
                  ownValues={values}
                />
              )}
            </div>
          )}
        </>
      ) : (
        <Empty
          title={
            demo || active
              ? "Aún no hay partidos disponibles"
              : groups.length
                ? "Elige tu competición"
                : "Primero, reúne a tu equipo"
          }
        >
          {demo ? (
            "La demo contiene únicamente una jornada de LaLiga."
          ) : active ? (
            "Los partidos aparecerán cuando se sincronice el calendario de esta competición."
          ) : (
            <>
              <Link to="/grupos">
                Crea un grupo o únete con un código de invitación.
              </Link>
            </>
          )}
        </Empty>
      )}
      <p className="muted footnote">
        La hora del servidor cierra cada partido al comenzar. Guardar la
        quiniela la cierra antes y de forma definitiva.
      </p>
      {confirm && (
        <ConfirmQuiniela
          matches={list}
          values={values}
          busy={submitting}
          demo={demo}
          error={submitError}
          onCancel={() => {
            if (!submitting) setConfirm(false);
          }}
          onConfirm={() => void finalize()}
        />
      )}
    </>
  );
}
function ExactInput({
  disabled,
  value,
  onApply,
}: {
  disabled: boolean;
  value?: Prediction;
  onApply: (value: Prediction) => void;
}) {
  const [home, setHome] = useState(value?.home ?? 0);
  const [away, setAway] = useState(value?.away ?? 0);
  useEffect(() => {
    setHome(value?.home ?? 0);
    setAway(value?.away ?? 0);
  }, [value]);
  return (
    <form
      className="exact-input"
      onSubmit={(e) => {
        e.preventDefault();
        onApply({ home, away });
      }}
    >
      <input
        aria-label="Goles local"
        type="number"
        inputMode="numeric"
        min="0"
        max="99"
        required
        disabled={disabled}
        value={home}
        onChange={(e) => setHome(Number(e.target.value))}
      />
      <span>—</span>
      <input
        aria-label="Goles visitante"
        type="number"
        inputMode="numeric"
        min="0"
        max="99"
        required
        disabled={disabled}
        value={away}
        onChange={(e) => setAway(Number(e.target.value))}
      />
      <button className="button secondary" disabled={disabled}>
        Aplicar
      </button>
    </form>
  );
}
