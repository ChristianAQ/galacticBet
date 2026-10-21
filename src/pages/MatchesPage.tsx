import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import CompetitionLogo from "../components/CompetitionLogo";
import { Empty, MatchRow, PageTitle } from "../components/ui";
import { preferredRound, roundLabel, type Match } from "../lib/domain";
export default function MatchesPage({
  matches,
  demo,
  onDemo,
  loading,
}: {
  matches: Match[];
  demo: boolean;
  onDemo: () => void;
  loading: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const competition = params.get("competition") === "CL" ? "CL" : "PD";
  const [round, setRound] = useState("");
  const filtered = matches.filter((m) => m.competition === competition);
  const rounds = [...new Set(filtered.map((m) => m.roundId))];
  const selected = rounds.includes(round) ? round : preferredRound(filtered);
  return (
    <>
      <PageTitle
        eyebrow="CADA PARTIDO CUENTA"
        title="El calendario del fútbol"
        description="Jornadas, eliminatorias y resultados. Todo en un mismo terreno de juego."
      />
      <div className="tabs">
        {["PD", "CL"].map((c) => (
          <button
            className={competition === c ? "selected" : ""}
            onClick={() => {
              setParams({ competition: c });
              setRound("");
            }}
            key={c}
          >
            <CompetitionLogo code={c} small />
            {c === "PD" ? "LaLiga" : "Champions League"}
          </button>
        ))}
      </div>
      <div className="filter-row">
        <h2>
          {competition === "PD" ? "LaLiga EA Sports" : "UEFA Champions League"}
        </h2>
        <select
          aria-label="Seleccionar jornada o ronda"
          value={selected || ""}
          onChange={(e) => setRound(e.target.value)}
        >
          {rounds.length ? (
            rounds.map((r) => {
              const m = filtered.find((m) => m.roundId === r)!;
              return (
                <option key={r} value={r}>
                  {roundLabel(m)}
                </option>
              );
            })
          ) : (
            <option>Sin jornadas sincronizadas</option>
          )}
        </select>
      </div>
      <div className="panel">
        {loading ? (
          <Empty title="Cargando partidos…">Consultando Firestore.</Empty>
        ) : filtered.length ? (
          filtered
            .filter((m) => m.roundId === selected)
            .map((m) => <MatchRow key={m.id} match={m} />)
        ) : (
          <Empty title="Aún no hay partidos disponibles">
            {demo
              ? "La demo contiene únicamente una jornada de LaLiga."
              : "La sincronización cargará los calendarios y resultados reales desde Football-Data.org."}
            <br />
            <button className="button secondary" onClick={onDemo}>
              Explorar modo demo
            </button>
          </Empty>
        )}
      </div>
    </>
  );
}
