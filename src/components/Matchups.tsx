import type { Matchup } from "../lib/matchInsightsData";
export default function Matchups({ matches }: { matches: Matchup[] }) {
  if (!matches.length) return null;
  return (
    <section
      className="matchup-history"
      aria-label="Últimos enfrentamientos entre ambos equipos"
    >
      <h4>Últimos enfrentamientos</h4>
      <ul>
        {matches.map((m) => (
          <li key={m.id}>
            <div className="matchup-meta">
              <time dateTime={m.date}>
                {new Intl.DateTimeFormat("es", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }).format(new Date(m.date))}
              </time>
              {m.competition && <span>{m.competition}</span>}
            </div>
            <div className="matchup-scoreline">
              <span
                className={m.homeScore > m.awayScore ? "matchup-winner" : ""}
              >
                {m.home}
              </span>
              <strong
                aria-label={`${m.home}: ${m.homeScore}; ${m.away}: ${m.awayScore}`}
              >
                {m.homeScore} <span>–</span> {m.awayScore}
              </strong>
              <span
                className={m.awayScore > m.homeScore ? "matchup-winner" : ""}
              >
                {m.away}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className="match-extra-note">
        Fuente: ESPN · Marcadores publicados del partido, que pueden incluir
        prórroga. No se utilizan para puntuar la quiniela.
      </p>
    </section>
  );
}
