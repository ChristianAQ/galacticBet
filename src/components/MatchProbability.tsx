import { useEffect, useState } from "react";
import type { Match } from "../lib/domain";
import type { MatchProbability as Probability } from "../lib/matchProbability";
export default function MatchProbability({
  match,
  probability,
}: {
  match: Match;
  probability?: Probability;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) setNow(Date.now());
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  if (
    !["TIMED", "SCHEDULED"].includes(match.status) ||
    Date.parse(match.utcDate) <= now
  )
    return (
      <p className="match-extra-empty">
        La probabilidad previa solo se muestra antes del partido.
      </p>
    );
  if (
    !probability ||
    Date.parse(probability.fetchedAt) > now ||
    now - Date.parse(probability.fetchedAt) > 36 * 3_600_000 ||
    (probability.marketUpdatedAt !== undefined &&
      (Date.parse(probability.marketUpdatedAt) > now ||
        now - Date.parse(probability.marketUpdatedAt) > 36 * 3_600_000))
  )
    return (
      <p className="match-extra-empty">
        ESPN todavía no ofrece una probabilidad actualizada para este encuentro.
      </p>
    );
  const options = [
    { label: match.home, value: probability.home, code: "1" },
    { label: "Empate", value: probability.draw, code: "X" },
    { label: match.away, value: probability.away, code: "2" },
  ];
  const format = (n: number) =>
    new Intl.NumberFormat("es", { maximumFractionDigits: 1 }).format(n);
  return (
    <section
      className="match-probability"
      aria-label="Probabilidad previa al partido"
    >
      <div className="probability-values">
        {options.map((p) => (
          <div key={p.code}>
            <span>{p.label}</span>
            <strong>
              {format(p.value)}
              <small>%</small>
            </strong>
            <small>{p.code}</small>
          </div>
        ))}
      </div>
      <div className="probability-bar" aria-hidden="true">
        {options.map((p) => (
          <span key={p.code} style={{ flexGrow: p.value }} />
        ))}
      </div>
      <p>
        {probability.model === "ESPN_ODDS"
          ? `Probabilidad implícita de cuotas 1X2 · ${probability.bookmaker} vía ESPN. Margen eliminado; no es un modelo estadístico.`
          : "Estimación del modelo ESPN; no garantiza el resultado."}
      </p>
      {probability.marketUpdatedAt && (
        <small className="probability-market-time">
          Cuotas actualizadas{" "}
          {new Intl.DateTimeFormat("es", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(probability.marketUpdatedAt))}
        </small>
      )}
      <small>
        Consultado{" "}
        <time dateTime={probability.fetchedAt}>
          {new Intl.DateTimeFormat("es", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(probability.fetchedAt))}
        </time>
      </small>
    </section>
  );
}
