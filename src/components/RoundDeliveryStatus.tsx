import { Clock3 } from "lucide-react";
import type { Participant } from "../lib/data";

export default function RoundDeliveryStatus({
  memberIds,
  participants,
  completedIds,
  ready,
  deadline,
  clock,
  canShare,
  sealed,
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
  const closed = deadline !== null && clock >= deadline;
  const date =
    deadline === null
      ? ""
      : new Intl.DateTimeFormat("es", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }).format(deadline);
  return (
    <section
      className="delivery-panel panel"
      aria-label="Entregas de la jornada"
      aria-busy={!ready}
    >
      <div className="delivery-heading">
        <h2>
          {ready
            ? `${done.length} de ${memberIds.length} han guardado`
            : "Comprobando entregas…"}
        </h2>
        {ready && (
          <span>
            {canShare
              ? "Pronósticos compartidos"
              : "Solo tú ves tus elecciones"}
          </span>
        )}
      </div>
      <p
        className={`delivery-deadline ${closed ? "is-closed" : ""}`}
        role="status"
      >
        <Clock3 size={15} />
        <span>
          {deadline === null ? (
            "Esperando el horario de la jornada"
          ) : (
            <>
              {closed ? "Plazo cerrado" : "Entrega hasta"} ·{" "}
              <time dateTime={new Date(deadline).toISOString()}>{date}</time>
              <small>Inicio del primer partido · hora local</small>
            </>
          )}
        </span>
      </p>
      {ready &&
        (missing.length ? (
          <div className="delivery-missing">
            <h3>
              {closed ? "Sin entregar" : "Faltan por guardar"}
              <span>{missing.length}</span>
            </h3>
            <ul>
              {missing.map((id) => (
                <li key={id}>
                  {participants.find((person) => person.id === id)?.name ||
                    "Jugador"}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="delivery-all-done">
            Todo el grupo ha guardado su quiniela.
          </p>
        ))}
      {ready && !canShare && (sealed || !closed) && (
        <p className="delivery-privacy">
          {sealed
            ? "Esta entrega anterior no está habilitada para compartir. Solo se comparten jornadas completas."
            : "Completa y guarda para ver a quienes también hayan entregado."}
        </p>
      )}
    </section>
  );
}
