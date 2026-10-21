import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Home,
  Menu,
  Plus,
  ShieldCheck,
  Target,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import LoginModal from "./components/LoginModal";
import { Empty, PrivateGate, readableError } from "./components/ui";
import { loadGroups, loadMatches, type Group } from "./lib/data";
import { demoMatches } from "./lib/demo";
import { type Match } from "./lib/domain";
import { auth, configured, db } from "./lib/firebase";
const HomePage = lazy(() => import("./pages/HomePage"));
const MatchesPage = lazy(() => import("./pages/MatchesPage"));
const PredictionsPage = lazy(() => import("./pages/PredictionsPage"));
const GroupsPage = lazy(() => import("./pages/GroupsPage"));
const StandingsPage = lazy(() => import("./pages/StandingsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const nav = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/partidos", label: "Partidos", icon: CalendarDays },
  { to: "/quiniela", label: "Mi quiniela", icon: Target },
  { to: "/grupos", label: "Mis grupos", icon: Users },
  { to: "/clasificacion", label: "Clasificación", icon: Trophy },
];
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!auth);
  const [demo, setDemo] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [login, setLogin] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(
    () =>
      auth
        ? onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthReady(true);
            if (u && db)
              void setDoc(
                doc(db, "users", u.uid),
                {
                  name: u.displayName || "Jugador",
                  avatar: u.photoURL || null,
                  updatedAt: serverTimestamp(),
                },
                { merge: true },
              ).catch((e) =>
                setError(
                  "Se inició sesión, pero no se pudo guardar el perfil: " +
                    readableError(e),
                ),
              );
          })
        : undefined,
    [],
  );
  async function refreshGroups() {
    if (user) {
      try {
        const next = await loadGroups(user.uid);
        if (auth?.currentUser?.uid === user.uid) setGroups(next);
      } catch (e) {
        setError(readableError(e));
      }
    }
  }
  useEffect(() => {
    setMatches(demo ? demoMatches : []);
    if (demo || !configured) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    loadMatches()
      .then((next) => {
        if (active) setMatches(next);
      })
      .catch((e) => {
        if (active) setError(readableError(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [demo]);
  useEffect(() => {
    setGroups([]);
    void refreshGroups();
  }, [user]);
  const name = user?.displayName?.split(" ")[0] || "crack";
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link className="brand" to="/">
          <span className="brand-mark">
            <Zap fill="currentColor" size={23} />
          </span>
          galactic<span>bet</span>
          <span className="brand-dot">®</span>
        </Link>
        <div className="sidebar-caption">TU CENTRO DE JUEGO</div>
        <nav>
          {nav.map((n) => (
            <NavLink
              end={n.to === "/"}
              to={n.to}
              key={n.to}
              onClick={() => setMenu(false)}
            >
              <n.icon size={20} />
              {n.label}
              {n.to === "/quiniela" && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-competitions">
          <span className="sidebar-caption">COMPETICIONES</span>
          <Link to="/partidos?competition=PD">
            <span className="tiny-league">LL</span>LaLiga EA Sports
            <span className="live-dot" />
          </Link>
          <Link to="/partidos?competition=CL">
            <span className="tiny-league">✦</span>Champions League
            <span className="live-dot" />
          </Link>
        </div>
        <div className="sidebar-bottom">
          <div className="friend-card">
            <Users size={22} />
            <h4>El fútbol, con los tuyos.</h4>
            <p>Crea una liga privada y demuestra quién sabe más.</p>
            <Link to="/grupos">
              Crear mi grupo <Plus size={15} />
            </Link>
          </div>
          <Link to="/perfil" className="sidebar-help">
            <CircleHelp size={18} />
            Ayuda y cómo jugar
            <ArrowUpRight size={14} />
          </Link>
          <div className="sidebar-footer">
            HECHO PARA VIVIR EL FÚTBOL <span>⚽</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Abrir menú"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <div className="topbar-breadcrumb">
            Tu comunidad. Tu fútbol.<span>/</span>
            <strong>Temporada 2026 / 27</strong>
          </div>
          <div className="topbar-right">
            <span className="private-label">
              <ShieldCheck size={15} /> Ligas privadas, rivalidad real
            </span>
            <button
              aria-label={user ? "Abrir perfil" : "Acceder"}
              className="profile-button"
              onClick={() => setLogin(true)}
            >
              <span className="avatar">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Tu avatar" />
                ) : (
                  user?.displayName?.charAt(0) || "G"
                )}
              </span>
              <span>{user?.displayName || "Acceder"}</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </header>
        <main>
          {demo && (
            <div className="demo-banner">
              <span>
                <Activity size={15} /> Modo demo · Calendario y resultados de
                ejemplo. Los pronósticos no se guardan en la nube.
              </span>
              <button onClick={() => setDemo(false)}>
                Salir de demo <X size={14} />
              </button>
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Cerrar error">
                <X size={16} />
              </button>
            </div>
          )}
          <Suspense
            fallback={<Empty title="Cargando…">Preparando tu vestuario.</Empty>}
          >
            <Routes>
              <Route
                path="/"
                element={
                  <HomePage
                    name={name}
                    groups={groups}
                    matches={matches}
                    loading={loading}
                    onDemo={() => setDemo(true)}
                  />
                }
              />
              <Route
                path="/partidos"
                element={
                  <MatchesPage
                    matches={matches}
                    demo={demo}
                    onDemo={() => setDemo(true)}
                    loading={loading}
                  />
                }
              />
              <Route
                path="/quiniela"
                element={
                  !authReady ? (
                    <Empty title="Comprobando sesión…">Un momento.</Empty>
                  ) : !user && !demo ? (
                    <PrivateGate
                      onLogin={() => setLogin(true)}
                      onDemo={() => setDemo(true)}
                    />
                  ) : (
                    <PredictionsPage
                      matches={matches}
                      groups={groups}
                      user={user}
                      demo={demo}
                    />
                  )
                }
              />
              <Route
                path="/grupos"
                element={
                  <GroupsPage
                    user={user}
                    groups={groups}
                    refresh={refreshGroups}
                    onLogin={() => setLogin(true)}
                  />
                }
              />
              <Route
                path="/clasificacion"
                element={
                  <StandingsPage
                    groups={groups}
                    user={user}
                    onLogin={() => setLogin(true)}
                  />
                }
              />
              <Route
                path="/perfil"
                element={
                  <ProfilePage user={user} onLogin={() => setLogin(true)} />
                }
              />
              <Route
                path="*"
                element={
                  <Empty title="Fuera de juego">
                    Esta página no existe. <Link to="/">Volver al inicio</Link>
                  </Empty>
                }
              />
            </Routes>
          </Suspense>
          <footer className="main-footer">
            <span>© {new Date().getFullYear()} GalacticBet</span>
            <span>
              Fútbol real. Rivalidad sana.{" "}
              <span className="green-text">Siempre entre amigos.</span>
            </span>
            <Link to="/perfil">
              Cómo jugar <ArrowUpRight size={13} />
            </Link>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav">
        {nav.map((n) => (
          <NavLink end={n.to === "/"} to={n.to} key={n.to}>
            <n.icon size={21} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      {login && <LoginModal close={() => setLogin(false)} user={user} />}
    </div>
  );
}
