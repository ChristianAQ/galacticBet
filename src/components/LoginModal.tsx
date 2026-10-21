import type { User } from "firebase/auth";
import { ArrowRight, ArrowUpRight, X, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { configured, emailLogin, googleLogin, logout } from "../lib/firebase";
import { readableError } from "./ui";
export default function LoginModal({
  close,
  user,
}: {
  close: () => void;
  user: User | null;
}) {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  function keyboard(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape") close();
    if (e.key !== "Tab") return;
    const items = dialog.current?.querySelectorAll<HTMLElement>(
      "button:not(:disabled),a[href],input:not(:disabled)",
    );
    if (!items?.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      close();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        ref={dialog}
        onKeyDown={keyboard}
        className="modal panel"
        role="dialog"
        aria-modal="true"
        aria-label="Acceder a GalacticBet"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close icon-button"
          aria-label="Cerrar"
          onClick={close}
        >
          <X />
        </button>
        <span className="brand-mark">
          <Zap fill="currentColor" />
        </span>
        <h2>
          {user
            ? "Tu perfil"
            : register
              ? "Únete al vestuario"
              : "Bienvenido al vestuario"}
        </h2>
        {user ? (
          <>
            <p>
              {user.displayName} · {user.email}
            </p>
            <Link className="button primary" to="/perfil" onClick={close}>
              Ver perfil
            </Link>
            <button
              className="button secondary"
              onClick={() => void run(logout)}
            >
              Cerrar sesión
            </button>
          </>
        ) : (
          <>
            {!configured && (
              <p className="setup-notice">
                El acceso estará disponible al conectar Firebase. Mientras
                tanto, puedes explorar el modo demo desde el inicio.
              </p>
            )}
            <button
              className="button secondary full"
              disabled={!configured || busy}
              onClick={() => void run(googleLogin)}
            >
              Continuar con Google <ArrowUpRight size={16} />
            </button>
            <div className="divider">o con tu correo</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(() =>
                  emailLogin(email, password, register ? name : undefined),
                );
              }}
            >
              {register && (
                <label>
                  Nombre
                  <input
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              )}
              <label>
                Correo electrónico
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                />
              </label>
              <label>
                Contraseña
                <input
                  type="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button
                className="button primary full"
                disabled={!configured || busy}
              >
                {busy ? "Entrando…" : register ? "Crear cuenta" : "Entrar"}
                <ArrowRight size={17} />
              </button>
            </form>
            <button
              className="text-button register-toggle"
              onClick={() => setRegister(!register)}
            >
              {register ? "Ya tengo cuenta" : "¿Primera vez? Crea tu cuenta"}
            </button>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
