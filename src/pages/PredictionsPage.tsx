import type { User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { Check, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Empty,
  MatchRow,
  PageTitle,
  readableError,
} from "../components/ui";
import { savePrediction, type Group } from "../lib/data";
import {
  canPredict,
  preferredRound,
  roundLabel,
  type Match,
  type Mode,
  type Outcome,
  type Prediction,
} from "../lib/domain";
import { db } from "../lib/firebase";
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
  const [group, setGroup] = useState("");
  const [season, setSeason] = useState("");
  const [seasons, setSeasons] = useState<
    { id: string; mode: Mode; competition: string }[]
  >([]);
  const [values, setValues] = useState<Record<string, Outcome | Prediction>>(
    {},
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [round, setRound] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    setSeasons([]);
    setSeason("");
    if (!db || !group) return;
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
        setSeasons(next);
        setSeason(next[0]?.id || "");
      })
      .catch((e) => {
        if (active) setError(readableError(e));
      });
    return () => {
      active = false;
    };
  }, [group]);
  useEffect(() => {
    setValues({});
    if (!db || !group || !season || !user || demo) {
      setPending(false);
      return;
    }
    let active = true;
    setPending(true);
    getDocs(
      query(
        collection(db, "groups", group, "gameSeasons", season, "predictions"),
        where("userId", "==", user.uid),
      ),
    )
      .then((s) => {
        if (active)
          setValues(
            Object.fromEntries(
              s.docs.map((d) => [d.data().matchId, d.data().value]),
            ),
          );
      })
      .catch((e) => {
        if (active) setError(readableError(e));
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [group, season, user, demo]);
  const active = seasons.find((s) => s.id === season);
  const filtered = matches.filter(
    (m) => demo || m.competition === active?.competition,
  );
  const rounds = [...new Set(filtered.map((m) => m.roundId))];
  const selected = rounds.includes(round) ? round : preferredRound(filtered);
  const list = filtered.filter((m) => m.roundId === selected);
  const mode = demo ? "classic" : active?.mode || "classic";
  async function save(m: Match, value: Outcome | Prediction) {
    setBusy(m.id);
    setError("");
    try {
      if (!demo) {
        if (!user || !group || !season)
          throw new Error("Selecciona un grupo y una temporada.");
        await savePrediction(user.uid, group, season, m, value);
      }
      setValues((v) => ({ ...v, [m.id]: value }));
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="CONFÍA EN TU INSTINTO"
        title="Mi quiniela"
        description="Completa tus pronósticos a tu ritmo. Cada partido se cierra al comenzar."
      />
      {!demo && (
        <div className="filter-row">
          <select
            aria-label="Grupo"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value="">Selecciona tu grupo</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Temporada"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} · {s.mode === "classic" ? "1X2" : "Marcador exacto"}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="filter-row">
        <Badge>
          {mode === "classic" ? "QUINIELA CLÁSICA · 1X2" : "MARCADOR EXACTO"}
        </Badge>
        <select
          aria-label="Jornada"
          value={selected || ""}
          onChange={(e) => setRound(e.target.value)}
        >
          {rounds.map((r) => (
            <option key={r} value={r}>
              {roundLabel(filtered.find((m) => m.roundId === r)!)}
            </option>
          ))}
        </select>
        <span>
          {list.filter((m) => values[m.id]).length} / {list.length} completados
        </span>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {list.length ? (
        <div className="prediction-list">
          {list.map((m) => {
            const locked = !canPredict(m.utcDate, clock, m.status);
            return (
              <div className="panel prediction-card" key={m.id}>
                <MatchRow match={m} />
                <div className="prediction-actions">
                  <span>
                    {locked ? (
                      <>
                        <LockKeyhole size={14} /> Cerrado
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={14} /> Cierra al inicio del partido
                      </>
                    )}
                  </span>
                  {mode === "classic" ? (
                    <div className="outcomes">
                      {(["1", "X", "2"] as const).map((v) => (
                        <button
                          disabled={locked || pending || busy === m.id}
                          className={values[m.id] === v ? "selected" : ""}
                          key={v}
                          onClick={() => void save(m, v)}
                        >
                          {v}
                          {values[m.id] === v && <Check size={13} />}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <ExactInput
                      disabled={locked || pending || busy === m.id}
                      value={
                        typeof values[m.id] === "object"
                          ? (values[m.id] as Prediction)
                          : undefined
                      }
                      onSave={(v) => void save(m, v)}
                    />
                  )}
                </div>
                {!demo && clock >= Date.parse(m.utcDate) && (
                  <Rivals groupId={group} season={season} match={m} />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          title={
            groups.length
              ? "Selecciona una competición"
              : "Primero, reúne a tu equipo"
          }
        >
          <Link to="/grupos">
            Crea un grupo o únete con un código de invitación.
          </Link>
        </Empty>
      )}
      <p className="muted footnote">
        El reloj del navegador es orientativo. Firestore valida el cierre con la
        hora del servidor.
      </p>
    </>
  );
}
function ExactInput({
  disabled,
  value,
  onSave,
}: {
  disabled: boolean;
  value?: Prediction;
  onSave: (p: Prediction) => void;
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
        onSave({ home, away });
      }}
    >
      <input
        aria-label="Goles local"
        type="number"
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
        min="0"
        max="99"
        required
        disabled={disabled}
        value={away}
        onChange={(e) => setAway(Number(e.target.value))}
      />
      <button className="button secondary" disabled={disabled}>
        Guardar
      </button>
    </form>
  );
}

function Rivals({
  groupId,
  season,
  match,
}: {
  groupId: string;
  season: string;
  match: Match;
}) {
  const [rows, setRows] = useState<
    { name: string; value: Outcome | Prediction }[]
  >([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  async function reveal() {
    setOpen(!open);
    if (open || !db) return;
    try {
      const store = db;
      const snap = await getDocs(
        query(
          collection(
            store,
            "groups",
            groupId,
            "gameSeasons",
            season,
            "predictions",
          ),
          where("matchId", "==", match.id),
        ),
      );
      const next = await Promise.all(
        snap.docs.map(async (d) => {
          const p = d.data();
          const profile = await getDoc(doc(store, "users", p.userId));
          return {
            name: profile.data()?.name || "Jugador",
            value: p.value as Outcome | Prediction,
          };
        }),
      );
      setRows(next);
    } catch (e) {
      setError(readableError(e));
    }
  }
  return (
    <div className="rivals">
      <button className="text-button" onClick={() => void reveal()}>
        {open ? "Ocultar" : "Ver"} pronósticos del grupo
      </button>
      {open &&
        (error ? (
          <p role="alert">{error}</p>
        ) : rows.length ? (
          rows.map((r, i) => (
            <p key={i}>
              {r.name}:{" "}
              <strong>
                {typeof r.value === "string"
                  ? r.value
                  : `${r.value.home} - ${r.value.away}`}
              </strong>
            </p>
          ))
        ) : (
          <p>No hay pronósticos para este partido.</p>
        ))}
    </div>
  );
}
