import { ChartNoAxesColumnIncreasing, ChevronDown, Trophy } from "lucide-react";
import type { Match } from "../lib/domain";
import { finishedMatchResult } from "../lib/matchResult";

export default function MatchResult({ match }: { match: Match }) {
  const result = finishedMatchResult(match);
  if (!result) return null;
  const rows = result.regulation
    ? [
        ["Goles · 90 min", result.regulation.home, result.regulation.away],
        ...(result.halfTime
          ? [["Primera parte", result.halfTime.home, result.halfTime.away]]
          : []),
        ...(result.secondHalf
          ? [["Segunda parte", result.secondHalf.home, result.secondHalf.away]]
          : []),
        [
          "Portería a cero",
          result.regulation.away === 0 ? "Sí" : "No",
          result.regulation.home === 0 ? "Sí" : "No",
        ],
      ]
    : [];
  return (
    <section className="finished-result" aria-label="Resultado del partido">
      <div className="finished-result-main">
        <div className="finished-result-score">
          <span>Resultado · 90 min</span>
          <strong>
            {result.regulation
              ? `${result.regulation.home} – ${result.regulation.away}`
              : "—"}
          </strong>
          {result.sign && <small>Signo {result.sign}</small>}
        </div>
        <div
          className={`finished-winner ${result.winnerName ? "has-winner" : ""}`}
        >
          {result.winnerName && <Trophy size={17} aria-hidden="true" />}
          <div>
            <span>
              {result.winnerName
                ? "Ganador del partido"
                : result.winner === "X"
                  ? "Partido empatado"
                  : "Ganador pendiente"}
            </span>
            <strong>
              {result.winnerName ||
                (result.winner === "X" ? "Empate" : "Por confirmar")}
            </strong>
            <small>{result.decision}</small>
          </div>
        </div>
      </div>
      {result.regulation ? (
        <details className="match-result-stats">
          <summary>
            <span>
              <ChartNoAxesColumnIncreasing size={14} /> Estadísticas del partido
            </span>
            <ChevronDown size={15} />
          </summary>
          <div className="match-result-stats-body">
            <table>
              <caption className="sr-only">
                Estadísticas del partido a 90 minutos
              </caption>
              <thead>
                <tr>
                  <th scope="col">Dato</th>
                  <th scope="col">{match.home}</th>
                  <th scope="col">{match.away}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, home, away]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td>{home}</td>
                    <td>{away}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="match-goals-total">
              <span>Goles totales · 90 min</span>
              <strong>{result.totalGoals}</strong>
            </div>
            {!result.halfTime && (
              <p className="match-data-note">
                Marcador al descanso no disponible.
              </p>
            )}
          </div>
        </details>
      ) : (
        <p className="match-data-note result-pending">
          Marcador reglamentario pendiente.
        </p>
      )}
    </section>
  );
}
