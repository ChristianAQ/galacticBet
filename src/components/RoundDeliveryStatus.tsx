import { ChevronDown, Clock3 } from "lucide-react";
import type { Participant } from "../lib/data";

export default function RoundDeliveryStatus({
  memberIds,
  participants,
  completedIds,
  ready,
  deadline,
  clock,
}: {
  memberIds: string[];
  participants: Participant[];
  completedIds: string[];
  ready: boolean;
  deadline: number | null;
  clock: number;
  canShare: boolean;
  sealed: boolean;
}) {
  const done = memberIds.filter((id) => completedIds.includes(id));
  const missing = memberIds.filter((id) => !completedIds.includes(id));
  const validDate = deadline !== null && Number.isFinite(deadline);
  const closed = validDate && clock >= deadline;
  const date = validDate
    ? new Intl.DateTimeFormat("es", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(deadline)
    : "Fecha pendiente";
  return (
    <details
      className="delivery-panel panel"
      aria-label="Entregas de la jornada"
      aria-busy={!ready}
    >
      <summary className="delivery-summary">
        <strong
          aria-label={
            ready
              ? `${done.length} de ${memberIds.length} participantes han guardado`
              : "Comprobando entregas"
          }
        >
          {ready ? done.length : "—"} <span>de {memberIds.length}</span>
        </strong>
        <span className={`delivery-summary-date ${closed ? "is-closed" : ""}`}>
          {validDate ? (
            <time
              dateTime={new Date(deadline).toISOString()}
              title={closed ? "Plazo cerrado" : "Inicio del primer partido"}
            >
              {date}
            </time>
          ) : (
            date
          )}
          <ChevronDown size={15} aria-hidden="true" />
        </span>
      </summary>
      <div className="delivery-content">
        <p className="delivery-start">
          <Clock3 size={16} aria-hidden="true" />
          Inicio del primer partido de la jornada
        </p>
        {!ready ? (
          <p className="delivery-all-done" role="status">
            Comprobando quién falta…
          </p>
        ) : missing.length ? (
          <div className="delivery-missing">
            <h3>
              {closed ? "Sin entregar" : "Faltan por guardar"}
              <span>{missing.length}</span>
            </h3>
            <ul>
              {missing.map((id) => {
                const name =
                  participants.find((p) => p.id === id)?.name || "Jugador";
                return (
                  <li key={id}>
                    <span className="delivery-person-icon" aria-hidden="true">
                      {name.slice(0, 1).toUpperCase()}
                    </span>
                    <span>{name}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="delivery-all-done">Todos han guardado su quiniela.</p>
        )}
      </div>
    </details>
  );
}
