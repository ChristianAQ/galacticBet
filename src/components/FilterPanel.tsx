import { ChevronDown, SlidersHorizontal, Trophy } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import CompetitionLogo from "./CompetitionLogo";
import type { CompetitionCode } from "../lib/preferences";

/** One disclosure for page filters; closing it preserves the selected values. */
export default function FilterPanel({
  title,
  summary,
  competition,
  applyLabel,
  children,
}: {
  title: string;
  summary: string;
  competition?: CompetitionCode | "global";
  applyLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  function close() {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }
  return (
    <section
      className="filter-panel panel"
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="filter-summary"
        aria-label={open ? "Ocultar filtros" : "Mostrar filtros"}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="filter-summary-icon">
          {competition === "global" ? (
            <Trophy size={21} />
          ) : competition ? (
            <CompetitionLogo code={competition} small />
          ) : (
            <SlidersHorizontal size={20} />
          )}
        </span>
        <span className="filter-summary-text">
          <strong title={title}>{title}</strong>
          <span title={summary}>{summary}</span>
        </span>
        <span className="filter-summary-action">
          <SlidersHorizontal size={15} />
          <span>Filtros</span>
          <ChevronDown size={15} />
        </span>
      </button>
      <div
        id={id}
        className={`filter-reveal ${open ? "is-open" : ""}`}
        inert={!open}
        aria-hidden={!open}
      >
        <div>
          <div className="filter-controls">
            {children}
            <button
              type="button"
              className="button primary filter-apply"
              onClick={close}
            >
              {applyLabel}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
