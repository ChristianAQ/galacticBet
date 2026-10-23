import { roundLabelFromId, type Match } from "./domain";
import type { Participant } from "./data";

export interface RankingTotal {
  points: number;
  hits: number;
}
export interface SeasonRanking {
  id: string;
  competition: string;
  standings: {
    id: string;
    points: number;
    hits: number;
    rounds: Record<string, RankingTotal>;
  }[];
}
export interface RankingRow extends Participant, RankingTotal {
  position: number;
}

// Only backend totals contribute points. The roster supplies names and zero rows.
export function buildRanking(
  participants: Participant[],
  seasons: SeasonRanking[],
  scope: string,
  roundId = "",
): RankingRow[] {
  const totals = new Map(
    participants.map((p) => [p.id, { ...p, points: 0, hits: 0 }]),
  );
  for (const season of seasons) {
    if (scope !== "global" && scope !== season.competition) continue;
    for (const standing of season.standings) {
      const row = totals.get(standing.id);
      const value = roundId ? standing.rounds[roundId] : standing;
      if (!row || !value) continue;
      row.points += value.points;
      row.hits += value.hits;
    }
  }
  const sorted = [...totals.values()].sort(
    (a, b) =>
      b.points - a.points ||
      a.name.localeCompare(b.name, "es") ||
      a.id.localeCompare(b.id),
  );
  let position = 1;
  return sorted.map((row, index) => {
    if (index && row.points !== sorted[index - 1].points) position = index + 1;
    return { ...row, position };
  });
}

export function rankingRounds(
  seasons: SeasonRanking[],
  matches: Match[],
  scope: string,
) {
  const active = seasons.filter(
    (s) => scope === "global" || s.competition === scope,
  );
  const seasonIds = new Set(active.map((s) => s.id));
  const rounds = new Map<
    string,
    { id: string; label: string; kickoff: string }
  >();
  function add(id: string, kickoff = "") {
    const [competition, year] = id.split("-");
    const previous = rounds.get(id);
    rounds.set(id, {
      id,
      label: `${competition === "PD" ? "LaLiga" : "Champions"} · ${roundLabelFromId(id)} · ${year}/${String(Number(year) + 1).slice(-2)}`,
      kickoff:
        previous?.kickoff && (!kickoff || previous.kickoff < kickoff)
          ? previous.kickoff
          : kickoff,
    });
  }
  for (const season of active)
    for (const row of season.standings)
      for (const id of Object.keys(row.rounds)) add(id);
  for (const match of matches)
    if (
      seasonIds.has(match.seasonId) &&
      active.some(
        (s) => s.id === match.seasonId && s.competition === match.competition,
      )
    )
      add(match.roundId, match.utcDate);
  return [...rounds.values()].sort(
    (a, b) =>
      (a.kickoff || "9999").localeCompare(b.kickoff || "9999") ||
      a.id.localeCompare(b.id, "es", { numeric: true }),
  );
}
