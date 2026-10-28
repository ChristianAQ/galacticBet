import { competitionCode } from "../lib/competitions";
import { competitionName } from "../lib/competitions";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import MatchDetails from "../components/MatchDetails";
import { knockoutContext } from "../lib/matchInsights";
import CompetitionSwitch from "../components/CompetitionSwitch";
import FilterPanel, { FilterField } from "../components/FilterPanel";
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
  const competition = competitionCode(params.get("competition"));
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
      <FilterPanel
        title={competitionName(competition)}
        summary={
          filtered.find((m) => m.roundId === selected)
            ? roundLabel(filtered.find((m) => m.roundId === selected)!)
            : "Sin jornadas disponibles"
        }
        competition={competition}
        applyLabel="Ver partidos"
      >
        <CompetitionSwitch
          value={competition}
          onChange={(code) => setParams({ competition: code })}
        />
        <FilterField label="Jornada o ronda">
          <select
            aria-label="Seleccionar jornada o ronda"
            value={selected || ""}
            disabled={!rounds.length}
            onChange={(e) => {
              setParams((previous) => {
                const next = new URLSearchParams(previous);
                next.set("round", e.target.value);
                return next;
              });
            }}
          >
            {rounds.length ? (
              rounds.map((r) => (
                <option key={r} value={r}>
                  {roundLabel(filtered.find((m) => m.roundId === r)!)}
                </option>
              ))
            ) : (
              <option value="">Sin jornadas sincronizadas</option>
            )}
          </select>
        </FilterField>
      </FilterPanel>
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
          key={detail.id}
          match={detail}
          matches={matches}
          demo={demo}
          onClose={() => setDetailId("")}
        />
      )}
    </>
  );
}
