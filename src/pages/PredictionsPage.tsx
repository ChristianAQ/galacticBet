import { competitionCode, competitionName } from "../lib/competitions";
import { COMPETITION_CODES } from "../lib/competitions";
import type { User } from "firebase/auth";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { LockKeyhole, Save, Target, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CompetitionSwitch from "../components/CompetitionSwitch";
import FilterPanel, { FilterField } from "../components/FilterPanel";
import ConfirmQuiniela from "../components/ConfirmQuiniela";
import RoundDeliveryStatus from "../components/RoundDeliveryStatus";
import GroupPredictions from "../components/GroupPredictions";
import MatchResult from "../components/MatchResult";
import { Empty, MatchRow, PageTitle, readableError } from "../components/ui";
import {
  loadGameSeasons,
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
import { preferenceStore } from "../lib/preferences";
import { useGroupSelection } from "../lib/useGroupSelection";
import { useRoundDelivery } from "../lib/useRoundDelivery";

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
  const {
    groupId: group,
    selectGroup: setGroup,
    preferences,
  } = useGroupSelection(demo ? "" : user?.uid || "", demo ? [] : groups);
  const [demoCompetition, setDemoCompetition] = useState("PD");
  const [season, setSeason] = useState("");
  const [seasons, setSeasons] = useState<
    { id: string; mode: Mode; competition: string }[]
  >([]);
  const [storedValues, setValues] = useState<Record<string, PredictionValue>>(
    {},
  );
  const [valuesKey, setValuesKey] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [round, setRound] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [loadingPredictions, setLoadingPredictions] = useState(!demo);
  const [loadingSeal, setLoadingSeal] = useState(!demo);
  const [sealed, setSealed] = useState({
    key: "",
    value: false,
    sharing: false,
  });
  const [demoSeals, setDemoSeals] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [view, setView] = useState<"mine" | "group">("mine");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [peopleError, setPeopleError] = useState("");
  const uid = demo ? "demo-me" : user?.uid || "demo-me";
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
  const predictionKey = `${uid}:${group}:${season}:${selected}`;
  const sealKey = predictionKey;
  const values = demo || valuesKey === predictionKey ? storedValues : {};
  const isSealed = demo
    ? Boolean(demoSeals[selected])
    : sealed.key === sealKey && sealed.value;
  const canShare = isSealed && (demo || sealed.sharing);
  const delivery = useRoundDelivery({
    groupId: group,
    seasonId: season,
    roundId: selected,
    userId: uid,
    matches: list,
    demo,
    demoSealed: isSealed,
  });
  const deadlineClosed =
    delivery.deadline !== null && clock >= delivery.deadline;
  const required = list.filter((match) =>
    delivery.requiredIds.includes(match.id),
  );
  const shownView = isSealed ? "group" : view;
  const pending =
    !demo &&
    (loadingPredictions ||
      loadingSeal ||
      !delivery.prepared ||
      valuesKey !== predictionKey ||
      sealed.key !== sealKey);
  const completed = required.filter((m) => values[m.id]).length;
  const missingOpen = delivery.requiredIds.length - completed;
  const canSubmit =
    delivery.requiredIds.length > 0 &&
    delivery.deadline !== null &&
    !deadlineClosed &&
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
    setSeasons([]);
    setSeason("");
    setRound("");
    if (!db || !group || demo) return;
    let active = true;
    loadGameSeasons(group)
      .then((configs) => {
        if (!active) return;
        const next = [...configs];
        next.sort(
          (a, b) =>
            Number(b.competition === "PD") - Number(a.competition === "PD") ||
            b.id.localeCompare(a.id, "es", { numeric: true }),
        );
        setSeasons(next);
        setSeason(
          next.find((s) => s.competition === preferences.competition)?.id ||
            next[0]?.id ||
            "",
        );
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
    setValuesKey(predictionKey);
    setError("");
    if (!db || !group || !season || !selected || !user || demo) {
      setLoadingPredictions(false);
      return;
    }
    setLoadingPredictions(true);
    return onSnapshot(
      query(
        collection(db, "groups", group, "gameSeasons", season, "predictions"),
        where("userId", "==", uid),
        where("roundId", "==", selected),
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
  }, [group, season, selected, uid, demo]);
  useEffect(() => {
    setSealed({ key: sealKey, value: false, sharing: false });
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
        if (!snap.metadata.hasPendingWrites)
          setSealed({
            key: sealKey,
            value: snap.exists(),
            sharing: snap.data()?.formatVersion === 2,
          });
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
    if (isSealed || busy || pending || submitting || deadlineClosed) return;
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
        deadlineClosed
          ? "El plazo ha terminado: la jornada se cierra al inicio del primer partido."
          : "Espera a que se comprueben tus elecciones antes de confirmar.",
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
            required
              .filter((m) => values[m.id])
              .map((m) => [m.id, values[m.id]]),
          ),
        );
        setSealed({ key: sealKey, value: true, sharing: true });
      }
      setConfirm(false);
    } catch (e) {
      setSubmitError(readableError(e));
    } finally {
      setSubmitting(false);
    }
  }
  useEffect(() => {
    if (isSealed && !submitting) {
      setConfirm(false);
      document
        .getElementById("group-predictions")
        ?.focus({ preventScroll: true });
    }
  }, [isSealed, submitting]);
  useEffect(() => {
    setView("mine");
  }, [group, season, selected]);
  const disabled = Boolean(busy) || pending || submitting;
  const selectorsDisabled = Boolean(busy) || submitting;
  return (
    <>
      <PageTitle
        eyebrow={`QUINIELA${list[0] ? ` · ${competitionName(list[0].competition).toUpperCase()}` : ""}`}
        title={list[0] ? roundLabel(list[0]) : "Mi quiniela"}
        description={
          !list.length
            ? "Selecciona tu grupo y la competición para ver tu quiniela."
            : pending
              ? "Comprobando tu pronóstico…"
              : isSealed
                ? "Pronóstico guardado · Tu apuesta está confirmada."
                : deadlineClosed
                  ? "Plazo cerrado · No has guardado tu pronóstico."
                  : completed > 0
                    ? "Pronóstico en curso · Completa y guarda tu quiniela."
                    : "Jornada abierta · Haz tu pronóstico antes del primer partido."
        }
      />
      <FilterPanel
        title={
          demo
            ? "Grupo de demostración"
            : selectedGroup?.name || "Selecciona tu grupo"
        }
        summary={`${competitionName(demo ? demoCompetition : active?.competition)} · ${list[0] ? roundLabel(list[0]) : "Sin jornada"} · ${mode === "classic" ? "Clásica 1X2" : "Marcador exacto"}`}
        competition={competitionCode(
          demo ? demoCompetition : active?.competition,
        )}
        applyLabel="Ver mis apuestas"
      >
        {!demo && (
          <FilterField label="Grupo">
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
          </FilterField>
        )}
        <CompetitionSwitch
          value={competitionCode(demo ? demoCompetition : active?.competition)}
          disabled={selectorsDisabled}
          available={
            demo
              ? [...COMPETITION_CODES]
              : COMPETITION_CODES.filter((code) =>
                  seasons.some((s) => s.competition === code),
                )
          }
          onChange={(code) => {
            if (demo) setDemoCompetition(code);
            else {
              if (user) preferenceStore.update(user.uid, { competition: code });
              setSeason(seasons.find((s) => s.competition === code)?.id || "");
            }
            setRound("");
          }}
        />
        {!demo &&
          seasons.filter((s) => s.competition === active?.competition).length >
            1 && (
            <FilterField label="Temporada">
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
            </FilterField>
          )}
        <FilterField label="Jornada o ronda">
          <select
            aria-label="Jornada"
            value={selected || ""}
            disabled={selectorsDisabled || !rounds.length}
            onChange={(e) => setRound(e.target.value)}
          >
            {!rounds.length && (
              <option value="">Sin jornadas disponibles</option>
            )}
            {rounds.map((r) => (
              <option key={r} value={r}>
                {roundLabel(filtered.find((m) => m.roundId === r)!)}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterPanel>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {delivery.error && (
        <p className="error" role="alert">
          {delivery.error}
        </p>
      )}
      {!demo &&
        !isSealed &&
        !deadlineClosed &&
        !delivery.prepared &&
        !delivery.checking &&
        !delivery.error && (
          <p className="setup-notice">
            Esta jornada aún no está preparada para recibir entregas. Inténtalo
            más tarde.
          </p>
        )}
      {list.length ? (
        <>
          <RoundDeliveryStatus
            key={`${group}:${list[0]?.roundId}`}
            memberIds={
              demo
                ? demoPlayers.map((person) => person.id)
                : selectedGroup?.memberIds || []
            }
            participants={demo ? demoPlayers : participants}
            completedIds={delivery.completedIds}
            ready={delivery.attendanceReady}
            deadline={delivery.deadline}
            clock={clock}
            canShare={canShare}
            sealed={isSealed}
          />
          {!isSealed && (
            <section
              className="round-save-panel panel"
              aria-label="Estado de la quiniela"
              aria-busy={pending || submitting}
            >
              <div className="round-save-progress">
                <div className="round-progress-row">
                  <strong>
                    {completed}/{delivery.requiredIds.length}
                  </strong>
                  <span>
                    {deadlineClosed
                      ? "Plazo cerrado"
                      : pending
                        ? "Comprobando…"
                        : missingOpen > 0
                          ? `${missingOpen} pendientes`
                          : completed > 0
                            ? "Lista para guardar"
                            : "Sin pronósticos"}
                  </span>
                </div>
                <div
                  className="round-progress-track"
                  role="progressbar"
                  aria-label="Pronósticos completados"
                  aria-valuemin={0}
                  aria-valuemax={delivery.requiredIds.length}
                  aria-valuenow={completed}
                >
                  <span
                    style={{
                      width: `${delivery.requiredIds.length ? (completed / delivery.requiredIds.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <button
                className="button primary"
                disabled={!canSubmit}
                onClick={() => {
                  setSubmitError("");
                  setConfirm(true);
                }}
              >
                <Save size={16} />
                Guardar quiniela
              </button>
            </section>
          )}
          {!isSealed && (
            <div
              className="prediction-view-tabs"
              role="tablist"
              aria-label="Vista de pronósticos"
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
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
          )}
          {shownView === "mine" ? (
            <div
              id="mine-predictions"
              role="tabpanel"
              aria-labelledby="mine-tab"
              className="prediction-list"
            >
              {list.map((m) => {
                const kickoffLocked =
                  deadlineClosed || !canPredict(m.utcDate, clock, m.status);
                const locked = isSealed || kickoffLocked;
                return (
                  <div
                    className={`panel prediction-card ${locked ? "prediction-locked" : ""}`}
                    key={m.id}
                  >
                    <MatchRow match={m} history={matches} />
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
                            {deadlineClosed
                              ? "Plazo cerrado"
                              : "Partido cerrado"}
                          </>
                        ) : values[m.id] ? (
                          "Elegido"
                        ) : (
                          "Tu pronóstico"
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
                    {m.status === "FINISHED" && <MatchResult match={m} />}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              id="group-predictions"
              tabIndex={isSealed ? -1 : 0}
              role={isSealed ? "region" : "tabpanel"}
              aria-label={isSealed ? "El grupo" : undefined}
              aria-labelledby={!isSealed ? "group-tab" : undefined}
            >
              {peopleError && (
                <p className="error" role="alert">
                  {peopleError}
                </p>
              )}
              <GroupPredictions
                key={`${uid}:${group}:${season}:${selected}`}
                matches={list}
                history={matches}
                participants={demo ? demoPlayers : participants}
                userId={uid}
                groupId={group}
                seasonId={season}
                clock={clock}
                demo={demo}
                ownValues={values}
                sealed={isSealed}
                loadingOwn={!demo && loadingPredictions}
                canShare={canShare}
                roundId={selected}
                completedIds={delivery.completedIds}
              />
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
      {confirm && (
        <ConfirmQuiniela
          matches={required}
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
