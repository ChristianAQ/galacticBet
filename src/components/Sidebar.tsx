import {
  ArrowUpRight,
  CircleHelp,
  Plus,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useBodyScrollLock } from "../lib/useBodyScrollLock";

interface SidebarProps {
  open: boolean;
  mobile: boolean;
  onClose: () => void;
  items: { to: string; label: string; icon: LucideIcon }[];
}

export default function Sidebar({
  open,
  mobile,
  onClose,
  items,
}: SidebarProps) {
  const panel = useRef<HTMLElement>(null);
  const location = useLocation();
  useBodyScrollLock(open);

  useEffect(() => {
    onClose();
  }, [location.key, onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current
      ?.querySelector<HTMLButtonElement>(".sidebar-close")
      ?.focus({ preventScroll: true });

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab") return;
      const controls = panel.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not(:disabled)",
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (previous?.isConnected && previous.getClientRects().length) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [open, onClose]);

  return (
    <>
      {open && (
        <button
          className="sidebar-overlay"
          onClick={onClose}
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
      <aside
        id="app-sidebar"
        ref={panel}
        className={`sidebar ${open ? "open" : ""}`}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label="Menú principal"
        aria-hidden={mobile && !open ? true : undefined}
        inert={mobile && !open}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a"))
            onClose();
        }}
      >
        <div className="sidebar-header">
          <Link className="brand" to="/">
            <span className="brand-mark">
              <Zap fill="currentColor" size={23} />
            </span>
            galactic<span>bet</span>
            <span className="brand-dot">®</span>
          </Link>
          <button
            className="sidebar-close icon-button"
            aria-label="Cerrar menú"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </div>
        <div className="sidebar-caption">TU CENTRO DE JUEGO</div>
        <nav aria-label="Secciones">
          {items.map((item) => (
            <NavLink end={item.to === "/"} to={item.to} key={item.to}>
              <item.icon size={20} />
              {item.label}
              {item.to === "/quiniela" && <span className="nav-dot" />}
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
    </>
  );
}
