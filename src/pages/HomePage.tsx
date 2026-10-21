import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Plus,
  ShieldCheck,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import CompetitionLogo from "../components/CompetitionLogo";
import { Badge, Empty, MatchRow } from "../components/ui";
import type { Group } from "../lib/data";
import { canPredict, type Match } from "../lib/domain";
export default function HomePage({
  name,
  groups,
  matches,
  loading,
  onDemo,
}: {
  name: string;
  groups: Group[];
  matches: Match[];
  loading: boolean;
  onDemo: () => void;
}) {
  const upcoming = matches.filter((m) =>
    canPredict(m.utcDate, Date.now(), m.status),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="live-dot" /> EL PARTIDO EMPIEZA AQUÍ
          </div>
          <h1>
            ¡Qué pasa, {name}! <span className="wave">✌</span>
          </h1>
          <p>Una nueva jornada. Otra oportunidad para llevarte la gloria.</p>
        </div>
        <div className="today">
          <CalendarDays size={17} />
          {new Intl.DateTimeFormat("es", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "Europe/Madrid",
          }).format(new Date())}
        </div>
      </div>
      <section className="hero">
        <div className="hero-content">
          <Badge>EL FÚTBOL SE JUEGA ENTRE AMIGOS</Badge>
          <h2>
            Tu intuición.
            <br />
            Tu equipo.
            <br />
            <em>Tu próxima victoria.</em>
          </h2>
          <p>
            LaLiga y Champions. Todos los partidos, tus pronósticos
            <br className="desktop-break" /> y una sola pregunta: ¿quién manda
            en el grupo?
          </p>
          <Link className="button primary" to="/quiniela">
            Hacer mi quiniela
            <ArrowRight size={18} />
          </Link>
          <div className="hero-note">
            <ShieldCheck size={14} />
            Sin apuestas de dinero. Solo fútbol y orgullo.
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="pitch-circle" />
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="ball">
            <div className="ball-panel center" />
            <div className="ball-panel p1" />
            <div className="ball-panel p2" />
            <div className="ball-panel p3" />
            <div className="ball-panel p4" />
            <div className="ball-panel p5" />
          </div>
          <div className="floating-score">
            <span>LA MEJOR JUGADA</span>
            <strong>
              Jugar con los tuyos <Zap size={17} />
            </strong>
          </div>
          <span className="art-star star-one">✦</span>
          <span className="art-star star-two">+</span>
        </div>
      </section>
      <section className="stat-grid">
        <div className="stat-card">
          <span className="stat-icon">
            <Users />
          </span>
          <div>
            <span>Mis grupos</span>
            <strong>
              {groups.length.toString().padStart(2, "0")}
              <small> ligas privadas</small>
            </strong>
          </div>
          <Link to="/grupos" aria-label="Ver grupos">
            <ArrowUpRight size={19} />
          </Link>
        </div>
        <div className="stat-card">
          <span className="stat-icon">
            <Target />
          </span>
          <div>
            <span>Próximos partidos</span>
            <strong>
              {matches
                .filter((m) => canPredict(m.utcDate, Date.now(), m.status))
                .length.toString()
                .padStart(2, "0")}
              <small> tu próxima jugada</small>
            </strong>
          </div>
          <Link to="/quiniela" aria-label="Ver quiniela">
            <ArrowUpRight size={19} />
          </Link>
        </div>
        <div className="stat-card">
          <span className="stat-icon">
            <Trophy />
          </span>
          <div>
            <span>La gloria te espera</span>
            <strong>
              Todo<small> empieza en tu grupo</small>
            </strong>
          </div>
          <Link to="/clasificacion" aria-label="Ver clasificación">
            <ArrowUpRight size={19} />
          </Link>
        </div>
      </section>
      <div className="dashboard-columns">
        <section>
          <div className="section-heading">
            <h2>
              Elige tu competición <span>02</span>
            </h2>
            <Link to="/partidos">
              Ver calendario <ArrowRight size={15} />
            </Link>
          </div>
          <div className="competition-grid">
            {["PD", "CL"].map((code) => (
              <Link
                key={code}
                className={`competition-card ${code === "CL" ? "blue" : ""}`}
                to={`/partidos?competition=${code}`}
              >
                <div className="competition-card-top">
                  <CompetitionLogo code={code} />
                  <span className="competition-arrow">
                    <ArrowUpRight size={18} />
                  </span>
                </div>
                <div className="competition-subtitle">
                  {code === "PD"
                    ? "EL FÚTBOL DE CADA FIN DE SEMANA"
                    : "LAS NOCHES QUE LO CAMBIAN TODO"}
                </div>
                <h3>
                  {code === "PD" ? "LaLiga EA Sports" : "UEFA Champions League"}
                </h3>
                <div className="competition-card-bottom">
                  <span>
                    <span className="live-dot" />
                    Temporada 2026 / 27
                  </span>
                  <span>
                    {code === "PD"
                      ? "38 jornadas"
                      : "Fase liga + eliminatorias"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <div className="section-heading upcoming-heading">
            <h2>Próximos encuentros</h2>
            <Link to="/partidos">
              Ver todos <ArrowRight size={15} />
            </Link>
          </div>
          <div className="panel">
            {loading ? (
              <Empty title="Cargando calendario…">
                Consultando los partidos disponibles.
              </Empty>
            ) : upcoming.length ? (
              upcoming.slice(0, 3).map((m) => <MatchRow key={m.id} match={m} />)
            ) : (
              <div className="calendar-empty">
                <span className="empty-icon">
                  <CalendarDays size={25} />
                </span>
                <div>
                  <h3>El calendario está por llegar</h3>
                  <p>
                    Los partidos reales aparecerán al conectar y sincronizar la
                    competición.
                  </p>
                </div>
                <button className="text-button" onClick={onDemo}>
                  Explorar demo <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>
        </section>
        <aside className="right-column">
          <div className="section-heading">
            <h2>Tu vestuario</h2>
            <Users size={18} />
          </div>
          <div className="locker-card">
            <div className="locker-illustration">
              <span>⚑</span>
              <span>⚑</span>
              <Users size={33} />
            </div>
            <h3>
              La rivalidad empieza
              <br />
              en tu grupo.
            </h3>
            <p>
              Reúne a tus amigos, elige las reglas y convierte cada jornada en
              vuestra competición.
            </p>
            <Link className="button primary full" to="/grupos">
              <Plus size={17} />
              Crear un grupo
            </Link>
            <Link className="join-link" to="/grupos?join=1">
              Tengo un código de invitación <ArrowRight size={14} />
            </Link>
          </div>
          <div className="how-card">
            <span className="how-icon">
              <Zap size={20} />
            </span>
            <div>
              <h4>Dos formas de jugar</h4>
              <p>El clásico 1X2 o afina tu instinto con el marcador exacto.</p>
              <Link to="/perfil">
                Así se juega <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </aside>
      </div>
      <div className="bottom-note">
        <ShieldCheck size={15} />
        Tu grupo, tus reglas. Una comunidad privada para disfrutar del fútbol.
      </div>
    </>
  );
}
