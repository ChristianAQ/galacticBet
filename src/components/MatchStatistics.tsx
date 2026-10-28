import type { Match } from "../lib/domain";
import type { MatchStatistic } from "../lib/matchInsightsData";
import { statisticShares } from "../lib/matchPresentation";
import { Team } from "./ui";

const lowerIsBetter = new Set([
  "Faltas",
  "Tarjetas amarillas",
  "Tarjetas rojas",
  "Fueras de juego",
]);
const labels: Record<string, string> = {
  Remates: "Tiros",
  "Remates a puerta": "Tiros a puerta",
  "Pases completados": "Pases completados",
  "Precisión de pase": "Precisión de pases",
  Córners: "Saques de esquina",
};

export default function MatchStatistics({
  match,
  statistics,
}: {
  match: Match;
  statistics: MatchStatistic[];
}) {
  return (
    <div className="match-statistics-card">
      <table className="match-extra-stats">
        <caption className="sr-only">
          Estadísticas del partido según ESPN. Se destaca la cifra más
          favorable; en faltas, tarjetas y fueras de juego, la menor.
        </caption>
        <thead>
          <tr>
            <th scope="col">
              <Team name={match.home} crest={match.homeCrest} />
            </th>
            <th scope="col">Estadísticas de equipo</th>
            <th scope="col">
              <Team name={match.away} crest={match.awayCrest} />
            </th>
          </tr>
        </thead>
        <tbody>
          {statistics.map((stat, index) => {
            const shares = statisticShares(stat.home, stat.away);
            const lower = lowerIsBetter.has(stat.label);
            const highlighted =
              !shares || shares[0] === shares[1]
                ? null
                : lower
                  ? shares[0] < shares[1]
                    ? "home"
                    : "away"
                  : shares[0] > shares[1]
                    ? "home"
                    : "away";
            const value = (side: "home" | "away") => (
              <span
                className={`stat-value ${side}${highlighted === side ? " is-highlighted" : ""}`}
              >
                {stat[side]}
                {highlighted === side && (
                  <span className="sr-only">
                    {" "}
                    · {lower ? "Menor cifra" : "Mayor cifra"}
                  </span>
                )}
              </span>
            );
            return (
              <tr key={`${stat.label}-${index}`}>
                <td>{value("home")}</td>
                <th scope="row">{labels[stat.label] || stat.label}</th>
                <td>{value("away")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
