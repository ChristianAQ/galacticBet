import { useState } from "react";
import type { Match } from "../lib/domain";
import type { MatchLineup, MatchPlayer } from "../lib/matchInsightsData";
import { positionLines } from "../lib/matchPresentation";

function Player({ player }: { player: MatchPlayer }) {
  return (
    <span className="pitch-player">
      <b>{player.number || "—"}</b>
      <span>{player.name}</span>
    </span>
  );
}
export default function LineupPitch({
  match,
  lineups,
  initialSide = "home",
}: {
  match: Match;
  lineups: MatchLineup[];
  initialSide?: "home" | "away";
}) {
  const [side, setSide] = useState<"home" | "away">(initialSide);
  const lineup = lineups.find((l) => l.side === side);
  const { lines, unknown } = positionLines(lineup?.players || []);
  return (
    <section
      className="lineup-map"
      aria-label="Distribución de titulares por posición"
    >
      <div
        className="pitch-team-switch"
        role="group"
        aria-label="Equipo sobre el campo"
      >
        {(["home", "away"] as const).map((s) => (
          <button
            type="button"
            key={s}
            aria-pressed={side === s}
            onClick={() => setSide(s)}
          >
            {match[s]}
          </button>
        ))}
      </div>
      {lines.some((l) => l.players.length) ? (
        <>
          <div className="lineup-pitch">
            {[...lines].reverse().map((line) => (
              <div
                key={line.label}
                className="pitch-line"
                role="group"
                aria-label={line.label}
              >
                {line.players.map((p, i) => (
                  <Player key={`${p.name}-${i}`} player={p} />
                ))}
              </div>
            ))}
          </div>
          <p className="match-extra-note">
            Distribución por posición publicada. La ubicación exacta en el campo
            puede variar.
          </p>
        </>
      ) : (
        <p className="match-extra-empty">
          Posiciones de los titulares no disponibles.
        </p>
      )}
      {unknown.length > 0 && (
        <div className="pitch-unassigned">
          <small>Sin posición publicada</small>
          <div>
            {unknown.map((p, i) => (
              <Player key={i} player={p} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
