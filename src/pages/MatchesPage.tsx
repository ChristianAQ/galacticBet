import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import MatchDetails from "../components/MatchDetails";
import { knockoutContext } from "../lib/matchInsights";
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
  const round = params.get("round") || "";
  const [detailId, setDetailId] = useState("");
  const detail = matches.find((m) => m.id === detailId);
  const filtered = matches.filter((m) => m.competition === competition);
  const rounds = [...new Set(filtered.map((m) => m.roundId))];
  const selected = rounds.includes(round) ? round : preferredRound(filtered);
  useEffect(() => {
    if (selected && round !== selected) {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set("round", selected);
          return next;
        },
        { replace: true },
      );
    }
  }, [selected, round, setParams]);
  return (
    <>
      <PageTitle
        eyebrow="CADA PARTIDO CUENTA"
        title="El calendario del fútbol"
      />
      <div className="tabs">
        {["PD", "CL"].map((c) => (
          <button
            aria-label={c === "PD" ? "LaLiga" : "Champions League"}
            aria-pressed={competition === c}
            className={competition === c ? "selected" : ""}
            onClick={() => {
              setParams({ competition: c });
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
          onChange={(e) => {
            setParams((previous) => {
              const next = new URLSearchParams(previous);
              next.set("round", e.target.value);
              return next;
            });
          }}
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
      <div className="match-calendar-list">
        {loading ? (
          <Empty title="Cargando partidos…">Consultando Firestore.</Empty>
        ) : filtered.length ? (
          filtered
            .filter((m) => m.roundId === selected)
            .map((m) => {
              const tie = knockoutContext(m, matches);
              return (
                <button
                  key={m.id}
                  className="panel fixture-card-button"
                  aria-label={`Ver ficha de ${m.home} contra ${m.away}`}
                  onClick={() => setDetailId(m.id)}
                >
                  <span className="fixture-card-heading">
                    <span>{roundLabel(m)}</span>
                    {tie?.leg && (
                      <span>{tie.leg === 1 ? "Ida" : "Vuelta"}</span>
                    )}
                  </span>
                  <MatchRow match={m} history={matches} as="span" />
                  <span className="fixture-card-footer">
                    Ver ficha del partido
                    <ArrowUpRight size={15} />
                  </span>
                </button>
              );
            })
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
      {detail && (
        <MatchDetails
          match={detail}
          matches={matches}
          onClose={() => setDetailId("")}
        />
      )}
    </>
  );
}
