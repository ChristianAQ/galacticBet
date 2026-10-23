import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../lib/useBodyScrollLock";

export default function Modal({
  title,
  busy = false,
  onClose,
  children,
  className = "",
}: {
  title: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const panel = useRef<HTMLElement>(null);
  const titleId = useId();
  useBodyScrollLock(true);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = document.getElementById("root");
    const wasInert = root?.inert || false;
    if (root) root.inert = true;
    (
      panel.current?.querySelector<HTMLElement>("input, select") ||
      panel.current?.querySelector<HTMLElement>("button") ||
      panel.current
    )?.focus();
    return () => {
      if (root) root.inert = wasInert;
      previous?.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div
      className="modal-backdrop"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <section
        ref={panel}
        tabIndex={-1}
        className={`modal panel group-form-modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            if (!busy) onClose();
          }
          if (e.key !== "Tab") return;
          const controls = panel.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
          );
          if (!controls?.length) {
            e.preventDefault();
            panel.current?.focus();
            return;
          }
          const first = controls[0],
            last = controls[controls.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
      >
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="modal-close icon-button"
          aria-label="Cerrar ventana"
          disabled={busy}
          onClick={onClose}
        >
          <X />
        </button>
        {children}
      </section>
    </div>,
    document.body,
  );
}
