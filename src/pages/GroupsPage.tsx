import type { User } from "firebase/auth";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { ArrowRight, Copy, LockKeyhole, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Empty, PageTitle, PrivateGate, readableError } from "../components/ui";
import {
  activateCompetition,
  createGroup,
  joinGroup,
  leaveGroup,
  renameGroup,
  type Group,
} from "../lib/data";
import { type Mode } from "../lib/domain";
import { db } from "../lib/firebase";
export default function GroupsPage({
  user,
  groups,
  refresh,
  onLogin,
}: {
  user: User | null;
  groups: Group[];
  refresh: () => Promise<void>;
  onLogin: () => void;
}) {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.has("join") ? "join" : "create");
  const [name, setName] = useState("");
  const [code, setCode] = useState(params.get("code") || "");
  const [competition, setCompetition] = useState("PD");
  const [mode, setMode] = useState<Mode>("classic");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      if (tab === "create")
        await createGroup(user.uid, name, competition, mode);
      else await joinGroup(user.uid, code);
      await refresh();
      setMessage(
        tab === "create"
          ? "¡Grupo creado! Comparte el código con tus amigos."
          : "¡Ya estás dentro del grupo!",
      );
      setName("");
    } catch (e) {
      setMessage(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="TU GENTE, TU LIGA"
        title="Mis grupos"
        description="La mejor rivalidad es la que se comparte. Crea vuestro próximo desafío."
      />
      {!user ? (
        <PrivateGate onLogin={onLogin} />
      ) : (
        <div className="groups-layout">
          <section>
            {groups.length ? (
              groups.map((g) => (
                <GroupCard
                  key={g.id}
                  group={g}
                  user={user}
                  refresh={refresh}
                  notify={setMessage}
                />
              ))
            ) : (
              <Empty title="Tu vestuario está vacío">
                Crea tu primer grupo o entra con el código de tus amigos.
              </Empty>
            )}
          </section>
          <form className="panel form-panel" onSubmit={submit}>
            <div className="tabs compact">
              <button
                type="button"
                className={tab === "create" ? "selected" : ""}
                onClick={() => setTab("create")}
              >
                Crear grupo
              </button>
              <button
                type="button"
                className={tab === "join" ? "selected" : ""}
                onClick={() => setTab("join")}
              >
                Unirme
              </button>
            </div>
            {tab === "create" ? (
              <>
                <h2>Empieza vuestra liga</h2>
                <label>
                  Nombre del grupo
                  <input
                    required
                    minLength={3}
                    maxLength={60}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Los del tercer tiempo"
                  />
                </label>
                <label>
                  Competición
                  <select
                    value={competition}
                    onChange={(e) => setCompetition(e.target.value)}
                  >
                    <option value="PD">LaLiga EA Sports</option>
                    <option value="CL">Champions League</option>
                  </select>
                </label>
                <label>
                  Modalidad de la temporada
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as Mode)}
                  >
                    <option value="classic">Clásica 1X2 · 1 punto</option>
                    <option value="exact">
                      Marcador exacto · hasta 3 puntos
                    </option>
                  </select>
                </label>
                <p className="muted footnote">
                  <LockKeyhole size={13} />
                  La modalidad queda fija durante toda la temporada.
                </p>
              </>
            ) : (
              <>
                <h2>Entra en el grupo</h2>
                <label>
                  Código de invitación
                  <input
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Pega el código de tu grupo"
                  />
                </label>
              </>
            )}
            <button className="button primary full" disabled={busy}>
              {busy
                ? "Guardando…"
                : tab === "create"
                  ? "Crear grupo"
                  : "Unirme al grupo"}
              <ArrowRight size={17} />
            </button>
            {message && (
              <p role="status" className="form-message">
                {message}
              </p>
            )}
          </form>
        </div>
      )}
    </>
  );
}

function GroupCard({
  group: g,
  user,
  refresh,
  notify,
}: {
  group: Group;
  user: User;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [seasons, setSeasons] = useState<
    { id: string; competition: string; mode: Mode }[]
  >([]);
  const [name, setName] = useState(g.name);
  const [competition, setCompetition] = useState("PD");
  const [mode, setMode] = useState<Mode>("classic");
  const [busy, setBusy] = useState(false);
  async function details() {
    if (!db) return;
    try {
      const store = db;
      const members = await getDocs(
        collection(store, "groups", g.id, "members"),
      );
      const profiles = await Promise.all(
        members.docs.map(async (m) => {
          const profile = await getDoc(doc(store, "users", m.id));
          return { id: m.id, name: profile.data()?.name || "Jugador" };
        }),
      );
      setPeople(profiles);
      const list = await getDocs(
        collection(store, "groups", g.id, "gameSeasons"),
      );
      setSeasons(
        list.docs.map(
          (d) =>
            ({ id: d.id, ...d.data() }) as {
              id: string;
              competition: string;
              mode: Mode;
            },
        ),
      );
    } catch (e) {
      notify(readableError(e));
    }
  }
  useEffect(() => {
    if (expanded) void details();
  }, [expanded, g.id]);
  async function act(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      await details();
      await refresh();
      notify("Grupo actualizado.");
    } catch (e) {
      notify(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="panel group-card">
      <div className="group-avatar">
        <Users />
      </div>
      <h3>{g.name}</h3>
      <p>
        {g.memberIds.length} participantes ·{" "}
        {g.ownerId === user.uid ? "Administrador" : "Miembro"}
      </p>
      <div className="invite-code">
        <code>{g.id}</code>
        <button
          aria-label="Copiar enlace de invitación"
          className="icon-button"
          onClick={() => {
            void navigator.clipboard
              .writeText(
                `${location.origin}${location.pathname}#/grupos?join=1&code=${g.id}`,
              )
              .then(() => notify("Enlace copiado."))
              .catch(() => notify("Comparte el código manualmente."));
          }}
        >
          <Copy size={16} />
        </button>
      </div>
      <Link className="button secondary" to="/quiniela">
        Hacer quiniela <ArrowRight size={16} />
      </Link>
      <button className="text-button" onClick={() => setExpanded(!expanded)}>
        {expanded ? "Cerrar detalles" : "Participantes y reglas"}
      </button>
      {expanded && (
        <div className="group-settings">
          <h4>El vestuario</h4>
          <ul className="members-list">
            {people.map((p) => (
              <li key={p.id}>
                <Users size={13} />
                {p.name}
                <span>{g.ownerId === p.id ? "Administrador" : ""}</span>
              </li>
            ))}
          </ul>
          <h4>Competiciones activas</h4>
          {seasons.map((s) => (
            <p key={s.id}>
              {s.id} ·{" "}
              {s.mode === "classic" ? "Clásica 1X2" : "Marcador exacto"} · Fija
              toda la temporada
            </p>
          ))}
          {g.ownerId === user.uid ? (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(() => renameGroup(g.id, name));
                }}
              >
                <label>
                  Nombre del grupo
                  <input
                    required
                    minLength={3}
                    maxLength={60}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <button disabled={busy} className="button secondary">
                  Guardar nombre
                </button>
              </form>
              <h4>Activar competición esta temporada</h4>
              <div className="form-row">
                <select
                  aria-label="Activar competición"
                  value={competition}
                  onChange={(e) => setCompetition(e.target.value)}
                >
                  <option value="PD">LaLiga</option>
                  <option value="CL">Champions</option>
                </select>
                <select
                  aria-label="Modalidad nueva competición"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as Mode)}
                >
                  <option value="classic">Clásica 1X2</option>
                  <option value="exact">Marcador exacto</option>
                </select>
              </div>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void act(() => activateCompetition(g.id, competition, mode))
                }
              >
                Activar competición
              </button>
              <p className="footnote">
                Una competición ya iniciada no se puede reiniciar ni cambiar de
                modalidad.
              </p>
            </>
          ) : (
            <button
              disabled={busy}
              className="text-button"
              onClick={() => void act(() => leaveGroup(user.uid, g))}
            >
              Abandonar grupo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
