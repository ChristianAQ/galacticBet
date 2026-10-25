import { euro, porraTotal, type Porra } from "../lib/porra";

export default function PorraTicket({ porra: p }: { porra: Porra }) {
  return (
    <article className="porra-ticket" aria-label="Resumen de la porra">
      <header className="porra-ticket-header">
        <strong>
          galactic<span>bet</span>
          <small> / PORRA</small>
        </strong>
        <span>{p.demo ? "DEMO · EJEMPLO" : "ENTRE AMIGOS"}</span>
      </header>
      <div className="porra-ticket-match">
        <span className="porra-competition">
          {p.fixture.competition === "PD"
            ? "LaLiga EA Sports"
            : "UEFA Champions League"}
        </span>
        <h2>{p.title}</h2>
        <div className="porra-teams">
          <div>
            <span className="porra-team-badge">
              {p.fixture.home.slice(0, 2).toUpperCase()}
            </span>
            <strong>{p.fixture.home}</strong>
          </div>
          <span>vs</span>
          <div>
            <span className="porra-team-badge">
              {p.fixture.away.slice(0, 2).toUpperCase()}
            </span>
            <strong>{p.fixture.away}</strong>
          </div>
        </div>
        <time dateTime={p.fixture.utcDate}>
          {new Intl.DateTimeFormat("es", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(p.fixture.utcDate))}
        </time>
      </div>
      <ol
        className={`porra-ticket-players ${p.players.length > 8 ? "is-dense" : ""}`}
      >
        {p.players.map((player) => (
          <li key={player.id}>
            <span>{player.name}</span>
            <strong>
              {player.home}
              <span>–</span>
              {player.away}
            </strong>
          </li>
        ))}
      </ol>
      <footer className="porra-ticket-total">
        <div>
          <span>
            {p.players.length} personas · {euro(p.contributionCents)} por
            persona
          </span>
          <strong>Bote total</strong>
        </div>
        <b>{euro(porraTotal(p))}</b>
      </footer>
      <p className="porra-ticket-note">
        Marcador a 90 minutos · Aportaciones anotadas
      </p>
    </article>
  );
}
