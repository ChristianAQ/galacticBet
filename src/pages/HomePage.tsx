import {
  ArrowRight,
  CalendarDays,
  Plus,
  NotebookPen,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import UpcomingSchedule from "../components/UpcomingSchedule";
import NewsSection from "../components/NewsSection";
import type { Group } from "../lib/data";
import type { Match } from "../lib/domain";
import { upcomingMatches } from "../lib/schedule";

export default function HomePage({
  name,
  groups,
  matches,
  loading,
  demo = false,
}: {
  name: string;
  groups: Group[];
  matches: Match[];
  loading: boolean;
  demo?: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) setNow(Date.now());
    };
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const upcoming = upcomingMatches(matches, now);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">FÚTBOL ENTRE AMIGOS</div>
          <h1>Hola, {name}</h1>
          <p>Tus competiciones, tus jornadas y tu próxima quiniela.</p>
        </div>
        <div className="today">
          <CalendarDays size={17} />
          {new Intl.DateTimeFormat("es", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "Europe/Madrid",
          }).format(new Date(now))}
        </div>
      </div>
      <UpcomingSchedule
        matches={matches}
        upcoming={upcoming}
        now={now}
        loading={loading}
      />
      <Link to="/porra" className="porra-home-link">
        <span className="porra-home-icon">
          <NotebookPen size={23} />
        </span>
        <span>
          <strong>Una porra para el próximo partido</strong>
          <small>
            Anota marcadores, calcula el bote y comparte la tarjeta.
          </small>
        </span>
        <ArrowRight size={18} />
      </Link>
      <div className="dashboard-columns">
        <NewsSection demo={demo} />
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
              {groups.length ? "Ir a mis grupos" : "Crear un grupo"}
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
              <Link to="/perfil?tab=play">
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
