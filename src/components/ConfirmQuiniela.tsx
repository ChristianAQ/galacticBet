import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { useBodyScrollLock } from "../lib/useBodyScrollLock";
import {
  predictionSummary,
  type Match,
  type PredictionValue,
} from "../lib/domain";

export default function ConfirmQuiniela({
  matches,
  values,
  busy,
  demo,
  error,
  onCancel,
  onConfirm,
}: {
  matches: Match[];
  values: Record<string, PredictionValue>;
  busy: boolean;
  demo: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  useBodyScrollLock(true);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>("[data-cancel]")?.focus();
    return () => previous?.focus({ preventScroll: true });
  }, []);
  function keyboard(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && !busy) onCancel();
    if (event.key !== "Tab") return;
    const buttons = panel.current?.querySelectorAll<HTMLButtonElement>(
      "button:not(:disabled)",
    );
    if (!buttons?.length) {
      event.preventDefault();
      return;
    }
    const first = buttons[0],
      last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  const omitted = matches.filter((m) => !values[m.id]).length;
  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <section
        ref={panel}
        className="modal panel confirm-quiniela"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-quiniela-title"
        aria-describedby="confirm-quiniela-description"
        aria-busy={busy}
        onKeyDown={keyboard}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="confirm-icon">
          <LockKeyhole size={25} />
        </span>
        <h2 id="confirm-quiniela-title">¿Guardamos tu quiniela?</h2>
        <p id="confirm-quiniela-description">
          Una vez guardada,{" "}
          <strong>no podrás modificar ningún pronóstico de esta jornada</strong>
          , aunque los partidos todavía no hayan empezado.
        </p>
        <ul className="confirmation-summary">
          {matches
            .filter((m) => values[m.id])
            .map((m) => (
              <li key={m.id}>
                <span>
                  {m.home}
                  <small>vs {m.away}</small>
                </span>
                <strong>{predictionSummary(values[m.id])}</strong>
              </li>
            ))}
        </ul>
        {omitted > 0 && (
          <p className="confirmation-note">
            {omitted}{" "}
            {omitted === 1
              ? "partido sin pronóstico quedará"
              : "partidos sin pronóstico quedarán"}{" "}
            en blanco. Los encuentros cerrados o no disponibles no se pueden
            completar.
          </p>
        )}
        <p className="confirmation-privacy">
          <ShieldCheck size={16} />
          Tus amigos solo verán cada pronóstico cuando empiece ese partido.
        </p>
        {demo && (
          <p className="setup-notice">
            Modo demo: este cierre solo se conserva durante esta sesión de
            prueba.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="confirm-buttons">
          <button
            className="button secondary"
            data-cancel
            disabled={busy}
            onClick={onCancel}
          >
            Seguir editando
          </button>
          <button
            className="button primary"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Guardando…" : "Sí, guardar y cerrar"}
          </button>
        </div>
      </section>
    </div>
  );
}
